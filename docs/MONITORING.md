# Aptiva — Production Monitoring & Alerting Guide

Per playbook Section 30 and Phase 12 (`PH12-T05`), this document specifies the monitoring topology, health endpoints, alerting thresholds, and escalation policies for production.

---

## 1. Health & Readiness Probes

The Aptiva stack exposes three distinct probe levels:

| Endpoint             | Probe Type    | Description                                                          | Failure Behavior                                                                                                                                                               |
| :------------------- | :------------ | :------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/health` | **Liveness**  | Verifies NestJS process is responsive and event loop is not blocked. | Returns `200 {"data":{"status":"ok"}}`. If unresponsive for 3 intervals (15s each), container orchestrator restarts the pod/container.                                         |
| `GET /api/v1/ready`  | **Readiness** | Verifies active connections to both PostgreSQL and Redis.            | Returns `200 {"data":{"status":"ok"}}`. Returns `503` if PostgreSQL or Redis is unreachable. Load balancer / Caddy pulls the node from active traffic routing until recovered. |
| `GET /caddy-health`  | **Ingress**   | Verifies Caddy reverse-proxy listener.                               | Returns `200 "OK"`. Used by cloud load balancers (AWS ALB, Cloudflare, etc.).                                                                                                  |

---

## 2. Core Alerting Rules & SLI/SLO Thresholds

| Metric                           | Threshold                                   | Evaluation Window | Severity          | Action                                                                                                             |
| :------------------------------- | :------------------------------------------ | :---------------- | :---------------- | :----------------------------------------------------------------------------------------------------------------- |
| **Attempt Submit Latency (p95)** | $> 150\text{ ms}$                           | 5 minutes         | **P1 (High)**     | Check Redis stream backpressure, database connection pool exhaustion, and CPU saturation.                          |
| **HTTP 5xx Error Rate**          | $> 1.0\%$ of requests                       | 3 minutes         | **P1 (High)**     | Check unhandled exception logs (`requestId` trace), database locking, or worker crashes.                           |
| **Stream Consumer Lag**          | $> 2,000$ pending items                     | 5 minutes         | **P2 (Medium)**   | Ensure attempt-stream consumer worker is running (`ATTEMPT_CONSUMER_ENABLED=true`); check `reclaimPending()` logs. |
| **Dead-Letter Stream Growth**    | $> 0$ items in `aptiva:attempts:deadletter` | Immediate         | **P2 (Medium)**   | Inspect dead-letter stream payload: unparseable client payload or foreign key failure.                             |
| **Readiness Check Failure**      | 2 consecutive `503` responses               | 30 seconds        | **P0 (Critical)** | Primary backing store down (Postgres or Redis); check VPS/cluster host health.                                     |
| **Database Disk Utilization**    | $> 80\%$ volume usage                       | 1 hour            | **P2 (Medium)**   | Expand storage volume; verify audit log and temporary table retention cleanup jobs.                                |

---

## 3. Worker & Background Job Health

The BullMQ and Redis Streams background workers operate with automatic idempotency:

- **Daily Recalculation Worker**: Executes profile and plan updates following session completion. If recalculation is delayed, the student interface polls with neutral wording without blocking practice.
- **Privacy Retention Worker**: Runs daily to prune soft-deleted accounts ($> 30\text{ days}$), expired auth tokens ($> 1\text{ hour}$), and revoked refresh token families ($> 90\text{ days}$).

---

## 4. Incident Response & Escalation

1. **P0 (Site Down / Backing Store Degraded)**:
   - Check `docker compose logs --tail=100 -f infra/docker-compose.prod.yml`
   - Verify PostgreSQL: `pg_isready -h localhost -p 5432`
   - Verify Redis: `redis-cli ping`
2. **P1 (Performance Degradation)**:
   - Run EXPLAIN ANALYZE on suspect queries (`tools/explain-queries.ts`).
   - Check slow query log in PostgreSQL: `log_min_duration_statement = 250`.
3. **P2 (Worker Lag)**:
   - Inspect pending stream items: `redis-cli xpending aptiva:attempts attempt-writers`.
