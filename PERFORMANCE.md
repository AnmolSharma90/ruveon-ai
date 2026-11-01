# Performance audit and optimization

Audit date: 2026-11-01

This report distinguishes measurements from source-code findings. The production
changes were pushed to `main` and the live Vercel bundle was verified after
deployment. Production authentication and finance API checks used a dedicated
test account; all labeled test transactions, budget, and savings goal were
deleted and their absence verified. The test account remains because the app
does not provide an account-deletion endpoint.

## Production baseline

Measurements were collected against `https://ruveon-ai.vercel.app/` and its
configured Render API, before and after the code deployment. Homepage requests
were made twice in succession; API health and an unauthenticated current-user
route were then measured before deployment. Browser timings are from
integrated-browser navigations.

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

The Render service is configured with `plan: free`. Its slow first response is
a hosting/startup limitation rather than homepage work; `/health` itself does
not query the database. The measured first response may include post-deploy
startup as well as a free-tier wake-up, so it is not attributed to either
exclusively. No paid service or keep-alive job was added.

The production JS and CSS responses used
`Cache-Control: public, max-age=0, must-revalidate` despite content-hashed asset
names. Returning visits therefore revalidated these assets. The Vercel
configuration now assigns immutable one-year caching to `/assets/*`; HTML is
left uncached. After deployment, the production JS asset was confirmed to return
`Cache-Control: public, max-age=31536000, immutable`.

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
- Production API timings are now listed below. No production database query
  plan was available, so no database-query latency reduction is claimed.

## Local verification after changes

These are local smoke-test results using disposable SQLite data and a local
Uvicorn/Vite server. They are not production timings.

| Flow | Result |
| --- | --- |
| Signup to dashboard | 1,247 ms in one browser run on the final code |
| Login to dashboard | 1,740 ms in one browser run on the final code |
| Rapid double-click signup | One `POST /users`; dashboard opened |
| Dashboard initial requests | Transactions, dashboard, budgets, goals, and WhatsApp status returned successfully |
| Reports | Report API returned HTTP 200 when `/reports` was opened |
| Transaction creation in UI | HTTP 201 and the saved record appeared |
| API transaction, budget, and savings-goal create/update/delete; reports | Local TestClient workflow passed |
| User isolation and session revocation | A second user saw no first-user transactions; revoked sessions returned HTTP 401 |
| Logout and protected route | Logout returned HTTP 204; direct dashboard navigation redirected to login |

Local SQLite request timings varied substantially between runs on this Windows
workstation, so they are not presented as an improvement percentage or as a
substitute for production measurements.

## Production measurements after deployment

| Operation | Before | After deployment |
| --- | --- | --- |
| Homepage HTML | 606 ms first request; 94 ms immediate repeat | 689 ms in a later request |
| Browser homepage load | Initial trace: 9,196 ms; reload trace: 1,573 ms | 1,633 ms load; 529 ms response start |
| Initial JS/CSS | 107,213 B JS; 6,301 B CSS transferred | 107,239 B JS; CSS revalidated from cache at 300 B. JS response has immutable one-year caching |
| Render health | 6,762 ms first; 300 ms warm | 44,613 ms first post-deploy request; 567 ms and 295 ms on subsequent warm requests |
| Signup | No valid production-account measurement | 12,721 ms for the production signup API request; the dashboard request began immediately after signup returned |
| Login | No valid production-account measurement | 1,391 ms login API; 1,604 ms from login submission to dashboard |
| Authenticated user check | 1,283 ms without credentials (401; not a valid-auth comparison) | 1,377 ms first check; 474 ms on a later check |
| Dashboard summary | No authenticated production measurement | 643 ms in an authenticated production request |
| Transaction list | No authenticated production measurement | 558 ms; 545 ms after creating the test record |
| Transaction create/update/delete | Not measured | 929 / 881 / 608 ms |
| Budget list/create/update/delete | Not measured | 602 / 581 / 878 / 582 ms |
| Savings-goal list/create/update/delete | Not measured | 499 / 500 / 1,328 / 547 ms |
| Report | No authenticated production measurement | 862 ms |

These are individual request observations, not percentiles or controlled
benchmarks. Production API values include browser-to-Render network time. The
signup call's 12.7 seconds is confirmed, but the available measurements do not
isolate password hashing, database connect/query time, or instance wake-up; do
not attribute that delay to one component without server-side tracing. The
first post-deploy `/health` call taking 44.6 seconds, followed by sub-second
warm calls, is strong evidence that Render startup/wake latency remains a major
user-facing limitation.

The production test account was created and successfully logged in. Its account
record remains under the address provided for the test. The app has no user
deletion route; deleting it would require an authorized database operation.
Temporary test financial records were all deleted, and follow-up GET requests
confirmed none remained.

The free Render plan can still introduce long cold starts. Further production
diagnosis of the 12.7-second signup requires Render request logs or
instrumentation around password hashing and database operations. No production
database query plan or authenticated cross-user probe was run.
