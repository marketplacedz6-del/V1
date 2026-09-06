/* =========================================================
   SouqiExpress — وحدة الربط مع شركات التوصيل الجزائرية
   Yalidine · ZR Express · Maystro · NOEST · Ecotrack
   تعمل على موقع ثابت عبر بوابة موحّدة (Gateway) + بديل CSV مضمون
   ========================================================= */
(function () {
  "use strict";

  const SEC = {};

  /* البوابة الافتراضية: واجهة موحّدة لكل شركات التوصيل الجزائرية.
     بيانات اعتماد التاجر تُمرَّر للطلب الواحد ولا تُخزَّن لدى البوابة. */
  SEC.DEFAULT_GATEWAY = "https://freeship.dzbuild.com";

  /* ---------- تعريف الشركات وحقول الاعتماد ---------- */
  SEC.COURIERS = {
    yalidine: {
      id: "yalidine", name: "Yalidine ياليدين",
      note: "أكبر شبكة في الجزائر — 58 ولاية وشبكة مكاتب واسعة.",
      fields: [
        { key: "apiId", label: "API ID", type: "text" },
        { key: "apiToken", label: "API Token", type: "password" }
      ],
      needsFromWilaya: true,
      help: "احصل على المفاتيح من yalidine.app/dev بعد تسجيلك كتاجر."
    },
    zrexpress: {
      id: "zrexpress", name: "ZR Express (Procolis)",
      note: "قوي في الوسط، ويدعم الاستبدال.",
      fields: [
        { key: "token", label: "Token", type: "password" },
        { key: "key", label: "Key", type: "password" }
      ],
      help: "من لوحة Procolis الخاصة بك."
    },
    maystro: {
      id: "maystro", name: "Maystro Delivery",
      note: "يمنع تكرار نفس الاسم والهاتف مرتين في اليوم.",
      fields: [{ key: "apiKey", label: "API Key", type: "password" }],
      help: "من إعدادات حسابك في Maystro."
    },
    noest: {
      id: "noest", name: "NOEST Express",
      note: "يتطلب خطوة تحقّق — تتم تلقائياً هنا.",
      fields: [
        { key: "apiToken", label: "API Token", type: "password" },
        { key: "guid", label: "GUID", type: "text" }
      ],
      help: "من لوحة تحكم NOEST."
    },
    ecotrack: {
      id: "ecotrack", name: "Ecotrack (DHD, Conexlog, MSM Go…)",
      note: "منصّة تجمع أكثر من 30 شركة توصيل.",
      fields: [
        { key: "token", label: "Token", type: "password" },
        { key: "baseUrl", label: "رابط المنصّة (baseUrl)", type: "text", placeholder: "https://platform.dhd-dz.com" }
      ],
      help: "الرابط هو نطاق شركتك على منصة Ecotrack."
    }
  };

  /* ---------- الولايات بالرموز (مطلوبة للشركات) ---------- */
  SEC.WILAYA_CODES = {};
  (function buildCodes() {
    const list = window.SE_WILAYAS || [];
    list.forEach((n, i) => { SEC.WILAYA_CODES[n] = i + 1; });
  })();

  SEC.wilayaCode = function (name) {
    if (!name) return null;
    const clean = String(name).replace(/ولاية/g, "").trim();
    if (SEC.WILAYA_CODES[clean]) return SEC.WILAYA_CODES[clean];
    const hit = Object.keys(SEC.WILAYA_CODES).find(w => clean.includes(w) || w.includes(clean));
    return hit ? SEC.WILAYA_CODES[hit] : null;
  };

  /* ---------- أدوات ---------- */
  function gatewayUrl(cfg, path) {
    const base = (cfg && cfg.gateway ? cfg.gateway : SEC.DEFAULT_GATEWAY).replace(/\/+$/, "");
    return base + path;
  }

  async function callGateway(cfg, path, body, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs || 20000);
    try {
      const res = await fetch(gatewayUrl(cfg, path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
      if (!res.ok) {
        const msg = (data && (data.message || data.error || data.code)) || ("HTTP " + res.status);
        return { ok: false, status: res.status, error: msg, data };
      }
      return { ok: true, data };
    } catch (e) {
      const offline = (e.name === "AbortError")
        ? "انتهت مهلة الاتصال بالبوابة."
        : "تعذّر الوصول إلى بوابة الشحن (قد يكون بسبب حظر المتصفح CORS أو انقطاع الشبكة).";
      return { ok: false, error: offline, network: true };
    } finally {
      clearTimeout(t);
    }
  }

  /* ---------- بناء بيانات الاعتماد حسب الشركة ---------- */
  SEC.buildCredentials = function (cfg) {
    const def = SEC.COURIERS[cfg.courier];
    if (!def) return {};
    const creds = {};
    def.fields.forEach(f => {
      // baseUrl يُرسل ضمن options وليس credentials
      if (f.key === "baseUrl") return;
      if (cfg[f.key]) creds[f.key] = cfg[f.key];
    });
    return creds;
  };

  SEC.buildOptions = function (cfg) {
    const opt = {};
    if (cfg.baseUrl) opt.baseUrl = cfg.baseUrl;
    if (cfg.fromWilaya) opt.fromWilaya = Number(cfg.fromWilaya);
    return opt;
  };

  /* ---------- اختبار الاتصال ---------- */
  SEC.testConnection = async function (cfg) {
    const def = SEC.COURIERS[cfg.courier];
    if (!def) return { ok: false, error: "شركة توصيل غير معروفة" };
    const missing = def.fields.filter(f => !cfg[f.key]).map(f => f.label);
    if (missing.length) return { ok: false, error: "أكمل الحقول: " + missing.join("، ") };
    if (def.needsFromWilaya && !cfg.fromWilaya) return { ok: false, error: "حدّد ولاية الانطلاق." };

    // نستعمل تسعيرة كاختبار حقيقي للمفاتيح
    const from = Number(cfg.fromWilaya) || 16;
    const to = from === 31 ? 16 : 31;
    const r = await callGateway(cfg, "/v1/rates", {
      courier: cfg.courier,
      credentials: SEC.buildCredentials(cfg),
      options: SEC.buildOptions(cfg),
      query: { fromWilaya: from, toWilaya: to, deliveryType: "home" }
    });
    if (r.ok) return { ok: true, sample: r.data };
    return r;
  };

  /* ---------- جلب تسعيرة ولاية ---------- */
  SEC.getRate = async function (cfg, toWilayaCode, deliveryType) {
    return callGateway(cfg, "/v1/rates", {
      courier: cfg.courier,
      credentials: SEC.buildCredentials(cfg),
      options: SEC.buildOptions(cfg),
      query: {
        fromWilaya: Number(cfg.fromWilaya) || 16,
        toWilaya: Number(toWilayaCode),
        deliveryType: deliveryType === "desk" ? "stopdesk" : "home"
      }
    });
  };

  /* ---------- تحويل طلب المنصّة إلى صيغة الشركة ---------- */
  SEC.orderToParcel = function (order, opts) {
    opts = opts || {};
    const wilaya = order.wilaya || (String(order.address || "").match(/ولاية:\s*([^|]+)/) || [])[1] || "";
    const code = SEC.wilayaCode(wilaya);
    const qty = Number(order.quantity) || 1;
    const unit = Number(order.unit_price) || 0;
    const ship = Number(order.shipping_price) || 0;
    const cod = order.total_price != null ? (Number(order.total_price) + ship) : (unit * qty + ship);
    const isDesk = order.delivery_type === "desk" || /المكتب|stopdesk|desk/i.test(String(order.address || ""));

    // العنوان النظيف بدون البادئات التي نضيفها نحن
    let addr = String(order.address || "")
      .replace(/ولاية:\s*[^|]*\|/, "")
      .replace(/(توصيل للمنزل|استلام من المكتب|التوصيل:\s*[^|]*)\|?/g, "")
      .replace(/العنوان الكامل:\s*/, "")
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      recipient: {
        fullName: String(order.customer_name || "").trim(),
        phone: String(order.phone_number || "").trim(),
        wilayaCode: code,
        communeName: opts.commune || order.commune || wilayaNameOf(code) || "",
        addressLine: addr
      },
      deliveryType: isDesk ? "stopdesk" : "home",
      productList: [order.product_name || "منتج", "x" + qty].join(" "),
      codAmount: Math.round(cod),
      reference: order.order_ref || order.id || "",
      notes: opts.notes || ""
    };
  };

  function wilayaNameOf(code) {
    const list = window.SE_WILAYAS || [];
    return code && list[code - 1] ? list[code - 1] : "";
  }

  /* ---------- إنشاء طرد ---------- */
  SEC.createParcel = async function (cfg, order, opts) {
    const parcel = SEC.orderToParcel(order, opts);
    if (!parcel.recipient.wilayaCode) return { ok: false, error: "تعذّر تحديد رمز الولاية لهذا الطلب." };
    if (!/^0[5-7][0-9]{8}$/.test(parcel.recipient.phone)) return { ok: false, error: "رقم هاتف الزبون غير صالح." };
    if (!parcel.recipient.fullName || parcel.recipient.fullName.length < 2) return { ok: false, error: "اسم الزبون غير صالح." };

    const r = await callGateway(cfg, "/v1/orders", {
      courier: cfg.courier,
      credentials: SEC.buildCredentials(cfg),
      options: SEC.buildOptions(cfg),
      order: parcel
    }, 30000);

    if (r.ok) {
      const d = r.data || {};
      return { ok: true, tracking: d.trackingNumber || d.tracking || d.id || "", status: d.status || "created", data: d };
    }
    return r;
  };

  /* ---------- تتبّع طرد ---------- */
  SEC.track = async function (cfg, trackingNumber) {
    return callGateway(cfg, "/v1/track", {
      courier: cfg.courier,
      credentials: SEC.buildCredentials(cfg),
      options: SEC.buildOptions(cfg),
      trackingNumber: trackingNumber
    });
  };

  /* ترجمة حالات التتبّع الموحّدة */
  SEC.STATUS_AR = {
    created: "تم الإنشاء",
    pending_pickup: "بانتظار الاستلام",
    picked_up: "تم الاستلام",
    in_transit: "في الطريق",
    at_hub: "في المركز",
    out_for_delivery: "خرج للتوصيل",
    delivered: "تم التسليم",
    returned: "مُرجَع",
    cancelled: "ملغى",
    failed: "فشل التوصيل"
  };
  SEC.statusAr = s => SEC.STATUS_AR[s] || s || "—";

  /* =========================================================
     البديل المضمون: تصدير CSV بصيغة شركة التوصيل
     كل الشركات الجزائرية تقبل رفع ملف Excel/CSV من لوحتها
     ========================================================= */
  SEC.CSV_TEMPLATES = {
    yalidine: {
      name: "Yalidine",
      head: ["order_id", "firstname", "familyname", "contact_phone", "address", "to_commune_name", "to_wilaya_name", "product_list", "price", "is_stopdesk", "freeshipping"],
      row: o => {
        const p = SEC.orderToParcel(o);
        const parts = p.recipient.fullName.split(/\s+/);
        return [p.reference, parts[0] || "", parts.slice(1).join(" ") || parts[0] || "",
          p.recipient.phone, p.recipient.addressLine, p.recipient.communeName,
          wilayaNameOf(p.recipient.wilayaCode), p.productList, p.codAmount,
          p.deliveryType === "stopdesk" ? 1 : 0, 0];
      }
    },
    generic: {
      name: "عام (كل الشركات)",
      head: ["رقم الطلب", "الاسم الكامل", "الهاتف", "الولاية", "البلدية", "العنوان", "المنتج", "المبلغ", "نوع التوصيل"],
      row: o => {
        const p = SEC.orderToParcel(o);
        return [p.reference, p.recipient.fullName, p.recipient.phone,
          wilayaNameOf(p.recipient.wilayaCode), p.recipient.communeName,
          p.recipient.addressLine, p.productList, p.codAmount,
          p.deliveryType === "stopdesk" ? "مكتب" : "منزل"];
      }
    }
  };

  SEC.exportCourierCsv = function (orders, template) {
    const tpl = SEC.CSV_TEMPLATES[template] || SEC.CSV_TEMPLATES.generic;
    const rows = orders.map(o => { try { return tpl.row(o); } catch (e) { return null; } }).filter(Boolean);
    if (!rows.length) return 0;
    const csv = [tpl.head, ...rows]
      .map(r => r.map(c => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${tpl.name}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    return rows.length;
  };

  window.SEC = SEC;
})();
