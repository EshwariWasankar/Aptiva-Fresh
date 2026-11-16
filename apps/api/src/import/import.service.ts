import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  fetchGitHubRepo,
  parseDs01File,
  parseDs11File,
  parseDs12Bank,
  parseGsm8k,
  runQuestionPipeline,
  DS01_PARSER_VERSION,
  DS11_PARSER_VERSION,
  DS12_PARSER_VERSION,
  DSM8K_PARSER_VERSION,
  type MapperInput,
  type ParsedItem,
} from '@aptiva/ingest';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { sanitizeContent, stemHash } from '../common/sanitize';
import type { ImportRunDto } from './dto';

const DS01_REPO = 'drsarveshwarbharti/Aptitude-For-Placements';
const DS11_REPO = 'atmamoon/ultimate-aptitude';
const DS12_REPO = 'jidvish/aptitude-test-platform-public';
const GSM8K_DATASET = 'openai/gsm8k';
const HF_ROWS_BASE = 'https://datasets-server.huggingface.co';

interface SourceSpec {
  sourceName: string;
  parserVersion: string;
}

const SOURCES: Record<ImportRunDto['source'], SourceSpec> = {
  'ds-01': { sourceName: 'DS-01 Aptitude-For-Placements', parserVersion: DS01_PARSER_VERSION },
  'ds-03': { sourceName: 'DS-03 GSM8K', parserVersion: DSM8K_PARSER_VERSION },
  'ds-11': { sourceName: 'DS-11 ultimate-aptitude', parserVersion: DS11_PARSER_VERSION },
  'ds-12': { sourceName: 'DS-12 aptitude-test-platform', parserVersion: DS12_PARSER_VERSION },
};

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** E-062 — dry-run report or real import creating draft questions + batch. */
  async runImport(dto: ImportRunDto, actorId: string) {
    const spec = SOURCES[dto.source];
    const { items, fileRejects, sourceRef, filesSeen } = await this.fetchAndParse(dto);

    const mapper = await this.mapperInput();
    const existingHashes = await this.bankHashes();
    const report = runQuestionPipeline(
      items.map((i) => ({ item: i.item, sourcePath: i.sourcePath })),
      {
        sourceName: spec.sourceName,
        sourceRef,
        parserVersion: spec.parserVersion,
        filesSeen,
        existingHashes,
        mapper,
      },
    );
    // File-level parser rejects (missing sections, non-numeric answers)
    // belong in the same dry-run/real report as pipeline rejects.
    report.rejected.push(...fileRejects);

    const summary = {
      dryRun: dto.dryRun,
      source: dto.source,
      sourceRef,
      filesSeen,
      parsed: report.parsed,
      accepted: report.accepted.length,
      rejected: report.rejected.length,
      duplicates: report.duplicates.length,
      unmappedTopics: report.unmappedTopics,
      rejectedSample: report.rejected.slice(0, 50),
      duplicateSample: report.duplicates.slice(0, 50),
    };

    if (dto.dryRun) return summary;

    // ---- Load stage: single transaction, batch row + draft questions ----
    const batch = await this.prisma.$transaction(
      async (tx) => {
        const b = await tx.importBatch.create({
          data: {
            sourceName: spec.sourceName,
            sourceRef,
            parserVersion: spec.parserVersion,
            accepted: report.accepted.length,
            rejected: report.rejected.length,
            duplicates: report.duplicates.length,
            createdBy: actorId,
          },
        });
        const rows = report.accepted.map(({ item }) => this.questionRow(item, b.id));
        for (let i = 0; i < rows.length; i += 500) {
          await tx.question.createMany({ data: rows.slice(i, i + 500) });
        }
        await this.createOptions(tx, b.id, report.accepted);
        return b;
      },
      { timeout: 300_000, maxWait: 15_000 },
    );

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'import.run',
        objectType: 'import_batch',
        objectId: batch.id,
        details: { source: dto.source, accepted: report.accepted.length },
      },
    });
    this.logger.log(
      `import ${dto.source}: batch ${batch.id} accepted=${report.accepted.length} rejected=${report.rejected.length} dup=${report.duplicates.length}`,
    );
    return { ...summary, batchId: batch.id };
  }

  /** Fetch + parse a question source into normalised items. */
  private async fetchAndParse(dto: ImportRunDto): Promise<{
    items: { item: ParsedItem; sourcePath: string }[];
    fileRejects: { sourcePath: string; reason: string; excerpt?: string }[];
    sourceRef: string;
    filesSeen: number;
  }> {
    if (dto.source === 'ds-01') {
      const snap = await fetchGitHubRepo(DS01_REPO, dto.ref ?? 'main');
      const items: { item: ParsedItem; sourcePath: string }[] = [];
      const fileRejects: { sourcePath: string; reason: string; excerpt?: string }[] = [];
      for (const f of snap.files) {
        if (f.path === 'README.md') continue;
        const { items: parsed, rejected } = parseDs01File(f.path, f.content);
        fileRejects.push(...rejected);
        for (const item of parsed) items.push({ item, sourcePath: f.path });
      }
      if (fileRejects.length > 0)
        this.logger.warn(`ds-01: ${fileRejects.length} file-level rejects`);
      return {
        items,
        fileRejects,
        sourceRef: `github:${DS01_REPO}@${snap.commit}`,
        filesSeen: snap.files.length,
      };
    }

    // ds-11 — ultimate-aptitude banks/*.json (MCQ).
    if (dto.source === 'ds-11') {
      const snap = await fetchGitHubRepo(DS11_REPO, dto.ref ?? 'main');
      const items: { item: ParsedItem; sourcePath: string }[] = [];
      const fileRejects: { sourcePath: string; reason: string; excerpt?: string }[] = [];
      for (const f of snap.files) {
        if (!f.path.startsWith('banks/questions-') || !f.path.endsWith('.json')) continue;
        const { items: parsed, rejected } = parseDs11File(f.path, f.content);
        fileRejects.push(...rejected);
        for (const item of parsed) items.push({ item, sourcePath: f.path });
      }
      return {
        items,
        fileRejects,
        sourceRef: `github:${DS11_REPO}@${snap.commit}`,
        filesSeen: snap.files.length,
      };
    }

    // ds-12 — aptitude-test-platform question_bank.json (MCQ).
    if (dto.source === 'ds-12') {
      const snap = await fetchGitHubRepo(DS12_REPO, dto.ref ?? 'main');
      const file = snap.files.find((f) => f.path === 'app/src/question_bank.json');
      if (!file) throw new BadRequestException('question_bank.json not found in repo');
      const { items: parsed, rejected } = parseDs12Bank(file.path, file.content);
      return {
        items: parsed.map((item) => ({ item, sourcePath: file.path })),
        fileRejects: rejected,
        sourceRef: `github:${DS12_REPO}@${snap.commit}`,
        filesSeen: snap.files.length,
      };
    }

    // ds-03 — GSM8K via the HF datasets-server rows API. The upstream repo
    // only ships parquet now (the old main/train.jsonl URL 404s), so we page
    // through /rows and re-emit JSONL for the parser.
    const jsonl = await this.fetchGsm8kJsonl();
    const { items: parsed, rejected } = parseGsm8k(jsonl, 'main/train');
    if (rejected.length > 0) this.logger.warn(`ds-03: ${rejected.length} row rejects`);
    return {
      items: parsed.map((item) => ({ item, sourcePath: 'main/train' })),
      fileRejects: rejected,
      sourceRef: `hf:${GSM8K_DATASET}@main:${HF_ROWS_BASE}/rows`,
      filesSeen: 1,
    };
  }

  /** Page through the HF datasets-server rows API and rebuild GSM8K JSONL.
   *  GSM8K_JSONL_PATH overrides the fetch with a local JSONL file (one
   *  {"question","answer"} object per line) — useful when HF rate-limits. */
  private async fetchGsm8kJsonl(): Promise<string> {
    const localPath = process.env.GSM8K_JSONL_PATH;
    if (localPath) {
      const { readFile } = await import('node:fs/promises');
      return readFile(localPath, 'utf8');
    }
    const sizeUrl = `${HF_ROWS_BASE}/size?dataset=${GSM8K_DATASET}&config=main&split=train`;
    const sizeRes = await fetch(sizeUrl);
    if (!sizeRes.ok) throw new BadRequestException(`GSM8K size fetch failed: ${sizeRes.status}`);
    const sizeBody = (await sizeRes.json()) as {
      size?: { splits?: { split?: string; num_rows?: number }[] };
    };
    const numRows = sizeBody.size?.splits?.find((s) => s.split === 'train')?.num_rows ?? 0;
    if (numRows <= 0) throw new BadRequestException('GSM8K dataset reported 0 rows');

    const PAGE = 100;
    const pages = Math.ceil(numRows / PAGE);
    const lines: string[] = [];
    const CONCURRENCY = 2;
    const fetchPage = async (page: number): Promise<string[]> => {
      const offset = page * PAGE;
      const url =
        `${HF_ROWS_BASE}/rows?dataset=${GSM8K_DATASET}&config=main&split=train` +
        `&offset=${offset}&length=${PAGE}`;
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(url);
        if (res.ok) {
          const body = (await res.json()) as {
            rows?: { row?: { question?: unknown; answer?: unknown } }[];
          };
          return (body.rows ?? [])
            .map((r) => r.row)
            .filter((r): r is { question: string; answer: string } =>
              Boolean(r && typeof r.question === 'string' && typeof r.answer === 'string'),
            )
            .map((r) => JSON.stringify({ question: r.question, answer: r.answer }));
        }
        if (res.status !== 429 && res.status < 500) {
          throw new BadRequestException(`GSM8K rows fetch failed: ${res.status}`);
        }
        const retryAfter = Number(res.headers.get('retry-after'));
        const waitMs =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
        await new Promise((r) => setTimeout(r, waitMs));
      }
      throw new BadRequestException('GSM8K rows fetch failed: rate limited');
    };
    for (let start = 0; start < pages; start += CONCURRENCY) {
      const batch = Array.from(
        { length: Math.min(CONCURRENCY, pages - start) },
        (_, i) => start + i,
      );
      const results = await Promise.all(batch.map(fetchPage));
      for (const part of results) lines.push(...part);
    }
    return lines.join('\n');
  }

  /** Persist MCQ options for accepted rows (createMany can't nest). */
  private async createOptions(
    tx: Prisma.TransactionClient,
    batchId: string,
    accepted: { item: ParsedItem & { topicId?: string | null }; stemHash: string }[],
  ): Promise<void> {
    const mcq = accepted.filter(
      (a) => a.item.format === 'mcq' && (a.item.options?.length ?? 0) > 0,
    );
    if (mcq.length === 0) return;
    const created = await tx.question.findMany({
      where: { importBatchId: batchId, format: 'mcq' },
      select: { id: true, stemHash: true },
    });
    const byHash = new Map(created.map((q) => [q.stemHash, q.id]));
    const rows: Prisma.QuestionOptionCreateManyInput[] = [];
    for (const { item } of mcq) {
      const questionId = byHash.get(stemHash(sanitizeContent(item.stem)));
      if (!questionId) continue;
      (item.options ?? []).forEach((o, i) => {
        rows.push({
          questionId,
          text: sanitizeContent(o.text),
          isCorrect: o.isCorrect,
          trapTag: o.trapTag ?? null,
          orderNo: i,
        });
      });
    }
    for (let i = 0; i < rows.length; i += 500) {
      await tx.questionOption.createMany({ data: rows.slice(i, i + 500) });
    }
  }

  private questionRow(item: ParsedItem & { topicId?: string | null }, batchId: string) {
    const stem = sanitizeContent(item.stem);
    return {
      topicId: item.topicId!,
      format: item.format,
      stem,
      solution: item.solution != null ? sanitizeContent(item.solution) : null,
      difficultyPrior: item.difficultyPrior,
      expectedTimeMs: item.expectedTimeMs,
      language: 'en',
      numericAnswer: item.numericAnswer != null ? String(item.numericAnswer) : null,
      answerFormat: item.answerFormat ?? null,
      decimalPlaces: item.decimalPlaces ?? null,
      tolerance: item.tolerance != null ? String(item.tolerance) : null,
      pool: item.pool,
      status: 'draft',
      sourceName: item.sourceName,
      author: `import:${item.parserVersion}`,
      importBatchId: batchId,
      stemHash: stemHash(stem),
    } satisfies Prisma.QuestionCreateManyInput;
  }

  private async mapperInput(): Promise<MapperInput> {
    const [synonyms, topics] = await Promise.all([
      this.prisma.topicSynonym.findMany(),
      this.prisma.topic.findMany({ select: { id: true, slug: true, name: true } }),
    ]);
    return {
      synonyms: new Map(synonyms.map((s) => [s.phrase, s.topicId])),
      topics,
    };
  }

  private async bankHashes(): Promise<Set<string>> {
    const rows = await this.prisma.question.findMany({
      where: { status: { not: 'retired' } },
      select: { stemHash: true },
    });
    return new Set(rows.map((r) => r.stemHash));
  }

  // ------------------------------------------------ E-063 batches

  async listBatches() {
    const batches = await this.prisma.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { questions: true } } },
    });
    return batches.map((b) => ({
      id: b.id,
      sourceName: b.sourceName,
      sourceRef: b.sourceRef,
      parserVersion: b.parserVersion,
      accepted: b.accepted,
      rejected: b.rejected,
      duplicates: b.duplicates,
      createdBy: b.createdBy,
      reversedAt: b.reversedAt,
      createdAt: b.createdAt,
      questionCount: b._count.questions,
    }));
  }

  /** E-063 — reverse a batch: delete its draft questions, then the batch. */
  async reverseBatch(id: string, actorId: string) {
    const batch = await this.prisma.importBatch.findUnique({ where: { id } });
    if (!batch)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Import batch not found' });
    if (batch.reversedAt) {
      throw new BadRequestException({ code: 'CONFLICT', message: 'Batch already reversed' });
    }
    const reviewed = await this.prisma.question.count({
      where: { importBatchId: id, status: { not: 'draft' } },
    });
    if (reviewed > 0) {
      throw new BadRequestException({
        code: 'CONFLICT',
        message: `Batch has ${reviewed} reviewed/published questions — retire them first`,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.question.deleteMany({ where: { importBatchId: id } });
      await tx.importBatch.delete({ where: { id } });
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'import.reverse',
        objectType: 'import_batch',
        objectId: id,
      },
    });
  }

  // ------------------------------------------------ PH3-T06 coverage

  /** Coverage report: published+reviewed items per topic × band × pool. */
  async coverageReport() {
    const rows = await this.prisma.question.groupBy({
      by: ['topicId', 'difficultyPrior', 'pool', 'status'],
      where: { status: { in: ['reviewed', 'published'] } },
      _count: { _all: true },
    });
    const topics = await this.prisma.topic.findMany({
      select: { id: true, slug: true, name: true, level: true },
    });
    const topicMap = new Map(topics.map((t) => [t.id, t]));
    const THRESHOLD = 8;
    const cells = rows.map((r) => {
      const topic = topicMap.get(r.topicId);
      const count = r._count._all;
      return {
        topic: topic
          ? { slug: topic.slug, name: topic.name, level: topic.level }
          : { slug: r.topicId, name: '?', level: '?' },
        difficultyBand: r.difficultyPrior,
        pool: r.pool,
        status: r.status,
        count,
        belowThreshold: count < THRESHOLD,
      };
    });
    // Aggregate per topic×band×pool across statuses for the headline view.
    const agg = new Map<string, number>();
    for (const c of cells) {
      const k = `${c.topic.slug}|${c.difficultyBand}|${c.pool}`;
      agg.set(k, (agg.get(k) ?? 0) + c.count);
    }
    const belowThreshold = [...agg.entries()]
      .filter(([, n]) => n < THRESHOLD)
      .map(([k, n]) => {
        const [topic, band, pool] = k.split('|');
        return { topic, difficultyBand: Number(band), pool, count: n, threshold: THRESHOLD };
      })
      .sort((a, b) => a.count - b.count);
    return {
      threshold: THRESHOLD,
      target: '8–10 reviewed items per topic-difficulty cell (PH3-T06)',
      cells,
      belowThreshold,
      totals: {
        reviewed: cells.filter((c) => c.status === 'reviewed').reduce((a, c) => a + c.count, 0),
        published: cells.filter((c) => c.status === 'published').reduce((a, c) => a + c.count, 0),
      },
    };
  }
}
