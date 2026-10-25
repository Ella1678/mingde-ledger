
"use strict";

const CACHE_VERSION = "mingde-ledger-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json"
];

// 安装时预缓存应用入口文件。
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// 激活新版本时删除旧版本缓存。
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("mingde-ledger-") && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// 页面导航优先请求网络；断网时回退到缓存的入口页面。
// 其他同源 GET 请求优先使用缓存，未命中时再请求网络。
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 不拦截其他网站的请求。
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION)
              .then((cache) => cache.put("./index.html", copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;

          const fallback = await caches.match("./index.html");
          if (fallback) return fallback;

          return new Response(
            "应用尚未缓存，请先联网打开一次明德账本。",
            {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" }
            }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        });
      })
  );
});