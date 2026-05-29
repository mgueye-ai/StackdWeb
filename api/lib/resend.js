const DEFAULT_FROM = "Stackd <notifications@toostackd.com>";

function resendHeaders(apiKey, idempotencyKey) {
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "StackdWeb/1.0",
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  return headers;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function sendEmail({ to, subject, html, text, tags, idempotencyKey }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — email not sent.");
    return false;
  }

  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  const replyTo = process.env.RESEND_REPLY_TO;

  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
    tags,
  };

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: resendHeaders(apiKey, idempotencyKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await parseJsonResponse(response);
    console.error("Resend email failed:", response.status, body);
    return false;
  }

  return true;
}

module.exports = {
  sendEmail,
};
