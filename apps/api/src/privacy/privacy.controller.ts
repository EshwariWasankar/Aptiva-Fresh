import { Body, Controller, Delete, Get, Headers, HttpCode, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../common/guards/auth.guard';
import { parseBody } from '../common/http/zod';
import { PrivacyService } from './privacy.service';

const ReauthBody = z.object({ password: z.string().min(1).max(200).optional() });
const ConsentsBody = z.object({
  consents: z
    .array(z.object({ purpose: z.string().min(1).max(50), granted: z.boolean() }))
    .min(1)
    .max(10),
});

/** E-070/71/72 — data export, deletion, consent withdrawal (PH10-T01). */
@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('data-export')
  export(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
    @Headers('x-reauth-password') headerPassword?: string,
  ) {
    // GET bodies are unreliable across clients — accept the re-auth
    // password via header or JSON body.
    const parsed =
      body === undefined || body === null || body === ''
        ? { password: headerPassword }
        : parseBody(ReauthBody, body);
    return this.privacy.exportData(user.id, parsed.password ?? headerPassword);
  }

  @Delete()
  @HttpCode(202)
  remove(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
    @Headers('x-reauth-password') headerPassword?: string,
  ) {
    const parsed =
      body === undefined || body === null || body === ''
        ? { password: headerPassword }
        : parseBody(ReauthBody, body);
    return this.privacy.requestDeletion(user.id, parsed.password ?? headerPassword);
  }

  @Put('consents')
  consents(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    return this.privacy.updateConsents(user.id, parseBody(ConsentsBody, body).consents);
  }
}
