const { getSiteUrl } = require("./lib/site-url");
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
  const message = String(payload.message || payload.error || JSON.stringify(payload)).toLowerCase();
  return (
    status === 409 ||
    (status === 422 && (message.includes("already") || message.includes("exist") || message.includes("duplicate")))
  );
}

async function saveToSupabase(email, source) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return { skipped: true };
  }

  let role = "";
  try {
    role = JSON.parse(Buffer.from(key.split(".")[1], "base64").toString()).role;
  } catch {
    role = "";
  }

  if (role !== "service_role") {
    console.error(
      "SUPABASE_SERVICE_ROLE_KEY is not a service_role key. Use Project Settings → API → service_role secret."
    );
    return { skipped: true, misconfigured: true };
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

function resendHeaders(apiKey) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "StackdWeb/1.0",
  };
}

async function addContactToSegment(email, segmentId, apiKey) {
  const response = await fetch(
    `https://api.resend.com/contacts/${encodeURIComponent(email)}/segments/${segmentId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "User-Agent": "StackdWeb/1.0" },
    }
  );

  if (response.ok || response.status === 409) {
    return true;
  }

  const payload = await parseJsonResponse(response);
  console.error("Resend segment add failed:", response.status, payload);
  return false;
}

function isRestrictedResendKey(payload) {
  const message = String(payload?.message || payload?.error || "").toLowerCase();
  return payload?.name === "restricted_api_key" || message.includes("restricted to only send");
}

async function saveToResend(email, source) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const segmentId = process.env.RESEND_SEGMENT_ID?.trim();

  if (!apiKey) {
    return { skipped: true };
  }

  if (!segmentId) {
    console.error("RESEND_SEGMENT_ID is not set — create a Waitlist segment in Resend.");
    throw new Error("Waitlist is not fully configured. Please try again later.");
  }

  const createResponse = await fetch("https://api.resend.com/contacts", {
    method: "POST",
    headers: resendHeaders(apiKey),
    body: JSON.stringify({
      email,
      unsubscribed: false,
    }),
  });

  const createPayload = await parseJsonResponse(createResponse);
  const duplicate = isResendDuplicate(createResponse.status, createPayload);

  if (!createResponse.ok && !duplicate) {
    if (createResponse.status === 401 && isRestrictedResendKey(createPayload)) {
      console.error(
        "Resend API key is send-only. Create a Full access key in Resend → API Keys for contact/segment sync."
      );
      const welcomed = await sendResendWelcomeEmail(email, source, apiKey);
      return { duplicate: false, welcomed, segmentSynced: false };
    }

    console.error("Resend contact create failed:", createResponse.status, createPayload);
    throw new Error("Could not subscribe your email. Please try again.");
  }

  const segmentAdded = await addContactToSegment(email, segmentId, apiKey);
  if (!segmentAdded) {
    throw new Error("Could not add your email to the waitlist. Please try again.");
  }

  let welcomed = false;
  if (!duplicate) {
    welcomed = await sendResendWelcomeEmail(email, source, apiKey);
  }

  return { duplicate, welcomed, segmentSynced: true };
}

function welcomeEmailHtml() {
  const siteUrl = getSiteUrl();
  const logoUrl = `${siteUrl}/logo.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>Welcome to the Stackd waitlist</title>
</head>
<body style="margin:0;padding:0;background-color:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    You're on the Stackd waitlist. Be first to know when we launch the physical savings box built for real goals.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <a href="${siteUrl}" style="text-decoration:none;display:inline-block;">
                <img src="${logoUrl}" width="48" height="48" alt="Stackd" style="display:block;border:0;border-radius:12px;margin:0 auto 10px;" />
                <span style="color:#f0f0f0;font-size:18px;font-weight:600;letter-spacing:-0.02em;">Stackd</span>
              </a>
            </td>
          </tr>
          <!-- Main card -->
          <tr>
            <td style="background-color:#111111;border:1px solid #222222;border-radius:20px;padding:36px 32px 32px;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8a8a8a;">
                Waitlist confirmed
              </p>
              <h1 style="margin:0 0 16px;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.03em;color:#ffffff;">
                You're on the list.
              </h1>
              <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#a3a3a3;">
                Thanks for joining early. Stackd is the physical savings box that turns spare cash into real financial goals — and you'll be first to know when we launch.
              </p>
              <!-- Device preview -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#141414;border:1px solid #222222;border-radius:16px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 24px 20px;text-align:center;">
                    <p style="margin:0 0 16px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#5c5c5c;">
                      Your future savings goal
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:280px;margin:0 auto 14px;background-color:#1a1a1a;border-radius:999px;height:6px;overflow:hidden;">
                      <tr>
                        <td width="38%" style="background:linear-gradient(90deg,#cccccc,#ffffff);background-color:#ffffff;border-radius:999px;font-size:0;line-height:0;">&nbsp;</td>
                        <td style="font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                    <p style="margin:0;font-size:13px;color:#8a8a8a;">
                      Tap. Deposit. Watch the bar fill.
                    </p>
                  </td>
                </tr>
              </table>
              <!-- What's next -->
              <p style="margin:0 0 14px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a8a8a;">
                What happens next
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:0 0 12px;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;margin-right:10px;">1</span>
                    <span style="font-size:14px;line-height:1.6;color:#c9c9c9;">We'll email you when Stackd is ready to order.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 12px;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;margin-right:10px;">2</span>
                    <span style="font-size:14px;line-height:1.6;color:#c9c9c9;">Early supporters get first access to Stackd and Stackd Up.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;margin-right:10px;">3</span>
                    <span style="font-size:14px;line-height:1.6;color:#c9c9c9;">No spam — just launch updates and product news.</span>
                  </td>
                </tr>
              </table>
              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 8px;">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:#ffffff;">
                    <a href="${siteUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#080808;text-decoration:none;border-radius:12px;">
                      Visit Stackd
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 12px 8px;">
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#5c5c5c;">
                The physical savings box that turns spare cash into real financial goals.
              </p>
              <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#5c5c5c;">
                Banking infrastructure powered by Unit
              </p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#444444;">
                &copy; 2026 Stackd &middot; <a href="${siteUrl}" style="color:#8a8a8a;text-decoration:underline;">toostackd.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function welcomeEmailText() {
  const siteUrl = getSiteUrl();
  return [
    "You're on the Stackd waitlist.",
    "",
    "Thanks for joining early. Stackd is the physical savings box that turns spare cash into real financial goals — and you'll be first to know when we launch.",
    "",
    "What happens next:",
    "1. We'll email you when Stackd is ready to order.",
    "2. Early supporters get first access to Stackd and Stackd Up.",
    "3. No spam — just launch updates and product news.",
    "",
    `Visit us: ${siteUrl}`,
    "",
    "© 2026 Stackd",
  ].join("\n");
}

async function sendResendWelcomeEmail(email, source, apiKey) {
  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  const replyTo = process.env.RESEND_REPLY_TO || "hello@toostackd.com";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: resendHeaders(apiKey),
    body: JSON.stringify({
      from,
      reply_to: replyTo,
      to: [email],
      subject: "Welcome to the Stackd waitlist",
      html: welcomeEmailHtml(),
      text: welcomeEmailText(),
      tags: [
        { name: "source", value: source },
        { name: "type", value: "waitlist-welcome" },
      ],
      headers: {
        "X-Entity-Ref-ID": `waitlist-${Date.now()}`,
      },
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
    let segmentSynced = false;
    let storedInSupabase = false;

    if (hasResend) {
      const result = await saveToResend(email, source);
      if (!result.skipped) {
        duplicate = duplicate || result.duplicate;
        welcomed = welcomed || result.welcomed;
        segmentSynced = segmentSynced || result.segmentSynced !== false;
      }
    }

    if (hasSupabase) {
      try {
        const result = await saveToSupabase(email, source);
        if (!result.skipped && !result.misconfigured) {
          storedInSupabase = true;
          duplicate = duplicate || result.duplicate;
        }
      } catch (supabaseError) {
        console.error("Supabase waitlist backup failed:", supabaseError);
        if (!hasResend) {
          throw supabaseError;
        }
      }
    }

    if (!segmentSynced && !storedInSupabase && !(hasResend && welcomed)) {
      throw new Error("Waitlist is not fully configured. Please try again later.");
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
