/**
 * rex-form-guard — Turnstile + honeypot + timing gate for site forms.
 *
 * Secrets (wrangler secret put, never commit):
 *   TURNSTILE_SECRET_KEY  — Turnstile widget secret
 *   FORWARD_URL           — contact backend (Azure /api/contact or Logic App)
 *   COLLAB_FORWARD_URL    — collaborator-request Azure Function URL
 *
 * Contract:
 *   - Human submit after >2.5s with a fresh Turnstile token → 200, clean fields forwarded
 *   - Honeypot filled → 200 silent success, nothing forwarded
 *   - Submit within 2s (elapsed < 2500ms) → 400, nothing forwarded
 *   - Missing or reused Turnstile token → 400 "Security check failed"
 */
const MIN_ELAPSED_MS = 2500;
const HONEYPOT_FIELDS = ["website", "company", "fax", "hp"];
const STRIP_FIELDS = new Set([
  ...HONEYPOT_FIELDS,
  "form_started_at",
  "form_type",
  "cf-turnstile-response",
  "cf_turnstile_response",
  "turnstileToken",
  "g-recaptcha-response",
]);
const ALLOWED_ORIGINS = new Set([
  "https://rexautistikonlabs.org",
  "https://www.rexautistikonlabs.org",
]);

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host.endsWith(".azurestaticapps.net");
  } catch {
    return false;
  }
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

async function readBody(request) {
  const ct = (request.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    const data = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("invalid");
    }
    return data;
  }
  if (ct.includes("form-urlencoded") || ct.includes("multipart/form-data")) {
    const fd = await request.formData();
    const data = {};
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string") data[k] = v;
    }
    return data;
  }
  const data = await request.json();
  if (!data || typeof data !== "object") throw new Error("invalid");
  return data;
}

function honeypotFilled(data) {
  return HONEYPOT_FIELDS.some((f) => {
    const v = data[f];
    return typeof v === "string" && v.trim() !== "";
  });
}

function cleanFields(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (STRIP_FIELDS.has(k)) continue;
    if (typeof v === "string") out[k] = v;
    else if (typeof v === "boolean" || typeof v === "number") out[k] = v;
  }
  for (const key of ["agree_data_security", "agree_terms", "agree_citation"]) {
    if (key in out) {
      const v = out[key];
      out[key] = v === true || v === "true" || v === "on" || v === "1";
    }
  }
  return out;
}

async function verifyTurnstile(token, ip, secret) {
  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return { success: false };
  return res.json();
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return json({ success: false, message: "Method not allowed." }, 405, origin);
    }

    let data;
    try {
      data = await readBody(request);
    } catch {
      return json({ success: false, message: "Invalid request body." }, 400, origin);
    }

    // Honeypot: look like success, never forward.
    if (honeypotFilled(data)) {
      return json({ success: true }, 200, origin);
    }

    const started = Number(data.form_started_at);
    const elapsed = Date.now() - started;
    if (!Number.isFinite(started) || started <= 0 || elapsed < MIN_ELAPSED_MS) {
      return json(
        { success: false, message: "Please wait a moment and try again." },
        400,
        origin,
      );
    }

    const token = (
      data["cf-turnstile-response"] ||
      data.cf_turnstile_response ||
      data.turnstileToken ||
      ""
    ).toString().trim();

    if (!token || !env.TURNSTILE_SECRET_KEY) {
      return json(
        { success: false, message: "Security check failed. Please complete the verification and try again." },
        400,
        origin,
      );
    }

    const ip = request.headers.get("CF-Connecting-IP") || "";
    let verified;
    try {
      verified = await verifyTurnstile(token, ip, env.TURNSTILE_SECRET_KEY);
    } catch {
      return json(
        { success: false, message: "Security check failed. Please complete the verification and try again." },
        400,
        origin,
      );
    }
    if (!verified || verified.success !== true) {
      return json(
        { success: false, message: "Security check failed. Please complete the verification and try again." },
        400,
        origin,
      );
    }

    const formType = data.form_type === "collaborate" ? "collaborate" : "contact";
    const forwardUrl =
      formType === "collaborate" ? env.COLLAB_FORWARD_URL : env.FORWARD_URL;
    if (!forwardUrl) {
      return json({ success: false, message: "Form service is not configured." }, 500, origin);
    }

    const clean = cleanFields(data);
    let fwd;
    try {
      fwd = await fetch(forwardUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(clean),
      });
    } catch {
      return json(
        { success: false, message: "The form service did not respond. Please try again later." },
        502,
        origin,
      );
    }

    if (!fwd.ok) {
      let message = "The message could not be sent. Please try again later.";
      try {
        const errBody = await fwd.json();
        if (errBody && (errBody.message || errBody.error)) {
          message = String(errBody.message || errBody.error);
        }
      } catch {
        /* keep default */
      }
      return json({ success: false, message }, fwd.status >= 500 ? 502 : fwd.status, origin);
    }

    return json({ success: true }, 200, origin);
  },
};
