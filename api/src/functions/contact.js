const { app } = require("@azure/functions");

// Public route: POST /api/contact on rex-lab-intake.
// Mail is sent by Logic App logic-rex-contact (resource group rg-rex-lab-prod)
// through the Foundation Office 365 connection to info@rexautistikonlabs.org.
// The Logic App callback URL is the Static Web App setting CONTACT_LOGIC_URL.

const TOPICS = new Set(["research", "collaboration", "media", "donation", "other"]);
const LIMITS = { name: 200, email: 200, role: 200, topic: 40, message: 5000 };

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonResponse(status, payload) {
  return {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    jsonBody: payload
  };
}

async function readFields(request) {
  const contentType = String(request.headers.get("content-type") || "");
  let body = {};
  if (contentType.includes("application/json")) {
    body = await request.json();
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    body = Object.fromEntries(form.entries());
  }
  if (!body || typeof body !== "object") body = {};
  return {
    wantsJson: contentType.includes("application/json"),
    payload: {
      name: clean(body.name, LIMITS.name),
      email: clean(body.email, LIMITS.email),
      role: clean(body.role, LIMITS.role),
      topic: clean(body.topic, LIMITS.topic),
      message: clean(body.message, LIMITS.message)
    }
  };
}

async function handleContact(request, context) {
    if (request.method === "OPTIONS") {
      return { status: 204 };
    }

    let fields;
    try {
      fields = await readFields(request);
    } catch (err) {
      context.error("contact form body could not be read");
      return jsonResponse(400, {
        success: false,
        message: "Please complete all required fields."
      });
    }

    const { payload, wantsJson } = fields;
    const invalid =
      !payload.name ||
      !payload.email ||
      !payload.role ||
      !payload.topic ||
      !payload.message ||
      !validEmail(payload.email) ||
      !TOPICS.has(payload.topic);

    if (invalid) {
      if (!wantsJson) {
        return {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          body: "Please complete all required fields."
        };
      }
      return jsonResponse(400, {
        success: false,
        message: "Please complete all required fields."
      });
    }

    const endpoint = process.env.CONTACT_LOGIC_URL;
    if (!endpoint) {
      context.error("CONTACT_LOGIC_URL is not configured");
      return jsonResponse(500, {
        success: false,
        message: "The message could not be sent. Please email info@rexautistikonlabs.org directly."
      });
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });
      let data = null;
      try {
        data = await response.json();
      } catch (parseErr) {
        data = null;
      }
      const accepted = response.ok && data && data.success === true;
      if (!accepted) {
        context.error("logic-rex-contact did not accept the contact form", response.status);
        const message =
          response.status === 400
            ? "Please complete all required fields."
            : "The message could not be sent. Please email info@rexautistikonlabs.org directly.";
        return jsonResponse(response.status === 400 ? 400 : 502, {
          success: false,
          message
        });
      }
    } catch (err) {
      context.error("logic-rex-contact request failed");
      return jsonResponse(502, {
        success: false,
        message: "The message could not be sent. Please email info@rexautistikonlabs.org directly."
      });
    }

    if (!wantsJson) {
      return {
        status: 303,
        headers: { Location: "/contact/received/" }
      };
    }

    return jsonResponse(200, { success: true, message: "Message received" });
}

app.http("contact", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  handler: handleContact
});

module.exports = { handleContact };
