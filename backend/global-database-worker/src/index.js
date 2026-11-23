import { importPKCS8, SignJWT } from "jose";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const BIGQUERY_SCOPE = "https://www.googleapis.com/auth/bigquery";
let cachedGoogleToken = null;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(origin) }
  });
}

function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function decodeField(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.map(item => decodeField(item?.v));
  if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "v")) {
    if (Array.isArray(value.v)) return value.v.map(item => decodeField(item?.v));
    return decodeField(value.v);
  }
  return value;
}

function rowsToObjects(result) {
  const fields = result.schema?.fields || [];
  return (result.rows || []).map(row => {
    const output = {};
    fields.forEach((field, index) => {
      output[field.name] = decodeField(row.f?.[index]?.v);
    });
    return output;
  });
}

async function getGoogleAccessToken(env) {
  if (cachedGoogleToken && cachedGoogleToken.expiresAt > Date.now() + 60000) {
    return cachedGoogleToken.accessToken;
  }

  let account;
  try {
    account = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON secret is missing or is not valid JSON.");
  }
  if (!account.client_email || !account.private_key || !account.token_uri) {
    throw new Error("Service-account JSON must include client_email, private_key and token_uri.");
  }

  const privateKey = await importPKCS8(account.private_key, "RS256");
  const assertion = await new SignJWT({ scope: BIGQUERY_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience(account.token_uri || GOOGLE_TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);

  const form = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion
  });
  const response = await fetch(account.token_uri || GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error("Google token exchange failed. Check the service-account key and IAM permissions.");
  }

  cachedGoogleToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600)) * 1000
  };
  return data.access_token;
}

async function runQuery(env, sql, parameters = []) {
  const accessToken = await getGoogleAccessToken(env);
  const endpoint = "https://bigquery.googleapis.com/bigquery/v2/projects/" +
    encodeURIComponent(env.PROJECT_ID) + "/queries";

  const queryParameters = parameters.map(parameter => ({
    name: parameter.name,
    parameterType: { type: parameter.type },
    parameterValue: { value: parameter.value }
  }));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: sql,
      useLegacySql: false,
      parameterMode: "NAMED",
      queryParameters,
      timeoutMs: 10000,
      maxResults: 1000
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const reason = data.error?.errors?.[0]?.reason || "";
    const message = data.error?.message || "BigQuery query failed.";
    throw new Error(reason + (reason ? ": " : "") + message);
  }
  if (!data.jobComplete) {
    throw new Error("BigQuery query is still running. Retry the request in a moment.");
  }
  return rowsToObjects(data);
}

function intParam(value, fallback, max) {
  if (value === null || value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) return fallback;
  return Math.min(number, max);
}

function addExactFilter(params, where, searchParams, key, column) {
  const value = searchParams.get(key);
  if (value) {
    where.push(column + " = @" + key);
    params.push({ name: key, type: "STRING", value });
  }
}

function table(env, name) {
  return "`" + env.PROJECT_ID + "." + env.DATASET_ID + "." + name + "`";
}

