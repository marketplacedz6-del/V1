/* =========================================================
   SouqiExpress — وحدة التكاملات (تعمل بدون خادم)
   1) Google Sheets  : إرسال الطلبات تلقائياً لجدول التاجر
   2) Pixels         : فيسبوك + تيك توك لتتبّع الإعلانات
   3) Anti-Bot       : تقييد الطلبات حسب عنوان IP + كشف البوتات
   ========================================================= */
(function () {
  "use strict";

  const SEI = {};
  const LS_DEVICE = "se_device_id";
  const LS_ORDERS = "se_order_log_v1";

  /* ============ أدوات مساعدة ============ */
  function nowMs() { return Date.now(); }

  function read(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch (e) { return f; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  // معرّف جهاز ثابت (خط الدفاع الأول قبل الوصول للشبكة)
  SEI.deviceId = function () {
    let id = localStorage.getItem(LS_DEVICE);
    if (!id) {
      id = 'd' + Math.random().toString(36).slice(2) + nowMs().toString(36);
      try { localStorage.setItem(LS_DEVICE, id); } catch (e) {}
    }
    return id;
  };

  // تجزئة نصية بسيطة (لا نخزّن الـ IP صريحاً احتراماً للخصوصية)
  SEI.hash = function (str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
    return 'ip_' + h.toString(36);
  };

  /* =========================================================
     1) GOOGLE SHEETS
     التاجر يلصق رابط Google Apps Script Web App في إعداداته
     نرسل الطلب كـ text/plain لتفادي طلب preflight الذي يرفضه Apps Script
     ========================================================= */
  SEI.isSheetUrl = function (u) {
    return !!u && /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec/i.test(String(u).trim());
  };

  /**
   * إرسال الطلب إلى Google Apps Script.
   * ملاحظات مهمة اكتُشفت عملياً:
   *  - Apps Script لا يُرجع ترويسات CORS، لذا نستعمل no-cors (الرد opaque).
   *  - لا نضيف أي ترويسة مخصّصة: مع no-cors يرفضها المتصفح أو يُسقط الطلب.
   *  - keepalive يضمن إكمال الإرسال حتى لو انتقل المستخدم من الصفحة فوراً.
   *  - sendBeacon كخطة بديلة لأنه مصمَّم لهذه الحالة بالضبط.
   */
  SEI.sendToSheet = function (webhookUrl, payload) {
    const url = String(webhookUrl || '').trim();
    if (!SEI.isSheetUrl(url)) {
      console.warn('Sheets: رابط غير صالح (يجب أن ينتهي بـ /exec):', url);
      return Promise.resolve(false);
    }

    const body = JSON.stringify(payload || {});

    // 1) sendBeacon: الأضمن عند مغادرة الصفحة — يُرسل في الخلفية
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
        if (navigator.sendBeacon(url, blob)) return Promise.resolve(true);
      }
    } catch (e) { /* نكمل للخطة التالية */ }

    // 2) fetch مع keepalive (بلا ترويسات مخصّصة)
    return fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      body: body
    }).then(() => true).catch(err => {
      console.warn('Sheets webhook failed:', err);
      return false;
    });
  };

  /* =========================================================
     2) PIXELS (فيسبوك + تيك توك)
     ========================================================= */
  const loaded = { fb: null, tt: null };

  SEI.initPixels = function (settings) {
    if (!settings) return;
    if (settings.fb_pixel && !loaded.fb) SEI.initFacebook(String(settings.fb_pixel).trim());
    if (settings.tt_pixel && !loaded.tt) SEI.initTiktok(String(settings.tt_pixel).trim());
  };

  SEI.initFacebook = function (id) {
    if (!id || loaded.fb === id) return;
    loaded.fb = id;
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s)
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  };

  SEI.initTiktok = function (id) {
    if (!id || loaded.tt === id) return;
    loaded.tt = id;
    /* eslint-disable */
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
      ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
      ttq.setAndDefer = function (e, n) { e[n] = function () { e.push([n].concat(Array.prototype.slice.call(arguments, 0))) } };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (e) { for (var n = ttq._i[e] || [], i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(n, ttq.methods[i]); return n };
      ttq.load = function (e, n) {
        var r = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._i[e]._u = r; ttq._t = ttq._t || {}; ttq._t[e] = +new Date;
        ttq._o = ttq._o || {}; ttq._o[e] = n || {};
        var o = d.createElement("script"); o.type = "text/javascript"; o.async = !0; o.src = r + "?sdkid=" + e + "&lib=" + t;
        var a = d.getElementsByTagName("script")[0]; a.parentNode.insertBefore(o, a)
      };
      ttq.load(id); ttq.page();
    }(window, document, 'ttq');
    /* eslint-enable */
  };

  // إطلاق حدث على كل البكسلات المفعّلة
  SEI.track = function (event, data) {
    data = data || {};
    const value = Number(data.value || 0);
    const currency = 'DZD';
    const fbMap = { view: 'ViewContent', addToCart: 'AddToCart', checkout: 'InitiateCheckout', purchase: 'Purchase' };
    const ttMap = { view: 'ViewContent', addToCart: 'AddToCart', checkout: 'InitiateCheckout', purchase: 'CompletePayment' };

    try {
      if (window.fbq && fbMap[event]) {
        window.fbq('track', fbMap[event], {
          content_name: data.name || '', content_ids: data.id ? [data.id] : [],
          content_type: 'product', value: value, currency: currency
        });
      }
    } catch (e) {}

    try {
      if (window.ttq && ttMap[event]) {
        window.ttq.track(ttMap[event], {
          content_id: data.id || '', content_name: data.name || '',
          content_type: 'product', quantity: data.qty || 1, price: value, value: value, currency: currency
        });
      }
    } catch (e) {}
  };

  /* =========================================================
     3) الحماية من البوتات وتقييد الطلبات حسب IP
     ========================================================= */
  SEI.limits = {
    maxPerIpPerDay: 5,      // أقصى عدد طلبات من نفس الـ IP في 24 ساعة
    maxPerDevicePerDay: 5,  // نفس الشيء على مستوى الجهاز
    minSecondsOnPage: 4     // أقل زمن معقول لملء النموذج (أقل منه = بوت)
  };

  // جلب عنوان IP من خدمات مجانية مع بدائل احتياطية
  let cachedIp = null;
  SEI.getClientIp = async function () {
    if (cachedIp) return cachedIp;
    const sources = [
      { url: 'https://api.ipify.org?format=json', pick: j => j.ip },
      { url: 'https://ipapi.co/json/', pick: j => j.ip },
      { url: 'https://api.db-ip.com/v2/free/self', pick: j => j.ipAddress }
    ];
    for (const s of sources) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3500);
        const res = await fetch(s.url, { signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) continue;
        const ip = s.pick(await res.json());
        if (ip) { cachedIp = ip; return ip; }
      } catch (e) { /* جرّب المصدر التالي */ }
    }
    return null; // تعذّر تحديد الـ IP — نعتمد على حدّ الجهاز فقط
  };

  // سجل محلي للطلبات (سريع، بلا شبكة)
  function localLog() {
    const cutoff = nowMs() - 86400000;
    const log = (read(LS_ORDERS, []) || []).filter(t => t > cutoff);
    write(LS_ORDERS, log);
    return log;
  }
  SEI.recordLocalOrder = function () {
    const log = localLog(); log.push(nowMs()); write(LS_ORDERS, log);
  };

  /**
   * فحص شامل قبل السماح بإرسال الطلب.
   * db: كائن Firestore (compat) — اختياري. بدونه يُطبَّق الحد المحلي فقط.
   * يُرجع { ok, reason, ipHash }
   */
  SEI.checkOrderAllowed = async function (db, opts) {
    opts = opts || {};

    // (أ) كشف البوت: تعبئة أسرع من البشر
    if (opts.pageOpenedAt) {
      const secs = (nowMs() - opts.pageOpenedAt) / 1000;
      if (secs < SEI.limits.minSecondsOnPage) {
        return { ok: false, reason: 'سلوك غير طبيعي: تم ملء النموذج بسرعة كبيرة. يرجى المحاولة مجدداً.' };
      }
    }

    // (ب) الحقل الخفي (honeypot) — لا يملؤه إلا البوت
    if (opts.honeypotValue) {
      return { ok: false, reason: 'تم رصد نشاط آلي مشبوه.' };
    }

    // (ج) الحد المحلي على الجهاز
    if (localLog().length >= SEI.limits.maxPerDevicePerDay) {
      return { ok: false, reason: `تجاوزت الحد المسموح (${SEI.limits.maxPerDevicePerDay} طلبات يومياً). يرجى التواصل معنا هاتفياً.` };
    }

    // (د) الحد حسب عنوان IP عبر Firestore
    const ip = await SEI.getClientIp();
    if (!ip || !db) return { ok: true, ipHash: ip ? SEI.hash(ip) : null };

    const ipHash = SEI.hash(ip);
    try {
      const ref = db.collection('order_limits').doc(ipHash);
      const snap = await ref.get();
      const cutoff = nowMs() - 86400000;

      if (snap.exists) {
        const d = snap.data() || {};
        const stamps = (d.stamps || []).filter(t => Number(t) > cutoff);
        if (stamps.length >= SEI.limits.maxPerIpPerDay) {
          return {
            ok: false, ipHash,
            reason: `تم تسجيل ${stamps.length} طلبات من هذا الاتصال خلال 24 ساعة. للطلبات الإضافية يرجى التواصل مع التاجر مباشرة.`
          };
        }
      }
      return { ok: true, ipHash };
    } catch (e) {
      console.warn('IP limit check skipped:', e);
      return { ok: true, ipHash }; // لا نمنع الزبون الحقيقي بسبب خطأ شبكة
    }
  };

  // تسجيل الطلب بعد نجاحه (يحدّث عدّاد الـ IP والجهاز)
  SEI.recordOrder = async function (db, ipHash) {
    SEI.recordLocalOrder();
    if (!db || !ipHash) return;
    try {
      const ref = db.collection('order_limits').doc(ipHash);
      const snap = await ref.get();
      const cutoff = nowMs() - 86400000;
      const prev = snap.exists ? ((snap.data() || {}).stamps || []) : [];
      const stamps = prev.filter(t => Number(t) > cutoff).concat([nowMs()]).slice(-20);
      await ref.set({ stamps, count: stamps.length, updated_at: nowMs() }, { merge: true });
    } catch (e) {
      console.warn('recordOrder failed:', e);
    }
  };

  /* حقن الحقل الخفي (honeypot) داخل أي نموذج */
  SEI.mountHoneypot = function (container) {
    if (!container || container.querySelector('[data-se-hp]')) return;
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;height:0;width:0;overflow:hidden';
    wrap.innerHTML = '<label>لا تملأ هذا الحقل<input type="text" data-se-hp tabindex="-1" autocomplete="off"></label>';
    container.appendChild(wrap);
  };
  SEI.honeypotValue = function (container) {
    const el = container ? container.querySelector('[data-se-hp]') : document.querySelector('[data-se-hp]');
    return el ? el.value : '';
  };

  /* جلب إعدادات التاجر (بكسلات + رابط الشيت) مع تخزين مؤقت */
  const settingsCache = {};
  SEI.loadMerchantSettings = async function (db, merchantId) {
    if (!db || !merchantId) return null;
    if (settingsCache[merchantId]) return settingsCache[merchantId];
    try {
      const snap = await db.collection('merchant_settings').doc(merchantId).get();
      const data = snap.exists ? snap.data() : null;
      settingsCache[merchantId] = data;
      return data;
    } catch (e) {
      console.warn('merchant settings load failed:', e);
      return null;
    }
  };

  window.SEI = SEI;
})();
