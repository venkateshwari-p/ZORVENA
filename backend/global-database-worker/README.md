# ZORVENA Global Database API (read-only foundation)

This is a separate Cloudflare Worker for the BigQuery-backed Global Database. It does not use or modify the Market Intelligence D1 database.

## Current scope

- Authenticated health endpoint.
- Dashboard overview counts.
- Sector, industry, sub-sector and division taxonomy.
- Read-only company and people directory search.
- Parameterized search filters and bounded pagination.

CSV import, data updates and export generation are intentionally not enabled in this first backend stage. They will be added only after the read-only connection is tested and the BigQuery billing / import method is confirmed.

## Required secrets

Create these Worker secrets in Cloudflare. Never commit either value to GitHub or place them in frontend JavaScript.

- `ADMIN_API_TOKEN`: a long random token that the dashboard operator enters when using the database page.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: the complete JSON key content for a dedicated, least-privilege Google Cloud service account.

The service account should initially have:
- `roles/bigquery.jobUser` on project `zorvena-market-intelligence`.
- `roles/bigquery.dataViewer` on dataset `zorvena_market_db` only.

Do not grant Owner, Editor, or project-wide BigQuery Data Editor. Do not enable write routes with this read-only account.

Google recommends Application Default Credentials for workloads on Google Cloud and Workload Identity Federation for supported external workloads. This Cloudflare Worker implementation uses a service-account key stored only as a Cloudflare Worker secret, following Cloudflare's BigQuery integration pattern. A key is sensitive: restrict its IAM roles, rotate it if exposed, and never paste it into chat or GitHub.

## Deploy through Cloudflare dashboard

1. Open **Workers & Pages**.
2. Create a Worker named `zorvena-global-database-api`.
3. Replace its editor code with `src/index.js` from this folder, or deploy this folder with Wrangler.
4. Add the two secrets above under **Settings → Variables and Secrets**.
5. Confirm the text variables from `wrangler.toml`.
6. Deploy and copy the Worker URL ending in `.workers.dev`.

For local CLI deployment, from this directory:
```bash
npm install
npx wrangler login
npx wrangler secret put ADMIN_API_TOKEN
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON
npx wrangler deploy
```

When prompted for `GOOGLE_SERVICE_ACCOUNT_JSON`, paste the complete JSON file contents into the terminal prompt. Do not add the JSON file to this repository.

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

The company and people tables are currently empty according to the last user-run BigQuery verification. Empty results are expected until records are imported.

## Important

- This Worker is read-only. It does not run INSERT, UPDATE, DELETE, MERGE or table-replacement statements.
- The API uses parameterized BigQuery queries and caps result page sizes.
- The first successful API test should be `/health`, followed by `/api/overview` and `/api/taxonomy`.
- BigQuery query execution and Cloudflare usage may incur costs or be subject to quotas. Review the relevant Google Cloud and Cloudflare pricing and limits before production use.
