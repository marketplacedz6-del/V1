/* SouqiExpress Service Worker — تصفح سريع وعمل جزئي بدون إنترنت */
const CACHE = "souqi-express-v39";

/* صفحات لوحة التاجر: يجب أن تكون محدّثة دائماً — لا تُخزَّن إطلاقاً */
const NEVER_CACHE = [
  "merchant-dashboard.html",
  "products.html",
  "orders.html",
  "customers.html",
  "shipping.html",
  "settings.html",
  "landing-preview.html",
  "admin-dashboard.html",
  "approve-vendors.html",
  "resellers_list.html",
  "login.html"
];

const CORE = [
  "./",
  "./index.html",
  "./cart.html",
  "./wishlist.html",
  "./offline.html",
  "./about.html",
  "./assets/css/tailwind.css",
  "./assets/css/theme.css",
  "./assets/js/app.js",
  "./assets/js/config.js",
  "./assets/js/integrations.js",
  "./assets/js/couriers.js",
  "./assets/js/subscription.js",
  "./assets/js/merchant-shell.js",
  "./landing.html",
  "./manifest.json"
];

function isDashboard(url) {
  return NEVER_CACHE.some(p => url.pathname.endsWith("/" + p) || url.pathname.endsWith(p));
}

self.addEventListener("install", (e) => {
  // فعّل النسخة الجديدة فوراً بدل انتظار إغلاق كل التبويبات
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// يسمح للصفحة بطلب التفعيل الفوري
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // لا نتدخّل في طلبات Firestore/التحقق
  if (/firestore|googleapis\.com\/identitytoolkit|firebaseio|identitytoolkit/.test(url.href)) return;

  // لا نعترض أبداً: سكربتات/بيانات التتبّع (فيسبوك، تيك توك، تحليلات)
  // ولا Google Apps Script (ربط الطلبات بجدول Google Sheets).
  // اعتراضها كان يكسرها: تخزين نسخة قديمة أو إرجاع 504 عند أي تعثّر شبكة.
  if (/connect\.facebook\.net|facebook\.com\/tr|analytics\.tiktok\.com|business-api\.tiktok\.com|google-analytics\.com|googletagmanager\.com|script\.google\.com|script\.googleusercontent\.com/.test(url.href)) return;

  const wantsHtml = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");

  /* صفحات الإدارة: الشبكة فقط — لا تخزين ولا تقديم نسخة قديمة أبداً */
  if (wantsHtml && isDashboard(url)) {
    e.respondWith(
      fetch(req, { cache: "no-store" }).catch(() =>
        new Response(
          `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
           <meta name="viewport" content="width=device-width,initial-scale=1">
           <title>لا يوجد اتصال</title>
           <style>body{font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;
           justify-content:center;text-align:center;padding:2rem;background:#f8fafc;color:#0f172a;margin:0}
           .c{max-width:22rem}h1{font-size:1.25rem;margin:.5rem 0}p{color:#64748b;font-size:.9rem;line-height:1.7}
           button{margin-top:1rem;background:#0284c7;color:#fff;border:0;padding:.8rem 1.5rem;
           border-radius:.9rem;font-weight:800;font-size:.85rem;cursor:pointer}</style></head>
           <body><div class="c"><div style="font-size:3rem">📡</div>
           <h1>لوحة التحكم تحتاج اتصالاً</h1>
           <p>هذه الصفحة تعرض بياناتك المباشرة، لذا لا نعرض نسخة محفوظة قد تكون قديمة.
           تحقّق من اتصالك ثم أعد المحاولة.</p>
           <button onclick="location.reload()">إعادة المحاولة</button></div></body></html>`,
          { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
        )
      )
    );
    return;
  }

  /* بقية الصفحات: الشبكة أولاً ثم الكاش ثم صفحة عدم الاتصال */
  if (wantsHtml) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./offline.html")))
    );
    return;
  }

  /* ملفات JS/CSS المحلية: الشبكة أولاً حتى تصل التحديثات فوراً.

     تحذير من خطأ سابق (سبّب ظهور الصفحات بلا أي تنسيق):
     كان الرد الاحتياطي عند فشل الشبكة هو Response("") فارغاً برمز 504.
     المتصفح يقبل ذلك كـ CSS *صالح لكنه فارغ*، فتظهر الصفحة كنص خام
     ضخم متراكب بلا تنسيق. الصواب: البحث في كل الكاشات، ثم — إن لم
     نجد شيئاً — رفض الطلب (Response.error) حتى يعرف المتصفح أن
     المورد فشل فعلاً ولا يعامله كملف فارغ. */
  if (url.origin === location.origin && /\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(async () => {
        // 1) طابق الطلب كما هو
        let hit = await caches.match(req);
        if (hit) return hit;
        // 2) تجاهل اختلاف ?v=N (تحديث الإصدار لا يعني أن الملف غير موجود)
        hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        // 3) فشل صريح — لا تُرجع ملفاً فارغاً أبداً
        return Response.error();
      })
    );
    return;
  }

  /* باقي الموارد (صور، خطوط، مكتبات): الكاش أولاً */
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && (url.origin === location.origin || /gstatic|cdnjs|fonts|tailwindcss|unsplash|blogger|jsdelivr/.test(url.host))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => Response.error());   // لا تُرجع مورداً فارغاً يُفسَّر كملف صالح
    })
  );
});
