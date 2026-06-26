const CACHE_NAME = 'rasd-cache-v3';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// التثبيت: خزّن الملفات في الكاش
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(()=>{})
  );
  self.skipWaiting();
});

// التفعيل: احذف الكاشات القديمة فوراً
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// الطلبات: كاش أولاً ثم تحديث في الخلفية (stale-while-revalidate)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // طلبات Google / Drive / EmailJS / خطوط / CDN — شبكة مباشرة بدون كاش
  const url = new URL(req.url);
  const bypassHosts = [
    'accounts.google.com',
    'googleapis.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'emailjs.com',
    'api.emailjs.com'
  ];
  if (bypassHosts.some(h => url.hostname.includes(h))) {
    return; // اتركها للمتصفح مباشرة
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);

      // جلب نسخة جديدة في الخلفية دائماً
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) {
          cache.put(req, res.clone());
        }
        return res;
      }).catch(() => null);

      // إذا موجود في الكاش — أرجعه فوراً (بدون انتظار الشبكة)
      if (cached) return cached;

      // إذا غير موجود — انتظر الشبكة
      const fresh = await fetchPromise;
      return fresh || new Response('Offline', { status: 503 });
    })
  );
});
