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

async function api(path) {
  const response = await fetch(path, { cache: "no-store", headers: state.token ? { "x-session-token": state.token } : {} });
  const payload = await response.json();
  if (response.status === 401) {
    localStorage.removeItem("merasTrackerSession");
    throw new Error("انتهت الجلسة، اضغط خروج وادخل من جديد.");
  }
  if (!response.ok) throw new Error(payload.error || "تعذر قراءة البيانات");
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
function moneyRow(order) { return `<div class="money-row"><span>الإجمالي <b>${fmt(order.totalAmount)}</b></span><span>تحت الإجراء <b>${fmt(order.inProcessAmount)}</b></span><span>المدفوع <b>${fmt(order.paidAmount)}</b></span><span>المتبقي <b>${fmt(order.remainingAmount)}</b></span></div>`; }

function renderMetricCards(totals, statusCounts = {}) {
  els.metrics.innerHTML = [
    metric("إجمالي أوامر العمل", fmt(totals.count), "blue"),
    metric("إجمالي قيمة أوامر العمل", fmt(totals.totalAmount), "green"),
    metric("إجمالي تحت الإجراء", fmt(totals.inProcessAmount), "amber"),
    metric("إجمالي المدفوع", fmt(totals.paidAmount), "green"),
    metric("إجمالي المتبقي", fmt(totals.remainingAmount), "red"),
    metric("مسودة", fmt(statusCounts.draft?.count || 0)),
    metric("معتمد", fmt(statusCounts.approved?.count || 0), "blue"),
    metric("مؤكد", fmt(statusCounts.confirm?.count || 0), "green"),
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
  return ({ all: "كل أوامر العمل", process: "أوامر تحت الإجراء", paid: "أوامر مدفوعة", remaining: "أوامر فيها متبقي" })[state.financialFilter] || "كل أوامر العمل";
}

function setLoggedIn(session) {
  state.token = session.token;
  state.admin = session.role === "admin";
  state.contractorId = session.contractorId || "";
  state.contractorName = session.contractorName || "";
  localStorage.setItem("merasTrackerSession", JSON.stringify(session));
  els.authScreen.classList.add("hidden");
  els.appRoot.classList.remove("hidden");
  els.currentSession.textContent = state.admin ? "الأدمن" : state.contractorName;
  document.querySelectorAll(".admin-only").forEach(el => el.style.display = state.admin ? "" : "none");
}
function setOrdersLoading(isLoading) {
  els.financialFilterTabs.classList.toggle("loading", isLoading);
  document.querySelectorAll("[data-financial-filter], #prevPageBtn, #nextPageBtn").forEach(button => button.disabled = isLoading);
  if (!isLoading) return;
  els.pageInfo.textContent = `جاري تجهيز ${financialFilterLabel()}...`;
  els.ordersRows.innerHTML = `<tr><td colspan="11" class="orders-loading">جاري تحديث أوامر العمل...</td></tr>`;
  els.ordersCards.innerHTML = `<div class="orders-loading">جاري تحديث أوامر العمل...</div>`;
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
    if (!email) return setAuthError("اكتب إيميل المتعهد أولا.");
    setAuthError("");
    const payload = await api(params("/api/login", { email }));
    if (!payload.ok) return setAuthError(payload.error || "الإيميل غير مربوط بمتعهد في MERAAS.");
    setFinancialFilter("all");
    if (payload.user.role === "admin") {
      setLoggedIn({ role: "admin", token: payload.token, email: "admin@meras.local" });
      await loadContractors();
    } else {
      setLoggedIn({ role: "contractor", token: payload.token, contractorId: String(payload.user.contractorId), contractorName: payload.user.contractorName, email });
    }
    setNotice(`تم الدخول: ${state.admin ? "الأدمن" : state.contractorName}`);
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
  els.latestOrders.innerHTML = payload.latest.map(order => `<button class="mini-order" data-open-order="${order.id}"><strong>${escapeHtml(order.number)} ${statusChip(order)}</strong><small>${escapeHtml(order.project.name)} - ${escapeHtml(order.location.name || "-")}</small>${moneyRow(order)}</button>`).join("") || `<div class="alert">لا توجد أوامر عمل.</div>`;
  const alerts = payload.latest.filter(order => order.remainingAmount > 0 || order.inProcessAmount > 0).slice(0, 6);
  els.alerts.innerHTML = alerts.map(order => `<div class="alert"><b>${escapeHtml(order.number)}</b><small>${order.inProcessAmount > 0 ? `تحت الإجراء: ${fmt(order.inProcessAmount)}` : `متبقي: ${fmt(order.remainingAmount)}`}</small></div>`).join("") || `<div class="alert">لا توجد تنبيهات في آخر الأوامر.</div>`;
  els.lastLoaded.textContent = `آخر قراءة: ${fmtDate(payload.loadedAt)}`;
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
    state.orders = payload.rows || [];
    state.total = payload.total || 0;
    renderOrders(financialFilterLabel());
  } catch (error) {
    if (seq === state.orderLoadSeq) setNotice(error.message, "error");
  } finally {
    if (seq === state.orderLoadSeq) setOrdersLoading(false);
  }
}
function renderOrders(scopeLabel = "") {
  els.ordersRows.innerHTML = state.orders.map(order => `<tr><td><button class="linkish" data-open-order="${order.id}">${escapeHtml(order.number)}</button></td><td>${statusChip(order)}</td><td>${escapeHtml(order.project.name)}</td><td>${escapeHtml(order.location.name || "-")}</td><td>${escapeHtml(order.costCenterNumber)}<br><small>${escapeHtml(order.costCenterName)}</small></td><td>${escapeHtml(order.invoiceNumber || order.contractorBill || "-")}</td><td class="amount">${fmt(order.totalAmount)}</td><td class="amount">${fmt(order.inProcessAmount)}</td><td class="amount">${fmt(order.paidAmount)}</td><td class="amount">${fmt(order.remainingAmount)}</td><td>${fmtDate(order.updatedAt)}</td></tr>`).join("");
  els.ordersCards.innerHTML = state.orders.map(order => `<article class="card" data-open-order="${order.id}"><div class="card-head"><b>${escapeHtml(order.number)}</b>${statusChip(order)}</div><small>${escapeHtml(order.project.name)} - ${escapeHtml(order.location.name || "-")}</small>${moneyRow(order)}</article>`).join("");
  const pages = Math.max(Math.ceil(state.total / state.pageSize), 1);
  if (state.page > pages) state.page = pages;
  const prefix = scopeLabel ? `${scopeLabel} - ` : "";
  els.pageInfo.textContent = `${prefix}صفحة ${state.page} من ${pages} - الإجمالي ${fmt(state.total)}`;
  els.prevPageBtn.disabled = state.page <= 1;
  els.nextPageBtn.disabled = state.page >= pages;
}
async function openOrder(orderId) {
  const detail = state.orders.find(item => String(item.id) === String(orderId));
  if (!detail) return;
  const payments = await api(params("/api/payments", { taskId: detail.id })).catch(() => ({ rows: [] }));
  els.drawerContent.innerHTML = `<h2>أمر العمل ${escapeHtml(detail.number)}</h2><p>${statusChip(detail)}</p><div class="detail-grid"><div class="detail"><span>المتعهد</span><b>${escapeHtml(detail.contractor.name)}</b></div><div class="detail"><span>المشروع</span><b>${escapeHtml(detail.project.name)}</b></div><div class="detail"><span>الموقع</span><b>${escapeHtml(detail.location.name || "-")}</b></div><div class="detail"><span>مركز التكلفة</span><b>${escapeHtml(detail.costCenterNumber || "-")}</b></div><div class="detail"><span>الفاتورة</span><b>${escapeHtml(detail.invoiceNumber || detail.contractorBill || "-")}</b></div><div class="detail"><span>آخر تحديث</span><b>${fmtDate(detail.updatedAt)}</b></div></div><h3>الملخص المالي</h3>${moneyRow(detail)}<h3>دفعات / شروط الدفع</h3><div class="order-list">${payments.rows.map(row => `<div class="mini-order"><b>دفعة ${escapeHtml(row.payment_number || "-")}</b><small>${escapeHtml(row.payment_term || "-")} - ${escapeHtml(row.payment_type || row.payment || "-")}</small></div>`).join("") || `<div class="alert">لا توجد دفعات مقروءة لهذا الأمر.</div>`}</div>`;
  els.drawer.classList.add("open");
  els.drawerBackdrop.classList.add("open");
}
function closeDrawer() { els.drawer.classList.remove("open"); els.drawerBackdrop.classList.remove("open"); }
function switchView(view) {
  document.querySelectorAll(".view").forEach(item => item.classList.remove("active"));
  $(`#${view}View`).classList.add("active");
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
  els.pageTitle.textContent = ({ dashboard: "لوحة المتابعة", orders: "أوامر العمل", contractors: "المتعهدين" })[view];
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
    setFinancialFilter(state.financialFilter);
    const saved = JSON.parse(localStorage.getItem("merasTrackerSession") || "null");
    if (!saved) return els.authEmail.focus();
    setLoggedIn(saved);
    if (state.admin) await loadContractors();
    await refreshAll();
  } catch (error) { logout(); setAuthError(error.message); }
})();
