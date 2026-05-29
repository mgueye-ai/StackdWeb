const { getSiteUrl } = require("./site-url");
const { getProduct } = require("./products");
const { sendEmail } = require("./resend");

function formatPrice(amountCents, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function getNotifyEmail() {
  return (
    process.env.ORDER_NOTIFY_EMAIL?.trim() ||
    process.env.RESEND_REPLY_TO?.trim() ||
    "hello@toostackd.com"
  );
}

function customerConfirmationHtml({ productName, productTag, amountFormatted, email, siteUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Order confirmed</title>
</head>
<body style="margin:0;padding:0;background-color:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="${siteUrl}/logo.png" alt="Stackd" width="48" height="48" style="display:block;border-radius:12px;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#111111;border:1px solid #222222;border-radius:20px;padding:36px 32px 32px;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8a8a8a;">
                Order confirmed
              </p>
              <h1 style="margin:0 0 16px;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.03em;color:#ffffff;">
                Thank you for your order.
              </h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#a3a3a3;">
                Your Stackd purchase is confirmed. We're preparing your order and will follow up at
                <strong style="color:#ffffff;">${email}</strong> with shipping details.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#141414;border:1px solid #222222;border-radius:16px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#5c5c5c;">Order summary</p>
                    <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#ffffff;">${productName}</p>
                    <p style="margin:0 0 12px;font-size:13px;color:#8a8a8a;">${productTag}</p>
                    <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">${amountFormatted}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 14px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a8a8a;">
                What happens next
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:0 0 12px;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;margin-right:10px;">1</span>
                    <span style="font-size:14px;line-height:1.6;color:#c9c9c9;">We'll email you when your Stackd ships.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 12px;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;margin-right:10px;">2</span>
                    <span style="font-size:14px;line-height:1.6;color:#c9c9c9;">Download the Stackd app on iOS or Android when your device arrives.</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;margin-right:10px;">3</span>
                    <span style="font-size:14px;line-height:1.6;color:#c9c9c9;">Set your first savings goal and start watching the bar fill.</span>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
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
          <tr>
            <td align="center" style="padding:24px 12px 8px;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#444444;">
                Questions? Reply to this email or contact us at hello@toostackd.com
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

function customerConfirmationText({ productName, amountFormatted, email, siteUrl }) {
  return [
    "Your Stackd order is confirmed.",
    "",
    `Product: ${productName}`,
    `Total: ${amountFormatted}`,
    `Confirmation sent to: ${email}`,
    "",
    "What happens next:",
    "1. We'll email you when your Stackd ships.",
    "2. Download the Stackd app when your device arrives.",
    "3. Set your first savings goal and start saving.",
    "",
    `Visit us: ${siteUrl}`,
  ].join("\n");
}

function adminNotificationHtml({ productName, productTag, amountFormatted, customerEmail, sessionId, siteUrl }) {
  const adminUrl = `${siteUrl}/admin.html`;
  const stripeUrl = sessionId
    ? `https://dashboard.stripe.com/search?query=${encodeURIComponent(sessionId)}`
    : "https://dashboard.stripe.com/payments";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Stackd order</title>
</head>
<body style="margin:0;padding:0;background-color:#080808;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#080808;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
          <tr>
            <td align="center" style="padding-bottom:28px;">
              <img src="${siteUrl}/logo.png" alt="Stackd" width="48" height="48" style="display:block;border-radius:12px;" />
            </td>
          </tr>
          <tr>
            <td style="background-color:#111111;border:1px solid #222222;border-radius:20px;padding:36px 32px 32px;">
              <p style="margin:0 0 12px;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#8a8a8a;">
                New order
              </p>
              <h1 style="margin:0 0 16px;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.03em;color:#ffffff;">
                You have a new order.
              </h1>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#a3a3a3;">
                A customer just purchased Stackd. Review the order details below and manage it from your admin dashboard.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#141414;border:1px solid #222222;border-radius:16px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#5c5c5c;">Order summary</p>
                    <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#ffffff;">${productName}</p>
                    <p style="margin:0 0 12px;font-size:13px;color:#8a8a8a;">${productTag}</p>
                    <p style="margin:0;font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">${amountFormatted}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 14px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8a8a8a;">
                Order details
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:0 0 12px;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;margin-right:10px;">1</span>
                    <span style="font-size:14px;line-height:1.6;color:#c9c9c9;">Customer: <strong style="color:#ffffff;">${customerEmail}</strong></span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 12px;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;margin-right:10px;">2</span>
                    <span style="font-size:14px;line-height:1.6;color:#c9c9c9;">Stripe session: <span style="color:#8a8a8a;font-size:12px;word-break:break-all;">${sessionId}</span></span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;vertical-align:top;">
                    <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;background-color:#1a1a1a;border:1px solid #2a2a2a;border-radius:999px;color:#ffffff;font-size:11px;font-weight:700;margin-right:10px;">3</span>
                    <span style="font-size:14px;line-height:1.6;color:#c9c9c9;">View and update this order in the admin dashboard.</span>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-bottom:16px;">
                <tr>
                  <td align="center" style="border-radius:12px;background-color:#ffffff;">
                    <a href="${adminUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#080808;text-decoration:none;border-radius:12px;">
                      View in Admin
                    </a>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td align="center" style="border-radius:12px;border:1px solid #2a2a2a;">
                    <a href="${stripeUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px;">
                      Open in Stripe
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 12px 8px;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#444444;">
                Stackd order notification · Manage orders at ${adminUrl.replace(/^https?:\/\//, "")}
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

function adminNotificationText({ productName, productTag, amountFormatted, customerEmail, sessionId, siteUrl }) {
  const adminUrl = `${siteUrl}/admin.html`;
  const stripeUrl = sessionId
    ? `https://dashboard.stripe.com/search?query=${encodeURIComponent(sessionId)}`
    : "https://dashboard.stripe.com/payments";

  return [
    "You have a new Stackd order.",
    "",
    "Order summary",
    `Product: ${productName} (${productTag})`,
    `Total: ${amountFormatted}`,
    "",
    "Order details",
    `Customer: ${customerEmail}`,
    `Stripe session: ${sessionId}`,
    "",
    `View in Admin: ${adminUrl}`,
    `Open in Stripe: ${stripeUrl}`,
  ].join("\n");
}

async function sendOrderEmails({ sessionId, email, productId, amountCents, currency = "usd" }) {
  if (!sessionId || !email || !productId) {
    return { skipped: true, reason: "missing_fields" };
  }

  const product = getProduct(productId);
  if (!product) {
    return { skipped: true, reason: "invalid_product" };
  }

  const siteUrl = getSiteUrl();
  const amountFormatted = formatPrice(amountCents, currency);
  const notifyEmail = getNotifyEmail();

  const customerSent = await sendEmail({
    to: email,
    subject: `Your Stackd order is confirmed — ${product.name}`,
    html: customerConfirmationHtml({
      productName: product.name,
      productTag: product.tag,
      amountFormatted,
      email,
      siteUrl,
    }),
    text: customerConfirmationText({
      productName: product.name,
      amountFormatted,
      email,
      siteUrl,
    }),
    tags: [
      { name: "type", value: "order-confirmation" },
      { name: "product", value: productId },
    ],
    idempotencyKey: `order-confirm-${sessionId}`,
  });

  const adminSent = await sendEmail({
    to: notifyEmail,
    subject: `New Stackd order — ${product.name} (${amountFormatted})`,
    html: adminNotificationHtml({
      productName: product.name,
      productTag: product.tag,
      amountFormatted,
      customerEmail: email,
      sessionId,
      siteUrl,
    }),
    text: adminNotificationText({
      productName: product.name,
      productTag: product.tag,
      amountFormatted,
      customerEmail: email,
      sessionId,
      siteUrl,
    }),
    tags: [
      { name: "type", value: "order-notification" },
      { name: "product", value: productId },
    ],
    idempotencyKey: `order-notify-${sessionId}`,
  });

  return { customerSent, adminSent, notifyEmail };
}

module.exports = {
  sendOrderEmails,
  formatPrice,
};
