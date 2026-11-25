-- ZORVENA Global Database: read-only live schema inspection
-- Run this in the BigQuery SQL workspace.
-- Set the query processing location to the same location as dataset zorvena_market_db.
-- This query reads metadata only; it does not modify any tables or records.

SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable
FROM
  `zorvena-market-intelligence.zorvena_market_db.INFORMATION_SCHEMA.COLUMNS`
WHERE
  table_name IN (
    'global_companies',
    'global_people',
    'company_sources',
    'person_sources'
  )
ORDER BY
  table_name,
  ordinal_position;

-- Optional: inspect row counts without exposing personal contact data.
SELECT
  'global_companies' AS table_name,
  COUNT(*) AS row_count
FROM
  `zorvena-market-intelligence.zorvena_market_db.global_companies`
UNION ALL
SELECT
  'global_people' AS table_name,
  COUNT(*) AS row_count
FROM
  `zorvena-market-intelligence.zorvena_market_db.global_people`
UNION ALL
SELECT
  'company_sources' AS table_name,
  COUNT(*) AS row_count
FROM
  `zorvena-market-intelligence.zorvena_market_db.company_sources`
UNION ALL
SELECT
  'person_sources' AS table_name,
  COUNT(*) AS row_count
FROM
  `zorvena-market-intelligence.zorvena_market_db.person_sources`
ORDER BY
  table_name;
