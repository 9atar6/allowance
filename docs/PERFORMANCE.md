# Performance

Honest numbers, honestly obtained. Method first, results second, caveats third.

## Method

`node proxy/scripts/benchmark.mjs` creates a disposable user on the staging
stack (same code as production, own Supabase + own worker), mints a key
through the same RPCs the dashboard uses, then measures four paths
sequentially with 30 samples each (3 warm-up calls discarded):

| Path | What it isolates |
| --- | --- |
| `GET /healthz` | raw edge round-trip from the client |
| `GET /v1/me` | the auth + caps pipeline (KV cache-hit) |
| upstream direct | the connected API without Allowance |
| upstream via Allowance | the full pipeline + forward |

Upstream: postman-echo.com. Client: a residential connection in France.

## Results (2026-06-12)

| Measurement | p50 | p95 |
| --- | --- | --- |
| Edge round-trip (healthz) | 32 ms | 37 ms |
| Auth pipeline (/v1/me) | 51 ms | 54 ms |
| Upstream direct | 112 ms | 114 ms |
| Upstream via Allowance | 147 ms | 162 ms |
| **Added latency (proxied minus direct)** | **35 ms** | **48 ms** |

The auth + caps machinery itself costs ~19 ms beyond raw round-trip on the
cache-hit path; the rest of the overhead is the extra network hop
client → edge → upstream versus client → upstream.

## Caveats, so the numbers stay honest

- Single vantage point, sequential requests, small sample. This is a latency
  characterization, not a load test.
- Numbers are for the KV **cache-hit** path, which is every call after the
  first. A cold key (first call, or first call after 60s idle) adds one
  Supabase round-trip to fetch and encrypt the context.
- For streaming responses, the overhead applies to time-to-first-byte only;
  tokens then pass through chunk-by-chunk.
- Your numbers will differ with geography. Re-run the script against your
  own staging stack to get yours.
