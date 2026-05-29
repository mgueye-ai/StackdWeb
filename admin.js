(function () {
  const PRODUCT_LABELS = {
    stackd: "Stackd",
    stackd_up: "Stackd Up",
  };

  const STATUS_LABELS = {
    pending: "Pending",
    paid: "Paid",
    failed: "Failed",
    refunded: "Refunded",
  };

  let allOrders = [];

  function formatMoney(cents) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format((cents || 0) / 100);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function showAlert(el, message, isError) {
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
    el.classList.toggle("admin-alert--error", Boolean(isError));
  }

  async function requireAdminAccess() {
    try {
      const response = await fetch("/api/check-launch-access", { credentials: "include" });
      const data = await response.json();
      if (!data.ok) {
        window.location.replace("index.html");
        return false;
      }
      return true;
    } catch {
      window.location.replace("index.html");
      return false;
    }
  }

  function switchPanel(panelId) {
    document.querySelectorAll(".admin-panel").forEach((panel) => {
      const isActive = panel.id === `panel-${panelId}`;
      panel.hidden = !isActive;
      panel.classList.toggle("is-active", isActive);
    });

    document.querySelectorAll(".admin-nav__link[data-panel]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.panel === panelId);
    });

    if (panelId === "orders" && allOrders.length === 0) {
      loadOrders();
    }
  }

  function renderMetrics(stats) {
    document.getElementById("metric-revenue").textContent = formatMoney(stats.revenue.total);
    document.getElementById("metric-revenue-sub").textContent = `${stats.orders.paid} paid orders`;

    document.getElementById("metric-orders").textContent = String(stats.orders.total);
    document.getElementById("metric-orders-sub").textContent = `${stats.orders.today} today`;

    document.getElementById("metric-week").textContent = formatMoney(stats.revenue.thisWeek);
    document.getElementById("metric-week-sub").textContent = `${stats.orders.thisWeek} orders this week`;

    document.getElementById("metric-waitlist").textContent = String(stats.waitlist.total_signups || 0);
    const latest = stats.waitlist.latest_signup
      ? `Latest: ${formatDate(stats.waitlist.latest_signup)}`
      : "No signups yet";
    document.getElementById("metric-waitlist-sub").textContent = latest;
  }

  function renderChart(chart) {
    const container = document.getElementById("revenue-chart");
    const note = document.getElementById("chart-note");
    if (!container) return;

    const maxRevenue = Math.max(...chart.map((d) => d.revenue), 1);

    container.innerHTML = chart
      .map((day) => {
        const height = Math.max(8, Math.round((day.revenue / maxRevenue) * 100));
        const active = day.revenue > 0 ? " admin-chart__bar--active" : "";
        return `<div class="admin-chart__bar${active}" style="--h:${height}%" title="${day.label}: ${formatMoney(day.revenue)} (${day.count} orders)"></div>`;
      })
      .join("");

    const weekTotal = chart.reduce((sum, d) => sum + d.revenue, 0);
    const weekCount = chart.reduce((sum, d) => sum + d.count, 0);
    if (note) {
      note.textContent =
        weekCount > 0
          ? `${formatMoney(weekTotal)} from ${weekCount} order${weekCount === 1 ? "" : "s"} in the last 7 days`
          : "No paid orders in the last 7 days";
    }
  }

  function renderProductBreakdown(products) {
    const list = document.getElementById("product-breakdown");
    if (!list) return;

    if (!products.length) {
      list.innerHTML = '<li class="admin-breakdown__empty">No orders yet</li>';
      return;
    }

    list.innerHTML = products
      .map(
        (p) => `
        <li class="admin-breakdown__item">
          <span class="admin-breakdown__name">${p.name}</span>
          <span class="admin-breakdown__meta">${p.count} sold · ${formatMoney(p.amount)} each</span>
        </li>`
      )
      .join("");
  }

  function renderStatusBreakdown(orders) {
    const list = document.getElementById("status-breakdown");
    if (!list) return;

    const items = [
      { key: "paid", count: orders.paid },
      { key: "pending", count: orders.pending },
      { key: "failed", count: orders.failed },
      { key: "refunded", count: orders.refunded },
    ];

    list.innerHTML = items
      .map(
        (item) => `
        <li class="admin-status-list__item">
          <span class="admin-status admin-status--${item.key}">${STATUS_LABELS[item.key]}</span>
          <span class="admin-status-list__count">${item.count}</span>
        </li>`
      )
      .join("");
  }

  function renderWaitlistBreakdown(waitlist) {
    const list = document.getElementById("waitlist-breakdown");
    if (!list) return;

    list.innerHTML = `
      <li class="admin-breakdown__item">
        <span class="admin-breakdown__name">Total signups</span>
        <span class="admin-breakdown__meta">${waitlist.total_signups || 0}</span>
      </li>
      <li class="admin-breakdown__item">
        <span class="admin-breakdown__name">Hero section</span>
        <span class="admin-breakdown__meta">${waitlist.hero_signups || 0}</span>
      </li>
      <li class="admin-breakdown__item">
        <span class="admin-breakdown__name">CTA section</span>
        <span class="admin-breakdown__meta">${waitlist.cta_signups || 0}</span>
      </li>
      <li class="admin-breakdown__item">
        <span class="admin-breakdown__name">Latest signup</span>
        <span class="admin-breakdown__meta">${waitlist.latest_signup ? formatDate(waitlist.latest_signup) : "—"}</span>
      </li>`;
  }

  async function loadStats() {
    const alert = document.getElementById("stats-alert");

    try {
      const response = await fetch("/api/admin/stats", { credentials: "include" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load stats.");
      }

      if (!data.configured) {
        showAlert(
          alert,
          "Supabase is not configured. Order data will appear once SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.",
          true
        );
      } else {
        showAlert(alert, "");
      }

      renderMetrics(data);
      renderChart(data.chart);
      renderProductBreakdown(data.products);
      renderStatusBreakdown(data.orders);
      renderWaitlistBreakdown(data.waitlist);
    } catch (error) {
      showAlert(alert, error.message || "Could not load dashboard.", true);
    }
  }

  function getFilteredOrders() {
    const statusFilter = document.getElementById("order-status-filter")?.value || "";
    const query = document.getElementById("order-search")?.value.trim().toLowerCase() || "";

    return allOrders.filter((order) => {
      if (statusFilter && order.status !== statusFilter) return false;
      if (!query) return true;

      const email = (order.email || "").toLowerCase();
      const product = (PRODUCT_LABELS[order.product] || order.product || "").toLowerCase();
      return email.includes(query) || product.includes(query) || String(order.id).includes(query);
    });
  }

  function renderOrdersTable(orders) {
    const tbody = document.getElementById("orders-body");
    if (!tbody) return;

    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-table__empty">No orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = orders
      .map((order) => {
        const stripeLink = order.stripe_session_id
          ? `<a href="https://dashboard.stripe.com/search?query=${encodeURIComponent(order.stripe_session_id)}" target="_blank" rel="noopener noreferrer" class="admin-link">View</a>`
          : "—";

        const statusOptions = Object.keys(STATUS_LABELS)
          .map(
            (s) =>
              `<option value="${s}"${s === order.status ? " selected" : ""}>${STATUS_LABELS[s]}</option>`
          )
          .join("");

        return `
        <tr data-order-id="${order.id}">
          <td>#${order.id}</td>
          <td>${formatDate(order.paid_at || order.created_at)}</td>
          <td>${order.email || "—"}</td>
          <td>${PRODUCT_LABELS[order.product] || order.product}</td>
          <td>${formatMoney(order.amount_cents)}</td>
          <td>
            <select class="admin-status-select" data-order-id="${order.id}" aria-label="Order ${order.id} status">
              ${statusOptions}
            </select>
          </td>
          <td>${stripeLink}</td>
        </tr>`;
      })
      .join("");
  }

  async function loadOrders() {
    const alert = document.getElementById("orders-alert");
    const tbody = document.getElementById("orders-body");

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-table__empty">Loading orders…</td></tr>';
    }

    try {
      const response = await fetch("/api/admin/orders", { credentials: "include" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load orders.");
      }

      allOrders = data.orders || [];
      showAlert(alert, allOrders.length === 0 && response.status !== 503 ? "No orders yet." : "");
      renderOrdersTable(getFilteredOrders());
    } catch (error) {
      showAlert(alert, error.message || "Could not load orders.", true);
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="admin-table__empty">Failed to load orders.</td></tr>';
      }
    }
  }

  async function updateOrderStatus(orderId, status, selectEl) {
    const alert = document.getElementById("orders-alert");
    const previous = allOrders.find((o) => o.id === orderId)?.status;

    selectEl.disabled = true;

    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: orderId, status }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Update failed.");
      }

      const order = allOrders.find((o) => o.id === orderId);
      if (order) order.status = status;

      showAlert(alert, `Order #${orderId} updated to ${STATUS_LABELS[status]}.`);
      loadStats();
    } catch (error) {
      if (previous) selectEl.value = previous;
      showAlert(alert, error.message || "Could not update order.", true);
    } finally {
      selectEl.disabled = false;
    }
  }

  function initNav() {
    document.querySelectorAll(".admin-nav__link[data-panel]").forEach((link) => {
      link.addEventListener("click", () => switchPanel(link.dataset.panel));
    });
  }

  function initOrdersPanel() {
    document.getElementById("order-status-filter")?.addEventListener("change", () => {
      renderOrdersTable(getFilteredOrders());
    });

    document.getElementById("order-search")?.addEventListener("input", () => {
      renderOrdersTable(getFilteredOrders());
    });

    document.getElementById("orders-body")?.addEventListener("change", (event) => {
      const select = event.target.closest(".admin-status-select");
      if (!select) return;

      const orderId = Number(select.dataset.orderId);
      updateOrderStatus(orderId, select.value, select);
    });

    document.getElementById("refresh-orders")?.addEventListener("click", loadOrders);
  }

  async function init() {
    const hasAccess = await requireAdminAccess();
    if (!hasAccess) return;

    initNav();
    initOrdersPanel();

    document.getElementById("refresh-stats")?.addEventListener("click", loadStats);

    await loadStats();
  }

  init();
})();
