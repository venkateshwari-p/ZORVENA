# Global Database — Target Data Schema (Design Draft)

Status: DESIGN ONLY — NOT A DATABASE MIGRATION

This document defines the target structure for the 50,000-record programme. A record means either one company or one individual professional contact. Only records with `verification_status = VERIFIED` and sufficient current evidence count toward the target.

## 1. Important implementation boundary

The live Worker currently reads these tables:
- `global_companies`
- `global_people`
- `company_sources`
- `person_sources`

Its API currently selects a subset of company and person columns. The exact BigQuery column definitions have not yet been retrieved from BigQuery INFORMATION_SCHEMA. Therefore this document does not claim that every field below already exists. Do not run ALTER, CREATE OR REPLACE, or import statements based on this draft. First export the live schemas and compare them field-by-field.

## 2. Company record — target logical fields

| Field | Purpose |
|---|---|
| company_id | Stable internal ID; never reuse |
| company_name | Public trading / commonly used name |
| legal_name | Registered legal entity name, if verified |
| registration_number | Public registry identifier, where permitted |
| registration_country | Jurisdiction of registration |
| country | Country of operating headquarters / primary operation |
| state_region | State, province or region |
| city | City |
| postal_code | Public business postal code, if relevant |
| official_website | Official company domain |
| linkedin_url | Official company page, when public |
| company_type | Legal or organisational type, when verified |
| business_type | Manufacturer, grower, exporter, importer, distributor, service provider, etc. |
| year_established | Only when supported by a source |
| employee_range | Publicly stated range, not a guessed exact count |
| products_services | Agriculture products and services |
| trade_activity | Import/export activity with evidence and date |
| sector_id | Primary agriculture sector |
| industry_id | Primary industry |
| subsector_id | Primary subsector |
| division_summary | Relevant company functions / divisions |
| operating_status | Active, inactive, dissolved, unknown; based on suitable evidence |
| verification_status | VERIFIED, PARTIALLY_VERIFIED, NEEDS_REVIEW, UNVERIFIED |
| verification_notes | Concise explanation of checks and unresolved issues |
| source_url | Compatibility / primary source URL surfaced in current API |
| created_at | First database insertion timestamp |
| updated_at | Most recent record update timestamp |
| last_verified_at | Date of most recent successful verification |

Additional classifications should remain in the existing relationship table(s), rather than storing multiple sector/industry IDs in comma-separated strings.

## 3. Individual professional contact — target logical fields

| Field | Purpose |
|---|---|
| person_id | Stable internal ID; never reuse |
| company_id | Link to current company record |
| full_name | Public professional name |
| job_title | Current public job title |
| department | Relevant company division |
| decision_role | Decision-maker, influencer, researcher, operator, etc. |
| purchasing_responsibility | Publicly evidenced purchasing remit, if applicable |
| product_interest | Relevant agriculture product / service interest, evidence-based |
| country | Work country |
| contact_location | Public professional location, if available |
| linkedin_profile | Public professional profile URL, where permitted |
| business_email | Public business email only; never guessed |
| business_phone | Public business phone only; never personal/private number |
| contact_source_url | Direct source supporting identity, role or contact detail |
| verification_status | VERIFIED, PARTIALLY_VERIFIED, NEEDS_REVIEW, UNVERIFIED |
| outreach_permission_status | Permission / lawful-contact review state; not inferred from public visibility |
| verification_notes | What was checked and what remains uncertain |
| created_at | First database insertion timestamp |
| updated_at | Most recent record update timestamp |
| last_verified_at | Date of most recent successful role/contact verification |

Do not count a contact as VERIFIED if the person's current employer or role is stale or unclear. Do not generate likely email addresses or infer direct phone numbers.

## 4. Evidence and provenance — required for both record types

Keep evidence in the existing `company_sources` and `person_sources` relationship tables, after their live schemas are confirmed. The logical evidence fields are:

- evidence_id — stable evidence-row ID
- entity_id — company_id or person_id, according to the evidence table
- source_id — link to the source registry
- source_name
- source_url — exact page / document used, not only the source homepage
- source_type — official website, government registry, association, trade fair, public professional profile, trade dataset, etc.
- evidence_description — what the source actually supports
- fields_supported — list of field names supported by this evidence
- retrieved_at — when the evidence was collected
- source_published_at — source publication/update date, if available
- terms_or_licence_url — applicable source terms
- attribution_required — yes/no/unknown
- review_status — pending, approved, rejected, licence review required
- reviewer_notes

A source record is not proof of every field. Link each source to the specific facts it supports. Keep a history of evidence instead of overwriting old source URLs.

## 5. Verification rules

- VERIFIED: identity and all fields required for the intended use are supported by current, traceable evidence.
- PARTIALLY_VERIFIED: entity identity is supported, but one or more important business/contact fields remain unconfirmed.
- NEEDS_REVIEW: evidence conflicts, appears stale, or cannot support a reliable conclusion.
- UNVERIFIED: not yet checked.

Only VERIFIED company and person records count toward the 50,000 target. Missing information remains NULL. Do not fill gaps with guesses.

For companies, a registry entry alone does not prove active agriculture-related operations. Confirm agriculture products/services or operations from an official company source or another direct, credible source.

For people, use public business-relevant information only. Public visibility does not automatically establish permission to market to a person. Track outreach permission/legal review separately.

## 6. Deduplication and relationship rules

- Company deduplication should use jurisdiction + registration number when reliable; otherwise compare official domain, legal name, country and address, then send uncertain matches to review.
- Person deduplication should use stable public profile URL where available plus name and employer; do not merge on name alone.
- A person may change employers. Preserve person identity and retain dated employment/company relationships rather than silently rewriting history.
- One company may have multiple source records and multiple classification links.
- Never use a company name or person's name as the only database key.

## 7. Data quality checks before a record can be VERIFIED

Company:
1. Company identity is supported by a traceable source.
2. Country and official website are checked where available.
3. Agriculture relevance is evidenced.
4. Classification is mapped to the approved taxonomy.
5. Source rights and permitted use have been reviewed.
6. Duplicate check is complete.
7. Last-verified date and reviewer/evidence notes are present.

Person:
1. Public professional identity is supported.
2. Current employer and role are supported by a recent source.
3. Any displayed business contact detail is explicitly published by a suitable source.
4. Contact details are not guessed or private.
5. Outreach permission/legal review is recorded separately.
6. Duplicate check is complete.
7. Last-verified date and evidence notes are present.

## 8. Required next technical step

Retrieve the live BigQuery schemas for `global_companies`, `global_people`, `company_sources`, and `person_sources` from `INFORMATION_SCHEMA.COLUMNS`. Compare them with this design and prepare a non-destructive migration plan. Do not modify production tables until that comparison is complete and the dashboard/API field mappings are updated and tested.
