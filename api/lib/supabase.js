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

module.exports = {
  savePaidOrder,
};
