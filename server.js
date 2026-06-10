const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const publicDir = path.join(root, "public");
const config = {
  url: process.env.ODOO_URL || "https://cubesteam-ardanoholding.odoo.com",
  db: process.env.ODOO_DB || "cubesteam-ardanoholding-live-10270445",
  login: process.env.ODOO_LOGIN || "",
  apiKey: process.env.ODOO_API_KEY || "",
  companyId: Number(process.env.ODOO_COMPANY_ID || 5),
  port: Number(process.env.PORT || 4185),
};

const READ_ONLY_METHODS = new Set(["search_read", "search_count", "read_group", "fields_get"]);
const cache = new Map();
const CACHE_MS = Number(process.env.ODOO_CACHE_MS || 2 * 60 * 1000);
const TOKEN_SECRET = config.apiKey || "meras-contractor-tracker";
const workOrderFields = ["id", "company_id", "name", "work_order_number", "task_type_work_order", "contractor_id", "project_id", "project_location", "cost_center_number", "analytic_account_id", "bill_number", "contractor_bill", "total_points", "total_payment", "total_payment_request", "date", "approved_date", "confirmed_date", "write_date"];

function send(res, status, body, type = "application/json; charset=utf-8") { res.writeHead(status, { "content-type": type, "cache-control": "no-store" }); res.end(body); }
function json(res, status, payload) { send(res, status, JSON.stringify(payload)); }
function contentType(file) { if (file.endsWith(".html")) return "text/html; charset=utf-8"; if (file.endsWith(".css")) return "text/css; charset=utf-8"; if (file.endsWith(".js")) return "text/javascript; charset=utf-8"; return "application/octet-stream"; }
function number(value) { return Number(value || 0); }
function text(value) { return String(value || "").trim(); }
function norm(value) { return text(value).toLowerCase(); }
function many2one(value) { return Array.isArray(value) ? { id: value[0] ?? null, name: text(value[1]) } : { id: null, name: "" }; }
function portalEmailForContractor(id) { return `contractor-${id}@meras.local`; }
function contractorIdFromPortalEmail(email) { return Number((norm(email).match(/^contractor-(\d+)@meras\.local$/) || [])[1] || 0); }
function baseDomain(extra = []) { return [["company_id", "=", config.companyId], ...extra]; }
function statusLabel(value) { return ({ draft: "مسودة", approved: "معتمد", confirm: "مؤكد", cancel: "ملغي", done: "مكتمل" })[value] || value || "غير محدد"; }
function sortOrder(sort) { return ({ latest: "write_date desc", value: "total_points desc", paid: "total_payment desc", date: "date desc, id desc" })[sort] || "write_date desc"; }
function parseLimit(url, fallback = 25, max = 200) { return Math.min(Math.max(Number(url.searchParams.get("limit") || fallback), 1), max); }
function parseOffset(url) { return Math.max(Number(url.searchParams.get("offset") || 0), 0); }
function cacheKey(name, value) { return `${name}:${JSON.stringify(value)}`; }

async function cached(name, value, fn, ttl = CACHE_MS) {
  const key = cacheKey(name, value);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const result = await fn();
  cache.set(key, { value: result, expiresAt: Date.now() + ttl });
  return result;
}

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyToken(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!session.createdAt || Date.now() - session.createdAt > 12 * 60 * 60 * 1000) return null;
  return session;
}

async function rpc(service, method, args) {
  const response = await fetch(`${config.url}/jsonrpc`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args }, id: Date.now() }) });
  const payload = await response.json();
  if (!response.ok || payload.error) throw new Error(payload.error?.data?.message || payload.error?.message || response.statusText);
  return payload.result;
}
async function authenticate() {
  if (!config.login || !config.apiKey) throw new Error("Odoo read-only credentials are not configured.");
  return cached("auth", config.login, async () => {
    const uid = await rpc("common", "authenticate", [config.db, config.login, config.apiKey, {}]);
    if (!uid) throw new Error("Odoo authentication failed.");
    return uid;
  });
}
async function odooRead(model, method, args = [], kwargs = {}) {
  if (!READ_ONLY_METHODS.has(method)) throw new Error(`Blocked non-read Odoo method: ${method}`);
  const uid = await authenticate();
  return rpc("object", "execute_kw", [config.db, uid, config.apiKey, model, method, args, kwargs]);
}

