'use strict';
const CACHE = 'amir-access-portal-v1';
const scope = new URL(self.registration.scope);
const assets = ['./', './index.html', './manifest.webmanifest', './app.js', './icon.svg'].map(p => new URL(p, scope).href);
const allow = new Set(assets);
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(assets))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !allow.has(event.request.url)) return;
  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(event.request)) || Response.error();
  }));
});
