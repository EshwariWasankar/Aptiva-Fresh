import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

export interface CreateExternalScoreDto {
  source: string;
  assessmentName: string;
  takenAt: string;
  totalScore: number;
  maxScore: number;
  percentile?: number | null;
  sectionScores?: Record<string, number> | null;
  notes?: string | null;
  reliability?: number;
}

@Injectable()
export class ExternalScoresService {
  constructor(private readonly prisma: PrismaService) {}

  async listScores(userId: string) {
    return this.prisma.externalScore.findMany({
      where: { userId },
      orderBy: { takenAt: 'desc' },
    });
  }

  async createScore(userId: string, dto: CreateExternalScoreDto) {
    if (!dto.source || typeof dto.source !== 'string') {
      throw new UnprocessableEntityException('source is required');
    }
    if (!dto.assessmentName || typeof dto.assessmentName !== 'string') {
      throw new UnprocessableEntityException('assessmentName is required');
    }
    if (!dto.takenAt) {
      throw new UnprocessableEntityException('takenAt date is required');
    }
    if (dto.totalScore == null || isNaN(dto.totalScore) || dto.totalScore < 0) {
      throw new UnprocessableEntityException('totalScore must be a non-negative number');
    }
    if (!dto.maxScore || isNaN(dto.maxScore) || dto.maxScore <= 0) {
      throw new UnprocessableEntityException('maxScore must be a positive number');
    }
    if (dto.totalScore > dto.maxScore) {
      throw new UnprocessableEntityException('totalScore cannot exceed maxScore');
    }

    const takenAtDate = new Date(dto.takenAt);
    if (isNaN(takenAtDate.getTime())) {
      throw new UnprocessableEntityException('Invalid takenAt date format');
    }

    return this.prisma.externalScore.create({
      data: {
        userId,
        source: dto.source.trim(),
        assessmentName: dto.assessmentName.trim(),
        takenAt: takenAtDate,
        totalScore: Number(dto.totalScore),
        maxScore: Number(dto.maxScore),
        percentile: dto.percentile != null ? Number(dto.percentile) : null,
        sectionScores: dto.sectionScores
          ? (dto.sectionScores as Record<string, number>)
          : undefined,
        reliability: dto.reliability != null ? Number(dto.reliability) : 0.8,
        notes: dto.notes ? dto.notes.trim() : null,
      },
    });
  }

  async parseAndUploadCsv(userId: string, csvContent: string) {
    if (!csvContent || typeof csvContent !== 'string') {
      throw new BadRequestException('CSV content string is required');
    }

    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV must contain at least a header and one data row');
    }

    const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
    const sourceIdx = header.indexOf('source');
    const nameIdx = header.findIndex((h) => h.includes('assessment') || h.includes('name'));
    const dateIdx = header.findIndex((h) => h.includes('date') || h.includes('taken'));
    const scoreIdx = header.findIndex((h) => h.includes('total') || h.includes('score'));
    const maxIdx = header.findIndex((h) => h.includes('max'));
    const percIdx = header.findIndex((h) => h.includes('percentile'));
    const notesIdx = header.findIndex((h) => h.includes('note'));

    if (sourceIdx === -1 || nameIdx === -1 || dateIdx === -1 || scoreIdx === -1) {
      throw new BadRequestException(
        'CSV header must include: source, assessmentName, takenAt, totalScore (optional: maxScore, percentile, notes)',
      );
    }

    const created: unknown[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i]!.split(',').map((c) => c.trim());
      if (row.length < 4) continue;

      const source = row[sourceIdx] || 'CSV Import';
      const assessmentName = row[nameIdx] || 'External Mock';
      const takenAtStr = row[dateIdx] || new Date().toISOString().slice(0, 10);
      const totalScore = parseFloat(row[scoreIdx] || '0');
      const maxScore = maxIdx !== -1 && row[maxIdx] ? parseFloat(row[maxIdx]!) : 100;
      const percentile = percIdx !== -1 && row[percIdx] ? parseFloat(row[percIdx]!) : null;
      const notes = notesIdx !== -1 ? row[notesIdx] : null;

      const takenAt = new Date(takenAtStr);
      if (isNaN(takenAt.getTime()) || isNaN(totalScore) || isNaN(maxScore)) {
        errors.push(`Row ${i + 1}: Invalid date or score values`);
        continue;
      }

      const record = await this.prisma.externalScore.create({
        data: {
          userId,
          source,
          assessmentName,
          takenAt,
          totalScore,
          maxScore,
          percentile,
          reliability: 0.85,
          notes: notes || null,
        },
      });
      created.push(record);
    }

    return {
      uploadedCount: created.length,
      errorsCount: errors.length,
      errors,
      records: created,
    };
  }

  async deleteScore(userId: string, id: string) {
    const score = await this.prisma.externalScore.findUnique({
      where: { id },
    });

    if (!score) {
      throw new NotFoundException(`External score with id ${id} not found`);
    }

    if (score.userId !== userId) {
      throw new ForbiddenException('Cannot delete external score belonging to another user');
    }

    await this.prisma.externalScore.delete({
      where: { id },
    });

    return { success: true, deletedId: id };
  }
}
