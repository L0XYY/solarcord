# Put SolarCord online (free, ~10 minutes)

The repo includes a **Render blueprint** (`render.yaml`) that provisions everything — Postgres, Redis, the API, and the web app — from one file. You'll create the accounts and click Deploy; I've done the config.

> I can't create cloud accounts or click "Deploy" for you (that needs your own login + billing), so these are the steps to run yourself.

## Step 1 — Put the code on GitHub

From `C:\Users\Loxy\solarcord` (it's already committed locally):

```bash
# create a repo on github.com first (e.g. "solarcord"), then:
git remote add origin https://github.com/<your-username>/solarcord.git
git branch -M main
git push -u origin main
```

(No `gh` CLI installed — easiest is to create the empty repo in the browser, then run the commands above. Want me to install the GitHub CLI and walk you through `gh auth login`? Just say so.)

## Step 2 — Deploy on Render

1. Sign up at <https://render.com> (free; sign in with GitHub).
2. **New +** → **Blueprint**.
3. Pick your `solarcord` repo. Render reads `render.yaml` and shows 4 resources:
   `solarcord-db` (Postgres), `solarcord-redis`, `solarcord-api`, `solarcord-web`.
4. Click **Apply**. First build takes a few minutes (it installs, builds, pushes the DB schema, and seeds demo data).

## Step 3 — Connect the two URLs (one-time)

Because the web app bakes the API URL at build time, you set them after the first deploy:

1. Open **solarcord-api** → copy its URL (e.g. `https://solarcord-api.onrender.com`).
2. Open **solarcord-web** → **Environment** → set `NEXT_PUBLIC_API_URL` to that API URL → **Save** (this triggers a web rebuild).
3. Open **solarcord-api** → **Environment** → set `WEB_ORIGIN` to the web URL (e.g. `https://solarcord-web.onrender.com`) → **Save**.

Wait for both to redeploy.

## Step 4 — Test it

Open the **solarcord-web** URL. Log in with the seeded account:

```
nova@solarcord.dev  /  password123
```

`nova` is a staff account, so you also get **/admin**, and there are demo servers in **Discovery** (🧭). Or just sign up fresh.

> **Free-tier note:** Render free services sleep after ~15 min idle; the first request wakes them (~30s cold start). The free Postgres is time-limited — fine for testing, upgrade for anything real. Replace the auto-generated `JWT_*` secrets are already random per-deploy.

## Alternative: Railway

Railway also works well: New Project → Deploy from GitHub → add **PostgreSQL** and **Redis** plugins → create two services (root dir = repo), with the same build/start commands from `render.yaml`, and the env vars from [`DEPLOYMENT.md`](DEPLOYMENT.md). Render's blueprint is the lower-effort path.

## What won't work yet (by design)

Voice/video and Solar+ payments are stubbed pending your **LiveKit** and **Stripe** accounts — everything else is fully live. See [`DEPLOYMENT.md`](DEPLOYMENT.md) §7.
