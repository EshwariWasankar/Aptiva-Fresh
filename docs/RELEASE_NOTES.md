# Aptiva v1.0.0 Release Notes — First Production Milestone

**Release Version**: `v1.0.0`  
**Date**: 2026-11-14  
**Target**: Initial Student Pilot & Placement Aptitude Preparation Platform

---

## Highlights

Aptiva v1.0.0 delivers the full end-to-end adaptive placement aptitude preparation platform, comprising a TypeScript ML estimation and knapsack planning engine, NestJS backend API with Redis Streams and BullMQ background workers, Next.js web application with Tailwind CSS and KaTeX rendering, and a reverse proxy.

### Core Capabilities

1. **Authentication & Identity (PH-1)**:
   - Secure Argon2id password hashing, refresh token rotation with family revocation on reuse, Google OAuth support, and consent tracking (`consent_records`).
2. **Taxonomy & Content Bank (PH-2 & PH-3)**:
   - 78-topic hierarchical taxonomy across 4 main sections (Quantitative, Logical, Verbal, Data Interpretation).
   - Ingested 1,733 vetted aptitude questions with published disjoint pools (1,413 practice, 160 diagnostic, 160 reassessment).
   - Provenance tracking, topic synonym mapping, and company pattern blueprints (`sample-it-company` and `generic`).
3. **Attempt Pipeline & Server Authority (PH-4)**:
   - Server-authoritative timing, zero answer-key leakage before submission, idempotent attempt marking.
   - High-throughput Redis Streams buffer with at-least-once delivery, flush barrier reconciliation, and dead-letter protection.
4. **Diagnostic & Error Inference (PH-5)**:
   - Express (12-item) and Standard (27-item) diagnostic assessments.
   - Post-test error inference categorizing mistakes into calculation errors, conceptual gaps, timing pressure, or misread questions.
5. **Rating Engine & Bayesian Inference (PH-6)**:
   - Glicko-1 volatility rating updates per topic with prequential evaluation.
   - Bayesian confidence intervals and error mix profiles.
6. **Adaptive Planner (PH-7)**:
   - 0-1 Knapsack adaptive daily practice plan generation with time budgets (15–60 min/day).
   - Dynamic plan compression on time changes without backlog accumulation.
7. **Daily Practice Loop & Mistake Notebook (PH-8)**:
   - Interactive runner with instant feedback and LaTeX KaTeX math rendering.
   - Spaced-repetition retry ladder (1, 3, 7, 14 days) in the student mistake notebook.
   - Concept-repair lesson gates before targeted practice.
8. **Reassessment & History (PH-9)**:
   - Post-practice reassessments comparing performance against baseline with noise labels.
   - Plan version history, restoration, and `keep-my-plan` settings.
9. **Privacy Hardening (PH-10)**:
   - GDPR/DPDP compliant full data export (`GET /me/data-export`) with re-authentication.
   - Soft-deletion with 30-day retention and automated purge job (`DELETE /me`).
   - Comprehensive authorization matrix and administrative audit logging.
10. **Testing & Performance Verification (PH-11)**:
    - 222/222 automated tests passing cleanly.
    - Attempt submission latency $p95 = 40.00\text{ ms}$ under sustained 10 VU k6 load with 0.00% errors.
    - Zero axe-core accessibility violations across 15 views; 15/15 responsive viewport checks passing.
11. **Production Deployment & Packaging (PH-12)**:
    - Multi-stage Docker containerization, automated Caddy HTTPS reverse proxy, production compose stack.
    - Automated backup and restore rehearsal with 100% data fidelity.
    - Production smoke test (`pnpm smoke`), robots.txt, sitemap.xml, and operational runbook.
