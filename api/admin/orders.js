const { requireAdmin, json } = require("../lib/admin-auth");
const { getOrders, updateOrderStatus } = require("../lib/supabase");

const VALID_STATUSES = ["pending", "paid", "failed", "refunded"];

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, PATCH, OPTIONS");
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
    const url = new URL(req.url, "http://localhost");
    const status = url.searchParams.get("status") || "";
    const limit = url.searchParams.get("limit") || "100";
    const offset = url.searchParams.get("offset") || "0";

    const orders = await getOrders({
      status: VALID_STATUSES.includes(status) ? status : undefined,
      limit,
      offset,
    });

    if (orders === null) {
      json(res, 503, { error: "Database not configured.", orders: [] });
      return;
    }

    json(res, 200, { orders });
    return;
  }

  if (req.method === "PATCH") {
    let body = req.body;

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        json(res, 400, { error: "Invalid request." });
        return;
      }
    }

    const id = Number(body?.id);
    const status = String(body?.status || "").trim();

    if (!id || !VALID_STATUSES.includes(status)) {
      json(res, 400, { error: "Valid order id and status required." });
      return;
    }

    const updated = await updateOrderStatus(id, status);

    if (!updated) {
      json(res, 500, { error: "Could not update order." });
      return;
    }

    json(res, 200, { ok: true });
    return;
  }

  json(res, 405, { error: "Method not allowed." });
};
