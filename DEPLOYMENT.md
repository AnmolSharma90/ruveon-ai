# Ruveon website deployment

Ruveon is deployed as a static React website on Vercel and a Python FastAPI API on Render. The browser calls the Render API using `VITE_API_BASE_URL`; secrets stay in Render environment variables and are never included in the frontend bundle.

## Before deploying

1. Push this project to a GitHub repository. Do not commit `.env` files, API keys, WhatsApp tokens, or database files.
2. Review the in-app `/privacy` notice. Confirm its listed privacy email is monitored, establish a working account/data deletion process and retention period, and update the notice with those details before inviting users.
3. Create a persistent PostgreSQL database with a provider such as Neon or Supabase. Copy its PostgreSQL connection URL. A local SQLite file or Render's temporary filesystem is not suitable for production data.
4. Create a Render web service from this repository using the included `render.yaml` blueprint. Set `DATABASE_URL` to the PostgreSQL connection URL in the Render service environment.
5. In Render, set `CORS_ORIGINS` to the exact website origin, currently `https://ruveon-ai.vercel.app` (no trailing slash). The API refuses to start in production with a wildcard CORS origin, SQLite, or an `AUTH_SECRET` shorter than 32 characters.
6. Wait for the Render service to deploy. Check `https://<your-render-service>.onrender.com/health`.
7. Import the same repository into Vercel. Set the build command to `npm run build`, the output directory to `dist`, and add:
   - `VITE_API_BASE_URL=https://ruveon-api.onrender.com/api/v1` for the current Render service.
8. Deploy the Vercel website. Copy its exact origin into Render's `CORS_ORIGINS` and redeploy the API.
9. Verify the live website can register and log in, then create, read, update, and delete test transactions, budgets, and savings goals. Confirm one user's data cannot be accessed from another account. Remove test data after the checks.

Render runs the Alembic migrations before starting FastAPI. The service command runs from `backend`, so the deployed API uses `backend/app` and `backend/alembic`; the separate root-level `app` directory is not the deployment entry point.

## Gemini setup for Ruvi

