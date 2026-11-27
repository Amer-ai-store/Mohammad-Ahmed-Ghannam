#!/usr/bin/env python3
"""Non-mutating E2E acceptance smoke tests for the public Amir AI Store.

Runs in a clean browser without authentication. The production app must not
receive any writes, demo orders or privileged credentials from this suite.
"""
import asyncio
import os
from urllib.parse import urlparse

from playwright.async_api import async_playwright

BASE = os.environ.get("STORE_BASE_URL", "https://amir-ai-store.vercel.app").rstrip("/")
assert urlparse(BASE).scheme == "https", "Only HTTPS targets are supported"


async def check_response(request, route, expected=200):
    response = await request.get(BASE + route, timeout=30000)
    assert response.status == expected, f"{route}: expected HTTP {expected}, got {response.status}"
    return response


async def main():
    checks = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=1)
        try:
            page = await context.new_page()
            response = await page.goto(BASE + "/", wait_until="domcontentloaded", timeout=45000)
            assert response and response.status == 200, "Store homepage not accessible"
            assert "Amir AI Store" in (await page.title()), "Store title mismatch"
            assert "تسوّق" in await page.locator("body").inner_text(), "Store content not found"
            checks.append("PASS public store / mobile")

            response = await page.goto(BASE + "/catalog-full.html", wait_until="domcontentloaded", timeout=45000)
            assert response and response.status == 200, "Catalog preview unavailable"
            assert "الكتالوج المرجعي" in await page.locator("body").inner_text()
            checks.append("PASS catalog / mobile")

            response = await page.goto(BASE + "/owner.html", wait_until="domcontentloaded", timeout=45000)
            assert response and response.status == 200, "Owner login unavailable"
            skip = page.locator("#skipOwnerLogin")
            assert await skip.count() == 1, "Owner skip button not present"
            assert await skip.get_attribute("href") == "/", "Owner skip destination is not public store"
            await skip.click()
            await page.wait_for_url(BASE + "/", timeout=30000)
            assert "Amir AI Store" in await page.title(), "Owner skip did not return to public site"
            checks.append("PASS owner skip returns to public store")

            r = await check_response(context.request, "/api/photo-jobs?task=status")
            data = await r.json()
            assert isinstance(data.get("verifiedBarcodeImages"), int)
            assert isinstance(data.get("approvedForDisplay"), int)
            assert 0 <= data["approvedForDisplay"] <= data["verifiedBarcodeImages"]
            assert data.get("requestThrottle", {}).get("maxBatch") == 8
            assert data.get("requestThrottle", {}).get("minStartIntervalMs") >= 5500
            checks.append("PASS image job status / throttling")

            r = await check_response(context.request, "/api/experience?action=home")
            data = await r.json()
            assert data.get("noRealCheckout") is True, "Real checkout unexpectedly enabled"
            assert data.get("offersVerified") is False or isinstance(data.get("offersVerified"), bool)
            checks.append("PASS commerce safety on home API")

            r = await check_response(context.request, "/api/jawafa?action=categories")
            data = await r.json()
            assert data.get("snapshot", {}).get("count", 0) > 0
            checks.append("PASS catalog categories API")

            await check_response(context.request, "/api/fresh-preview?group=invalid", 400)
            checks.append("PASS invalid group rejected with HTTP 400")
        finally:
            await context.close()
            await browser.close()
    for c in checks:
        print(c)
    print(f"SMOKE_CHECKS_PASSED={len(checks)}")


if __name__ == "__main__":
    asyncio.run(main())
