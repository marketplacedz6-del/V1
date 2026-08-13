/* =========================================================
   SouqiExpress — النواة المشتركة (Toast / السلة / المفضلة / الوضع الليلي)
   لا تحتاج أي خادم — تعمل 100% على الاستضافة المجانية الثابتة
   ========================================================= */
(function () {
  "use strict";

  const CFG = window.SE_CONFIG || {};
  const CURRENCY = CFG.currency || "د.ج";
  const LS = {
    cart: "se_cart_v1",
    wish: "se_wishlist_v1",
    theme: "se_theme",
    recent: "se_recent_v1"
  };

  /* ---------------- أدوات عامة ---------------- */
  const SE = {};
  SE.currency = CURRENCY;

  SE.money = function (n) {
    const v = Number(n || 0);
    return v.toLocaleString("en-US") + " " + CURRENCY;
  };

  SE.escape = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  };

  SE.param = function (key) {
    return new URLSearchParams(location.search).get(key);
  };

  /* تحويل الخيارات (المقاسات/الألوان) إلى مصفوفة نظيفة
     يدعم: النص العادي، الفاصلة العربية «،»، الفاصلة المنقوطة، الشرطة، والمصفوفات الجاهزة */
  SE.parseOptions = function (value) {
    if (value == null || value === "") return [];
    let arr;
    if (Array.isArray(value)) arr = value;
    else arr = String(value).split(/[\s,،؛;|/\\]+/);
    return arr
      .map(v => String(v).trim())
      .filter(v => v.length > 0);
  };

  SE.read = function (key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch (e) { return fallback; }
  };
  SE.write = function (key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  };

  /* ---------------- الإشعارات ---------------- */
  SE.toast = function (message, type, ms) {
    let stack = document.getElementById("se-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "se-toast-stack";
      document.body.appendChild(stack);
    }
    const el = document.createElement("div");
    el.className = "se-toast " + (type || "info");
    el.innerHTML = '<span>' + SE.escape(message) + '</span>';
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 320);
    }, ms || 2600);
  };

  /* ---------------- الوضع الليلي ---------------- */
  SE.theme = {
    get() { return localStorage.getItem(LS.theme) || "light"; },
    apply(mode) {
      document.documentElement.classList.toggle("dark", mode === "dark");
      localStorage.setItem(LS.theme, mode);
      document.querySelectorAll("[data-se-theme-icon]").forEach(i => {
        i.className = (mode === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon");
      });
    },
    toggle() {
      const next = SE.theme.get() === "dark" ? "light" : "dark";
      SE.theme.apply(next);
      SE.toast(next === "dark" ? "🌙 تم تفعيل الوضع الليلي" : "☀️ تم تفعيل الوضع النهاري", "info", 1600);
    }
  };

  /* ---------------- السلة ---------------- */
  SE.cart = {
    all() { return SE.read(LS.cart, []) || []; },
    save(items) { SE.write(LS.cart, items); SE.cart.sync(); },
    count() { return SE.cart.all().reduce((s, i) => s + (i.qty || 1), 0); },
    total() { return SE.cart.all().reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || 1), 0); },
    find(id, size, color) {
      return SE.cart.all().find(i => i.id === id && (i.size || "") === (size || "") && (i.color || "") === (color || ""));
    },
    add(product, qty, size, color) {
      qty = Math.max(1, parseInt(qty || 1, 10));
      const items = SE.cart.all();
      const key = i => i.id === product.id && (i.size || "") === (size || "") && (i.color || "") === (color || "");
      const found = items.find(key);
      if (found) {
        found.qty += qty;
        const max = found.stock;
        if (max !== undefined && max !== null && Number(max) > 0 && found.qty > Number(max)) {
          found.qty = Number(max);
          SE.toast(`⚠️ الكمية المتوفرة هي ${found.qty} فقط`, 'error', 2200);
        }
      }
      else {
        // خطأ سابق: كان حدّ المخزون يُفحص فقط عند زيادة منتج موجود،
        // فكان بالإمكان طلب 10 قطع من منتج مخزونه 3 في أول إضافة.
        const stock = (product.stock === undefined || product.stock === null) ? null : Number(product.stock);
        let finalQty = qty;
        if (stock !== null && stock > 0 && finalQty > stock) {
          finalQty = stock;
          SE.toast(`⚠️ الكمية المتوفرة هي ${finalQty} فقط`, 'error', 2200);
        }
        items.push({
          id: product.id,
          name: product.name || "منتج",
          price: Number(product.price) || 0,
          image: Array.isArray(product.image) ? product.image[0] : (product.image || ""),
          merchant: product.user_id || product.merchant || "",
          stock: stock,
          size: size || "",
          color: color || "",
          qty: finalQty
        });
      }
      SE.cart.save(items);
      SE.toast("🛒 تمت إضافة المنتج إلى السلة", "success");
    },
    setQty(index, qty) {
      const items = SE.cart.all();
      if (!items[index]) return;
      let n = Math.max(1, parseInt(qty, 10) || 1);
      // احترام المخزون المتوفر إن كان معروفاً
      const max = items[index].stock;
      if (max !== undefined && max !== null && Number(max) > 0 && n > Number(max)) {
        n = Number(max);
        SE.toast(`⚠️ الكمية المتوفرة هي ${n} فقط`, 'error', 2200);
      }
      items[index].qty = n;
      SE.cart.save(items);
    },
    remove(index) {
      const items = SE.cart.all();
      items.splice(index, 1);
      SE.cart.save(items);
      SE.toast("🗑️ تم حذف المنتج من السلة", "info", 1800);
    },
    clear() { SE.cart.save([]); },
    sync() {
      const count = SE.cart.count();
      document.querySelectorAll("[data-se-cart-count]").forEach(el => {
        el.textContent = count;
        el.classList.toggle("scale-0", count === 0);
        el.classList.toggle("scale-100", count > 0);
      });
      document.querySelectorAll("[data-se-cart-total]").forEach(el => {
        el.textContent = SE.money(SE.cart.total());
      });
      document.dispatchEvent(new CustomEvent("se:cart-updated"));
    }
  };

  /* ---------------- المفضلة ---------------- */
  SE.wishlist = {
    all() { return SE.read(LS.wish, []) || []; },
    has(id) { return SE.wishlist.all().some(p => p.id === id); },
    toggle(product) {
      let items = SE.wishlist.all();
      const exists = items.some(p => p.id === product.id);
      if (exists) {
        items = items.filter(p => p.id !== product.id);
        SE.toast("💔 تمت الإزالة من المفضلة", "info", 1700);
      } else {
        items.push({
          id: product.id, name: product.name, price: product.price,
          image: Array.isArray(product.image) ? product.image[0] : product.image
        });
        SE.toast("❤️ تمت الإضافة للمفضلة", "success", 1700);
      }
      SE.write(LS.wish, items);
      SE.wishlist.sync();
      return !exists;
    },
    sync() {
      const n = SE.wishlist.all().length;
      document.querySelectorAll("[data-se-wish-count]").forEach(el => {
        el.textContent = n;
        el.classList.toggle("scale-0", n === 0);
        el.classList.toggle("scale-100", n > 0);
      });
      document.querySelectorAll("[data-se-wish-id]").forEach(btn => {
        const on = SE.wishlist.has(btn.getAttribute("data-se-wish-id"));
        btn.classList.toggle("text-rose-500", on);
        btn.classList.toggle("text-slate-400", !on);
        const ic = btn.querySelector("i");
        if (ic) ic.className = (on ? "fa-solid" : "fa-regular") + " fa-heart";
      });
    }
  };

  /* ---------------- المنتجات التي شوهدت مؤخراً ---------------- */
  SE.recent = {
    all() { return SE.read(LS.recent, []) || []; },
    push(product) {
      if (!product || !product.id) return;
      let items = SE.recent.all().filter(p => p.id !== product.id);
      items.unshift({
        id: product.id, name: product.name, price: product.price,
        image: Array.isArray(product.image) ? product.image[0] : product.image
      });
      SE.write(LS.recent, items.slice(0, 8));
    }
  };

  /* ---------------- مشاركة / نسخ ---------------- */
  SE.share = async function (title, url) {
    url = url || location.href;
    if (navigator.share) {
      try { await navigator.share({ title: title || CFG.siteName, url }); return; } catch (e) {}
    }
    SE.copy(url);
  };
  SE.copy = function (text) {
    const done = () => SE.toast("📋 تم نسخ الرابط بنجاح", "success", 1900);
    if (navigator.clipboard) { navigator.clipboard.writeText(text).then(done).catch(() => {}); return; }
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    ta.remove();
  };

  /* ---------------- ظهور تدريجي ---------------- */
  SE.observeReveal = function (root) {
    const els = (root || document).querySelectorAll(".se-reveal:not(.is-visible)");
    if (!("IntersectionObserver" in window)) {
      els.forEach(e => e.classList.add("is-visible")); return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); }
      });
    }, { threshold: .08 });
    els.forEach(e => io.observe(e));
  };

  /* ---------------- واجهة عامة إضافية ---------------- */
  SE.mountToTop = function () {
    if (document.getElementById("se-to-top")) return;
    const btn = document.createElement("button");
    btn.id = "se-to-top";
    btn.className = "se-noprint";
    btn.setAttribute("aria-label", "العودة للأعلى");
    btn.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
    btn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
    document.body.appendChild(btn);
    window.addEventListener("scroll", () => {
      btn.classList.toggle("show", window.scrollY > 500);
    }, { passive: true });
  };

  // تمّت إزالة شريط "لا يوجد اتصال" نهائياً.
  // السبب: كان يعطي إنذارات كاذبة على أندرويد/WebView (navigator.onLine
  // غير موثوق)، وقيمته أقل بكثير من ضرره. الصفحات نفسها تعرض حالة
  // الاتصال الحقيقية في الشريط الجانبي بعد جلب البيانات فعلياً.
  SE.markOnline = function () {};
  SE.mountOfflineBar = function () {
    // أزل أي شريط قديم بقي من نسخة سابقة عالقة في الكاش
    const old = document.getElementById("se-offline-bar");
    if (old) old.remove();
  };

  /* ---------------- كاشف انهيار الأنماط (إصلاح ذاتي) ----------------
     عطل حقيقي حدث فعلاً: الـ Service Worker كان يُرجع ملف CSS *فارغاً*
     برمز 504 عند تعثّر الشبكة. المتصفح يقبله كملف صالح فارغ، فتظهر
     الصفحة نصاً ضخماً متراكباً بلا أي تنسيق.

     هنا نتحقق بعد التحميل: هل وصل tailwind.css فعلاً؟ إن لم يصل،
     نمسح الكاش ونلغي الـ SW ونعيد التحميل مرة واحدة تلقائياً. */
  SE.verifyStyles = function () {
    // عنصر اختبار: كلاس Tailwind معروف يجب أن ينتج display:flex
    const probe = document.createElement("div");
    probe.className = "flex";
    probe.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px";
    document.body.appendChild(probe);
    const ok = getComputedStyle(probe).display === "flex";
    probe.remove();
    if (ok) return true;

    // الأنماط لم تصل — أصلح ذاتياً مرة واحدة فقط (لا حلقة إعادة تحميل)
    let tried = "0";
    try { tried = sessionStorage.getItem("se_css_repair") || "0"; } catch (e) {}
    if (tried !== "0") {
      console.warn("SouqiExpress: تعذّر تحميل ملفات التنسيق حتى بعد الإصلاح.");
      return false;
    }
    try { sessionStorage.setItem("se_css_repair", "1"); } catch (e) {}

    console.warn("SouqiExpress: ملفات التنسيق لم تصل — جارٍ الإصلاح التلقائي...");
    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if (window.caches) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch (e) {}
      // أعد التحميل متجاوزاً الكاش
      location.replace(location.pathname + "?rescue=" + Date.now());
    })();
    return false;
  };

  /* ---------------- معالجة الصور المكسورة ----------------
     بدل تعديل كل وسم <img> على حدة، نلتقط حدث error في مرحلة
     الالتقاط (capture) لأن حدث error للصور لا يتصاعد (لا يفقّع).
     يمنع ظهور أيقونة الصورة المكسورة التي تشوّه المتجر. */
  SE.FALLBACK_IMG =
    "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">' +
      '<rect width="400" height="400" fill="#e2e8f0"/>' +
      '<text x="200" y="185" font-size="64" text-anchor="middle">🖼️</text>' +
      '<text x="200" y="245" font-size="22" font-family="sans-serif" fill="#64748b" ' +
      'font-weight="bold" text-anchor="middle">لا توجد صورة</text></svg>');

  SE.mountImageFallback = function () {
    document.addEventListener("error", function (e) {
      const el = e.target;
      if (!el || el.tagName !== "IMG") return;
      if (el.dataset.seFallbackDone) return;      // امنع الحلقة اللانهائية
      el.dataset.seFallbackDone = "1";
      el.src = SE.FALLBACK_IMG;
    }, true);                                      // capture = true (مهم)
  };

  /* ---------------- تثبيت التطبيق (PWA) ----------------
     يعمل بلا خادم. يلتقط حدث beforeinstallprompt ويفعّل
     كل زر يحمل [data-se-install]. إن لم يدعم المتصفح التثبيت
     التلقائي (iOS مثلاً) يعرض تعليمات يدوية واضحة. */
  SE.install = {
    prompt: null,
    done: false,
    isStandalone() {
      if (SE.install.done) return true;
      try { if (localStorage.getItem("se_installed") === "1") return true; } catch (e) {}
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
        || window.navigator.standalone === true;
    },
    isIOS() {
      return /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    },
    available() { return !!SE.install.prompt; },

    /* تحديث حالة كل الأزرار في الصفحة */
    refresh() {
      const installed = SE.install.isStandalone();
      document.querySelectorAll("[data-se-install]").forEach(btn => {
        if (installed) {
          btn.setAttribute("disabled", "disabled");
          btn.classList.add("opacity-60", "cursor-default");
          const lbl = btn.querySelector("[data-se-install-label]");
          if (lbl) lbl.textContent = "✅ التطبيق مثبّت على جهازك";
          else btn.textContent = "✅ التطبيق مثبّت على جهازك";
        } else {
          btn.removeAttribute("disabled");
          btn.classList.remove("opacity-60", "cursor-default");
        }
      });
      const hint = document.getElementById("se-install-hint");
      if (hint) {
        if (installed) hint.textContent = "التطبيق مثبّت بالفعل — افتحه من شاشة هاتفك.";
        else if (SE.install.prompt) hint.textContent = "التثبيت جاهز — اضغط الزر ووافق على الرسالة.";
        else if (SE.install.isIOS()) hint.textContent = "على iPhone: اضغط زر المشاركة ⬆️ ثم «إضافة إلى الشاشة الرئيسية».";
        else hint.textContent = "إن لم تظهر رسالة التثبيت، استعمل قائمة المتصفح ⋮ ← «تثبيت التطبيق».";
      }
    },

    /* تنفيذ التثبيت */
    async run() {
      if (SE.install.isStandalone()) {
        SE.toast("✅ التطبيق مثبّت بالفعل على جهازك", "info", 2400);
        return;
      }
      if (SE.install.prompt) {
        const dp = SE.install.prompt;
        SE.install.prompt = null;
        try {
          dp.prompt();
          const res = await dp.userChoice;
          if (res && res.outcome === "accepted") SE.toast("🎉 جارٍ تثبيت التطبيق على جهازك", "success", 2600);
          else SE.toast("تم إلغاء التثبيت — يمكنك المحاولة لاحقاً", "info", 2400);
        } catch (e) {
          SE.install.help();
        }
        SE.install.refresh();
        return;
      }
      SE.install.help();
    },

    /* تعليمات يدوية حسب المتصفح */
    help() {
      const ua = navigator.userAgent;
      let steps;
      if (SE.install.isIOS()) {
        steps = [
          "افتح الموقع في متصفح <b>Safari</b>.",
          "اضغط زر <b>المشاركة</b> <i class=\"fa-solid fa-arrow-up-from-bracket\"></i> في الأسفل.",
          "اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.",
          "اضغط <b>«إضافة»</b> — سيظهر التطبيق مع تطبيقاتك."
        ];
      } else if (/firefox/i.test(ua)) {
        steps = [
          "افتح قائمة المتصفح <b>⋮</b> في الأعلى.",
          "اختر <b>«تثبيت»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.",
          "أكّد الإضافة."
        ];
      } else {
        steps = [
          "افتح قائمة المتصفح <b>⋮</b> (أعلى يمين الشاشة).",
          "اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.",
          "أكّد بالضغط على <b>«تثبيت»</b>.",
          "لو لم يظهر الخيار: تصفّح الموقع دقيقة ثم أعد المحاولة."
        ];
      }
      SE.install.modal(steps);
    },

    modal(steps) {
      document.getElementById("se-install-modal")?.remove();
      const wrap = document.createElement("div");
      wrap.id = "se-install-modal";
      wrap.setAttribute("dir", "rtl");
      wrap.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.6);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(3px)";
      wrap.innerHTML = `
        <div style="background:var(--se-surface,#fff);color:var(--se-text,#0f172a);max-width:23rem;width:100%;border-radius:1.25rem;padding:1.25rem;box-shadow:0 24px 60px -20px rgba(0,0,0,.5)">
          <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.85rem">
            <div style="font-size:1.6rem">📲</div>
            <div style="font-weight:900;font-size:.95rem">تثبيت تطبيق سوقي إكسبريس</div>
          </div>
          <ol style="padding-inline-start:1.1rem;margin:0 0 1rem;font-size:.78rem;font-weight:700;line-height:2">
            ${steps.map(s => "<li>" + s + "</li>").join("")}
          </ol>
          <button type="button" id="se-install-close" style="width:100%;border:0;border-radius:.85rem;padding:.7rem;font-weight:900;font-size:.8rem;cursor:pointer;background:linear-gradient(90deg,#0369a1,#0284c7);color:#fff">فهمت</button>
        </div>`;
      const close = () => wrap.remove();
      wrap.addEventListener("click", e => { if (e.target === wrap) close(); });
      document.body.appendChild(wrap);
      document.getElementById("se-install-close").onclick = close;
    },

    mount() {
      document.querySelectorAll("[data-se-install]:not([data-se-install-bound])").forEach(btn => {
        btn.setAttribute("data-se-install-bound", "1");
        btn.addEventListener("click", e => { e.preventDefault(); SE.install.run(); });
      });
      SE.install.refresh();
    }
  };

  // التقط الحدث مبكّراً (قد يقع قبل تحميل الصفحة بالكامل)
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    SE.install.prompt = e;
    SE.install.refresh();
  });
  window.addEventListener("appinstalled", () => {
    SE.install.prompt = null;
    SE.install.done = true;
    try { localStorage.setItem("se_installed", "1"); } catch (e) {}
    SE.toast("🎉 تم تثبيت التطبيق بنجاح", "success", 2800);
    SE.install.refresh();
  });

  /* شريط تنقل سفلي للهواتف */
  SE.mountTabbar = function (active) {
    if (document.querySelector(".se-tabbar")) return;
    const items = [
      { href: "index.html", icon: "fa-house", label: "الرئيسية", key: "home" },
      { href: "index.html#shop-section", icon: "fa-store", label: "المتجر", key: "shop" },
      { href: "wishlist.html", icon: "fa-heart", label: "المفضلة", key: "wish" },
      { href: "cart.html", icon: "fa-basket-shopping", label: "السلة", key: "cart" }
    ];
    const nav = document.createElement("nav");
    nav.className = "se-tabbar se-noprint";
    nav.innerHTML = items.map(i => `
      <a href="${i.href}" class="${active === i.key ? "active" : ""}">
        <span class="relative">
          <i class="fa-solid ${i.icon}"></i>
          ${i.key === "cart" ? '<span data-se-cart-count class="absolute -top-2 -left-2.5 bg-emerald-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center scale-0 transition-transform">0</span>' : ""}
          ${i.key === "wish" ? '<span data-se-wish-count class="absolute -top-2 -left-2.5 bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center scale-0 transition-transform">0</span>' : ""}
        </span>
        <span>${i.label}</span>
      </a>`).join("");
    document.body.appendChild(nav);
    document.body.classList.add("has-tabbar");
    // المساحة السفلية تُحجز في theme.css عبر media query — لا نضبطها هنا
    // حتى لا تختلّ عند تدوير الهاتف.
  };

  /* ---------------- التشغيل ---------------- */
  function boot() {
    SE.theme.apply(SE.theme.get());
    SE.cart.sync();
    SE.wishlist.sync();
    SE.observeReveal();
    SE.mountToTop();
    SE.mountOfflineBar();
    SE.mountImageFallback();
    // تحقّق من وصول الأنماط (بعد أن يستقر التحميل)
    if (document.readyState === "complete") setTimeout(SE.verifyStyles, 0);
    else window.addEventListener("load", () => setTimeout(SE.verifyStyles, 0));
    SE.install.mount();

    document.querySelectorAll("[data-se-theme-toggle]").forEach(b => b.addEventListener("click", SE.theme.toggle));

    // مزامنة السلة بين التبويبات المفتوحة
    window.addEventListener("storage", e => {
      if (e.key === LS.cart) SE.cart.sync();
      if (e.key === LS.wish) SE.wishlist.sync();
    });

    // إصلاح ذاتي: ?fresh=1 يمسح كل الكاش ويلغي الـ SW ثم يعيد التحميل نظيفاً
    if (location.search.includes("fresh=1") && "serviceWorker" in navigator) {
      (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
          if (window.caches) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
        } catch (e) {}
        location.replace(location.pathname);
      })();
      return;
    }

    // شبكة أمان: إن كان الـ SW المتحكّم قديماً (نسخة سابقة)، ألغِ التسجيل
    // وامسح الكاش مرة واحدة تلقائياً — يمنع بقاء المستخدم على نسخة عالقة.
    const SE_BUILD = "34";
    try {
      if (localStorage.getItem("se_build") !== SE_BUILD) {
        localStorage.setItem("se_build", SE_BUILD);
        // امسح كل الكاش القديم بلا استثناء عند تغيّر الإصدار
        if (window.caches) {
          caches.keys().then(keys => {
            keys.filter(k => k !== "souqi-express-v34").forEach(k => caches.delete(k));
          }).catch(() => {});
        }
      }
    } catch (e) {}

    // تسجيل الـ Service Worker (يعمل فقط على https أو localhost)
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").then(reg => {
        // ابحث عن تحديث فور فتح الصفحة
        try { reg.update(); } catch (e) {}

        // إن وُجدت نسخة جديدة، فعّلها فوراً بدل انتظار إغلاق كل التبويبات
        reg.addEventListener("updatefound", () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", () => {
            if (sw.state === "installed" && navigator.serviceWorker.controller) {
              sw.postMessage("SKIP_WAITING");
            }
          });
        });
      }).catch(() => {});

      // أعد تحميل الصفحة مرة واحدة عند تفعيل النسخة الجديدة
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        location.reload();
      });
    }
  }

  window.SE = SE;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
