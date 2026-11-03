// J: English language — dictionary lookup with Arabic fallback, and coverage of navigation
// and smart-tool titles (the parts declared as translated).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EN, translate, isLang } from './i18nCore.ts';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
test('translate: Arabic passthrough, English lookup, fallback to Arabic', () => {
  assert.equal(translate('ar', 'الرئيسية'), 'الرئيسية');
  assert.equal(translate('en', 'الرئيسية'), 'Home');
  assert.equal(translate('en', 'نص غير مترجم'), 'نص غير مترجم');
  assert.equal(isLang('en'), true); assert.equal(isLang('fr'), false);
});
test('navigation tabs, smart tools and main screen titles all have English', () => {
  const tabs = [...read('../components/Shell.tsx').matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
  const tools = [...read('../components/smart/tools.ts').matchAll(/title: "([^"]+)"/g)].map((m) => m[1]);
  const titles = ['شو بدك اليوم؟', 'اكتشف عالمك', 'سلة المشتريات', 'مراجعة الطلب', 'طريقة الدفع', 'وين نوصلك؟', 'طلباتي', 'حسابي', 'أدوات لُقطة الذكية', 'العب واربح', 'تخصيص شخصيتي', 'مظهر التطبيق'];
  const missing = [...tabs, ...tools, ...titles].filter((s) => !EN[s]);
  assert.ok(tabs.length === 4 && tools.length >= 20);
  assert.deepEqual(missing, []);
  for (const v of Object.values(EN)) assert.doesNotMatch(v, /[؀-ۿ]/, `English value contains Arabic: ${v}`);
});
test('Txt renders translated plain strings and the language is user-selectable', () => {
  assert.match(read('../components/ui.tsx'), /tr\(children\)/);
  assert.match(read('../app/appearance.tsx'), /testID=\{`lang-\$\{l\.id\}`\}/);
  assert.match(read('../app/_layout.tsx'), /<LanguageProvider>/);
});
