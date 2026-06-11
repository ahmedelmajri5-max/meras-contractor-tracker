const state = {
  token: "",
  admin: false,
  contractorId: "",
  contractorName: "",
  orders: [],
  total: 0,
  page: 1,
  pageSize: 25,
  financialFilter: "all",
  orderLoadSeq: 0,
  contractors: [],
};

const $ = selector => document.querySelector(selector);
const els = {
  authScreen: $("#authScreen"), appRoot: $("#appRoot"), authEmail: $("#authEmail"), authLoginBtn: $("#authLoginBtn"), authAdminBtn: $("#authAdminBtn"), authError: $("#authError"),
  pageTitle: $("#pageTitle"), notice: $("#notice"), currentSession: $("#currentSession"), logoutBtn: $("#logoutBtn"), refreshBtn: $("#refreshBtn"), metrics: $("#metrics"), latestOrders: $("#latestOrders"), alerts: $("#alerts"), lastLoaded: $("#lastLoaded"),
  searchInput: $("#searchInput"), statusFilter: $("#statusFilter"), projectFilter: $("#projectFilter"), costCenterFilter: $("#costCenterFilter"), sortFilter: $("#sortFilter"), financialFilterTabs: $("#financialFilterTabs"),
  ordersRows: $("#ordersRows"), ordersCards: $("#ordersCards"), prevPageBtn: $("#prevPageBtn"), nextPageBtn: $("#nextPageBtn"), pageInfo: $("#pageInfo"), contractorSearch: $("#contractorSearch"), searchContractorsBtn: $("#searchContractorsBtn"), exportEmailsBtn: $("#exportEmailsBtn"), contractorRows: $("#contractorRows"),
  drawer: $("#drawer"), drawerBackdrop: $("#drawerBackdrop"), drawerContent: $("#drawerContent"), closeDrawer: $("#closeDrawer"),
};

function fmt(value) {
  if (value === "loading") return "...";
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0));
}
function fmtDate(value) { return value ? String(value).replace("T", " ").slice(0, 16) : "-"; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]); }
function norm(value) { return String(value || "").trim().toLowerCase(); }
function params(base, data = {}) { const url = new URL(base, location.origin); Object.entries(data).forEach(([k, v]) => { if (v !== "" && v !== null && v !== undefined && v !== false) url.searchParams.set(k, v); }); return `${url.pathname}${url.search}`; }
function applyOrderTableLayout() {
  const head = document.querySelector("#ordersView thead tr");
  if (head) head.innerHTML = ["\u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", "\u0627\u0644\u062d\u0627\u0644\u0629", "\u0627\u0644\u0645\u0648\u0642\u0639", "\u0645\u0631\u0643\u0632 \u0627\u0644\u062a\u0643\u0644\u0641\u0629", "\u0631\u0642\u0645 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629", "\u0631\u0627\u0628\u0637 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629", "\u0625\u062c\u0645\u0627\u0644\u064a \u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", "\u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621 \u0644\u062f\u0649 \u0627\u0644\u0645\u0627\u0644\u064a\u0629", "\u062a\u0627\u0631\u064a\u062e \u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621", "\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0633\u062f\u0627\u062f\u0627\u062a \u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621", "\u0627\u0644\u0642\u064a\u0645 \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629", "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062f\u0641\u0639", "\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0633\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0629"].map(label => `<th>${label}</th>`).join("");
  if (document.getElementById("orderLayoutPatch")) return;
  const style = document.createElement("style");
  style.id = "orderLayoutPatch";
  style.textContent = "table{min-width:1560px}.ref-list{display:flex;gap:6px;flex-wrap:wrap}.ref-list span{display:inline-flex;min-width:28px;justify-content:center;border-radius:6px;background:#eef4f1;color:#12463d;padding:3px 7px;font-weight:800}.card-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.card-details span{border-top:1px solid var(--line);padding-top:8px;color:var(--muted);font-size:12px}.card-details b{display:block;color:var(--text);direction:ltr;text-align:right}@media(max-width:620px){.card-details{grid-template-columns:1fr}}";
  document.head.appendChild(style);
}

