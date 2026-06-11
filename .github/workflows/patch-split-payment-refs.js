const fs = require('fs');
const path = 'public/app.js';
let text = fs.readFileSync(path, 'utf8');
const anchor = 'function invoiceLink(order) { return order.invoiceLink ? `<a href="${escapeHtml(order.invoiceLink)}" target="_blank" rel="noreferrer">\\u0641\\u062a\\u062d</a>` : "-"; }\n';
const helper = anchor + `function splitPaymentRefs(order, paymentRows) {
  const items = [...new Map((paymentRows || []).map(row => {
    const ref = String(row.payment_reference || row.name || row.display_name || row.payment_number || row.id || "").trim();
    return ref ? [ref, { ref, date: row.payment_date || row.bill_date || row.date || row.write_date || row.create_date || "" }] : null;
  }).filter(Boolean)).values()];
  if (!items.length) return { paid: [], process: [], paidDate: "", processDate: "" };
  const all = items.map(item => item.ref);
  if (order.paidAmount > 0 && order.inProcessAmount > 0 && items.length > 1) {
    const processItems = items.slice(-1);
    const paidItems = items.slice(0, -1);
    return {
      paid: paidItems.map(item => item.ref),
      process: processItems.map(item => item.ref),
      paidDate: paidItems.map(item => item.date).filter(Boolean).sort().at(-1) || "",
      processDate: processItems.map(item => item.date).filter(Boolean).sort().at(-1) || "",
    };
  }
  if (order.inProcessAmount > 0 && order.paidAmount <= 0) return { paid: [], process: all, paidDate: "", processDate: items.map(item => item.date).filter(Boolean).sort().at(-1) || "" };
  if (order.paidAmount > 0) return { paid: all, process: [], paidDate: items.map(item => item.date).filter(Boolean).sort().at(-1) || "", processDate: "" };
  return { paid: [], process: [], paidDate: "", processDate: "" };
}
`;
if (!text.includes('function splitPaymentRefs')) {
  if (!text.includes(anchor)) throw new Error('invoice anchor not found');
  text = text.replace(anchor, helper);
}
const oldBlock = `    const refsList = [...new Set((payload.rows || []).map(row => String(row.payment_reference || row.name || row.display_name || row.payment_number || row.id || "").trim()).filter(Boolean))];
    const latestPaymentDate = (payload.rows || []).map(row => row.payment_date || row.bill_date || row.date || row.write_date || row.create_date).filter(Boolean).sort().at(-1) || "";
    order.paymentNumbers = refsList;
    order.inProcessPaymentNumbers = order.inProcessAmount > 0 ? refsList : [];
    order.paidPaymentNumbers = order.paidAmount > 0 ? refsList : [];
    order.inProcessDate = order.inProcessAmount > 0 ? (latestPaymentDate || order.updatedAt) : "";
    order.paidDate = order.paidAmount > 0 ? (latestPaymentDate || order.updatedAt) : "";`;
const newBlock = `    const split = splitPaymentRefs(order, payload.rows || []);
    order.paymentNumbers = [...split.paid, ...split.process];
    order.inProcessPaymentNumbers = split.process;
    order.paidPaymentNumbers = split.paid;
    order.inProcessDate = order.inProcessAmount > 0 ? (split.processDate || order.updatedAt) : "";
    order.paidDate = order.paidAmount > 0 ? (split.paidDate || order.updatedAt) : "";`;
if (text.includes(oldBlock)) text = text.replace(oldBlock, newBlock);
else if (!text.includes(newBlock)) throw new Error('payment enrich block not found');
new Function(text);
fs.writeFileSync(path, text);
