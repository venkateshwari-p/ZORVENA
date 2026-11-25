# Global Database Verification Workflow

## Scope

This workflow uses the existing BigQuery tables and columns only. It does not create, alter, rename, or delete tables or columns.

Target: build a worldwide agriculture company and public professional-contact database in controlled, auditable batches. The 50,000 target is a combined total of verified company and person records, not a promise of immediate availability.

## 1. Source approval before collection

For each source, record and review:

- Official source name and URL
- Source type (company website, government registry, association, trade fair, etc.)
- Access method (manual, permitted API, downloadable dataset)
- Terms of use, licence, attribution and redistribution restrictions
- Authentication requirements, rate limits and costs
- Date reviewed and approval status

Do not automate collection from a source until its terms and permitted use have been reviewed. A source being publicly viewable does not automatically permit bulk extraction or republication.

## 2. Company candidate collection

Collect only business-relevant facts supported by a traceable source:

- Company name and, when available, legal name or registration identifier
- Country and available location details
- Official website and public company profile URL
- Agriculture-related products, services or operations
- Sector, industry and subsector selected from the existing taxonomy
- Relevant business divisions, where supported
- Evidence URL and the date checked

A registry listing alone is not enough to classify a company as an agriculture business. Confirm agriculture relevance using the company's official website or another credible direct source.

## 3. Professional-contact collection

Add a person only when a public, business-relevant source supports the person's identity and current company/role.

- Record name, current job title, department and company relationship only when evidenced.
- Use public professional profile URLs where permitted.
- Record business email or business phone only when explicitly published for business contact.
- Never guess email patterns, generate phone numbers, or infer private contact details.
- Keep outreach permission/legal review separate from verification status.

## 4. Verification statuses

| Status | Rule |
|---|---|
| VERIFIED | Identity and relevant business facts are supported by current, traceable evidence. |
| PARTIALLY_VERIFIED | Identity is supported, but one or more important fields remain unconfirmed. |
| NEEDS_REVIEW | Evidence is conflicting, stale, ambiguous or insufficient. |
| UNVERIFIED | Not yet checked against acceptable evidence. |

Only records marked VERIFIED count toward the 50,000 target. Do not upgrade a record solely because it has many populated fields.

## 5. Evidence and freshness

For every candidate, preserve source details in the existing source/evidence fields or related source tables, wherever those fields already exist:

- Source name and URL
- Source type
- What facts the source supports
- Retrieval/check date
- Licence/terms URL and attribution requirement, if applicable
- Review outcome and reviewer note

Use the source's publication/update date when available. Recheck important company and role details before marking them VERIFIED. Do not invent missing dates.

## 6. Deduplication

Before adding a record, compare against existing records:

- Companies: registration identifier + country first; otherwise normalized company name + country + official domain.
- People: normalized name + company + current role/profile URL.
- Do not merge records based on name alone when multiple entities could match.
- Preserve alternate names and source URLs where the existing schema supports them.
- Send uncertain matches to NEEDS_REVIEW rather than deleting or merging automatically.

## 7. Batch quality gates

Start with a small pilot batch (for example, 25 company candidates and up to 25 associated public professional contacts).

A batch is ready for import only when:

- Required existing-table fields are mapped and valid.
- Each candidate has at least one traceable source.
- Agriculture relevance is evidenced.
- Duplicate checks are complete.
- Verification status is assigned honestly.
- Source terms have been reviewed.
- No unsupported or guessed values are present.

Review pilot results before increasing batch size. Track counts by status, country, source and sector. Report verified and unverified totals separately.

## 8. Import safety

- Use only the current production schema; do not alter table structure as part of this workflow.
- Map data to existing columns only after confirming their actual names and types.
- Test imports in a separate staging process or with a small reviewed batch before any production write.
- Keep raw source files and import logs access-controlled; do not commit personal contact data, API tokens or credentials to the public GitHub repository.
- Never expose private contact records through a public dashboard/API.
- Keep the current read-only Worker read-only until a separately reviewed, authenticated import process is approved.

## 9. Batch reporting

For each batch, report:

- Candidates reviewed
- VERIFIED / PARTIALLY_VERIFIED / NEEDS_REVIEW / UNVERIFIED counts
- Duplicate candidates
- Rejected candidates and reasons
- Source/licence issues
- Import result and timestamp, if an import is authorized

A batch report must distinguish records reviewed from records successfully imported.
