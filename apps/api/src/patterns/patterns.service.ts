import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

export interface CreatePatternReportDto {
  company: string;
  field:
    | 'numQuestions'
    | 'timeLimit'
    | 'sectionWeights'
    | 'negativeMarking'
    | 'calculatorAllowed'
    | 'subsections'
    | string;
  claim: Record<string, unknown>;
  assessmentId?: string;
}

const ALLOWED_STRUCTURAL_FIELDS = new Set([
  'numquestions',
  'timelimit',
  'sectionweights',
  'negativemarking',
  'calculatorallowed',
  'subsections',
  'interfacetype',
  'markingpolicy',
]);

const QUESTION_CONTENT_PATTERNS = [
  /\b(what is|which of the following|find the value|calculate|evaluate|solve|if a train|if x =|suppose that)\b/i,
  /\b[A-D]\s*[\)\.\:]\s+[a-zA-Z0-9]/i, // Option markers e.g. "A) 42" or "B. None"
  /\b(answer is|option [a-d]|correct choice)\b/i,
];

@Injectable()
export class PatternsService {
  constructor(private readonly prisma: PrismaService) {}

  private validateStructureOnly(claim: unknown, field: string) {
    const claimStr = JSON.stringify(claim);

    // Structural field check
    if (!ALLOWED_STRUCTURAL_FIELDS.has(field.toLowerCase().replace(/[-_]/g, ''))) {
      throw new UnprocessableEntityException(
        `Field '${field}' is not an allowed structural attribute. Allowed: numQuestions, timeLimit, sectionWeights, negativeMarking, calculatorAllowed, subsections`,
      );
    }

    // Check if free text question content was included
    for (const pattern of QUESTION_CONTENT_PATTERNS) {
      if (pattern.test(claimStr)) {
        throw new UnprocessableEntityException(
          'Structure only; free-text question content rejected (FR-025, E-092)',
        );
      }
    }

    // Length check: structural claims should be succinct
    if (claimStr.length > 1000) {
      throw new UnprocessableEntityException(
        'Structure only; claim payload exceeds allowable size for blueprint structure',
      );
    }
  }

  async createPatternReport(userId: string, dto: CreatePatternReportDto) {
    if (!dto.company || typeof dto.company !== 'string') {
      throw new UnprocessableEntityException('company name is required');
    }
    if (!dto.field || typeof dto.field !== 'string') {
      throw new UnprocessableEntityException('field name is required');
    }
    if (!dto.claim || typeof dto.claim !== 'object') {
      throw new UnprocessableEntityException('claim must be a structured JSON object');
    }

    this.validateStructureOnly(dto.claim, dto.field);

    return this.prisma.patternReport.create({
      data: {
        userId,
        company: dto.company.trim(),
        field: dto.field.trim(),
        claim: dto.claim as Prisma.InputJsonValue,
        assessmentId: dto.assessmentId ?? null,
        status: 'pending',
        weight: 1.0,
      },
    });
  }

  async listPatternReports(company?: string, status?: string) {
    const where: Record<string, unknown> = {};
    if (company) where.company = { contains: company, mode: 'insensitive' };
    if (status) where.status = status;

    return this.prisma.patternReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true } },
      },
    });
  }

  async reviewPatternReport(id: string, status: 'approved' | 'rejected') {
    const report = await this.prisma.patternReport.findUnique({ where: { id } });
    if (!report) {
      throw new NotFoundException(`Pattern report with id ${id} not found`);
    }

    return this.prisma.patternReport.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
      },
    });
  }

  async listDriftAlerts(company?: string, status?: string) {
    const where: Record<string, unknown> = {};
    if (company) where.company = { contains: company, mode: 'insensitive' };
    if (status) where.status = status;

    return this.prisma.patternDriftAlert.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
    });
  }

  async createDriftAlert(dto: {
    company: string;
    section: string;
    topicId?: string;
    oldWeight: number;
    newWeight: number;
    severity?: 'low' | 'medium' | 'high';
    notes?: string;
  }) {
    return this.prisma.patternDriftAlert.create({
      data: {
        company: dto.company.trim(),
        section: dto.section.trim(),
        topicId: dto.topicId ?? null,
        oldWeight: Number(dto.oldWeight),
        newWeight: Number(dto.newWeight),
        severity: dto.severity ?? 'medium',
        status: 'open',
        notes: dto.notes ?? null,
      },
    });
  }

  async resolveDriftAlert(id: string, resolution: 'resolved' | 'dismissed', notes?: string) {
    const alert = await this.prisma.patternDriftAlert.findUnique({ where: { id } });
    if (!alert) {
      throw new NotFoundException(`Drift alert with id ${id} not found`);
    }

    return this.prisma.patternDriftAlert.update({
      where: { id },
      data: {
        status: resolution,
        notes: notes ? `${alert.notes ? alert.notes + ' | ' : ''}${notes}` : alert.notes,
      },
    });
  }
}
