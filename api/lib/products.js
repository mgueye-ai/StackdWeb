const PRODUCTS = {
  stackd: {
    id: "stackd",
    name: "Stackd",
    tag: "Compact",
    description: "Card-tap savings device with front LED progress bar. Set goals in the app and watch your progress light up.",
    amount: 4900,
    priceEnv: "STRIPE_PRICE_STACKD",
  },
  stackd_up: {
    id: "stackd_up",
    name: "Stackd Up",
    tag: "Full size",
    description: "Everything in Stackd, plus a built-in cash slot. Bills are counted, verified, and deposited into your linked account.",
    amount: 9900,
    priceEnv: "STRIPE_PRICE_STACKD_UP",
  },
};

function getProduct(productId) {
  return PRODUCTS[productId] || null;
}

function getLineItem(product) {
  const priceId = process.env[product.priceEnv];

  if (priceId) {
    return {
      price: priceId,
      quantity: 1,
    };
  }

  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: product.amount,
      product_data: {
        name: product.name,
        description: product.description,
        images: product.image ? [product.image] : undefined,
      },
    },
  };
}

module.exports = {
  PRODUCTS,
  getProduct,
  getLineItem,
};
