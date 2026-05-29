async function supabaseRequest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: options.prefer || "return=minimal",
      ...options.headers,
    },
  });

  return response;
}

async function savePaidOrder(order) {
  const response = await supabaseRequest("orders?on_conflict=stripe_session_id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(order),
  });

  if (!response) {
    console.warn("Supabase not configured — order not saved.");
    return false;
  }

  if (response.ok || response.status === 409) {
    return true;
  }

  const detail = await response.text();
  console.error("Supabase order save failed:", response.status, detail);
  return false;
}

async function parseJsonResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getOrders({ status, limit = 100, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  let path = `orders?select=*&order=created_at.desc&limit=${safeLimit}&offset=${safeOffset}`;
  if (status) {
    path += `&status=eq.${encodeURIComponent(status)}`;
  }

  const response = await supabaseRequest(path, { method: "GET" });
  if (!response) return null;

  if (!response.ok) {
    const detail = await response.text();
    console.error("Supabase orders fetch failed:", response.status, detail);
    return null;
  }

  return parseJsonResponse(response);
}

async function updateOrderStatus(id, status) {
  const response = await supabaseRequest(`orders?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  if (!response) return false;

  if (!response.ok) {
    const detail = await response.text();
    console.error("Supabase order update failed:", response.status, detail);
    return false;
  }

  return true;
}

async function getWaitlistStats() {
  const response = await supabaseRequest("waitlist_stats?select=*", { method: "GET" });
  if (!response) return null;

  if (!response.ok) {
    const detail = await response.text();
    console.error("Supabase waitlist stats failed:", response.status, detail);
    return null;
  }

  const rows = await parseJsonResponse(response);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function getAllPaidOrders() {
  const response = await supabaseRequest(
    "orders?select=id,product,amount_cents,status,created_at,paid_at&status=eq.paid&order=created_at.asc",
    { method: "GET" }
  );

  if (!response) return null;

  if (!response.ok) {
    const detail = await response.text();
    console.error("Supabase paid orders fetch failed:", response.status, detail);
    return null;
  }

  return parseJsonResponse(response);
}

async function getOrderCounts() {
  const response = await supabaseRequest("orders?select=status,product,amount_cents", {
    method: "GET",
  });

  if (!response) return null;

  if (!response.ok) {
    const detail = await response.text();
    console.error("Supabase order counts failed:", response.status, detail);
    return null;
  }

  return parseJsonResponse(response);
}

module.exports = {
  savePaidOrder,
  getOrders,
  updateOrderStatus,
  getWaitlistStats,
  getAllPaidOrders,
  getOrderCounts,
};
