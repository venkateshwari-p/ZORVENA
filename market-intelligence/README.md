# ZORVENA Market Intelligence

A free-tier-first price intelligence module for vegetable markets. This project stores dated observations rather than overwriting the latest price, so historical trends can be calculated.

## Coverage strategy

- Start with India wholesale observations from AGMARKNET / the Open Government Data Platform and the CEDA Agmarknet API.
- Add retail and international series only when a source publishes usable data with clear dates, geography, units, and reuse terms.
- Do not label monthly or weekly observations as daily or live.
- Never fill missing observations with estimates or generated values.

## Planned free-tier architecture

- Public dashboard: GitHub Pages, in the existing ZORVENA repository.
- API and scheduled collection: Cloudflare Workers.
- Historical database: Cloudflare D1.
- Source adapters: one adapter per data provider, with source-specific attribution and refresh frequency.

Cloudflare free-tier limits apply. The current D1 free tier has 500 MB per database, 5 GB total storage per account, 5 million rows read per day, and 100,000 rows written per day. The Workers Free plan currently allows 100,000 requests per day and up to five Cron Triggers per account. Limits can change; check the provider's current documentation before deployment.

## Data quality rules

1. Every observation keeps its source, source URL, collection time, and original observation date.
2. Keep wholesale, retail, and producer prices separate.
3. Keep minimum, maximum, modal, and average prices in separate fields.
4. Preserve the original currency and unit. Do not compare unlike units without a documented conversion.
5. Preserve commodity variety and grade when the source provides them.
6. Missing data stays missing. A source's reporting frequency is displayed to users.
7. Historical records are append-only at the observation level; corrections are recorded with provenance.

## Initial source candidates

- India Open Government Data / AGMARKNET: daily mandi wholesale minimum, maximum, and modal prices.
- CEDA Agmarknet API: programmatic access to Agmarknet commodities, geographies, markets, and prices.
- FAO FPMA: international domestic wholesale/retail price series, often weekly or monthly depending on series.

Before enabling an adapter, verify endpoint access, terms of use, attribution requirements, response fields, and refresh frequency. A public webpage is not automatically an unrestricted API.

## Current status

Foundation schema only. No market data has been collected yet, no D1 database has been connected, and no scheduled collector is active. The dashboard must not display fabricated prices.
