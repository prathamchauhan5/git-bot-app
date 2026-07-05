# GitHub Automation Bot

An event-driven bot that reacts to activity in a GitHub repository. A user signs
in with GitHub, connects one of their repos, and configures rules in a dashboard.
When GitHub sends a webhook (issue opened, PR opened, push), the bot evaluates
the rules and acts — **adds a label** on GitHub and/or **sends a Slack
notification** — then records every action in a live activity log.

> Example rule: *issues whose title contains `bug` → add the `bug` label and send
> a Slack alert.*

## Features

- **GitHub OAuth sign-in** — authenticate and connect a repo you own.
- **Webhooks for three event types** — `issues`, `pull_request`, `push`.
- **Writes back to GitHub** — adds labels to issues/PRs via the GitHub API.
- **Slack notifications** — per-user Incoming Webhook, verified before saving.
- **Configurable rules in the UI** (stretch) — match on title / author / branch
  with `contains` / `equals` / `starts with` / `ends with`; no hard-coded logic.
- **Dashboard behind login** — manage rules and see a live activity log with
  success/failure status per action.

### Reliability & security

- **Webhook signature verification** — HMAC-SHA256 (`X-Hub-Signature-256`),
  compared with `crypto.timingSafeEqual`. Forged/tampered requests are rejected.
- **Idempotent delivery handling** — every delivery's `X-GitHub-Delivery` GUID is
  recorded; an already-processed delivery is skipped, so the same event is never
  acted on twice. A delivery that failed mid-way is left retryable so events
  aren't silently lost.
- **Failure history** — failed actions are stored as `FAILED` executions with the
  error message, visible in the dashboard.
- **No secret exposure** — the session is an httpOnly cookie; the GitHub access
  token is never returned by any API. Secrets live only in environment variables.

## Tech stack

| Layer    | Tech |
|----------|------|
| Frontend | React + Vite |
| Backend  | Node.js + Express 5 |
| Database | PostgreSQL (Neon) via Prisma |
| Auth     | GitHub OAuth App + JWT session cookie |
| Deploy   | Single Render Web Service (Express serves the built React app) |

The client and server live in one repo and deploy as **one service on a single
origin**, which keeps the auth cookie first-party (no CORS, no third-party-cookie
issues). See [DEPLOYMENT.md](DEPLOYMENT.md) for the full deploy guide.

## Project structure

```
git-bot-app/
├─ client/                 # React + Vite frontend
│  └─ src/App.jsx          # login + dashboard (rules, activity)
├─ server/
│  ├─ app.js               # Express app: API routes + serves client/dist
│  ├─ server.js            # entrypoint
│  ├─ prisma/schema.prisma # data model + migrations
│  └─ src/
│     ├─ routes/           # auth, repositories, rules, webhooks
│     ├─ services/         # github, slack, rule-engine, webhook-delivery, jwt…
│     └─ middlewares/      # auth (JWT cookie)
└─ DEPLOYMENT.md           # step-by-step Render + GitHub + Slack setup
```

## Local setup

**Prerequisites:** Node 18+, a PostgreSQL database (a free [Neon](https://neon.tech)
DB works), a GitHub OAuth App, and (optionally) a Slack Incoming Webhook.

1. **Clone and install**
   ```bash
   git clone <your-repo-url> git-bot-app
   cd git-bot-app
   npm install --prefix server
   npm install --prefix client
   ```

2. **Configure environment** — copy the examples and fill them in:
   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env   # leave VITE_API_URL empty for local
   ```
   See [Environment variables](#environment-variables) below.

3. **Set up the database**
   ```bash
   cd server && npx prisma migrate deploy   # apply schema; use `migrate dev` when changing it
   ```

4. **Run both dev servers** (two terminals, from the repo root):
   ```bash
   npm run dev:server   # Express on :3000
   npm run dev:client   # Vite on :5173  ← open this
   ```
   Vite proxies API calls to the backend, so it's same-origin locally too.

5. **Expose webhooks locally** — GitHub can't reach `localhost`. Use a tunnel:
   ```bash
   npx smee-client --url https://smee.io/<channel> --target http://localhost:3000/webhooks/github
   ```
   Point your repo's webhook at the smee URL. Leave `GITHUB_WEBHOOK_SECRET`
   empty locally to skip signature checks (or set it on both sides).

## Environment variables

Server (`server/.env`):

| Key | Description |
|-----|-------------|
| `PORT` | Server port (default `3000`). Do **not** set this on Render. |
| `NODE_ENV` | `development` locally, `production` on Render (enables Secure cookies). |
| `CLIENT_URL` | Frontend origin; used for the post-login redirect. |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID. |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret. |
| `GITHUB_CALLBACK_URL` | OAuth callback, e.g. `http://localhost:3000/auth/github/callback`. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_SECRET` | Long random string used to sign session cookies. |
| `GITHUB_WEBHOOK_SECRET` | Webhook HMAC secret; set the **same** value on the GitHub webhook. Leave empty locally to skip verification. |

Client (`client/.env`):

| Key | Description |
|-----|-------------|
| `VITE_API_URL` | Backend base URL. Leave **empty** for local (Vite proxy) and for single-origin production. |

## Testing instructions

**Automated:** there is no unit-test suite in this project. Verification is done
by exercising the flow end-to-end (below) and by module smoke-checks
(`node -e "require('./server/app.js')"`).

**End-to-end manual test:**

1. Open the app → **Login with GitHub** → authorize.
2. Connect a repository you own.
3. Create a rule, e.g. *Event: Issue opened · Filter: Title contains `bug` ·
   Action: Add label `bug`*. Add a second rule with *Action: Send Slack* and set
   your Slack webhook in settings.
4. In that repo, open an issue titled `found a bug`.
5. Confirm:
   - the `bug` label appears on the issue,
   - a Slack message arrives,
   - both actions show as **SUCCESS** in the dashboard's Activity log.

**Verify the reliability guarantees:**

- **Signature:** with `GITHUB_WEBHOOK_SECRET` set, `POST /webhooks/github` with a
  wrong/missing `X-Hub-Signature-256` returns `401`.
- **Idempotency:** in the GitHub webhook UI, **Redeliver** a processed delivery
  (same `X-GitHub-Delivery`) — the bot responds `Duplicate delivery ignored` and
  takes no second action. (Auto-retries of a delivery whose first attempt failed
  are still processed.)

## Deployment

Deployed as a single Render Web Service that serves both the API and the built
React app. Full walkthrough — Render service, env vars, GitHub OAuth App, and the
per-repo webhook — is in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

> Note: Render's free tier sleeps when idle; the first request/webhook after a nap
> takes ~30–60s to wake, and GitHub may mark that delivery failed — just Redeliver.
