const Stripe = require("stripe");
const { savePaidOrder } = require("./lib/supabase");
const { sendOrderEmails } = require("./lib/order-emails");

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

module.exports.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error("Stripe webhook secrets are not configured.");
    res.statusCode = 503;
    res.end("Webhook not configured");
    return;
  }

  const stripe = new Stripe(secretKey);
  const signature = req.headers["stripe-signature"];

  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error.message);
    res.statusCode = 400;
    res.end(`Webhook Error: ${error.message}`);
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const product = session.metadata?.product;

      if (!product || !session.customer_details?.email) {
        console.error("Checkout session missing product metadata or email.");
      } else {
        const email = session.customer_details.email.toLowerCase();

        await savePaidOrder({
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          email,
          product,
          amount_cents: session.amount_total,
          currency: session.currency || "usd",
          status: "paid",
          paid_at: new Date().toISOString(),
        });

        const emailResult = await sendOrderEmails({
          sessionId: session.id,
          email,
          productId: product,
          amountCents: session.amount_total,
          currency: session.currency || "usd",
        });

        if (!emailResult.skipped && (!emailResult.customerSent || !emailResult.adminSent)) {
          console.error("Order confirmation emails partially failed:", emailResult);
        }
      }
    }

    res.statusCode = 200;
    res.end(JSON.stringify({ received: true }));
  } catch (error) {
    console.error("Stripe webhook handler failed:", error);
    res.statusCode = 500;
    res.end("Webhook handler failed");
  }
};
