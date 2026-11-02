// Turns OCR'd / pasted receipt text into items. Handles Arabic-Indic digits, "x2" / "2×"
// quantities, trailing currency words and total/tax lines. Pure (no RN imports).
export type ParsedReceipt = { store: string | null; items: { name: string; price: number; quantity: number }[]; total: number | null };

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/٫/g, ".").replace(/٬/g, ",");
const TOTAL = /(الإجمالي|الاجمالي|المجموع|المطلوب|total|grand total|المبلغ)/i;
const SKIP = /(ضريبة|الضريبة|vat|tax|نقد|كاش|cash|visa|فيزا|الباقي|change|خصم|discount|subtotal|المجموع الفرعي|رقم|tel|هاتف|فاتورة|invoice|شكرا|thank)/i;
const CURRENCY = /\s*(د\.?أ|دينار|jod|jd|ر\.?س|ريال|sar|aed|درهم|\$|usd|ل\.?س)\s*/gi;

export function parseReceiptText(raw: string): ParsedReceipt {
  const lines = toLatin(raw || "").split(/\r?\n/).map((l) => l.replace(CURRENCY, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
  const items: ParsedReceipt["items"] = []; let total: number | null = null, store: string | null = null;
  for (const line of lines) {
    const nums = [...line.matchAll(/(\d+(?:[.,]\d{1,3})?)/g)].map((m) => ({ v: Number(m[1].replace(",", ".")), i: m.index ?? 0, s: m[1] }));
    if (!nums.length) { if (!store && line.length >= 3 && line.length <= 40) store = line; continue; }
    const price = nums[nums.length - 1].v;
    if (TOTAL.test(line) && !/فرعي|subtotal/i.test(line)) { total = price; continue; }
    if (SKIP.test(line)) continue;
    let quantity = 1;
    const q = /(?:x|×|\*)\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:x|×|\*)/i.exec(line);
    if (q) quantity = Number(q[1] || q[2]) || 1;
    const name = line.slice(0, nums[nums.length - 1].i).replace(/(?:x|×|\*)\s*\d{1,3}\b|\b\d{1,3}\s*(?:x|×|\*)/gi, "").replace(/[\d.,:@\-–]+\s*$/g, "").replace(/[:\-–]+$/, "").trim();
    if (!name || name.length < 2 || !Number.isFinite(price) || price <= 0) continue;
    // a line "name qty price" where price is the line total → unit price
    const unit = q && nums.length >= 2 && quantity > 1 && Math.abs(nums[nums.length - 2].v * quantity - price) < 0.01 ? nums[nums.length - 2].v : q && quantity > 1 ? Math.round((price / quantity) * 1000) / 1000 : price;
    items.push({ name: name.slice(0, 120), price: unit, quantity });
  }
  return { store, items, total };
}
