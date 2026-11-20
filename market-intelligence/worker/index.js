const ALLOWED_ORIGIN = "https://venkateshwari-p.github.io";
const AGMARKNET_SOURCE_URL = "https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store",
      "Vary": "Origin"
    }
  });
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeArrivalDate(value) {
  const input = String(value || "").trim();
  let year, month, day;
  let match = input.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    day = Number(match[1]); month = Number(match[2]); year = Number(match[3]);
  } else {
    match = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    year = Number(match[1]); month = Number(match[2]); day = Number(match[3]);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function cleanText(value, max = 200) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

function numericPrice(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function commodityKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function makeNaturalKey(record) {
  return [
    record.observed_on, record.state, record.district, record.market,
    record.commodity, record.variety || "", record.grade || ""
  ].join("|").toLowerCase();
}

async function importAgmarknet(request, env) {
  if (!env.IMPORT_TOKEN) {
    return json({ error: "Import is not configured. Add the IMPORT_TOKEN secret to this Worker first." }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  if (authorization !== "Bearer " + env.IMPORT_TOKEN) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }

  if (!Array.isArray(body.records) || body.records.length < 1 || body.records.length > 50) {
    return json({ error: "Send between 1 and 50 records per batch" }, 400);
  }

  const statements = [];
  const validRecords = [];
  const errors = [];

  for (let index = 0; index < body.records.length; index++) {
    const input = body.records[index] || {};
    const record = {
      state: cleanText(input.state),
      district: cleanText(input.district),
      market: cleanText(input.market),
      commodity: cleanText(input.commodity),
      variety: cleanText(input.variety),
      grade: cleanText(input.grade),
      observed_on: normalizeArrivalDate(input.arrival_date),
      min_price: numericPrice(input.min_price),
      max_price: numericPrice(input.max_price),
      modal_price: numericPrice(input.modal_price)
    };

    const problems = [];
    if (!record.state) problems.push("state missing");
    if (!record.district) problems.push("district missing");
    if (!record.market) problems.push("market missing");
    if (!record.commodity) problems.push("commodity missing");
    if (!record.observed_on) problems.push("arrival date invalid");
    if (record.min_price === null) problems.push("minimum price invalid");
    if (record.max_price === null) problems.push("maximum price invalid");
    if (record.modal_price === null) problems.push("modal price invalid");
    if (record.min_price !== null && record.max_price !== null && record.min_price > record.max_price) {
      problems.push("minimum price exceeds maximum price");
    }
    if (problems.length) {
      errors.push({ record: index + 1, problems: problems });
      continue;
    }

    const key = commodityKey(record.commodity);
    if (!key) {
      errors.push({ record: index + 1, problems: ["commodity name could not be normalized"] });
      continue;
    }

    const naturalKey = makeNaturalKey(record);
    const dedupeKey = naturalKey + "|" + record.min_price + "|" + record.max_price + "|" + record.modal_price;
    const rawPayload = JSON.stringify(input);

    statements.push(env.DB.prepare(
      "INSERT OR IGNORE INTO commodities (commodity_key, canonical_name, category) VALUES (?, ?, 'produce')"
    ).bind(key, record.commodity));

    statements.push(env.DB.prepare(
      "INSERT OR IGNORE INTO price_observations (dedupe_key, source_key, source_record_id, observed_on, country_code, admin1, admin2, market_name, commodity_key, commodity_name_raw, variety, grade, price_type, min_price, max_price, modal_price, average_price, currency_code, unit_name, unit_quantity, source_url, quality_note, raw_payload) VALUES (?, 'india_agmarknet_ogd', ?, ?, 'IN', ?, ?, ?, ?, ?, ?, ?, 'wholesale', ?, ?, ?, NULL, 'INR', 'quintal', 1, ?, ?, ?)"
    ).bind(
      dedupeKey,
      naturalKey,
      record.observed_on,
      record.state,
      record.district,
      record.market,
      key,
      record.commodity,
      record.variety,
      record.grade,
      record.min_price,
      record.max_price,
      record.modal_price,
      AGMARKNET_SOURCE_URL,
      "AGMARKNET standard DMI price unit is Rs./quintal. Check commodity-specific/local unit conversions before comparing.",
      rawPayload
    ));

    validRecords.push(record);
  }

  if (!statements.length) {
    return json({ error: "No valid records in this batch", received: body.records.length, inserted: 0, skipped: body.records.length, validation_errors: errors }, 422);
  }

  try {
    const results = await env.DB.batch(statements);
    let inserted = 0;
    for (let index = 1; index < results.length; index += 2) {
      if (results[index]?.meta?.changes > 0) inserted += results[index].meta.changes;
    }
    const skipped = validRecords.length - inserted + errors.length;
    return json({
      source: "india_agmarknet_ogd",
      received: body.records.length,
      valid: validRecords.length,
      inserted: inserted,
      skipped: skipped,
      validation_errors: errors,
      note: "Imported observations retain the original AGMARKNET arrival date and source attribution. Exact duplicate records are skipped."
    });
  } catch (error) {
    return json({
      error: "Database import failed",
      detail: error instanceof Error ? error.message : "Unknown database error"
    }, 500);
  }
}

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get("Origin") || "";
    if (requestOrigin && requestOrigin !== ALLOWED_ORIGIN) {
      return new Response("Origin not allowed", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    if (!env.DB) return json({ error: "D1 binding DB is missing" }, 500);

    const url = new URL(request.url);

    if (request.method === "POST") {
      if (url.pathname === "/admin/import/agmarknet") {
        return await importAgmarknet(request, env);
      }
      return json({ error: "POST route not found" }, 404);
    }

    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        const result = await env.DB.prepare(
          "SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type = 'table' AND name IN ('data_sources','commodities','markets','price_observations','collection_runs')"
        ).first();
        const prices = await env.DB.prepare("SELECT COUNT(*) AS total FROM price_observations").first();
        return json({
          service: "ZORVENA Market Intelligence API",
          status: result?.table_count === 5 ? "ready" : "database_incomplete",
          database_tables_verified: result?.table_count ?? 0,
          price_observations: prices?.total ?? 0,
          prices_collected: (prices?.total ?? 0) > 0,
          note: (prices?.total ?? 0) > 0 ? "Price observations are stored." : "Database and API foundation only. No market prices have been collected yet."
        });
      }

      if (url.pathname === "/api/sources") {
        const result = await env.DB.prepare(
          "SELECT source_key, name, base_url, country_code, price_types, expected_frequency, enabled, last_checked_at FROM data_sources ORDER BY name"
        ).all();
        return json({ data: result.results || [], count: result.results?.length || 0 });
      }

      if (url.pathname === "/api/commodities") {
        const result = await env.DB.prepare(
          "SELECT commodity_key, canonical_name, category FROM commodities ORDER BY canonical_name"
        ).all();
        return json({ data: result.results || [], count: result.results?.length || 0 });
      }

      if (url.pathname === "/api/prices") {
        const filters = [];
        const values = [];
        const exactFilters = [
          ["country", "country_code"],
          ["state", "admin1"],
          ["district", "admin2"],
          ["commodity", "commodity_key"],
          ["type", "price_type"],
          ["market", "market_name"]
        ];

        for (const [parameter, column] of exactFilters) {
          const value = url.searchParams.get(parameter);
          if (value) {
            filters.push(column + " = ?");
            values.push(value);
          }
        }

        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        if (from) {
          if (!validDate(from)) return json({ error: "from must use YYYY-MM-DD" }, 400);
          filters.push("observed_on >= ?");
          values.push(from);
        }
        if (to) {
          if (!validDate(to)) return json({ error: "to must use YYYY-MM-DD" }, 400);
          filters.push("observed_on <= ?");
          values.push(to);
        }
        if (from && to && from > to) return json({ error: "from cannot be later than to" }, 400);

        const where = filters.length ? " WHERE " + filters.join(" AND ") : "";
        const rawLimit = Number(url.searchParams.get("limit") || 50);
        const rawOffset = Number(url.searchParams.get("offset") || 0);
        if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100 ||
            !Number.isInteger(rawOffset) || rawOffset < 0 || rawOffset > 1000000) {
          return json({ error: "limit must be 1-100 and offset must be 0-1000000" }, 400);
        }

        const count = await env.DB.prepare(
          "SELECT COUNT(*) AS total FROM price_observations" + where
        ).bind(...values).first();

        const rows = await env.DB.prepare(
          "SELECT observed_on, country_code, admin1, admin2, locality, market_name, commodity_key, commodity_name_raw, variety, grade, price_type, min_price, max_price, modal_price, average_price, currency_code, unit_name, unit_quantity, source_key, source_url, collected_at, quality_note FROM price_observations" +
          where + " ORDER BY observed_on DESC, commodity_name_raw ASC LIMIT ? OFFSET ?"
        ).bind(...values, rawLimit, rawOffset).all();

        return json({
          data: rows.results || [],
          pagination: {
            total: count?.total || 0,
            limit: rawLimit,
            offset: rawOffset
          }
        });
      }

      return json({
        error: "Not found",
        available_endpoints: ["/health", "/api/sources", "/api/commodities", "/api/prices", "POST /admin/import/agmarknet"]
      }, 404);
    } catch (error) {
      return json({
        error: "Database request failed",
        detail: error instanceof Error ? error.message : "Unknown error"
      }, 500);
    }
  }
};
