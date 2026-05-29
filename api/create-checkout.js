const Stripe = require("stripe");
const { getProduct, getLineItem } = require("./lib/products");
const { getSiteUrl } = require("./lib/site-url");

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
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

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY is not set.");
    json(res, 503, { error: "Checkout is not configured yet." });
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

  const product = getProduct(body?.product);
  if (!product) {
    json(res, 400, { error: "Invalid product." });
    return;
  }

  const siteUrl = getSiteUrl();
  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [getLineItem(product)],
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel.html`,
      allow_promotion_codes: false,
      billing_address_collection: "auto",
      metadata: {
        product: product.id,
      },
    });

    json(res, 200, { url: session.url });
  } catch (error) {
    console.error("Stripe checkout session failed:", error);
    json(res, 500, { error: "Could not start checkout. Please try again." });
  }
};