1. Sign in to [Google AI Studio API Keys](https://aistudio.google.com/apikey), choose or create a Google project, and create a Gemini API key. If you already have a Cloud project, import it into AI Studio first.
2. Add it to Render as `GEMINI_API_KEY`. Keep the key out of Vercel and out of all `VITE_*` variables.
3. The default model is `gemini-2.5-flash`; change `GEMINI_MODEL` in Render only if your Google project supports the replacement.
4. Verify the free-tier quota and current pricing for your account, region, and model in the [Gemini API pricing documentation](https://ai.google.dev/gemini-api/docs/pricing). Free availability and limits can change; usage beyond a free quota may require billing.

Ruvi uses Gemini to answer WhatsApp questions using a compact current-month account summary and savings goals. The website discloses this to users. Do not send bank credentials, card numbers, passwords, or other secrets to the chatbot. Before a public launch, publish a privacy notice that covers account data, WhatsApp/Meta, Google Gemini, retention, and user deletion requests.

## Official WhatsApp Cloud API setup

An ordinary WhatsApp or WhatsApp Business mobile app number is not enough to run an automated bot. Ruvi uses Meta's official WhatsApp Business Platform Cloud API.

1. Register or sign in at [Meta for Developers](https://developers.facebook.com/) and create a Meta app using the WhatsApp use case. Follow Meta's current onboarding flow to create/select a business portfolio and WhatsApp Business Account.
2. In the app's **WhatsApp > API Setup** panel, start with Meta's test sender:
   - **Phone Number ID**: shown in API Setup beside the selected sender. Copy it to `WHATSAPP_PHONE_NUMBER_ID`.
   - **Temporary access token**: click **Generate access token** in API Setup and copy it to `WHATSAPP_ACCESS_TOKEN`. It is short-lived and for testing only; replace it with a production token before public use.
   - **Display phone number**: the sender shown in the same panel; put its digits only (including country code) in `WHATSAPP_DISPLAY_NUMBER`.
   - **WhatsApp Business Account ID**: shown in the WhatsApp API Setup/dashboard. Meta may request this during webhook configuration; the current Ruveon webhook itself does not need it as an environment variable.
   - Add your own WhatsApp number as an allowed test recipient, then use API Setup to send the test message.
3. In Render, set:
   - `WHATSAPP_PHONE_NUMBER_ID` to that Phone Number ID.
   - `WHATSAPP_ACCESS_TOKEN` to a valid token. The temporary setup token is for testing; use Meta's documented production token flow before a public launch.
   - `WHATSAPP_DISPLAY_NUMBER` to the WhatsApp sender's international number digits, without `+`, spaces, or punctuation.
   - `WHATSAPP_VERIFY_TOKEN` to a long, random value you create. Use the same value when verifying the webhook in Meta.
   - `WHATSAPP_APP_SECRET` to the Meta app secret from **App settings > Basic** in the Meta App Dashboard (use **Show** if needed).
4. Configure the Meta WhatsApp webhook callback URL as `https://<your-render-service>.onrender.com/api/v1/webhooks/whatsapp`, use the same verify token, and subscribe the webhook to the `messages` field.
5. After Render redeploys, sign in to Ruveon and choose **Connect WhatsApp** in the dashboard header. This opens a chat with Ruvi and a pre-filled account-link code. Press **Send** in WhatsApp to finish linking. Codes expire after 10 minutes. WhatsApp is optional; users can continue in the dashboard without connecting it.
6. Send Ruvi a text question. Send `unlink` to disconnect the WhatsApp number from that Ruveon account.

`WHATSAPP_VERIFY_TOKEN` is not issued by Meta: create a private random value yourself, put it in Render, and enter the exact same value into Meta's webhook setup. It is separate from `WHATSAPP_APP_SECRET`.

**WhatsApp cannot start a conversation silently:** browsers and WhatsApp require the person to open/send the pre-filled first message. After the person sends it, Meta delivers incoming messages to the webhook and Ruvi can reply. Automated messages outside Meta's customer-service window may require an approved template and can incur charges. Check [Meta's current WhatsApp pricing](https://business.whatsapp.com/products/platform-pricing) and policies before inviting users. A test sender/test token is not the same as a production-ready WhatsApp business number.

## Environment variables

The root `.env.example` lists the variables for reference. In production, enter them in the Vercel or Render dashboard rather than committing a `.env` file:

| Variable | Where | Purpose |
| --- | --- | --- |
| `APP_ENV` | Render | Set to `production`; enables production configuration checks. |
| `DATABASE_URL` | Render | Persistent PostgreSQL connection URL. |
| `AUTH_SECRET` | Render | Render-generated signing secret; do not share it. |
| `CORS_ORIGINS` | Render | Exact Vercel website origin(s), comma-separated. |
| `GEMINI_API_KEY` | Render | Private Gemini credential. |
| `GEMINI_MODEL` | Render | Gemini model name; defaults to `gemini-2.5-flash`. |
| `WHATSAPP_VERIFY_TOKEN` | Render and Meta | Webhook verification value chosen by you. |
| `WHATSAPP_APP_SECRET` | Render | Meta app secret used to verify webhook signatures. |
| `WHATSAPP_ACCESS_TOKEN` | Render | Meta Cloud API bearer token. |
| `WHATSAPP_PHONE_NUMBER_ID` | Render | Meta Cloud API sender ID. |
| `WHATSAPP_DISPLAY_NUMBER` | Render | Sender phone number for the `wa.me` link. |
| `VITE_API_BASE_URL` | Vercel | Full Render API URL ending in `/api/v1`. |

## What is working versus what still needs outside setup

- The repository contains the frontend/API wiring, token-protected API routes, database migrations, Gemini request handler, WhatsApp webhook, WhatsApp account linking, Vercel SPA routing, and Render service configuration.
- The public repository is prepared, but live deployment still requires importing it into Vercel and Render, a persistent PostgreSQL database, production environment variables, and verification against those live services.
- Automated WhatsApp requires Meta's business onboarding, a sender number, approved/valid credentials, and webhook subscription. Until configured, website login should continue to the dashboard rather than opening WhatsApp.
- The WhatsApp bot currently answers finance questions from a summary; it does not create or edit transactions by interpreting chat messages.
- The in-app privacy notice is available at `/privacy`. Confirm its privacy contact remains monitored and establish a reliable account/data deletion process and retention policy before public launch.
- Provider plans, free quotas, and WhatsApp charges depend on the current provider rules and usage. Check the linked official pricing pages before launch.
