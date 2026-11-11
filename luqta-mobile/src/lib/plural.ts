// Counted nouns in both languages. Arabic changes the noun with the number: "منتج واحد", "منتجان", "3 منتجات",
// "11 منتجًا", "100 منتج". Texts write {n:product} and the translator fills in the right phrase (lib/i18n.tsx).
// After a verb or a preposition the Arabic dual changes too ("أضف منتجين", "منذ يومين"): those texts write
// {n:product:acc}. Pure, so the node tests can check it.

export type Noun = "product" | "item" | "piece" | "day" | "point" | "person" | "member" | "interest";

type ArabicForms = { one: string; two: string; twoAcc: string; few: string; many: string; other: string };
const AR: Record<Noun, ArabicForms> = {
  product: { one: "منتج واحد", two: "منتجان", twoAcc: "منتجين", few: "منتجات", many: "منتجًا", other: "منتج" },
  item: { one: "عنصر واحد", two: "عنصران", twoAcc: "عنصرين", few: "عناصر", many: "عنصرًا", other: "عنصر" },
  piece: { one: "قطعة واحدة", two: "قطعتان", twoAcc: "قطعتين", few: "قطع", many: "قطعة", other: "قطعة" },
  day: { one: "يوم واحد", two: "يومان", twoAcc: "يومين", few: "أيام", many: "يومًا", other: "يوم" },
  point: { one: "نقطة واحدة", two: "نقطتان", twoAcc: "نقطتين", few: "نقاط", many: "نقطة", other: "نقطة" },
  person: { one: "شخص واحد", two: "شخصان", twoAcc: "شخصين", few: "أشخاص", many: "شخصًا", other: "شخص" },
  member: { one: "فرد واحد", two: "فردان", twoAcc: "فردين", few: "أفراد", many: "فردًا", other: "فرد" },
  interest: { one: "اهتمام واحد", two: "اهتمامان", twoAcc: "اهتمامين", few: "اهتمامات", many: "اهتمامًا", other: "اهتمام" },
};
const EN: Record<Noun, [one: string, other: string]> = {
  product: ["product", "products"],
  item: ["item", "items"],
  piece: ["piece", "pieces"],
  day: ["day", "days"],
  point: ["point", "points"],
  person: ["person", "people"],
  member: ["member", "members"],
  interest: ["interest", "interests"],
};

export const isNoun = (value: string): value is Noun => Object.prototype.hasOwnProperty.call(AR, value);

/** The Arabic plural category of a whole number (the same rule as Unicode CLDR). */
export function arabicCategory(n: number): "zero" | "one" | "two" | "few" | "many" | "other" {
  if (!Number.isInteger(n) || n < 0) return "other";
  if (n === 0) return "zero";
  if (n === 1) return "one";
  if (n === 2) return "two";
  const rest = n % 100;
  if (rest >= 3 && rest <= 10) return "few";
  if (rest >= 11 && rest <= 99) return "many";
  return "other";
}

/**
 * "3 منتجات" / "3 products". `acc` is for a count after a verb or a preposition, which only changes the Arabic
 * dual ("منتجين"). A value that is not a whole number is shown as given, with the plain form.
 */
export function countText(lang: "ar" | "en", value: number | string, noun: Noun, grammaticalCase: "nom" | "acc" = "nom"): string {
  const n = typeof value === "number" ? value : Number(value);
  if (lang === "en") return `${value} ${EN[noun][n === 1 ? 0 : 1]}`;
  const forms = AR[noun];
  switch (arabicCategory(n)) {
    case "one": return forms.one;
    case "two": return grammaticalCase === "acc" ? forms.twoAcc : forms.two;
    case "few": return `${n} ${forms.few}`;
    case "many": return `${n} ${forms.many}`;
    default: return `${value} ${forms.other}`;
  }
}

/**
 * Fills {name} with the value, {name:noun} with the counted noun ({n:product} → "3 منتجات") and {name:noun:acc}
 * with the form used after a verb or a preposition ({n:day:acc} → "يومين"). Unknown names stay.
 */
export function fillText(text: string, vars: Record<string, string | number> | undefined, lang: "ar" | "en"): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)(?::(\w+)(?::(acc))?)?\}/g, (whole, key: string, noun?: string, grammaticalCase?: string) => {
    const value = vars[key];
    if (value === undefined) return whole;
    return noun && isNoun(noun) ? countText(lang, value, noun, grammaticalCase === "acc" ? "acc" : "nom") : String(value);
  });
}
