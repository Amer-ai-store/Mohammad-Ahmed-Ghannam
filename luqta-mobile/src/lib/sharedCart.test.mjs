import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MAX_SHARED_LINES, encodeSharedCart, parseSharedCart, sharedCartLink } from "./sharedCart.ts";

test("a shared cart round-trips through its link", () => {
  const cart = { rice: 2, milk: 1, "olive-oil_5l": 3 };
  assert.equal(encodeSharedCart(cart), "rice*2,milk*1,olive-oil_5l*3");
  assert.deepEqual(parseSharedCart(encodeSharedCart(cart)), cart);
  const link = sharedCartLink(cart);
  assert.equal(link, "luqta://cart?add=rice*2%2Cmilk*1%2Colive-oil_5l*3");
  assert.deepEqual(parseSharedCart(decodeURIComponent(new URL(link.replace("luqta://", "https://x/")).searchParams.get("add"))), cart);
  assert.equal(sharedCartLink({}), null);
});

test("a shared cart link is read strictly", () => {
  assert.deepEqual(parseSharedCart("rice*2,<script>*1,milk*0,eggs*abc,bread*100,../x*1,*3,tea*"), { rice: 2 }, "bad ids, zero, non-numbers and three digits are skipped");
  assert.deepEqual(parseSharedCart("rice*60,rice*60"), { rice: 99 }, "repeats add up and are capped at 99");
  assert.deepEqual(parseSharedCart(["rice*1"]), { rice: 1 }, "a repeated query parameter uses the first value");
  for (const bad of [undefined, null, 5, "", "x".repeat(4001), {}]) assert.deepEqual(parseSharedCart(bad), {});
  const many = Array.from({ length: 60 }, (_, i) => `p${i}*1`).join(",");
  assert.equal(Object.keys(parseSharedCart(many)).length, MAX_SHARED_LINES);
  assert.equal(encodeSharedCart({ rice: 250, "bad id": 1, milk: 1.5 }), "rice*99", "encoding caps and drops what could not be read back");
});
