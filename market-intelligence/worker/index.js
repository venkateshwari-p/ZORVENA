const ALLOWED_ORIGIN = "https://venkateshwari-p.github.io";

function json(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
      "Vary": "Origin"
    }
  });
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z"));
}

export default {
  async fetch(request, env) {
    const requestOrigin = request.headers.get("Origin") || "";
    const origin = requestOrigin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Vary": "Origin"
        }
      });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    if (!env.DB) {
      return json({ error: "D1 binding DB is missing" }, 500, origin);
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        const result = await env.DB.prepare(
          "SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type = 'table' AND name IN ('data_sources','commodities','markets','price_observations','collection_runs')"
        ).first();
        return json({
          service: "ZORVENA Market Intelligence API",
          status: result?.table_count === 5 ? "ready" : "database_incomplete",
          database_tables_verified: result?.table_count ?? 0,
          prices_collected: false,
          note: "Database and API foundation only. No market prices have been collected yet."
        }, 200, origin);
      }

      if (url.pathname === "/api/sources") {
        const result = await env.DB.prepare(
          "SELECT source_key, name, base_url, country_code, price_types, expected_frequency, enabled, last_checked_at FROM data_sources ORDER BY name"
        ).all();
        return json({ data: result.results || [], count: result.results?.length || 0 }, 200, origin);
      }

      if (url.pathname === "/api/commodities") {
        const result = await env.DB.prepare(
          "SELECT commodity_key, canonical_name, category FROM commodities ORDER BY canonical_name"
        ).all();
        return json({ data: result.results || [], count: result.results?.length || 0 }, 200, origin);
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
          if (!validDate(from)) return json({ error: "from must use YYYY-MM-DD" }, 400, origin);
          filters.push("observed_on >= ?");
          values.push(from);
        }
        if (to) {
          if (!validDate(to)) return json({ error: "to must use YYYY-MM-DD" }, 400, origin);
          filters.push("observed_on <= ?");
          values.push(to);
        }
        if (from && to && from > to) {
          return json({ error: "from cannot be later than to" }, 400, origin);
        }

        const where = filters.length ? " WHERE " + filters.join(" AND ") : "";
        const rawLimit = Number(url.searchParams.get("limit") || 50);
        const rawOffset = Number(url.searchParams.get("offset") || 0);
        if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100 ||
            !Number.isInteger(rawOffset) || rawOffset < 0 || rawOffset > 1000000) {
          return json({ error: "limit must be 1-100 and offset must be 0-1000000" }, 400, origin);
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
        }, 200, origin);
      }

      return json({
        error: "Not found",
        available_endpoints: ["/health", "/api/sources", "/api/commodities", "/api/prices"]
      }, 404, origin);
    } catch (error) {
      return json({
        error: "Database request failed",
        detail: error instanceof Error ? error.message : "Unknown error"
      }, 500, origin);
    }
  }
};
