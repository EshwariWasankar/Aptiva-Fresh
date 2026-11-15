import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ENV, type Env } from '../common/config/env';
import { randomToken, safeEqual, sha256Hex } from '../common/crypto';
import { AuditService } from '../common/audit/audit.service';
import { MailerService } from '../common/mail/mailer.service';
import { RedisService } from '../common/redis/redis.service';
import { PasswordPolicyError, PasswordService } from './password.service';
import { TokenService } from './token.service';
import type { LoginDto, RegisterDto } from './dto';
import type { PublicUser } from './dto';

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const OTP_TTL_SECONDS = 300; // 5 minutes
const OTP_COOLDOWN_SECONDS = 60; // 60 seconds
const OTP_MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL_SECONDS = 600; // 10 minutes

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  // ------------------------------------------------------------- E-001

  async register(dto: RegisterDto): Promise<IssuedSession> {
    try {
      await this.password.assertAcceptable(dto.password);
    } catch (err) {
      if (err instanceof PasswordPolicyError) {
        throw new BadRequestException({ code: 'VALIDATION_FAILED', message: err.message });
      }
      throw err;
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'An account with this email already exists',
      });
    }

    const passwordHash = await this.password.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'student',
        profile: {
          create: {
            gradYear: dto.gradYear ?? null,
            branch: dto.branch ?? null,
            college: dto.college ?? null,
          },
        },
        consents: {
          create: {
            noticeVersion: dto.consentVersion,
            purpose: 'core',
            granted: true,
          },
        },
      },
    });

    await this.sendEmailVerification(user.id, email);
    await this.audit.record({
      actorId: user.id,
      action: 'auth.register',
      objectType: 'user',
      objectId: user.id,
    });

    return this.issueSession(user.id);
  }

  // ------------------------------------------------------------- E-002

  async login(dto: LoginDto): Promise<IssuedSession> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Generic failure — never reveal whether the email exists.
    const invalid = () =>
      new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Invalid credentials' });

    if (!user || !user.passwordHash) throw invalid();
    const ok = await this.password.verify(user.passwordHash, dto.password);
    if (!ok) {
      await this.audit.record({
        action: 'auth.login_failed',
        objectType: 'user',
        objectId: user.id,
      });
      throw invalid();
    }
    await this.audit.record({
      actorId: user.id,
      action: 'auth.login',
      objectType: 'user',
      objectId: user.id,
    });
    return this.issueSession(user.id);
  }

  // ------------------------------------------------- E-003 / E-004

  async refresh(rawToken: string | undefined): Promise<IssuedSession> {
    if (!rawToken) throw this.unauthenticated();
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
      include: { user: true },
    });
    if (!record) throw this.unauthenticated();

    if (record.revokedAt !== null) {
      // Reuse of a rotated/revoked token: compromise signal — kill the family.
      await this.revokeFamily(record.familyId);
      await this.audit.record({
        actorId: record.userId,
        action: 'auth.refresh_reuse_detected',
        objectType: 'refresh_token_family',
        objectId: record.familyId,
      });
      throw this.unauthenticated();
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw this.unauthenticated();
    }

    // Rotate: revoke the presented token and issue a new one in the same
    // family, atomically — a lost race means the token was already rotated.
    const refreshToken = await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (revoked.count === 0) throw this.unauthenticated();
      return this.rotate(record.familyId, record.userId, tx);
    });
    return {
      accessToken: this.tokens.signAccessToken({
        id: record.user.id,
        role: record.user.role,
        email: record.user.email,
      }),
      refreshToken,
      user: this.toPublicUser(record.user),
    };
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256Hex(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ------------------------------------------------------------- E-006

  async verifyEmail(rawToken: string): Promise<void> {
    const record = await this.consumeAuthToken(rawToken, 'email_verify');
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() },
    });
    await this.audit.record({
      actorId: record.userId,
      action: 'auth.email_verified',
      objectType: 'user',
      objectId: record.userId,
    });
  }

  async requestPasswordReset(emailRaw: string): Promise<void> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always succeed silently — never reveal whether the email exists.
    if (!user) return;

    const raw = randomToken(32);
    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        purpose: 'password_reset',
        tokenHash: sha256Hex(raw),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    });
    const link = `${this.env.WEB_BASE_URL}/reset-password?token=${raw}`;
    await this.mailer.send({
      to: email,
      subject: 'Reset your Aptiva password',
      text: `Reset your password: ${link}\nThis link expires in 1 hour.`,
    });
    await this.audit.record({
      actorId: user.id,
      action: 'auth.password_reset_requested',
      objectType: 'user',
      objectId: user.id,
    });
  }

  async confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
    try {
      await this.password.assertAcceptable(newPassword);
    } catch (err) {
      if (err instanceof PasswordPolicyError) {
        throw new BadRequestException({ code: 'VALIDATION_FAILED', message: err.message });
      }
      throw err;
    }
    const record = await this.consumeAuthToken(rawToken, 'password_reset');
    const passwordHash = await this.password.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      // Reset invalidates every existing session.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.record({
      actorId: record.userId,
      action: 'auth.password_reset_confirmed',
      objectType: 'user',
      objectId: record.userId,
    });
  }

  // ------------------------------------------------------------- OTP Password Reset

  async requestPasswordResetOtp(
    rawEmail: string,
  ): Promise<{ success: boolean; message: string; cooldownSeconds: number }> {
    const email = rawEmail.trim().toLowerCase();

    // Verify email service configuration upfront so we never return a fake success when unconfigured
    if (
      !this.mailer.isConfigured() &&
      this.env.NODE_ENV !== 'test' &&
      process.env.ALLOW_CONSOLE_MAIL !== 'true'
    ) {
      throw new BadRequestException({
        code: 'EMAIL_DELIVERY_FAILED',
        message:
          'Email delivery service is not configured on the server. Please configure SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM) or EMAIL_API_KEY in apps/api/.env.',
      });
    }

    const cooldownKey = `aptiva:otp:cooldown:${email}`;
    const ttlRemaining = await this.redis.client.ttl(cooldownKey);
    if (ttlRemaining > 0) {
      throw new BadRequestException({
        code: 'COOLDOWN_ACTIVE',
        message: `Please wait ${ttlRemaining} second${ttlRemaining === 1 ? '' : 's'} before requesting a new code.`,
        details: { retryAfterSeconds: ttlRemaining },
      });
    }

    const user = await this.prisma.user.findUnique({ where: { email } });

    // Anti-enumeration: Generic response regardless of whether account exists.
    const genericResponse = {
      success: true,
      message: 'If an account matches that email, a 6-digit verification code has been sent.',
      cooldownSeconds: OTP_COOLDOWN_SECONDS,
    };

    if (!user) {
      // Set cooldown key to maintain identical timing/rate limits for non-existent emails
      await this.redis.client.setex(cooldownKey, OTP_COOLDOWN_SECONDS, '1');
      return genericResponse;
    }

    // Invalidate any previously issued OTP for this email
    const otpKey = `aptiva:otp:${email}`;
    await this.redis.client.del(otpKey);

    // Generate cryptographically secure 6-digit OTP
    const otp = randomInt(100_000, 1_000_000).toString();

    // Securely hash OTP before storing in Redis (with server secret + email salt)
    const salt = this.env.JWT_ACCESS_SECRET || 'aptiva-otp-salt';
    const otpHashed = sha256Hex(`${otp}:${salt}:${email}`);

    const payload = {
      userId: user.id,
      email,
      otpHashed,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      createdAt: Date.now(),
    };

    // Store hashed OTP with 5-minute TTL
    await this.redis.client.setex(otpKey, OTP_TTL_SECONDS, JSON.stringify(payload));
    // Set 60-second cooldown
    await this.redis.client.setex(cooldownKey, OTP_COOLDOWN_SECONDS, '1');

    // Deliver OTP via MailerService
    try {
      await this.mailer.send({
        to: email,
        subject: 'Your Aptiva Password Reset Code',
        text: `Your 6-digit verification code is: ${otp}\n\nThis code expires in 5 minutes. If you did not request this, please ignore this email.`,
      });
    } catch (err: unknown) {
      // Wipe OTP and cooldown from Redis so an undelivered OTP cannot be guessed or block the user
      await this.redis.client.del(otpKey);
      await this.redis.client.del(cooldownKey);
      const messageText = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to deliver OTP email to ${email}: ${messageText}`);
      throw new BadRequestException({
        code: 'EMAIL_DELIVERY_FAILED',
        message: messageText.includes('EMAIL_SERVICE_NOT_CONFIGURED')
          ? 'Email delivery service is not configured on the server. Please configure SMTP credentials (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM) or EMAIL_API_KEY in apps/api/.env.'
          : `Email delivery failed: ${messageText}`,
      });
    }

    await this.audit.record({
      actorId: user.id,
      action: 'auth.password_reset_otp_requested',
      objectType: 'user',
      objectId: user.id,
    });

    return genericResponse;
  }

  async verifyPasswordResetOtp(
    rawEmail: string,
    otp: string,
  ): Promise<{ success: boolean; resetToken: string }> {
    const email = rawEmail.trim().toLowerCase();
    const otpKey = `aptiva:otp:${email}`;
    const raw = await this.redis.client.get(otpKey);

    if (!raw) {
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message:
          'The verification code has expired or was not requested. Please request a new code.',
      });
    }

    let record: {
      userId: string;
      email: string;
      otpHashed: string;
      attempts: number;
      maxAttempts: number;
    };

    try {
      record = JSON.parse(raw);
    } catch {
      await this.redis.client.del(otpKey);
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'Invalid verification session. Please request a new code.',
      });
    }

    if (record.attempts >= record.maxAttempts) {
      await this.redis.client.del(otpKey);
      throw new BadRequestException({
        code: 'MAX_ATTEMPTS_EXCEEDED',
        message: 'Maximum verification attempts exceeded. Please request a new code.',
      });
    }

    const salt = this.env.JWT_ACCESS_SECRET || 'aptiva-otp-salt';
    const candidateHash = sha256Hex(`${otp}:${salt}:${email}`);

    if (!safeEqual(candidateHash, record.otpHashed)) {
      record.attempts += 1;
      const remaining = record.maxAttempts - record.attempts;
      if (remaining <= 0) {
        await this.redis.client.del(otpKey);
        throw new BadRequestException({
          code: 'MAX_ATTEMPTS_EXCEEDED',
          message: 'Maximum verification attempts exceeded. Please request a new code.',
        });
      }
      const currentTtl = await this.redis.client.ttl(otpKey);
      if (currentTtl > 0) {
        await this.redis.client.setex(otpKey, currentTtl, JSON.stringify(record));
      }
      throw new BadRequestException({
        code: 'INVALID_OTP',
        message: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        details: { remainingAttempts: remaining },
      });
    }

    // Verification succeeded: immediately invalidate the OTP (single use)
    await this.redis.client.del(otpKey);

    // Issue a short-lived, single-use password-reset authorization token
    const resetToken = randomToken(32);
    const resetTokenHash = sha256Hex(resetToken);
    const resetKey = `aptiva:reset-token:${resetTokenHash}`;

    await this.redis.client.setex(
      resetKey,
      RESET_TOKEN_TTL_SECONDS,
      JSON.stringify({ userId: record.userId, email }),
    );

    return {
      success: true,
      resetToken,
    };
  }

  async confirmPasswordResetWithOtp(resetToken: string, newPassword: string): Promise<void> {
    try {
      await this.password.assertAcceptable(newPassword);
    } catch (err) {
      if (err instanceof PasswordPolicyError) {
        throw new BadRequestException({ code: 'VALIDATION_FAILED', message: err.message });
      }
      throw err;
    }

    const resetTokenHash = sha256Hex(resetToken);
    const resetKey = `aptiva:reset-token:${resetTokenHash}`;
    const raw = await this.redis.client.get(resetKey);

    if (!raw) {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message:
          'Reset authorization has expired or is invalid. Please restart the verification process.',
      });
    }

    // Immediately consume the authorization token (single use)
    await this.redis.client.del(resetKey);

    let data: { userId: string; email: string };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message: 'Invalid reset authorization.',
      });
    }

    const passwordHash = await this.password.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: data.userId },
        data: { passwordHash },
      }),
      // Invalidate every existing session and refresh token
      this.prisma.refreshToken.updateMany({
        where: { userId: data.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      actorId: data.userId,
      action: 'auth.password_reset_confirmed',
      objectType: 'user',
      objectId: data.userId,
      details: { method: 'otp' },
    });
  }

  // ------------------------------------------------------------- Google

  /** Called by GoogleOAuthService after a successful upsert. */
  async issueSessionForGoogleUser(userId: string): Promise<IssuedSession> {
    return this.issueSession(userId);
  }

  // ------------------------------------------------------------- helpers

  private async issueSession(userId: string): Promise<IssuedSession> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const refreshToken = await this.rotate(randomUUID(), userId);
    return {
      accessToken: this.tokens.signAccessToken({
        id: user.id,
        role: user.role,
        email: user.email,
      }),
      refreshToken,
      user: this.toPublicUser(user),
    };
  }

  private async rotate(
    familyId: string,
    userId: string,
    db: Prisma.TransactionClient = this.prisma,
  ): Promise<string> {
    const raw = randomToken(32);
    await db.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: sha256Hex(raw),
        expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      },
    });
    return raw;
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async consumeAuthToken(
    rawToken: string,
    purpose: 'email_verify' | 'password_reset',
  ): Promise<{ userId: string }> {
    const record = await this.prisma.authToken.findUnique({
      where: { tokenHash: sha256Hex(rawToken) },
    });
    if (!record || record.purpose !== purpose) {
      throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'Invalid token' });
    }
    if (record.usedAt !== null) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Token has already been used',
      });
    }
    if (record.expiresAt.getTime() <= Date.now()) {
      throw new GoneException({ code: 'TOKEN_EXPIRED', message: 'Token has expired' });
    }
    await this.prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return { userId: record.userId };
  }

  private async sendEmailVerification(userId: string, email: string): Promise<void> {
    const raw = randomToken(32);
    await this.prisma.authToken.create({
      data: {
        userId,
        purpose: 'email_verify',
        tokenHash: sha256Hex(raw),
        expiresAt: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      },
    });
    const link = `${this.env.WEB_BASE_URL}/verify-email?token=${raw}`;
    await this.mailer.send({
      to: email,
      subject: 'Verify your Aptiva email',
      text: `Verify your email address: ${link}\nThis link expires in 24 hours.`,
    });
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    role: string;
    emailVerifiedAt: Date | null;
  }): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerifiedAt !== null,
    };
  }

  private unauthenticated(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'UNAUTHENTICATED',
      message: 'Invalid or expired session',
    });
  }

  /** Used by tests: constant-time check helper re-export. */
  static tokensEqual(a: string, b: string): boolean {
    return safeEqual(a, b);
  }
}
