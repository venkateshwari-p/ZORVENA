# ZORVENA Global Database — Source Registry

Registry status: **initial candidates documented; not yet approved for automated collection**.

This file is source metadata only. It contains no company or personal-contact records, API keys, credentials, or collected data. Do not mark a company or person VERIFIED merely because it appears in a directory.

## Source candidates

| Source ID | Jurisdiction | Source | Official URL | Intended use | Evidence returned | Current status |
|---|---|---|---|---|---|---|
| SRC-GB-001 | United Kingdom | Companies House | https://developer.company-information.service.gov.uk/ | Legal entity lookup and company status | Company number, legal name, status, registered office and filing data where available | REVIEW_REQUIRED |
| SRC-AU-001 | Australia | Australian Business Register — ABN Lookup | https://abr.business.gov.au/ | ABN and business identity lookup | ABN status, entity name and registration details where returned | REVIEW_REQUIRED |
| SRC-EU-001 | European Union | BRIS / European e-Justice | https://e-justice.europa.eu/ | Locate participating national business registers and company records | Registry information subject to each national register's access rules | REVIEW_REQUIRED |
| SRC-EU-002 | European Union | VIES VAT number validation | https://ec.europa.eu/taxation_customs/vies/ | VAT number validation only | VAT validity and identity fields when supplied by the member state | REVIEW_REQUIRED |
| SRC-INT-001 | International | GLEIF LEI Search / API | https://www.gleif.org/en/lei-data/gleif-api | Legal entity identifier and reference data | LEI, legal name, registered address and relationship data when present | REVIEW_REQUIRED |
| SRC-IN-001 | India | Ministry of Corporate Affairs | https://www.mca.gov.in/ | Company/LLP master-data lookup | Legal name, CIN/LLPIN, status and other fields exposed by MCA | REVIEW_REQUIRED |
| SRC-IN-002 | India | India Open Government Data | https://www.data.gov.in/ | Discover and access government-published datasets | Dataset-specific fields, licence and update frequency | REVIEW_REQUIRED |
| SRC-INT-002 | International | OpenCorporates API | https://api.opencorporates.com/documentation/API-Reference | Candidate discovery and legal-entity reconciliation; verify against primary registry | Company identifiers, registry links and provenance where returned | LICENCE_REVIEW_REQUIRED |

## Approval rules

A source must remain disabled until all of the following are recorded:

1. The publisher and source owner are identified.
2. The exact endpoint, dataset or search page is documented.
3. Terms, licence, attribution and redistribution restrictions are reviewed.
4. Authentication, rate limits, costs and permitted collection methods are documented.
5. A small test confirms the returned fields and source links.
6. A refresh cadence and failure-handling process are defined.

REVIEW_REQUIRED and LICENCE_REVIEW_REQUIRED are not approved states. No automated harvesting should run against these entries until a reviewer changes the status after checking the current terms.

## Verification policy

### Company records

- Legal identity: prefer the relevant national government registry.
- Operating website and business activity: use the company's own website or other direct, dated evidence.
- Agriculture classification: require evidence of actual agriculture-related products, services or operations; do not infer it from a broad company name alone.
- Record the exact source URL, retrieval timestamp, evidence type and fields supported by each source.

### Professional-contact records

- Use public professional information relevant to the person's business role.
- Prefer the employer's official team/contact page or a public professional profile.
- Store business contact details only when explicitly published for business contact and permitted by the source's terms and applicable law.
- Do not infer email addresses, guess phone numbers, collect private/personal contact details, or bypass platform access restrictions.
- Re-check current employment and role before marking a contact VERIFIED.

## Record statuses

- VERIFIED: required identity and relevant business facts are supported by current, traceable evidence.
- PARTIALLY_VERIFIED: identity is supported, but one or more required business fields remain unconfirmed.
- NEEDS_REVIEW: sources conflict, are stale, or are insufficient.
- UNVERIFIED: not yet checked.

Only VERIFIED records count toward the 50,000 combined company + professional-contact target. A company and a person are separate records. Missing data must remain null/blank, never fabricated.

## Provenance fields required for each evidence item

- source_id
- source_name
- source_url
- source_type
- evidence_description
- fields_supported
- retrieved_at
- terms_or_licence_url
- attribution_required
- review_status

## Notes

- Official registry status confirms legal registration facts only; it does not, by itself, prove current trading activity or agriculture relevance.
- VAT validation is not a substitute for a national company-register check.
- LEI data covers entities that have an LEI; it is not a complete global business directory.
- OpenCorporates is an aggregator of registry-derived data, not the primary registry. Its API requires a key and its licence/API terms must be checked before reuse or redistribution. Its API documentation describes separate conditions for open-data projects and paid/internal or external distribution.
- Keep personal-contact data out of the public GitHub repository. This repository file is intended to document source metadata and rules only.
