import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { arabicCategory, countText, fillText } from "./plural.ts";

test("Arabic plural categories follow the CLDR rule", () => {
  const cases = { 0: "zero", 1: "one", 2: "two", 3: "few", 10: "few", 11: "many", 99: "many", 100: "other", 101: "other", 102: "other", 103: "few", 111: "many", 1000: "other" };
  for (const [n, category] of Object.entries(cases)) assert.equal(arabicCategory(Number(n)), category, `n = ${n}`);
  assert.equal(arabicCategory(2.5), "other");
  assert.equal(arabicCategory(-1), "other");
});

test("counted nouns read correctly in Arabic and English", () => {
  assert.equal(countText("ar", 1, "product"), "منتج واحد");
  assert.equal(countText("ar", 2, "product"), "منتجان");
  assert.equal(countText("ar", 3, "product"), "3 منتجات");
  assert.equal(countText("ar", 11, "product"), "11 منتجًا");
  assert.equal(countText("ar", 100, "product"), "100 منتج");
  assert.equal(countText("ar", 0, "product"), "0 منتج");
  assert.equal(countText("ar", 1, "point"), "نقطة واحدة");
  assert.equal(countText("ar", 7, "day"), "7 أيام");
  assert.equal(countText("ar", 30, "day"), "30 يومًا");
  assert.equal(countText("en", 1, "product"), "1 product");
  assert.equal(countText("en", 0, "product"), "0 products");
  assert.equal(countText("en", 4, "person"), "4 people");
});

test("the translator fills {n:noun} in the text's language and keeps plain values", () => {
  assert.equal(fillText("{n:product} في سلتك", { n: 1 }, "ar"), "منتج واحد في سلتك");
  assert.equal(fillText("{n:product} in your cart", { n: 1 }, "en"), "1 product in your cart");
  assert.equal(fillText("باقي {n:point} للمستوى {t}", { n: 12, t: "ذهبي" }, "ar"), "باقي 12 نقطة للمستوى ذهبي");
  assert.equal(fillText("{a} و{b:item}", { a: "x" }, "ar"), "x و{b:item}");
  assert.equal(fillText("{n:unknown}", { n: 3 }, "ar"), "3");
  assert.equal(fillText("بلا متغيرات", undefined, "ar"), "بلا متغيرات");
  // After a verb or a preposition only the Arabic dual changes.
  assert.equal(fillText("انتهى منذ {d:day:acc}", { d: 2 }, "ar"), "انتهى منذ يومين");
  assert.equal(fillText("أضف {n:item:acc} للقائمة", { n: 2 }, "ar"), "أضف عنصرين للقائمة");
  assert.equal(fillText("أضف {n:item:acc} للقائمة", { n: 5 }, "ar"), "أضف 5 عناصر للقائمة");
  assert.equal(fillText("Expired {d:day:acc} ago", { d: 2 }, "en"), "Expired 2 days ago");
});

test("the sample and server catalogs write shelf life with the Arabic count rule", () => {
  for (const file of ["../data/products.ts", "../../server/catalog.json"]) {
    const text = readFileSync(new URL(file, import.meta.url), "utf8");
    // "7 يوم" or "30 يوم" (a number from 3 to 99 followed by the bare singular) is the old, wrong form.
    const wrong = [...text.matchAll(/"(\d+) يوم تقريبًا"/g)].filter((m) => { const r = Number(m[1]) % 100; return r >= 3 && r <= 99; });
    assert.deepEqual(wrong.map((m) => m[0]), [], file);
  }
});
