const Stripe = require("stripe");
const { getProduct } = require("./lib/products");
const { savePaidOrder } = require("./lib/supabase");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    json(res, 503, { error: "Checkout is not configured." });
    return;
  }

  const sessionId =
    req.query?.session_id ||
    (typeof req.body === "object" && req.body?.session_id) ||
    (typeof req.body === "string" ? JSON.parse(req.body || "{}").session_id : null);

  if (!sessionId) {
    json(res, 400, { error: "Missing session_id." });
    return;
  }

  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      json(res, 400, { error: "Payment not completed." });
      return;
    }

    const productId = session.metadata?.product;
    const product = getProduct(productId);
    const email = session.customer_details?.email?.toLowerCase();

    if (product && email) {
      await savePaidOrder({
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
        email,
        product: productId,
        amount_cents: session.amount_total,
        currency: session.currency || "usd",
        status: "paid",
        paid_at: new Date().toISOString(),
      });
    }

    json(res, 200, {
      ok: true,
      email,
      product: product
        ? { id: product.id, name: product.name, amount: product.amount }
        : null,
    });
  } catch (error) {
    console.error("Session verification failed:", error);
    json(res, 500, { error: "Could not verify payment." });
  }
};
