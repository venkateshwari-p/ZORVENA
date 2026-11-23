# ZORVENA Global Database API (authenticated read-only API)

This is a separate Cloudflare Worker for the BigQuery-backed Global Database. It does not use or modify the Market Intelligence D1 database.

## Current scope

- Authenticated health endpoint.
- Dashboard overview counts.
- Sector, industry, sub-sector and division taxonomy.
- Read-only company and people directory search.
- Read-only company and person source-evidence register.
- Parameterized search filters and bounded pagination.
- Browser-side CSV preview and preliminary structural validation in the dashboard; no CSV data is sent to this API.

CSV import, data updates and export generation are intentionally not enabled. The dashboard's Import Centre currently performs only local CSV preview and preliminary structure checks; it does not upload files or change BigQuery.

## Required secrets

Create these Worker secrets in Cloudflare. Never commit either value to GitHub or place them in frontend JavaScript.

- `ADMIN_API_TOKEN`: a long random token that the dashboard operator enters when using the database page.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: the complete JSON key content for a dedicated, least-privilege Google Cloud service account.

The service account should initially have:
- `roles/bigquery.jobUser` on project `zorvena-market-intelligence`.
- `roles/bigquery.dataViewer` on dataset `zorvena_market_db` only.

Do not grant BigQuery Data Editor yet. The current Worker intentionally exposes GET-only routes and has no database import or write endpoint. Any future write access should be reviewed separately and limited to the dataset, with server-side row validation, duplicate handling and audit logging implemented first.

Do not grant Owner, Editor, or project-wide BigQuery Data Editor. Do not enable write routes with this read-only account.

Google recommends Application Default Credentials for workloads on Google Cloud and Workload Identity Federation for supported external workloads. This Cloudflare Worker implementation uses a service-account key stored only as a Cloudflare Worker secret, following Cloudflare's BigQuery integration pattern. A key is sensitive: restrict its IAM roles, rotate it if exposed, and never paste it into chat or GitHub.

## Deploy through Cloudflare Git integration

The repository's Worker source is in `backend/global-database-worker`. In Cloudflare **Workers & Pages → zorvena-global-database-api → Settings → Builds**, connect this repository and use:

- Production branch: `main`
- Root directory: `backend/global-database-worker`
- Build command: `npm install`
- Deploy command: `npx wrangler deploy`

A commit pushed to the connected production branch should trigger a build and deployment. Check **Deployments** for the latest build result. Do not use the Quick Edit / Hello World editor as the source of truth when Git integration is enabled.

For local CLI deployment, from this directory:
```bash
npm install
npx wrangler login
npx wrangler secret put ADMIN_API_TOKEN
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler deploy
```

## Required Cloudflare secrets

Add these under **Settings → Variables and Secrets** after the correct Git-connected Worker code is deployed:

- `ADMIN_API_TOKEN`
- `GOOGLE_SERVICE_ACCOUNT_JSON`

When prompted for `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the complete JSON file contents into the Cloudflare secret input. Do not add the JSON file to this repository or paste it into chat.

## API authentication

Every endpoint except CORS preflight requires:
```
Authorization: Bearer YOUR_ADMIN_API_TOKEN
```

The dashboard must ask the operator for this token at runtime. Do not hardcode it in a public GitHub Pages file. CORS only controls browser access; the bearer token is the actual API gate.

## Endpoints

- `GET /health`
- `GET /api/overview`
- `GET /api/taxonomy`
- `GET /api/companies?q=&country=&sector_id=&industry_id=&subsector_id=&limit=50&offset=0`
- `GET /api/people?q=&company_id=&country=&limit=50&offset=0`
- `GET /api/sources` (up to 100 source rows from `company_sources` and `person_sources`, plus source-table column metadata)

The company and people tables are currently empty according to the last user-run BigQuery verification. Empty results are expected until records are imported.

## Important

- This Worker is read-only. It does not run INSERT, UPDATE, DELETE, MERGE or table-replacement statements.
- CORS and request handling currently allow GET and OPTIONS only; do not attempt CSV upload until a separately reviewed import API is deployed.
- The API uses parameterized BigQuery queries and caps result page sizes.
- The first successful API test should be `/health`, followed by `/api/overview` and `/api/taxonomy`.
- BigQuery query execution and Cloudflare usage may incur costs or be subject to quotas. Review the relevant Google Cloud and Cloudflare pricing and limits before production use.
