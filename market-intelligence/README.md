# ZORVENA Market Intelligence

A free-tier-first price intelligence module for vegetable markets. It stores dated observations instead of overwriting the latest price, so historical trends can be calculated.

## Product strategy: hybrid data provider

ZORVENA will combine two clearly distinguished kinds of data:

1. **External-source observations** — data imported from government and authorized third-party sources, with the original source, source URL, observation date, collection time, license/attribution and reporting frequency.
2. **Original ZORVENA observations** — market quotations submitted by ZORVENA staff, authorized partners or verified market contributors. These must retain reporter/source identity, submission time, evidence where available, and a review status. Do not label a report verified until a review has actually occurred.

The public API will normalize both kinds of data into a consistent response while preserving their provenance. Wholesale, retail, producer and international prices remain separate types.

## Coverage strategy

- Start with India wholesale observations from AGMARKNET / the Open Government Data Platform.
- Add retail and international series only when a source publishes usable data with clear dates, geography, units, and reuse terms.
- Do not label monthly or weekly observations as daily or live.
- Never fill missing observations with estimates or generated values.
- The initial AGMARKNET CSV fields are State, District, Market, Commodity, Variety, Grade, Arrival_Date, Min Price, Max Price and Modal Price.
- AGMARKNET's NIC manual identifies the DMI standard price unit as Rs./Quintal; retain this unit and a quality note because local commodity settings may use conversion formulas.

## Planned free-tier architecture

- Public dashboard: GitHub Pages, in the existing ZORVENA repository.
- API and scheduled collection: Cloudflare Workers.
- Historical database: Cloudflare D1.
- Source adapters: one adapter per data provider, with source-specific attribution and refresh frequency.
- CSV import: browser-side file parsing, authenticated small batches to the Worker, and D1 inserts. The CSV file is not committed to GitHub.
- Original reports: a separate authenticated submission and review workflow; do not mix unreviewed reports with external-source observations.

Cloudflare free-tier limits apply and can change. Current official documentation lists 100,000 Workers requests per day and a 10 ms CPU time limit per Free invocation. D1 Free currently allows 500 MB per database and 5 GB total account storage. Design imports in small batches and monitor daily usage. See:
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Data quality rules

1. Every observation keeps its source, source URL, collection time, and original observation date.
2. Keep wholesale, retail, producer, and international prices separate.
3. Keep minimum, maximum, modal, and average prices in separate fields.
4. Preserve original currency and unit. Do not compare unlike units without a documented conversion.
5. Preserve commodity variety and grade when the source provides them.
6. Missing data stays missing. A source's reporting frequency is displayed to users.
7. Exact duplicate source records are skipped; observations are not silently overwritten.
8. External-source records and original ZORVENA reports must remain distinguishable.

## Initial source candidates

- India Open Government Data / AGMARKNET: daily mandi wholesale minimum, maximum, and modal prices. The CSV download has been obtained by the project owner; the first sample records were inspected.
- CEDA Agmarknet API: candidate for programmatic access, but do not use for a commercial ZORVENA service until its terms explicitly permit it.
- FAO FPMA: candidate for international domestic wholesale/retail price series, often weekly or monthly depending on series.

Before enabling an automated adapter, verify endpoint access, terms of use, attribution requirements, response fields, and refresh frequency. A public webpage is not automatically an unrestricted API.

## Current status

- Cloudflare Worker and D1 binding are configured by the project owner.
- Health, sources, commodities and prices endpoints were tested by the project owner.
- Three source records are registered and remain disabled for scheduled collection.
- The AGMARKNET CSV schema and three sample rows were inspected.
- The secure batch importer is being prepared; it has not yet been deployed or tested.
- No market price observations have been imported yet.
- No scheduled collector or original-report workflow is active.
- Do not claim that live or historical data is available until records are actually imported and verified.
