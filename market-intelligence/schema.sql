-- ZORVENA Market Intelligence - Cloudflare D1 schema
-- Run once against the D1 database. All timestamps are UTC ISO-8601 text.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  country_code TEXT,
  price_types TEXT NOT NULL,
  expected_frequency TEXT NOT NULL,
  terms_url TEXT,
  attribution TEXT,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS commodities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commodity_key TEXT NOT NULL UNIQUE,
  canonical_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'vegetable',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS markets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL,
  source_market_id TEXT,
  market_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  admin1 TEXT,
  admin2 TEXT,
  locality TEXT,
  latitude REAL,
  longitude REAL,
  UNIQUE(source_key, source_market_id, market_name)
);

CREATE TABLE IF NOT EXISTS price_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dedupe_key TEXT NOT NULL UNIQUE,
  source_key TEXT NOT NULL,
  source_record_id TEXT,
  observed_on TEXT NOT NULL,
  collected_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  country_code TEXT NOT NULL,
  admin1 TEXT,
  admin2 TEXT,
  locality TEXT,
  market_name TEXT,
  commodity_key TEXT NOT NULL,
  commodity_name_raw TEXT NOT NULL,
  variety TEXT,
  grade TEXT,
  price_type TEXT NOT NULL CHECK (price_type IN ('wholesale','retail','producer','international','other')),
  min_price REAL,
  max_price REAL,
  modal_price REAL,
  average_price REAL,
  currency_code TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  unit_quantity REAL NOT NULL DEFAULT 1,
  source_url TEXT NOT NULL,
  quality_note TEXT,
  raw_payload TEXT,
  CHECK (min_price IS NULL OR min_price >= 0),
  CHECK (max_price IS NULL OR max_price >= 0),
  CHECK (modal_price IS NULL OR modal_price >= 0),
  CHECK (average_price IS NULL OR average_price >= 0)
);

CREATE INDEX IF NOT EXISTS idx_prices_date ON price_observations(observed_on);
CREATE INDEX IF NOT EXISTS idx_prices_commodity_date ON price_observations(commodity_key, observed_on);
CREATE INDEX IF NOT EXISTS idx_prices_geo_date ON price_observations(country_code, admin1, admin2, observed_on);
CREATE INDEX IF NOT EXISTS idx_prices_type_date ON price_observations(price_type, observed_on);
CREATE INDEX IF NOT EXISTS idx_prices_market_commodity ON price_observations(market_name, commodity_key, observed_on);
CREATE INDEX IF NOT EXISTS idx_prices_source_date ON price_observations(source_key, observed_on);

CREATE TABLE IF NOT EXISTS collection_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','success','partial','failed')),
  records_seen INTEGER NOT NULL DEFAULT 0,
  records_inserted INTEGER NOT NULL DEFAULT 0,
  records_skipped INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);

-- Initial source registry. Sources remain disabled until their access and reuse
-- requirements have been checked and a tested adapter is deployed.
INSERT OR IGNORE INTO data_sources
(source_key, name, base_url, country_code, price_types, expected_frequency, terms_url, attribution, enabled)
VALUES
('india_agmarknet_ogd', 'India Open Government Data / AGMARKNET', 'https://data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi', 'IN', 'wholesale', 'daily', 'https://data.gov.in/', 'Ministry of Agriculture and Farmers Welfare; Directorate of Marketing and Inspection', 0),
('ceda_agmarknet', 'CEDA Agmarknet API', 'https://api.ceda.ashoka.edu.in/documentation/', 'IN', 'wholesale', 'daily/history subject to endpoint availability', 'https://api.ceda.ashoka.edu.in/documentation/', 'Centre for Economic Data and Analysis, Ashoka University', 0),
('fao_fpma', 'FAO FPMA', 'https://fpma.fao.org/', NULL, 'wholesale,retail', 'weekly or monthly depending on series', 'https://www.fao.org/giews/food-prices/tool/public/#/home', 'Food and Agriculture Organization of the United Nations', 0);
