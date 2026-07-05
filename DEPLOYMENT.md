# Deployment — single service on Render

Frontend (`client/`) and backend (`server/`) live in **one repo** and deploy as
**one Render Web Service**: the Express server serves the built React app, so
everything is on a single origin. That makes the auth cookie first-party, so
login works in every browser with no CORS and no third-party-cookie issues.

```
Render Web Service  (one URL, e.g. https://git-bot.onrender.com)
 └─ Express
     ├─ /auth /repositories /rules /webhooks   (API)
     └─ serves client/dist                       (the React app)
```

## 1. Push to GitHub
```bash
cd git-bot-app
git init -b main
git add .
git commit -m "Monorepo: client + server, single-origin deploy"
git remote add origin git@github.com:<you>/git-bot-app.git
git push -u origin main
```
`.env` is gitignored — set secrets in the Render dashboard.

## 2. Create the Render Web Service
Render → **New → Web Service** → pick the `git-bot-app` repo. Settings:
- **Root Directory:** *(leave empty — repo root)*
- **Build Command:** `npm run build`
  (installs client + server, builds the React app, runs `prisma generate` + `prisma migrate deploy`)
- **Start Command:** `npm start`
- **Instance Type:** Free (fine to start)

## 3. Environment variables (Render → Environment)
| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | your Postgres (Neon) connection string |
| `JWT_SECRET` | a long random string |
| `GITHUB_CLIENT_ID` | from the GitHub OAuth app |
| `GITHUB_CLIENT_SECRET` | from the GitHub OAuth app |
| `GITHUB_CALLBACK_URL` | `https://<your-app>.onrender.com/auth/github/callback` |
| `CLIENT_URL` | `https://<your-app>.onrender.com` (same URL — used for the post-login redirect) |
| `GITHUB_WEBHOOK_SECRET` | webhook secret (also set it on the GitHub webhook) |

- **Do NOT set `PORT`** — Render injects it.
- **No `VITE_API_URL`** — the frontend calls the API on the same origin (relative URLs).
- `SLACK_WEBHOOK_URL` optional (per-user URLs live in the DB).

## 4. GitHub OAuth App
github.com → Settings → Developer settings → OAuth Apps → your app:
- **Homepage URL:** `https://<your-app>.onrender.com`
- **Authorization callback URL:** `https://<your-app>.onrender.com/auth/github/callback`

## 5. Webhook (per repo you automate)
Repo → Settings → Webhooks → Add webhook:
- **Payload URL:** `https://<your-app>.onrender.com/webhooks/github`
- **Content type:** `application/json`
- **Secret:** same as `GITHUB_WEBHOOK_SECRET`
- **Events:** Issues, Pull requests, Pushes

## 6. Verify
Open `https://<your-app>.onrender.com` → Login with GitHub → connect a repo →
create a rule → open a matching issue → label/Slack fires and shows in Activity.

## Local development
Two terminals (frontend proxies API calls to the backend, so it's same-origin locally too):
```bash
npm run dev:server   # Express on :3001
npm run dev:client   # Vite on :5173  (open this)
```
Locally, keep `.env` with `NODE_ENV=development`, `CLIENT_URL=http://localhost:5173`,
and `GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback` (use a
separate GitHub OAuth app for local so its callback can point at localhost).

## Notes
- **Render free tier sleeps** when idle; the first request/webhook after a nap
  takes ~30–60s to wake (GitHub may mark that delivery failed — Redeliver it).
- `npm run build` runs `prisma migrate deploy`, applying pending migrations on
  each deploy.
- Webhooks are added to each repo manually (step 5) — not auto-registered.
