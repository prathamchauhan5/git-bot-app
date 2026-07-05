# AI Notes

How AI tools were used while building this project, and the decisions behind it.

## Tools & models used

- **Claude Code** (Anthropic, Claude Opus) — primary pair-programming tool for
  scaffolding routes/services, writing the Prisma schema and migrations, the
  rule engine, and this documentation.
- Used interactively: describe intent → review the diff → run it → correct. No
  code was merged without reading it and exercising the flow it touched.

## Work split (human vs AI)

- **Human (me):** product decisions and requirements interpretation; choosing the
  single-origin architecture; provisioning GitHub OAuth App, Neon Postgres, Slack
  webhook, and Render; testing end-to-end against real GitHub deliveries; deciding
  what was "good enough" vs. what needed hardening.
- **AI:** first-pass implementation of routes/services from a described spec,
  Prisma schema + migration SQL, the filter/rule evaluation logic, boilerplate
  (validation, error shapes), and drafting README/DEPLOYMENT/these notes.
- **Together:** the reliability work (webhook signature verification and delivery
  idempotency) — designed in conversation, then implemented and verified.

## Architecture decisions

- **Single Render service, single origin.** The Express server serves the built
  React app, so the auth cookie is first-party. This sidesteps CORS and
  third-party-cookie problems that would otherwise break login in some browsers —
  a deliberate simplification over a split frontend/backend deploy.
- **httpOnly JWT cookie for sessions.** No token in JS-reachable storage; the
  GitHub access token is stored server-side and never returned by any API.
- **Rules as data, not code.** Rules are rows (`event`, optional
  `field/operator/value` filter, `action`), so behavior is configurable in the UI
  without redeploys. The rule engine is a small, testable pure-ish evaluator.
- **Delivery idempotency via a `WebhookDelivery` table.** Each `X-GitHub-Delivery`
  GUID is recorded and flipped `RECEIVED → PROCESSED`. Already-processed deliveries
  are skipped (no double actions); deliveries still `RECEIVED` (first attempt
  failed) remain retryable, so a downstream failure doesn't silently lose the
  event. Chose at-least-once + dedup-on-complete over a heavier queue/worker
  because it meets the reliability bar with far less infrastructure.
- **Signature verification gated on a secret.** When `GITHUB_WEBHOOK_SECRET` is
  set, HMAC is enforced with a constant-time compare; when unset (local dev via
  smee) it's skipped. Keeps local iteration frictionless without weakening prod.

## Hardest AI mistake

The trickiest bug class was **idempotency semantics**, not syntax. The naive
AI-suggested version recorded a delivery and skipped any repeat — but that
*also* skipped GitHub's automatic retry of a delivery whose first attempt had
**failed**, silently dropping the event. That directly violates "don't lose
events on downstream failure." The fix was to make the delivery a small state
machine (`RECEIVED` vs `PROCESSED`) and only skip once processing *completed*.
Lesson: for reliability code, the AI's happy-path solution reads as correct;
the failure modes have to be reasoned about explicitly.

Runner-up: matching hand-written Prisma migration SQL to the schema exactly
(enum + unique index naming) so `prisma migrate deploy` applies cleanly in prod
without drift, rather than relying on a shadow DB that Neon's free tier makes
awkward.

## Future improvements

- **AI triage step** (stretch): summarize an issue/PR and suggest labels/priority
  with a free model (Groq/Gemini), surfaced in the dashboard and Slack.
- **GitHub App** instead of an OAuth App — finer-grained per-repo installation
  and higher rate limits.
- **Multi-repository per user** — the schema currently allows one connected repo
  per user; relax the `User→Repository` relation to many.
- **A real job queue with retries/backoff** for downstream actions, replacing the
  inline at-least-once processing.
- **Encrypt access tokens at rest** and add structured logging + basic metrics.
- **Automated tests** for the rule engine and webhook handler (signature reject,
  duplicate-delivery skip, filter matching).