function mapWorkOrder(row) {
  const contractor = many2one(row.contractor_id);
  const project = many2one(row.project_id);
  const location = many2one(row.project_location);
  const analytic = many2one(row.analytic_account_id);
  const totalAmount = number(row.total_points);
  const paidAmount = number(row.total_payment);
  const requestedAmount = number(row.total_payment_request);
  const inProcessAmount = Math.max(requestedAmount - paidAmount, 0);
  const remainingAmount = Math.max(totalAmount - paidAmount - inProcessAmount, 0);
  return { id: row.id, company: many2one(row.company_id), number: row.work_order_number || row.name || String(row.id), status: row.task_type_work_order || "", statusLabel: statusLabel(row.task_type_work_order), contractor, project, location, costCenterNumber: row.cost_center_number || "", costCenterName: analytic.name, invoiceNumber: row.bill_number || "", contractorBill: row.contractor_bill || "", totalAmount, requestedAmount, inProcessAmount, paidAmount, remainingAmount, date: row.date || "", approvedDate: row.approved_date || "", confirmedDate: row.confirmed_date || "", updatedAt: row.write_date || "", currency: "LYD" };
}
function totalsFor(rows) {
  return rows.reduce((acc, order) => { acc.count += 1; acc.totalAmount += order.totalAmount; acc.inProcessAmount += order.inProcessAmount; acc.paidAmount += order.paidAmount; acc.remainingAmount += order.remainingAmount; acc.byStatus[order.status] = acc.byStatus[order.status] || { status: order.status, label: statusLabel(order.status), count: 0 }; acc.byStatus[order.status].count += 1; return acc; }, { count: 0, totalAmount: 0, inProcessAmount: 0, paidAmount: 0, remainingAmount: 0, byStatus: {} });
}
function rowMatchesText(order, q) {
  if (!q) return true;
  return [order.number, order.invoiceNumber, order.contractorBill, order.project.name, order.location.name, order.costCenterNumber, order.costCenterName].some(v => norm(v).includes(q));
}
function rowMatchesFinancial(order, financial) {
  if (financial === "process") return Number(order.inProcessAmount || 0) > 0;
  if (financial === "paid") return Number(order.paidAmount || 0) > 0;
  if (financial === "remaining") return Number(order.remainingAmount || 0) > 0;
  return true;
}
function sortRows(rows, sort) {
  return [...rows].sort((a, b) => {
    if (sort === "value") return Number(b.totalAmount || 0) - Number(a.totalAmount || 0);
    if (sort === "remaining") return Number(b.remainingAmount || 0) - Number(a.remainingAmount || 0);
    if (sort === "paid") return Number(b.paidAmount || 0) - Number(a.paidAmount || 0);
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
}
async function fetchAllTaskRows(domain, fields, batchSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += batchSize) {
    const page = await odooRead("project.task", "search_read", [domain], { fields, limit: batchSize, offset, order: "id asc" });
    rows.push(...page);
    if (page.length < batchSize) break;
  }
  return rows;
}

async function resolvePartnerByEmail(email) {
  if (!email) return { found: false };
  const generatedId = contractorIdFromPortalEmail(email);
  if (generatedId) {
    const rows = await odooRead("project.task", "search_read", [baseDomain([["contractor_id", "=", generatedId]])], { fields: ["contractor_id"], limit: 1 });
    if (rows[0]) {
      const contractor = many2one(rows[0].contractor_id);
      const workOrders = await odooRead("project.task", "search_count", [baseDomain([["contractor_id", "=", contractor.id]])]);
      return { found: true, partner: { id: contractor.id, name: contractor.name, email: portalEmailForContractor(contractor.id), workOrders } };
    }
  }
  const partners = await odooRead("res.partner", "search_read", [["|", ["email_normalized", "=", norm(email)], ["email", "ilike", email]]], { fields: ["id", "name", "email", "email_normalized"], limit: 5 });
  for (const partner of partners) {
    const count = await odooRead("project.task", "search_count", [baseDomain([["contractor_id", "=", partner.id]])]);
    if (count > 0) return { found: true, partner: { ...partner, workOrders: count } };
  }
  return { found: false, matches: partners };
}
async function loginWithEmail(url) {
  const email = norm(url.searchParams.get("email"));
  if (email === "admin@meras.local") return { ok: true, token: signPayload({ role: "admin", email, createdAt: Date.now() }), user: { role: "admin", email, name: "MERAAS Admin" } };
  const resolved = await resolvePartnerByEmail(email);
  if (!resolved.found) return { ok: false, error: "Email is not linked to a MERAAS contractor." };
  const token = signPayload({ role: "contractor", email, contractorId: resolved.partner.id, contractorName: resolved.partner.name, createdAt: Date.now() });
  return { ok: true, token, user: { role: "contractor", email, contractorId: resolved.partner.id, contractorName: resolved.partner.name, workOrders: resolved.partner.workOrders } };
}
function requireSession(req) {
  const session = verifyToken(req.headers["x-session-token"]);
  if (!session) { const error = new Error("Unauthorized session."); error.status = 401; throw error; }
  return session;
}
function scopedUrl(url, session) { const scoped = new URL(url.toString()); if (session.role === "contractor") scoped.searchParams.set("contractorId", String(session.contractorId)); return scoped; }
function buildDomainFromUrl(url, extra = []) {
  const contractorId = Number(url.searchParams.get("contractorId") || 0);
  const status = url.searchParams.get("status") || "";
  const project = norm(url.searchParams.get("project"));
  const costCenter = norm(url.searchParams.get("costCenter"));
  const domain = baseDomain(extra);
  if (contractorId) domain.push(["contractor_id", "=", contractorId]);
  if (status) domain.push(["task_type_work_order", "=", status]);
  if (project) domain.push(["project_id", "ilike", project]);
  if (costCenter) domain.push(["cost_center_number", "ilike", costCenter]);
  return domain;
}

async function getWorkOrders(url) {
  const domain = buildDomainFromUrl(url);
  const rows = await odooRead("project.task", "search_read", [domain], { fields: workOrderFields, limit: parseLimit(url), offset: parseOffset(url), order: sortOrder(url.searchParams.get("sort")) });
  let mapped = rows.map(mapWorkOrder);
  const q = norm(url.searchParams.get("q"));
  if (q) mapped = mapped.filter(order => rowMatchesText(order, q));
  const total = await odooRead("project.task", "search_count", [domain]);
  return { companyId: config.companyId, total, rows: mapped, loadedAt: new Date().toISOString() };
}
async function getFinancialOrders(url) {
  const financial = url.searchParams.get("financial") || "all";
  if (financial === "all") return getWorkOrders(url);
  const limit = parseLimit(url);
  const offset = parseOffset(url);
  const q = norm(url.searchParams.get("q"));
  const sort = url.searchParams.get("sort");
  let extra = [];
  if (financial === "paid") extra = [["total_payment", ">", 0]];
  if (financial === "process") extra = [["total_payment_request", ">", 0]];
  if (financial === "remaining") extra = [["total_points", ">", 0]];
  const domain = buildDomainFromUrl(url, extra);

  if (financial === "paid" && !q && !["remaining"].includes(sort || "")) {
    const total = await odooRead("project.task", "search_count", [domain]);
    const rows = await odooRead("project.task", "search_read", [domain], { fields: workOrderFields, limit, offset, order: sortOrder(sort) });
    return { companyId: config.companyId, total, rows: rows.map(mapWorkOrder), loadedAt: new Date().toISOString(), financial };
  }

  const cacheKeyValue = { domain, financial, q, sort };
  const filtered = await cached("financial-orders", cacheKeyValue, async () => {
    const rows = (await fetchAllTaskRows(domain, workOrderFields)).map(mapWorkOrder)
      .filter(order => rowMatchesFinancial(order, financial))
      .filter(order => rowMatchesText(order, q));
    return sortRows(rows, sort);
  }, 10 * 60 * 1000);
  return { companyId: config.companyId, total: filtered.length, rows: filtered.slice(offset, offset + limit), loadedAt: new Date().toISOString(), financial };
}
async function getDashboard(url) {
  const contractorId = Number(url.searchParams.get("contractorId") || 0);
  const extra = contractorId ? [["contractor_id", "=", contractorId]] : [];
  const latest = (await odooRead("project.task", "search_read", [baseDomain(extra)], { fields: workOrderFields, limit: 5, order: "write_date desc" })).map(mapWorkOrder);
  const count = await odooRead("project.task", "search_count", [baseDomain(extra)]);
  const totals = totalsFor(latest);
  totals.count = count;
  for (const status of ["draft", "approved", "confirm", "cancel", "done"]) {
    totals.byStatus[status] = totals.byStatus[status] || { status, label: statusLabel(status), count: 0 };
    totals.byStatus[status].count = await odooRead("project.task", "search_count", [baseDomain([...extra, ["task_type_work_order", "=", status]])]);
  }
  return { companyId: config.companyId, loadedAt: new Date().toISOString(), totals, latest };
}
async function getContractors(url) {
  const q = norm(url.searchParams.get("q"));
  const groups = await cached("contractors", config.companyId, () => odooRead("project.task", "read_group", [baseDomain([["contractor_id", "!=", false]]), ["contractor_id"], ["contractor_id"]], { lazy: false, limit: 5000 }), 10 * 60 * 1000);
  let rows = groups.map(group => { const contractor = many2one(group.contractor_id); return { id: contractor.id, name: contractor.name, portalEmail: portalEmailForContractor(contractor.id), workOrders: number(group.contractor_id_count || group.__count) }; }).filter(item => item.id);
  if (q) rows = rows.filter(item => norm(item.name).includes(q) || String(item.id).includes(q));
  rows.sort((a, b) => b.workOrders - a.workOrders);
  return { companyId: config.companyId, rows, loadedAt: new Date().toISOString() };
}
async function getPayments(url) {
  const taskId = Number(url.searchParams.get("taskId") || 0);
  const contractorId = Number(url.searchParams.get("contractorId") || 0);
  if (!taskId) return { rows: [] };
  if (contractorId) {
    const allowed = await odooRead("project.task", "search_count", [baseDomain([["id", "=", taskId], ["contractor_id", "=", contractorId]])]);
    if (!allowed) { const error = new Error("This work order is outside the contractor scope."); error.status = 403; throw error; }
  }
  const rows = await odooRead("task.payment", "search_read", [[["task_id", "=", taskId]]], { fields: ["id", "task_id", "payment", "payment_number", "payment_term", "payment_type", "write_date"], limit: 100, order: "payment_number asc, id asc" });
  return { rows };
}

async function routeApi(req, res, url) {
  if (url.pathname === "/api/health") return json(res, 200, { ok: true, mode: "odoo-readonly", companyId: config.companyId, writeMethodsBlocked: true });
  if (url.pathname === "/api/login") return json(res, 200, await loginWithEmail(url));
  const session = requireSession(req);
  const scoped = scopedUrl(url, session);
  if (url.pathname === "/api/work-orders") return json(res, 200, await getWorkOrders(scoped));
  if (url.pathname === "/api/work-orders-financial") return json(res, 200, await getFinancialOrders(scoped));
  if (url.pathname === "/api/dashboard") return json(res, 200, await getDashboard(scoped));
  if (url.pathname === "/api/payments") return json(res, 200, await getPayments(scoped));
  if (url.pathname === "/api/contractors") { if (session.role !== "admin") return json(res, 403, { error: "Admin only." }); return json(res, 200, await getContractors(scoped)); }
  return json(res, 404, { error: "API route not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return await routeApi(req, res, url);
    const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
    const filePath = path.normalize(path.join(publicDir, requested));
    if (!filePath.startsWith(publicDir)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    return send(res, 200, fs.readFileSync(filePath), contentType(filePath));
  } catch (error) { return json(res, error.status || 500, { error: error.message }); }
});
server.listen(config.port, () => console.log(`MERAAS Contractor Tracker running on http://localhost:${config.port}`));