async function api(path) {
  const response = await fetch(path, { cache: "no-store", headers: state.token ? { "x-session-token": state.token } : {} });
  const payload = await response.json();
  if (response.status === 401) {
    localStorage.removeItem("merasTrackerSession");
    throw new Error("\u0627\u0646\u062a\u0647\u062a \u0627\u0644\u062c\u0644\u0633\u0629\u060c \u0627\u0636\u063a\u0637 \u062e\u0631\u0648\u062c \u0648\u0627\u062f\u062e\u0644 \u0645\u0646 \u062c\u062f\u064a\u062f.");
  }
  if (!response.ok) throw new Error(payload.error || "\u062a\u0639\u0630\u0631 \u0642\u0631\u0627\u0621\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a");
  return payload;
}

function setNotice(message, type = "info") {
  els.notice.textContent = message || "";
  els.notice.style.display = message ? "block" : "none";
  els.notice.style.background = type === "error" ? "#fdeaea" : "#fff8e7";
  els.notice.style.borderColor = type === "error" ? "#efb2b2" : "#efd28e";
  els.notice.style.color = type === "error" ? "#842828" : "#76510c";
}
function setAuthError(message) { els.authError.textContent = message || ""; els.authError.style.display = message ? "block" : "none"; }
function statusChip(order) { return `<span class="status ${escapeHtml(order.status)}">${escapeHtml(order.statusLabel)}</span>`; }
function metric(label, value, color = "") { return `<article class="metric ${color}"><span>${label}</span><b>${value}</b></article>`; }
function moneyRow(order) { return `<div class="money-row"><span>\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a <b>${fmt(order.totalAmount)}</b></span><span>\u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621 <b>${fmt(order.inProcessAmount)}</b></span><span>\u0627\u0644\u0645\u062f\u0641\u0648\u0639 <b>${fmt(order.paidAmount)}</b></span><span>\u0627\u0644\u0645\u062a\u0628\u0642\u064a <b>${fmt(order.remainingAmount)}</b></span></div>`; }
function refs(value) { const list = Array.isArray(value) ? value : []; return list.length ? list.map(item => `<span>${escapeHtml(item)}</span>`).join("") : "-"; }
function invoiceLink(order) { return order.invoiceLink ? `<a href="${escapeHtml(order.invoiceLink)}" target="_blank" rel="noreferrer">\u0641\u062a\u062d</a>` : "-"; }
async function enrichOrdersWithPayments(rows) {
  await Promise.all(rows.map(async order => {
    const payload = await api(params("/api/payments", { taskId: order.id })).catch(() => ({ rows: [] }));
    const refsList = [...new Set((payload.rows || []).map(row => String(row.payment_number || row.id || "").trim()).filter(Boolean))];
    const latestPaymentDate = (payload.rows || []).map(row => row.write_date).filter(Boolean).sort().at(-1) || "";
    order.paymentNumbers = refsList;
    order.inProcessPaymentNumbers = order.inProcessAmount > 0 ? refsList : [];
    order.paidPaymentNumbers = order.paidAmount > 0 ? refsList : [];
    order.inProcessDate = order.inProcessAmount > 0 ? (latestPaymentDate || order.updatedAt) : "";
    order.paidDate = order.paidAmount > 0 ? order.updatedAt : "";
  }));
  return rows;
}

