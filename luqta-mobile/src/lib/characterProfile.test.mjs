import { strict as assert } from "node:assert";
import { test } from "node:test";
import { DEFAULT_CHARACTER, clampScale, sanitizeCharacter, toAvatarProfile } from "./characterProfile.ts";

test("F-G12-07 character size defaults to a quarter (25%) and is clamped to 25–100%", () => {
  assert.equal(DEFAULT_CHARACTER.scale, 0.25);
  assert.equal(clampScale(0.05), 0.25);
  assert.equal(clampScale(3), 1);
  assert.equal(clampScale(0.666), 0.67);
});

test("F-G11-07 stored profile is sanitised: only small JPEG/PNG data URLs, hex colours, booleans", () => {
  const bad = sanitizeCharacter({ faceDataUrl: "javascript:alert(1)", skin: "red", scale: "x", beard: 0, reduceMotion: "yes" });
  assert.equal(bad.faceDataUrl, undefined);
  assert.equal(bad.skin, DEFAULT_CHARACTER.skin);
  assert.equal(bad.scale, 0.25);
  assert.equal(bad.reduceMotion, false);
  const big = sanitizeCharacter({ faceDataUrl: "data:image/jpeg;base64," + "A".repeat(500000) });
  assert.equal(big.faceDataUrl, undefined, "oversized images are rejected");
  const ok = sanitizeCharacter({ faceDataUrl: "data:image/jpeg;base64,AAAA", skin: "#112233", scale: 0.5, beard: false });
  assert.equal(ok.faceDataUrl, "data:image/jpeg;base64,AAAA");
  assert.equal(ok.beard, false);
  assert.deepEqual(Object.keys(toAvatarProfile(ok)).sort(), ["beard", "faceDataUrl", "hair", "outfit", "pants", "skin"]);
});
