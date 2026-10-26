# Ruveon AI

Ruveon is a personal expense-tracking website with a React frontend, a FastAPI backend, and an optional Gemini-powered WhatsApp assistant.

## Features

- Account registration and sign-in with server-side password hashing.
- Personal transactions, budgets, savings goals, reports, and dashboards backed by the API.
- Gemini answers WhatsApp finance questions using a limited monthly account summary.
- Optional Meta WhatsApp Cloud API account linking and webhook support.
- Separate Vercel and Render deployment configuration.
- In-app `/privacy` route describing data collection and third-party processing.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the Vercel, Render, PostgreSQL, Gemini, and WhatsApp setup instructions.

Before inviting users, confirm the privacy contact in the notice is monitored, establish a reliable account-deletion and data-retention process, configure a persistent PostgreSQL database and production environment variables, and verify the deployed API and website together.

## Project layout

- `src/` — React website.
- `backend/app/` — FastAPI application used by Render.
- `backend/alembic/` — database migrations.
- `render.yaml` — Render API service blueprint.
- `vercel.json` — single-page application routing for Vercel.