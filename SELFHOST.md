# Self-hosting Allowance

The hosted version at [getallowance.dev](https://getallowance.dev) is the
convenience product. But Allowance is MIT-licensed and designed so you can run
your **own** instance where you control every secret. When you self-host:

- Your provider API keys live in **your** Supabase Vault.
- The edge encryption key and the database service-role key are **yours**.
- Traffic flows through **your** Cloudflare Worker.
- Allowance-the-company sees nothing. There is nothing to trust us about.

## What runs where (the honest version)

The proxy is built for the **Cloudflare Workers** runtime (KV, the rate-limit
binding, edge crypto). It is not a generic container, and we won't pretend it
is — you run it on your own Cloudflare account (free tier is plenty). The
dashboard is a normal Next.js app and **does** containerize; a Dockerfile and
`docker-compose.yml` are included if you want it.

| Piece | Where it runs | Cost to self-host |
| --- | --- | --- |
| Database + Vault + auth | Your Supabase project | Free tier |
| Proxy (the part that holds keys) | Your Cloudflare Worker | Free tier |
| Dashboard | Docker, Vercel, or any Node host | Free / your call |

## 10-minute setup

**1. Database.** Create a Supabase project. In the SQL editor, paste
[`db/schema.sql`](db/schema.sql) and run it. Then paste
[`db/healthcheck.sql`](db/healthcheck.sql) — every row should say PASS.

**2. Proxy secrets + deploy.** From `proxy/`:

```bash
npm install
npx wrangler kv namespace create WALLET_KV          # note the id it prints
# put the id into wrangler.jsonc (kv_namespaces[0].id)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # from Supabase > Settings > API
npx wrangler secret put EDGE_ENCRYPTION_KEY         # see below to generate
npx wrangler deploy
```

Generate a fresh edge encryption key (base64 of 32 random bytes):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `proxy/wrangler.jsonc` `vars` to
your project's values. `wrangler deploy` prints your Worker URL — that's your
`PROXY_URL`.

**3. Dashboard.** Easiest path with Docker:

```bash
cp .env.selfhost.example .env.selfhost   # fill in your values
docker compose up --build                # http://localhost:3000
```

Or run it on Node directly (`cd dashboard && npm install && npm run build &&
npm start`) with the same environment variables, or deploy it to Vercel.

**4. Auth redirect.** In Supabase > Authentication > URL Configuration, add
your dashboard origin (e.g. `http://localhost:3000`) to the allowed redirect
URLs so magic links land back on your instance.

That's it. Create an account, add a connection, mint a key, and route a call
through your own Worker.

## Verifying you really hold the keys

This is the point of self-hosting, so confirm it:

- `npx wrangler secret list` (in `proxy/`) shows the secrets live on **your**
  Cloudflare account.
- Your provider keys appear in your Supabase Vault, encrypted — never in any
  log (`proxy/src/lib/log.ts` is the only log path; read it, it's short).
- The dashboard image never bakes the service-role key: it's passed only at
  runtime (see the `Dockerfile` — public values are build args, the secret is
  a runtime env var).

## Staying current

Pull the repo, re-paste `db/schema.sql` if the changelog says a migration
landed (it's idempotent — safe to re-run), `npx wrangler deploy` the proxy,
and rebuild the dashboard image. `db/healthcheck.sql` tells you if your
database matches the code.

## What you give up vs. hosted

- You operate it: deploys, the Cloudflare $5 Workers plan if you outgrow the
  free KV write limit, your own uptime monitoring.
- Pro billing via Polar is optional and only matters if you charge your own
  users; leave the `POLAR_*` vars blank to run without it.

Questions or gaps in this guide: open an issue. A self-host path that doesn't
actually work is a bug.
