const { requireAdmin, json } = require("../lib/admin-auth");
const { getAllPaidOrders, getOrderCounts, getWaitlistStats } = require("../lib/supabase");
const { PRODUCTS } = require("../lib/products");

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
}

function buildRevenueChart(orders) {
  const days = 7;
  const today = startOfDay(new Date());
  const buckets = [];

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    buckets.push({
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      revenue: 0,
      count: 0,
    });
  }

  const bucketMap = Object.fromEntries(buckets.map((b) => [b.date, b]));

  for (const order of orders || []) {
    const paidAt = order.paid_at || order.created_at;
    if (!paidAt) continue;

    const key = startOfDay(new Date(paidAt)).toISOString().slice(0, 10);
    if (bucketMap[key]) {
      bucketMap[key].revenue += order.amount_cents;
      bucketMap[key].count += 1;
    }
  }

  return buckets;
}

function computeStats(allOrders, paidOrders, waitlistStats) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);

  const byStatus = { pending: 0, paid: 0, failed: 0, refunded: 0 };
  const byProduct = {};

  for (const order of allOrders || []) {
    if (byStatus[order.status] !== undefined) {
      byStatus[order.status] += 1;
    }

    if (order.status === "paid") {
      byProduct[order.product] = (byProduct[order.product] || 0) + 1;
    }
  }

  let totalRevenue = 0;
  let revenueToday = 0;
  let revenueWeek = 0;
  let ordersToday = 0;
  let ordersWeek = 0;

  for (const order of paidOrders || []) {
    totalRevenue += order.amount_cents;

    const paidAt = new Date(order.paid_at || order.created_at);
    if (paidAt >= todayStart) {
      revenueToday += order.amount_cents;
      ordersToday += 1;
    }
    if (paidAt >= weekStart) {
      revenueWeek += order.amount_cents;
      ordersWeek += 1;
    }
  }

  const productBreakdown = Object.entries(PRODUCTS).map(([id, product]) => ({
    id,
    name: product.name,
    count: byProduct[id] || 0,
    amount: product.amount,
  }));

  return {
    orders: {
      total: (allOrders || []).length,
      paid: byStatus.paid,
      pending: byStatus.pending,
      failed: byStatus.failed,
      refunded: byStatus.refunded,
      today: ordersToday,
      thisWeek: ordersWeek,
    },
    revenue: {
      total: totalRevenue,
      today: revenueToday,
      thisWeek: revenueWeek,
    },
    products: productBreakdown,
    waitlist: waitlistStats || {
      total_signups: 0,
      hero_signups: 0,
      cta_signups: 0,
      latest_signup: null,
    },
    chart: buildRevenueChart(paidOrders),
    configured: allOrders !== null,
  };
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  if (!requireAdmin(req, res)) return;

  const [allOrders, paidOrders, waitlistStats] = await Promise.all([
    getOrderCounts(),
    getAllPaidOrders(),
    getWaitlistStats(),
  ]);

  json(res, 200, computeStats(allOrders, paidOrders, waitlistStats));
};
