# Performance audit and optimization

Audit date: 2026-11-01

This report distinguishes measurements from source-code findings. The live checks
were anonymous and did not create or modify production accounts or financial
records. The code changes in this branch have not been deployed, so a production
before-and-after comparison is not yet available.

## Production baseline

Measurements were collected against `https://ruveon-ai.vercel.app/` and its
configured Render API. Homepage requests were made twice in succession; API
health and the unauthenticated current-user route were then measured once or
twice. Browser timing is from two integrated-browser navigations.

| Operation | Measured before | Evidence and limitations |
| --- | ---: | --- |
| Homepage HTML, first request | 606 ms | HTTP 200; 547-byte HTML body |
| Homepage HTML, immediate repeat | 94 ms | HTTP 200; 547-byte HTML body |
| Browser navigation, initial trace | 727 ms response start; 9,196 ms DOMContentLoaded/load | One browser run |
| Browser navigation, repeat reload | 271 ms response start; 1,573 ms DOMContentLoaded/load | Paint entries were unavailable on this reload |
| First contentful paint | 15,984 ms | Initial trace reported this after DOMContentLoaded and no long tasks; treat as anomalous and remeasure independently |
| Initial JS and CSS transfer | 107,213 B JS; 6,301 B CSS | Decoded sizes were 344,562 B and 22,782 B. No API, image, font, or third-party resource was in the homepage resource list |
| Render `/health` | 6,762 ms first request; 300 ms immediate repeat | Both HTTP 200. The large first/warm difference is consistent with a free-instance wake-up, but one sample does not prove cold-start time |
| Authenticated API proxy check | 1,283 ms, HTTP 401 | `/api/v1/users/me` without credentials; not a measurement of a valid login |

The deployed Render service is configured with `plan: free`. Its idle wake-up
is a hosting limitation, not a database or frontend code delay. No paid service
or keep-alive job was added.

The production JS and CSS responses used
`Cache-Control: public, max-age=0, must-revalidate` despite content-hashed asset
names. Returning visits therefore revalidated these assets. The Vercel
configuration now assigns immutable one-year caching to `/assets/*`; HTML is
left uncached. This response-header change must be verified after deployment.

## Findings and changes

### Frontend

- The homepage is static and did not request the API or third-party services.
- Recharts was already split into a lazy chart chunk; the homepage trace did not
  download it. Current production build output is 345.04 kB JS (104.76 kB gzip)
  plus 22.78 kB CSS (5.53 kB gzip). The chart chunk is 408.14 kB (115.47 kB
  gzip) and remains deferred.
- Fresh signup/login previously performed a separate `/users/me` request before
  account data could start. The auth response already contains the newly issued
  signed session, so that redundant check is skipped; protected API endpoints
  still validate every request, and page restoration still revalidates.
- Dashboard summary and transactions now resolve independently of budgets,
  goals, and WhatsApp status. These secondary requests still run in parallel,
  but cannot delay rendering the primary results.
- Reports are fetched only while the Reports route is open. They were
  previously fetched on every authenticated page.
- A synchronous submit lock prevents rapid duplicate signup/login submissions.
- The main bundle changed from 344.52 kB (104.70 kB gzip) to 345.04 kB
  (104.76 kB gzip); the change is 0.06 kB gzip. No dependency or chart library
  was added or removed.

### Backend and database

- Current-user authentication previously read the session and user in two
  separate ORM lookups. It now fetches both with one joined `SELECT`. A local
  SQLAlchemy statement trace verified one `SELECT` for `/users/me`.
- Signup now flushes the user and commits it together with its auth session,
  removing the intermediate commit and refresh while keeping account/session
  creation atomic. A database uniqueness conflict still returns the existing
  “User already exists” response.
- Login no longer commits a password-hash upgrade separately from session
  creation. Password hashing remains at 310,000 PBKDF2-SHA256 iterations.
- SQLAlchemy sessions retain loaded values after commit, allowing removal of
  redundant post-commit refresh queries from transaction, budget, and savings
  goal create/update handlers. A local statement trace counted three statements
  for transaction creation: two `SELECT`s and one `INSERT`.
- No schema migration or new index was needed. Existing user/email uniqueness,
  transaction `(user_id, date, id)` index, budget uniqueness index, and session
  primary key cover the inspected access patterns. No financial records were
  changed.
- The existing SQLAlchemy pool and `pool_pre_ping` were retained; production
  connection counts and database-provider limits were unavailable, so changing
  pool sizing would be speculative.
- Gemini and Meta calls are confined to WhatsApp webhook handling, not the
  homepage or authentication flow. They already have 20-second and 15-second
  timeouts with logged errors. No application retry was added to these
  non-idempotent POSTs, where retrying could duplicate a reply or prolong a
  webhook request.
- No production database query plan or authenticated production timing was
  available, so no database latency reduction is claimed.

## Local verification after changes

These are local smoke-test results using disposable SQLite data and a local
Uvicorn/Vite server. They are not production timings.

| Flow | Result |
| --- | --- |
| Signup to dashboard | 1,247 ms in one browser run on the final code |
| Login to dashboard | 1,740 ms in one browser run on the final code |
| Rapid double-click signup | One `POST /users`; dashboard opened |
| Dashboard initial requests | Transactions, dashboard, budgets, goals, and WhatsApp status returned successfully; no `/users/me` immediately after fresh auth |
| Reports | Report API returned HTTP 200 when `/reports` was opened |
| Transaction creation in UI | HTTP 201 and the saved record appeared |
| API transaction, budget, and savings-goal create/update/delete; reports | Local TestClient workflow passed |
| User isolation and session revocation | A second user saw no first-user transactions; revoked sessions returned HTTP 401 |
| Logout and protected route | Logout returned HTTP 204; direct dashboard navigation redirected to login |

Local SQLite request timings varied substantially between runs on this Windows
workstation, so they are not presented as an improvement percentage or as a
substitute for production measurements.

## Before/after status and remaining work

| Operation | Before | After |
| --- | --- | --- |
| Homepage | Production measurements above | Not measured in production; caching config awaits deployment |
| Signup and login | No valid production-account test performed | Local flows passed; production comparison unavailable |
| Dashboard and reports | Authenticated production data unavailable | Local route/API checks passed; production comparison unavailable |
| Transaction and budget mutations | Production records were not modified | Local create/update/delete tests passed; production comparison unavailable |
| Render cold/warm behavior | 6,762 ms / 300 ms on health route | Not remeasured after deployment |

To complete the comparison, deploy these changes, then repeat the homepage
trace and the authenticated flows using a designated production test account.
Measure cold and warm Render requests separately, and verify the deployed
`/assets/*` response header. The free Render plan can still introduce wake-up
latency even after application optimizations.
