const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const DEFAULT_FROM = "Stackd <hello@toostackd.com>";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return email.length > 0 && email.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(email);
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function isResendDuplicate(status, payload) {
  const message = String(payload.message || payload.error || "").toLowerCase();
  return status === 409 || (status === 422 && message.includes("already"));
}

async function saveToSupabase(email, source) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { skipped: true };
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/waitlist_signups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      email,
      source,
    }),
  });

  if (response.status === 409) {
    return { duplicate: true, welcomed: false };
  }

  if (!response.ok) {
    const detail = await response.text();
    console.error("Supabase waitlist insert failed:", response.status, detail);
    throw new Error("Could not save your email. Please try again.");
  }

  return { duplicate: false, welcomed: false };
}

async function addContactToSegment(email, segmentId, apiKey) {
  const response = await fetch(
    `https://api.resend.com/contacts/${encodeURIComponent(email)}/segments/${segmentId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  );

  if (response.ok || response.status === 409) {
    return true;
  }

  const payload = await parseJsonResponse(response);
  console.error("Resend segment add failed:", response.status, payload);
  return false;
}

async function saveToResend(email, source) {
  const apiKey = process.env.RESEND_API_KEY;
  const segmentId = process.env.RESEND_SEGMENT_ID;

  if (!apiKey) {
    return { skipped: true };
  }

  if (!segmentId) {
    console.error("RESEND_SEGMENT_ID is not set — create a Waitlist segment in Resend.");
    throw new Error("Waitlist is not fully configured. Please try again later.");
  }

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const createResponse = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    }),
  });

  if (createResponse.ok) {
    const welcomed = await sendResendWelcomeEmail(email, source, apiKey);
    return { duplicate: false, welcomed };
  }

  const createPayload = await parseJsonResponse(createResponse);

  if (isResendDuplicate(createResponse.status, createPayload)) {
    await addContactToSegment(email, segmentId, apiKey);
    return { duplicate: true, welcomed: false };
  }

  console.error("Resend contact create failed:", createResponse.status, createPayload);
  throw new Error("Could not subscribe your email. Please try again.");
}

function welcomeEmailHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#080808;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080808;padding:48px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141414;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:40px 32px;">
        <tr><td style="color:#f0f0f0;font-size:22px;font-weight:700;letter-spacing:-0.02em;padding-bottom:12px;">You're on the list.</td></tr>
        <tr><td style="color:#8a8a8a;font-size:16px;line-height:1.7;padding-bottom:24px;">
          Thanks for joining the Stackd waitlist. We're building the physical savings box that turns spare cash into real financial goals — and you'll be first to know when we launch.
        </td></tr>
        <tr><td style="color:#5c5c5c;font-size:13px;line-height:1.6;">
          No spam. Just launch updates.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendResendWelcomeEmail(email, source, apiKey) {
  const from = process.env.RESEND_FROM || DEFAULT_FROM;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "You're on the Stackd waitlist",
      html: welcomeEmailHtml(),
      text: "Thanks for joining the Stackd waitlist. You'll be first to know when we launch. No spam — just launch updates.",
      tags: [
        { name: "source", value: source },
        { name: "type", value: "waitlist-welcome" },
      ],
    }),
  });

  if (!response.ok) {
    const payload = await parseJsonResponse(response);
    console.error("Resend welcome email failed:", response.status, payload);
    return false;
  }

  return true;
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  let body = req.body;

  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      json(res, 400, { error: "Invalid request body." });
      return;
    }
  }

  if (!body || typeof body !== "object") {
    json(res, 400, { error: "Invalid request body." });
    return;
  }

  if (body.website) {
    json(res, 200, {
      ok: true,
      duplicate: false,
      message: "You're on the list. We'll be in touch at launch.",
    });
    return;
  }

  const email = normalizeEmail(body.email);
  const source = body.source === "cta" ? "cta" : "hero";

  if (!isValidEmail(email)) {
    json(res, 400, { error: "Please enter a valid email address." });
    return;
  }

  const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasResend = Boolean(process.env.RESEND_API_KEY);

  if (!hasResend && !hasSupabase) {
    console.error("Waitlist misconfigured: set RESEND_API_KEY (and RESEND_SEGMENT_ID) or Supabase credentials.");
    json(res, 503, { error: "Waitlist is temporarily unavailable. Please try again later." });
    return;
  }

  try {
    let duplicate = false;
    let welcomed = false;

    if (hasResend) {
      const result = await saveToResend(email, source);
      if (!result.skipped) {
        duplicate = duplicate || result.duplicate;
        welcomed = welcomed || result.welcomed;
      }
    }

    if (hasSupabase) {
      const result = await saveToSupabase(email, source);
      if (!result.skipped) {
        duplicate = duplicate || result.duplicate;
      }
    }

    let message;
    if (duplicate) {
      message = "You're already on the list. We'll be in touch at launch.";
    } else if (welcomed) {
      message = "You're on the list. Check your inbox for a confirmation.";
    } else {
      message = "You're on the list. We'll be in touch at launch.";
    }

    json(res, 200, {
      ok: true,
      duplicate,
      welcomed,
      message,
    });
  } catch (error) {
    console.error("Waitlist signup failed:", error);
    json(res, 500, {
      error: error.message || "Something went wrong. Please try again.",
    });
  }
};