function renderMetricCards(totals, statusCounts = {}) {
  els.metrics.innerHTML = [
    metric("\u0625\u062c\u0645\u0627\u0644\u064a \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", fmt(totals.count), "blue"),
    metric("\u0625\u062c\u0645\u0627\u0644\u064a \u0642\u064a\u0645\u0629 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", fmt(totals.totalAmount), "green"),
    metric("\u0625\u062c\u0645\u0627\u0644\u064a \u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621", fmt(totals.inProcessAmount), "amber"),
    metric("\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062f\u0641\u0648\u0639", fmt(totals.paidAmount), "green"),
    metric("\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062a\u0628\u0642\u064a", fmt(totals.remainingAmount), "red"),
    metric("\u0645\u0633\u0648\u062f\u0629", fmt(statusCounts.draft?.count || 0)),
    metric("\u0645\u0639\u062a\u0645\u062f", fmt(statusCounts.approved?.count || 0), "blue"),
    metric("\u0645\u0624\u0643\u062f", fmt(statusCounts.confirm?.count || 0), "green"),
  ].join("");
}
function setFinancialFilter(filter) {
  state.financialFilter = filter;
  document.querySelectorAll("[data-financial-filter]").forEach(button => {
    const active = button.dataset.financialFilter === filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}
function financialFilterLabel() {
  return ({ all: "\u0643\u0644 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", process: "\u0623\u0648\u0627\u0645\u0631 \u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621", paid: "\u0623\u0648\u0627\u0645\u0631 \u0645\u062f\u0641\u0648\u0639\u0629", remaining: "\u0623\u0648\u0627\u0645\u0631 \u0641\u064a\u0647\u0627 \u0645\u062a\u0628\u0642\u064a" })[state.financialFilter] || "\u0643\u0644 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0639\u0645\u0644";
}

function setLoggedIn(session) {
  state.token = session.token;
  state.admin = session.role === "admin";
  state.contractorId = session.contractorId || "";
  state.contractorName = session.contractorName || "";
  localStorage.setItem("merasTrackerSession", JSON.stringify(session));
  els.authScreen.classList.add("hidden");
  els.appRoot.classList.remove("hidden");
  els.currentSession.textContent = state.admin ? "\u0627\u0644\u0623\u062f\u0645\u0646" : state.contractorName;
  document.querySelectorAll(".admin-only").forEach(el => el.style.display = state.admin ? "" : "none");
}
function setOrdersLoading(isLoading) {
  els.financialFilterTabs.classList.toggle("loading", isLoading);
  document.querySelectorAll("[data-financial-filter], #prevPageBtn, #nextPageBtn").forEach(button => button.disabled = isLoading);
  if (!isLoading) return;
  els.pageInfo.textContent = `\u062c\u0627\u0631\u064a \u062a\u062c\u0647\u064a\u0632 ${financialFilterLabel()}...`;
  els.ordersRows.innerHTML = `<tr><td colspan="13" class="orders-loading">\u062c\u0627\u0631\u064a \u062a\u062d\u062f\u064a\u062b \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0639\u0645\u0644...</td></tr>`;
  els.ordersCards.innerHTML = `<div class="orders-loading">\u062c\u0627\u0631\u064a \u062a\u062d\u062f\u064a\u062b \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0639\u0645\u0644...</div>`;
}
function logout() {
  localStorage.removeItem("merasTrackerSession");
  Object.assign(state, { token: "", admin: false, contractorId: "", contractorName: "", orders: [], total: 0, financialFilter: "all", page: 1 });
  setFinancialFilter("all");
  els.appRoot.classList.add("hidden");
  els.authScreen.classList.remove("hidden");
  switchView("dashboard");
  els.authEmail.focus();
}

async function loginByEmail() {
  try {
    const email = els.authEmail.value.trim();
    if (!email) return setAuthError("\u0627\u0643\u062a\u0628 \u0625\u064a\u0645\u064a\u0644 \u0627\u0644\u0645\u062a\u0639\u0647\u062f \u0623\u0648\u0644\u0627.");
    setAuthError("");
    const payload = await api(params("/api/login", { email }));
    if (!payload.ok) return setAuthError(payload.error || "\u0627\u0644\u0625\u064a\u0645\u064a\u0644 \u063a\u064a\u0631 \u0645\u0631\u0628\u0648\u0637 \u0628\u0645\u062a\u0639\u0647\u062f \u0641\u064a MERAAS.");
    setFinancialFilter("all");
    if (payload.user.role === "admin") {
      setLoggedIn({ role: "admin", token: payload.token, email: "admin@meras.local" });
      await loadContractors();
    } else {
      setLoggedIn({ role: "contractor", token: payload.token, contractorId: String(payload.user.contractorId), contractorName: payload.user.contractorName, email });
    }
    setNotice(`\u062a\u0645 \u0627\u0644\u062f\u062e\u0648\u0644: ${state.admin ? "\u0627\u0644\u0623\u062f\u0645\u0646" : state.contractorName}`);
    await refreshAll();
  } catch (error) { setAuthError(error.message); }
}
async function refreshAll() {
  try {
    state.page = 1;
    await Promise.all([loadDashboard(), loadOrders()]);
  } catch (error) { setNotice(error.message, "error"); }
}
async function loadDashboard() {
  const payload = await api("/api/dashboard");
  renderMetricCards(payload.totals, payload.totals.byStatus);
  els.latestOrders.innerHTML = payload.latest.map(order => `<button class="mini-order" data-open-order="${order.id}"><strong>${escapeHtml(order.number)} ${statusChip(order)}</strong><small>${escapeHtml(order.project.name)} - ${escapeHtml(order.location.name || "-")}</small>${moneyRow(order)}</button>`).join("") || `<div class="alert">\u0644\u0627 \u062a\u0648\u062c\u062f \u0623\u0648\u0627\u0645\u0631 \u0639\u0645\u0644.</div>`;
  const alerts = payload.latest.filter(order => order.remainingAmount > 0 || order.inProcessAmount > 0).slice(0, 6);
  els.alerts.innerHTML = alerts.map(order => `<div class="alert"><b>${escapeHtml(order.number)}</b><small>${order.inProcessAmount > 0 ? `\u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621: ${fmt(order.inProcessAmount)}` : `\u0645\u062a\u0628\u0642\u064a: ${fmt(order.remainingAmount)}`}</small></div>`).join("") || `<div class="alert">\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0641\u064a \u0622\u062e\u0631 \u0627\u0644\u0623\u0648\u0627\u0645\u0631.</div>`;
  els.lastLoaded.textContent = `\u0622\u062e\u0631 \u0642\u0631\u0627\u0621\u0629: ${fmtDate(payload.loadedAt)}`;
}
async function loadOrders() {
  const seq = ++state.orderLoadSeq;
  setOrdersLoading(true);
  const offset = (state.page - 1) * state.pageSize;
  const endpoint = state.financialFilter === "all" ? "/api/work-orders" : "/api/work-orders-financial";
  try {
    const payload = await api(params(endpoint, {
      q: els.searchInput.value.trim(),
      status: els.statusFilter.value,
      project: els.projectFilter.value.trim(),
      costCenter: els.costCenterFilter.value.trim(),
      sort: els.sortFilter.value,
      financial: state.financialFilter,
      limit: state.pageSize,
      offset,
    }));
    if (seq !== state.orderLoadSeq) return;
    state.orders = await enrichOrdersWithPayments(payload.rows || []);
    state.total = payload.total || 0;
    renderOrders(financialFilterLabel());
  } catch (error) {
    if (seq === state.orderLoadSeq) setNotice(error.message, "error");
  } finally {
    if (seq === state.orderLoadSeq) setOrdersLoading(false);
  }
}
function renderOrders(scopeLabel = "") {
  els.ordersRows.innerHTML = state.orders.map(order => `<tr><td><button class="linkish" data-open-order="${order.id}">${escapeHtml(order.number)}</button></td><td>${statusChip(order)}</td><td>${escapeHtml(order.location.name || "-")}</td><td>${escapeHtml(order.costCenterNumber || "-")}<br><small>${escapeHtml(order.costCenterName)}</small></td><td>${escapeHtml(order.invoiceNumber || order.contractorBill || "-")}</td><td>${invoiceLink(order)}</td><td class="amount">${fmt(order.totalAmount)}</td><td class="amount">${fmt(order.inProcessAmount)}</td><td>${fmtDate(order.inProcessDate)}</td><td><div class="ref-list">${refs(order.inProcessPaymentNumbers)}</div></td><td class="amount">${fmt(order.paidAmount)}</td><td>${fmtDate(order.paidDate)}</td><td><div class="ref-list">${refs(order.paidPaymentNumbers)}</div></td></tr>`).join("");
  els.ordersCards.innerHTML = state.orders.map(order => `<article class="card" data-open-order="${order.id}"><div class="card-head"><b>${escapeHtml(order.number)}</b>${statusChip(order)}</div><small>${escapeHtml(order.location.name || "-")} - ${escapeHtml(order.costCenterNumber || "-")}</small><div class="card-details"><span>\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 <b>${escapeHtml(order.invoiceNumber || order.contractorBill || "-")}</b></span><span>\u0631\u0627\u0628\u0637 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 <b>${order.invoiceLink ? "\u0645\u062a\u0627\u062d" : "-"}</b></span><span>\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a <b>${fmt(order.totalAmount)}</b></span><span>\u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621 <b>${fmt(order.inProcessAmount)}</b></span><span>\u062a\u0627\u0631\u064a\u062e \u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621 <b>${fmtDate(order.inProcessDate)}</b></span><span>\u0633\u062f\u0627\u062f\u0627\u062a \u062a\u062d\u062a \u0627\u0644\u0625\u062c\u0631\u0627\u0621 <b>${escapeHtml((order.inProcessPaymentNumbers || []).join(", ") || "-")}</b></span><span>\u0627\u0644\u0645\u062f\u0641\u0648\u0639 <b>${fmt(order.paidAmount)}</b></span><span>\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062f\u0641\u0639 <b>${fmtDate(order.paidDate)}</b></span><span>\u0633\u062f\u0627\u062f\u0627\u062a \u0645\u062f\u0641\u0648\u0639\u0629 <b>${escapeHtml((order.paidPaymentNumbers || []).join(", ") || "-")}</b></span></div></article>`).join("");
  const pages = Math.max(Math.ceil(state.total / state.pageSize), 1);
  if (state.page > pages) state.page = pages;
  const prefix = scopeLabel ? `${scopeLabel} - ` : "";
  els.pageInfo.textContent = `${prefix}\u0635\u0641\u062d\u0629 ${state.page} \u0645\u0646 ${pages} - \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a ${fmt(state.total)}`;
  els.prevPageBtn.disabled = state.page <= 1;
  els.nextPageBtn.disabled = state.page >= pages;
}
async function openOrder(orderId) {
  const detail = state.orders.find(item => String(item.id) === String(orderId));
  if (!detail) return;
  const payments = await api(params("/api/payments", { taskId: detail.id })).catch(() => ({ rows: [] }));
  els.drawerContent.innerHTML = `<h2>\u0623\u0645\u0631 \u0627\u0644\u0639\u0645\u0644 ${escapeHtml(detail.number)}</h2><p>${statusChip(detail)}</p><div class="detail-grid"><div class="detail"><span>\u0627\u0644\u0645\u062a\u0639\u0647\u062f</span><b>${escapeHtml(detail.contractor.name)}</b></div><div class="detail"><span>\u0627\u0644\u0645\u0634\u0631\u0648\u0639</span><b>${escapeHtml(detail.project.name)}</b></div><div class="detail"><span>\u0627\u0644\u0645\u0648\u0642\u0639</span><b>${escapeHtml(detail.location.name || "-")}</b></div><div class="detail"><span>\u0645\u0631\u0643\u0632 \u0627\u0644\u062a\u0643\u0644\u0641\u0629</span><b>${escapeHtml(detail.costCenterNumber || "-")}</b></div><div class="detail"><span>\u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629</span><b>${escapeHtml(detail.invoiceNumber || detail.contractorBill || "-")}</b></div><div class="detail"><span>\u0622\u062e\u0631 \u062a\u062d\u062f\u064a\u062b</span><b>${fmtDate(detail.updatedAt)}</b></div></div><h3>\u0627\u0644\u0645\u0644\u062e\u0635 \u0627\u0644\u0645\u0627\u0644\u064a</h3>${moneyRow(detail)}<h3>\u062f\u0641\u0639\u0627\u062a / \u0634\u0631\u0648\u0637 \u0627\u0644\u062f\u0641\u0639</h3><div class="order-list">${payments.rows.map(row => `<div class="mini-order"><b>\u062f\u0641\u0639\u0629 ${escapeHtml(row.payment_number || "-")}</b><small>${escapeHtml(row.payment_term || "-")} - ${escapeHtml(row.payment_type || row.payment || "-")}</small></div>`).join("") || `<div class="alert">\u0644\u0627 \u062a\u0648\u062c\u062f \u062f\u0641\u0639\u0627\u062a \u0645\u0642\u0631\u0648\u0621\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0623\u0645\u0631.</div>`}</div>`;
  els.drawer.classList.add("open");
  els.drawerBackdrop.classList.add("open");
}
function closeDrawer() { els.drawer.classList.remove("open"); els.drawerBackdrop.classList.remove("open"); }
function switchView(view) {
  document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
  $(`#${view}View`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  els.pageTitle.textContent = ({ dashboard: "\u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0629", orders: "\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0639\u0645\u0644", contractors: "\u0627\u0644\u0645\u062a\u0639\u0647\u062f\u064a\u0646" })[view];
}
async function loadContractors() {
  const payload = await api(params("/api/contractors", { q: els.contractorSearch?.value || "" }));
  state.contractors = payload.rows;
  els.contractorRows.innerHTML = payload.rows.map(item => `<tr><td>${escapeHtml(item.name)}<br><small>ID: ${item.id}</small></td><td><code>${escapeHtml(item.portalEmail)}</code></td><td>${fmt(item.workOrders)}</td></tr>`).join("");
}
function exportEmails() {
  const rows = [["contractor_id", "contractor_name", "portal_email", "work_orders"], ...state.contractors.map(item => [item.id, item.name, item.portalEmail, item.workOrders])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = "meras-contractor-emails.csv"; link.click(); URL.revokeObjectURL(url);
}
let filterTimer = null;
function refilterOrders() { state.page = 1; return loadOrders(); }
function scheduleRefilterOrders() {
  clearTimeout(filterTimer);
  filterTimer = setTimeout(refilterOrders, 300);
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => switchView(button.dataset.view)));
els.authLoginBtn.addEventListener("click", loginByEmail);
els.authAdminBtn.addEventListener("click", loginByEmail);
els.authEmail.addEventListener("keydown", e => { if (e.key === "Enter") loginByEmail(); });
els.logoutBtn.addEventListener("click", logout);
els.refreshBtn.addEventListener("click", refreshAll);
els.prevPageBtn.addEventListener("click", () => { if (state.page > 1) { state.page -= 1; loadOrders(); } });
els.nextPageBtn.addEventListener("click", () => { const pages = Math.max(Math.ceil(state.total / state.pageSize), 1); if (state.page < pages) { state.page += 1; loadOrders(); } });
els.searchContractorsBtn.addEventListener("click", loadContractors);
els.exportEmailsBtn.addEventListener("click", exportEmails);
els.closeDrawer.addEventListener("click", closeDrawer);
els.drawerBackdrop.addEventListener("click", closeDrawer);
els.financialFilterTabs.addEventListener("click", event => {
  const button = event.target.closest("[data-financial-filter]");
  if (!button) return;
  setFinancialFilter(button.dataset.financialFilter);
  refilterOrders();
});
[els.searchInput, els.projectFilter, els.costCenterFilter].forEach(control => control.addEventListener("input", scheduleRefilterOrders));
[els.statusFilter, els.sortFilter].forEach(control => control.addEventListener("change", refilterOrders));
document.body.addEventListener("click", event => { const open = event.target.closest("[data-open-order]"); if (open) openOrder(open.dataset.openOrder); });

(async function init() {
  try {
    applyOrderTableLayout();
    setFinancialFilter(state.financialFilter);
    const saved = JSON.parse(localStorage.getItem("merasTrackerSession") || "null");
    if (!saved) return els.authEmail.focus();
    setLoggedIn(saved);
    if (state.admin) await loadContractors();
    await refreshAll();
  } catch (error) { logout(); setAuthError(error.message); }
})();
