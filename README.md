# Ruveon AI

Ruveon is a personal expense-tracking website with a React frontend, a FastAPI backend, and an optional Gemini-powered WhatsApp assistant.

## Features

- Account registration and sign-in with server-side password hashing.
- Personal transactions, budgets, savings goals, reports, and dashboards backed by the API.
- Custom transaction categories, monthly and category budgets, and dedicated feature guides.
- Lending and repayment tracking, kept separate from ordinary income and expenses.
- Gemini-powered Ruvi can interpret WhatsApp finance requests and save validated transactions, loans, and repayments to the shared account.
- Optional Meta WhatsApp Cloud API account linking and webhook support.
- Separate Vercel and Render deployment configuration.
- In-app `/privacy` route describing data collection and third-party processing.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the Vercel, Render, PostgreSQL, Gemini, and WhatsApp setup instructions.

The backend applies schema changes through Alembic. Before running it locally against an existing database, run `alembic upgrade head` from `backend/` with `PYTHONPATH` set to that directory. Configure `SESSION_IDLE_TIMEOUT_MINUTES` to change the server-enforced inactivity timeout; it defaults to 30 minutes.

Before inviting users, confirm the privacy contact in the notice is monitored, establish a reliable account-deletion and data-retention process, configure a persistent PostgreSQL database and production environment variables, and verify the deployed API and website together.

## Project layout

- `src/` — React website.
- `backend/app/` — FastAPI application used by Render.
- `backend/alembic/` — database migrations.
- `render.yaml` — Render API service blueprint.
- `vercel.json` — single-page application routing for Vercel.