async function handleApi(request, env, url) {
  if (url.pathname === "/health") {
    const rows = await runQuery(env, "SELECT 1 AS connected");
    return { service: "ZORVENA Global Database API", status: Number(rows[0]?.connected) === 1 ? "ready" : "error", database: env.DATASET_ID, mode: "read-only" };
  }

  if (url.pathname === "/api/overview") {
    const sql = `SELECT
      (SELECT COUNT(*) FROM ${table(env, "global_companies")}) AS companies,
      (SELECT COUNT(*) FROM ${table(env, "global_people")}) AS people,
      (SELECT COUNT(*) FROM ${table(env, "agri_sectors")}) AS sectors,
      (SELECT COUNT(*) FROM ${table(env, "agri_industries")}) AS industries,
      (SELECT COUNT(*) FROM ${table(env, "agri_subsectors")}) AS subsectors,
      (SELECT COUNT(*) FROM ${table(env, "company_divisions")}) AS divisions`;
    const rows = await runQuery(env, sql);
    return { data: rows[0] || {} };
  }

  if (url.pathname === "/api/taxonomy") {
    const [sectors, industries, subsectors, divisions] = await Promise.all([
      runQuery(env, `SELECT sector_id, sector_name, sector_description FROM ${table(env, "agri_sectors")} ORDER BY sector_id`),
      runQuery(env, `SELECT industry_id, sector_id, industry_name FROM ${table(env, "agri_industries")} ORDER BY industry_id`),
      runQuery(env, `SELECT subsector_id, industry_id, subsector_name FROM ${table(env, "agri_subsectors")} ORDER BY subsector_id`),
      runQuery(env, `SELECT division_id, division_name, division_description, status FROM ${table(env, "company_divisions")} ORDER BY division_id`)
    ]);
    return { data: { sectors, industries, subsectors, divisions } };
  }

  if (url.pathname === "/api/companies") {
    const params = [];
    const where = [];
    const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
    if (q) {
      where.push("(LOWER(company_name) LIKE CONCAT('%', LOWER(@q), '%') OR LOWER(official_website) LIKE CONCAT('%', LOWER(@q), '%'))");
      params.push({ name: "q", type: "STRING", value: q });
    }
    addExactFilter(params, where, url.searchParams, "country", "country");
    addExactFilter(params, where, url.searchParams, "sector_id", "sector_id");
    addExactFilter(params, where, url.searchParams, "industry_id", "industry_id");
    addExactFilter(params, where, url.searchParams, "subsector_id", "subsector_id");
    addExactFilter(params, where, url.searchParams, "business_type", "business_type");
    addExactFilter(params, where, url.searchParams, "verification_status", "verification_status");

    const limit = intParam(url.searchParams.get("limit"), 50, 100);
    const offset = intParam(url.searchParams.get("offset"), 0, 10000);
    const whereSql = where.length ? " WHERE " + where.join(" AND ") : "";
    const sql = `SELECT company_id, company_name, country, state_region, city, official_website,
      linkedin_url, sector_id, industry_id, subsector_id, division_summary, business_type,
      products_services, trade_activity, verification_status, source_url, last_verified_at
      FROM ${table(env, "global_companies")}${whereSql}
      ORDER BY company_name LIMIT ${limit} OFFSET ${offset}`;
    const countSql = `SELECT COUNT(*) AS total FROM ${table(env, "global_companies")}${whereSql}`;
    const [data, count] = await Promise.all([runQuery(env, sql, params), runQuery(env, countSql, params)]);
    return { data, pagination: { total: Number(count[0]?.total || 0), limit, offset } };
  }

  if (url.pathname === "/api/sources") {
    const schemaSql = `SELECT table_name, column_name
      FROM \`${env.PROJECT_ID}.${env.DATASET_ID}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name IN ("company_sources", "person_sources")
      ORDER BY table_name, ordinal_position`;
    const [schema, companySources, personSources] = await Promise.all([
      runQuery(env, schemaSql),
      runQuery(env, `SELECT * FROM ${table(env, "company_sources")} LIMIT 100`),
      runQuery(env, `SELECT * FROM ${table(env, "person_sources")} LIMIT 100`)
    ]);
    const data = [
      ...companySources.map(row => ({ ...row, source_table: "company_sources", entity_type: "Company" })),
      ...personSources.map(row => ({ ...row, source_table: "person_sources", entity_type: "Person" }))
    ];
    return {
      data,
      schema,
      pagination: { returned: data.length, limit: 100, capped: data.length === 100 }
    };
  }

  if (url.pathname === "/api/people") {
    const params = [];
    const where = [];
    const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
    if (q) {
      where.push("(LOWER(full_name) LIKE CONCAT('%', LOWER(@q), '%') OR LOWER(job_title) LIKE CONCAT('%', LOWER(@q), '%'))");
      params.push({ name: "q", type: "STRING", value: q });
    }
    addExactFilter(params, where, url.searchParams, "company_id", "company_id");
    addExactFilter(params, where, url.searchParams, "country", "country");
    addExactFilter(params, where, url.searchParams, "department", "department");
    addExactFilter(params, where, url.searchParams, "decision_role", "decision_role");
    addExactFilter(params, where, url.searchParams, "verification_status", "verification_status");
    addExactFilter(params, where, url.searchParams, "outreach_permission_status", "outreach_permission_status");

    const limit = intParam(url.searchParams.get("limit"), 50, 100);
    const offset = intParam(url.searchParams.get("offset"), 0, 10000);
    const whereSql = where.length ? " WHERE " + where.join(" AND ") : "";
    const sql = `SELECT p.person_id, p.company_id, c.company_name, p.full_name, p.job_title, p.department, p.country,
      p.linkedin_profile, p.business_email, p.business_phone, p.contact_location, p.decision_role,
      p.purchasing_responsibility, p.product_interest, p.verification_status, p.outreach_permission_status
      FROM ${table(env, "global_people")} p
      LEFT JOIN ${table(env, "global_companies")} c ON p.company_id = c.company_id${whereSql.replace(/\b(company_id|country|department|decision_role|verification_status|outreach_permission_status)\b/g, "p.$1")}
      ORDER BY p.full_name LIMIT ${limit} OFFSET ${offset}`;
    const countSql = `SELECT COUNT(*) AS total FROM ${table(env, "global_people")}${whereSql}`;
    const [data, count] = await Promise.all([runQuery(env, sql, params), runQuery(env, countSql, params)]);
    return { data, pagination: { total: Number(count[0]?.total || 0), limit, offset } };
  }

  return null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "https://venkateshwari-p.github.io";

    if (origin && origin !== allowedOrigin) {
      return new Response("Origin not allowed", { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(allowedOrigin) });
    }

    if (request.method !== "GET") {
      return json({ error: "Method not allowed" }, 405, allowedOrigin);
    }

    const authorization = request.headers.get("Authorization") || "";
    const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!env.ADMIN_API_TOKEN || !constantTimeEqual(suppliedToken, env.ADMIN_API_TOKEN)) {
      return json({ error: "Unauthorized. Enter the database API access token." }, 401, allowedOrigin);
    }

    const url = new URL(request.url);
    try {
      const result = await handleApi(request, env, url);
      if (!result) return json({ error: "Not found", available_endpoints: ["/health", "/api/overview", "/api/taxonomy", "/api/companies", "/api/people", "/api/sources"] }, 404, allowedOrigin);
      return json(result, 200, allowedOrigin);
    } catch (error) {
      return json({
        error: "Database request failed",
        detail: error instanceof Error ? error.message : "Unknown error"
      }, 502, allowedOrigin);
    }
  }
};
