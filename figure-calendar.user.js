// ==UserScript==
// @name         피규어 캘린더
// @namespace    figure-calendar
// @version      1.3.0
// @description  피규어 상품 페이지에서 정보를 추출하여 피규어 캘린더에 저장합니다.
// @match        *://figure-calendar.vercel.app/*
// @match        *://localhost:*/*
// @match        *://comics-art.co.kr/*
// @match        *://*.comics-art.co.kr/*
// @match        *://maniahouse.co.kr/*
// @match        *://*.maniahouse.co.kr/*
// @match        *://smartstore.naver.com/*
// @match        *://*.smartstore.naver.com/*
// @match        *://herotime.co.kr/*
// @match        *://*.herotime.co.kr/*
// @match        *://rabbits.kr/*
// @match        *://*.rabbits.kr/*
// @match        *://arca.live/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      identitytoolkit.googleapis.com
// @connect      securetoken.googleapis.com
// @connect      firestore.googleapis.com
// @connect      arca.live
// @updateURL    https://raw.githubusercontent.com/Uragirimono00/figure-calendar/master/figure-calendar.user.js
// @downloadURL  https://raw.githubusercontent.com/Uragirimono00/figure-calendar/master/figure-calendar.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const FIREBASE_API_KEY = "AIzaSyAVrkt_rugotCtw_k8nCVMM3_XpcIwilXI";
  const FIREBASE_PROJECT_ID = "figure-calendar";
  const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
  const IDB_KEY = `firebase:authUser:${FIREBASE_API_KEY}:[DEFAULT]`;

  const isFigureCalendarSite = location.hostname === "figure-calendar.vercel.app" || location.hostname === "localhost";

  // ============================================================
  //  피규어 캘린더 사이트: 로그인 정보 자동 동기화
  // ============================================================
  if (isFigureCalendarSite) {
    unsafeWindow.__FIGCAL_TM__ = true;

    GM_addStyle(`
      #figcal-sync-badge {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 2147483647;
        padding: 8px 14px;
        border-radius: 8px;
        font: 500 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #fff;
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        transition: opacity 400ms ease, transform 400ms ease;
        pointer-events: none;
      }
      #figcal-sync-badge.success { background: #22c55e; }
      #figcal-sync-badge.info    { background: #2563eb; }
      #figcal-sync-badge.warn    { background: #f59e0b; }
      #figcal-sync-badge.hide    { opacity: 0; transform: translateY(8px); }
    `);

    function showSyncBadge(msg, type, duration) {
      let badge = document.getElementById("figcal-sync-badge");
      if (!badge) {
        badge = document.createElement("div");
        badge.id = "figcal-sync-badge";
        document.body.appendChild(badge);
      }
      badge.textContent = msg;
      badge.className = type;
      if (duration) {
        setTimeout(() => badge.classList.add("hide"), duration);
      }
    }

    function readFirebaseAuth() {
      return new Promise((resolve) => {
        const req = indexedDB.open("firebaseLocalStorageDb");
        req.onerror = () => resolve(null);
        req.onsuccess = () => {
          const db = req.result;
          try {
            const tx = db.transaction("firebaseLocalStorage", "readonly");
            const store = tx.objectStore("firebaseLocalStorage");
            const get = store.get(IDB_KEY);
            get.onsuccess = () => {
              const val = get.result?.value || get.result;
              resolve(val || null);
            };
            get.onerror = () => resolve(null);
          } catch (e) {
            resolve(null);
          }
        };
      });
    }

    async function syncAuth() {
      const fbUser = await readFirebaseAuth();
      const prev = GM_getValue("authUser", null);

      if (fbUser && fbUser.uid) {
        const user = {
          idToken: fbUser.stsTokenManager?.accessToken || "",
          refreshToken: fbUser.stsTokenManager?.refreshToken || "",
          localId: fbUser.uid,
          email: fbUser.email || "",
        };
        GM_setValue("authUser", user);

        if (!prev || prev.localId !== user.localId) {
          showSyncBadge(`Tampermonkey 동기화 완료: ${user.email}`, "success", 3000);
        }
      } else if (prev) {
        // 사이트에서 로그아웃된 경우
        GM_deleteValue("authUser");
        showSyncBadge("Tampermonkey 로그아웃 동기화됨", "warn", 3000);
      }
    }

    // 초기 동기화 + 주기적 확인 (로그인/로그아웃 감지)
    syncAuth();
    setInterval(syncAuth, 5000);

    return; // 피규어 캘린더 사이트에서는 추출 UI 표시 안 함
  }

  // ============================================================
  //  상품 페이지: 추출 & 저장 UI
  // ============================================================

  // --- 스타일 ---
  GM_addStyle(`
    #figcal-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #2563eb;
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(37,99,235,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 150ms ease, box-shadow 150ms ease;
      font-size: 22px;
      line-height: 1;
    }
    #figcal-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 6px 24px rgba(37,99,235,0.5);
    }

    #figcal-panel {
      position: fixed;
      bottom: 84px;
      right: 24px;
      z-index: 2147483647;
      width: 360px;
      max-height: 80vh;
      overflow-y: auto;
      background: #f8fafc;
      border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      display: none;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      line-height: 1.5;
      color: #0f172a;
    }
    #figcal-panel *, #figcal-panel *::before, #figcal-panel *::after {
      box-sizing: border-box;
    }
    #figcal-panel.open { display: block; }

    #figcal-panel .figcal-inner { padding: 16px; }

    #figcal-panel h2 {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 12px;
      color: #0f172a;
    }

    /* Login */
    .figcal-login-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .figcal-login-form input {
      padding: 8px 12px;
      font-size: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #fff;
      color: #0f172a;
      outline: none;
      width: 100%;
    }
    .figcal-login-form input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }

    /* Buttons */
    .figcal-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 500;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 150ms ease;
      width: auto;
    }
    .figcal-btn-primary {
      background: #2563eb;
      color: #fff;
    }
    .figcal-btn-primary:hover { background: #1d4ed8; }
    .figcal-btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .figcal-btn-secondary {
      background: #f1f5f9;
      color: #475569;
    }
    .figcal-btn-secondary:hover { background: #e2e8f0; }
    .figcal-btn-danger {
      background: transparent;
      color: #ef4444;
      border: 1px solid transparent;
      font-size: 12px;
      padding: 4px 8px;
    }
    .figcal-btn-danger:hover {
      border-color: #ef4444;
      background: rgba(239,68,68,0.05);
    }
    .figcal-btn-full { width: 100%; }

    /* Status */
    .figcal-status {
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      margin-top: 8px;
      display: none;
    }
    .figcal-status-error {
      background: rgba(239,68,68,0.08);
      color: #ef4444;
      border: 1px solid rgba(239,68,68,0.2);
    }
    .figcal-status-success {
      background: rgba(34,197,94,0.08);
      color: #22c55e;
      border: 1px solid rgba(34,197,94,0.2);
    }

    /* Login prompt */
    .figcal-login-prompt {
      text-align: center;
      padding: 8px 0 12px;
    }
    .figcal-login-prompt p {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 10px;
    }
    .figcal-login-prompt a {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: #2563eb;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      transition: background 150ms ease;
    }
    .figcal-login-prompt a:hover { background: #1d4ed8; }
    .figcal-divider {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 14px 0;
    }
    .figcal-divider::before,
    .figcal-divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: #e2e8f0;
    }
    .figcal-divider span {
      font-size: 11px;
      color: #94a3b8;
      white-space: nowrap;
    }

    /* User bar */
    .figcal-user-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .figcal-user-bar-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .figcal-user-email {
      font-size: 12px;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 200px;
    }
    .figcal-site-link {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      color: #64748b;
      text-decoration: none;
      transition: all 150ms ease;
    }
    .figcal-site-link:hover {
      background: #f1f5f9;
      color: #2563eb;
    }

    /* Preview */
    .figcal-preview {
      display: none;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }
    .figcal-preview.open { display: flex; }
    .figcal-preview-image {
      border-radius: 8px;
      overflow: hidden;
      background: #f1f5f9;
      max-height: 150px;
      display: none;
    }
    .figcal-preview-image img {
      display: block;
      width: 100%;
      height: auto;
      max-height: 150px;
      object-fit: contain;
    }
    .figcal-field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .figcal-field label {
      font-size: 11px;
      font-weight: 500;
      color: #94a3b8;
    }
    .figcal-field input, .figcal-field select {
      padding: 6px 10px;
      font-size: 13px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #fff;
      color: #0f172a;
      outline: none;
      width: 100%;
    }
    .figcal-field input:focus, .figcal-field select:focus {
      border-color: #2563eb;
    }
    .figcal-fields-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
  `);

  // --- 상품 추출 로직 ---

  const STORE_NAMES = [
    "코믹스아트", "comicsart", "매니아하우스", "maniahouse",
    "히어로타임", "herotime", "래빗츠", "rabbits",
  ];

  function isStoreName(value) {
    const norm = value.toLowerCase().replace(/[\s\-_()（）]+/g, "");
    return STORE_NAMES.some((s) => norm.includes(s));
  }

  function extractProductData() {
    const result = {
      name: "",
      price: "",
      deposit: "",
      remaining: "",
      imageUrl: "",
      manufacturer: "",
      releaseDate: "",
      purchasePlace: "",
      sourceUrl: window.location.href,
      size: "",
      type: "",
    };

    const hostname = window.location.hostname.toLowerCase();

    // 아카라이브 게시글
    if (hostname.includes("arca.live")) {
      // 제목: .article-head .title 에서 카테고리 뱃지 제거
      const titleEl = document.querySelector(".article-head .title");
      if (titleEl) {
        const badge = titleEl.querySelector(".badge");
        const titleText = titleEl.textContent.replace(badge ? badge.textContent : "", "").trim();
        result.name = titleText;
      }

      // 이미지: 본문 첫 번째 이미지
      const contentEl = document.querySelector(".article-content, .article-body");
      if (contentEl) {
        const firstImg = contentEl.querySelector("img");
        if (firstImg) {
          result.imageUrl = firstImg.src || firstImg.dataset.src || "";
        }
      }

      // 본문 텍스트에서 구조화된 정보 추출
      const articleText = contentEl ? contentEl.innerText : document.body.innerText;

      // 발매원/제조사
      const mfgMatch = articleText.match(/발매원\s*[:：]\s*([^\n\r]+)/);
      if (mfgMatch) result.manufacturer = mfgMatch[1].trim();

      // 가격 (가격, 출시가, 판매가, 정가)
      const priceMatch = articleText.match(/(?:가격|출시가|판매가|정가)\s*[:：]\s*([^\n\r]+)/);
      if (priceMatch) result.price = priceMatch[1].trim();

      // 스케일/전고/크기 → size
      const scaleMatch = articleText.match(/(1\/\d+)\s*스케일/);
      const heightMatch = articleText.match(/(?:전고|높이)\s*[:：]\s*([^\n\r,]+)/);
      const sizeMatch = articleText.match(/크기\s*[:：]\s*([^\n\r]+)/);
      if (scaleMatch || heightMatch || sizeMatch) {
        const parts = [];
        if (scaleMatch) parts.push(scaleMatch[1]);
        if (heightMatch) parts.push(heightMatch[1].trim());
        if (sizeMatch && !heightMatch) parts.push(sizeMatch[1].trim());
        result.size = parts.join(" / ");
      }

      // 발매일 (발매일, 발매, 출시일, 출시)
      const releaseMatch = articleText.match(/(?:발매일|발매|출시일|출시)\s*[:：]\s*([^\n\r]+)/);
      if (releaseMatch) result.releaseDate = releaseMatch[1].trim();

      // 소재
      const materialMatch = articleText.match(/소재\s*[:：]\s*([^\n\r]+)/);
      if (materialMatch) result.type = materialMatch[1].trim();

      // 제품명에서 [제조사] 패턴 분리 (제목 또는 본문 첫 줄)
      // 제목에 [제조사]제품명 형태가 있으면 분리
      const titleBracket = result.name.match(/^\[([^\]]+)\]\s*(.+)/);
      if (titleBracket) {
        const productName = titleBracket[2].trim();
        if (productName.length > 3) {
          result.name = productName;
          if (!result.manufacturer) result.manufacturer = titleBracket[1].trim();
        }
      }

      // 본문 첫 줄에 [ MAKER ] 이름 형태인 경우 더 정확한 이름 추출
      if (!titleBracket) {
        const lines = articleText.split(/\n/).map((l) => l.trim()).filter(Boolean);
        for (const line of lines) {
          const bracketMatch = line.match(/^\[([^\]]+)\]\s*(.+)/);
          if (bracketMatch) {
            const productName = bracketMatch[2].trim();
            if (productName.length > 5) {
              result.name = productName;
              if (!result.manufacturer) result.manufacturer = bracketMatch[1].trim();
            }
            break;
          }
        }
      }

      result.purchasePlace = "";
      result.sourceUrl = window.location.href;
      return result;
    }

    // JSON-LD Product
    const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of ldScripts) {
      try {
        const json = JSON.parse(script.textContent);
        if (json["@type"] === "Product") {
          result.name = json.name || "";
          if (json.offers) {
            const offers = Array.isArray(json.offers) ? json.offers : [json.offers];
            for (const offer of offers) {
              const name = (offer.name || "").toLowerCase();
              const price = String(offer.price || "").replace(/,/g, "");
              if (name.includes("전체결제") || name.includes("전액결제")) {
                result.price = price;
              } else if (name.includes("잔금")) {
                result.remaining = price;
              } else if (name.includes("예약금") || name.includes("예약결제") || name.includes("1차결제") || name.includes("계약금")) {
                result.deposit = price;
              }
            }
            if (!result.price) {
              let maxPrice = 0;
              for (const offer of offers) {
                const p = Number(String(offer.price || "0").replace(/,/g, ""));
                if (p > maxPrice) maxPrice = p;
              }
              if (maxPrice > 0) result.price = String(maxPrice);
            }
          }
          if (json.image) {
            result.imageUrl = Array.isArray(json.image) ? json.image[0] : json.image;
          }
          if (json.brand) {
            const brandName = typeof json.brand === "string" ? json.brand : json.brand.name || "";
            if (brandName && !isStoreName(brandName)) {
              result.manufacturer = brandName;
            }
          }
          break;
        }
      } catch (e) { /* ignore */ }
    }

    // 잔금 자동 계산
    if (result.deposit && !result.remaining && result.price) {
      const total = Number(result.price);
      const dep = Number(result.deposit);
      if (total > dep) result.remaining = String(total - dep);
    }

    // 네이버 스마트스토어
    if (hostname.includes("smartstore.naver.com")) {
      const nextDataEl = document.querySelector("script#__NEXT_DATA__");
      if (nextDataEl) {
        try {
          const nextData = JSON.parse(nextDataEl.textContent);
          const product =
            nextData.props?.pageProps?.product ||
            nextData.props?.pageProps?.initialState?.product?.A ||
            nextData.props?.pageProps?.initialState?.product?.a ||
            null;
          if (product) {
            result.name = product.name || product.productName || result.name;
            result.price = String(product.discountedSalePrice || product.salePrice || product.price || result.price);
            if (product.representImage) result.imageUrl = product.representImage.url || result.imageUrl;
            else if (product.productImages?.length > 0) result.imageUrl = product.productImages[0].url || result.imageUrl;
            result.manufacturer = product.maker || product.brand || result.manufacturer;
          }
        } catch (e) { /* ignore */ }
      }

      if (!result.name) {
        try {
          const pageProduct =
            unsafeWindow.__PRELOADED_STATE__?.product?.A ||
            unsafeWindow.__PRELOADED_STATE__?.product?.a ||
            unsafeWindow.__PRELOADED_STATE__?.product ||
            unsafeWindow.__NEXT_DATA__?.props?.pageProps?.product ||
            null;
          if (pageProduct) {
            result.name = pageProduct.name || pageProduct.productName || result.name;
            result.price = String(pageProduct.discountedSalePrice || pageProduct.salePrice || pageProduct.price || result.price);
            if (pageProduct.representImage) result.imageUrl = pageProduct.representImage.url || result.imageUrl;
            result.manufacturer = pageProduct.maker || pageProduct.brand || result.manufacturer;
          }
        } catch (e) { /* ignore */ }
      }

      if (!result.name) {
        const scripts = document.querySelectorAll("script");
        for (const script of scripts) {
          const text = script.textContent || "";
          const match = text.match(/window\.__PRELOADED_STATE__\s*=\s*({.+})/);
          if (match) {
            try {
              const state = JSON.parse(match[1]);
              const product = state.product?.A || state.product?.a || state.product || {};
              result.name = product.name || product.productName || result.name;
              result.price = String(product.salePrice || product.discountedSalePrice || product.price || result.price);
              if (product.representImage) result.imageUrl = product.representImage.url || result.imageUrl;
              result.manufacturer = product.maker || product.brand || result.manufacturer;
              break;
            } catch (e) { /* ignore */ }
          }
        }
      }

      result.purchasePlace = "네이버";
    }

    // 구매처 판별
    if (hostname.includes("comics-art")) result.purchasePlace = "코아";
    else if (hostname.includes("maniahouse")) result.purchasePlace = "매하";
    else if (hostname.includes("herotime")) result.purchasePlace = "히어로타임";
    else if (hostname.includes("rabbits")) result.purchasePlace = "래빗츠";

    // Fallback: OG 메타 태그
    if (!result.name) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      result.name = ogTitle ? ogTitle.content : document.title || "";
    }
    if (!result.imageUrl) {
      const ogImage = document.querySelector('meta[property="og:image"]');
      result.imageUrl = ogImage ? ogImage.content : "";
    }
    if (!result.price) {
      const ogPrice = document.querySelector('meta[property="product:price:amount"]');
      result.price = ogPrice ? ogPrice.content : "";
    }

    // Cafe24 HTML 테이블/dl 스펙
    const isCafe24 =
      hostname.includes("comics-art") ||
      hostname.includes("maniahouse") ||
      hostname.includes("herotime") ||
      hostname.includes("rabbits");

    if (isCafe24) {
      const specMap = {};
      document.querySelectorAll("table tr").forEach((tr) => {
        const th = tr.querySelector("th");
        const td = tr.querySelector("td");
        if (!th || !td) return;
        specMap[th.innerText.trim().replace(/\s+/g, "")] = td.innerText.trim();
      });
      document.querySelectorAll("dl").forEach((dl) => {
        dl.querySelectorAll("dt").forEach((dt) => {
          const label = dt.innerText.trim();
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === "DD") {
            specMap[label.replace(/\s+/g, "")] = dd.innerText.trim();
          }
        });
      });
      for (const [key, value] of Object.entries(specMap)) {
        const k = key.toLowerCase();
        if (!result.manufacturer && (k.includes("제조사") || k.includes("메이커") || k.includes("브랜드"))) {
          if (!isStoreName(value)) result.manufacturer = value;
        }
        if (!result.size && (k.includes("스케일") || k.includes("사이즈") || k.includes("크기") || k.includes("전고") || k.includes("높이"))) {
          result.size = value;
        }
        if (!result.type && (k.includes("재질") || k.includes("소재") || k.includes("사양"))) {
          result.type = value;
        }
        if (!result.releaseDate && (k.includes("발매") || k.includes("예정일") || k.includes("발송") || k.includes("입고"))) {
          result.releaseDate = value;
        }
      }
    }

    // 본문 텍스트에서 상세 정보 추출
    const bodyText = document.body.innerText;

    if (!result.manufacturer) {
      const mfgPatterns = [
        /제작사\s*[:：]\s*([^\n\r,]+)/g,
        /제조사\s*[:：]?\s*([^\n\r,]+)/g,
        /메이커\s*[:：]\s*([^\n\r,]+)/g,
        /원형제작\s*[:：]\s*([^\n\r,]+)/g,
      ];
      for (const pattern of mfgPatterns) {
        let m;
        while ((m = pattern.exec(bodyText)) !== null) {
          const val = m[1].trim();
          if (val && !isStoreName(val)) {
            result.manufacturer = val;
            break;
          }
        }
        if (result.manufacturer) break;
      }
    }

    if (!result.size) {
      const sizePatterns = [
        /스케일\s*[:：]\s*([^\n\r,]+)/,
        /사이즈\s*[:：]\s*([^\n\r,]+)/,
        /크기\s*[:：]\s*([^\n\r,]+)/,
        /높이\s*[:：]\s*([^\n\r,]+)/,
      ];
      for (const p of sizePatterns) {
        const m = bodyText.match(p);
        if (m) { result.size = m[1].trim(); break; }
      }
    }

    if (!result.type) {
      const typePatterns = [
        /재질\s*[:：]\s*([^\n\r,]+)/,
        /소재\s*[:：]\s*([^\n\r,]+)/,
        /재료\s*[:：]\s*([^\n\r,]+)/,
        /사양\s*[:：]\s*([^\n\r,]+)/,
      ];
      for (const p of typePatterns) {
        const m = bodyText.match(p);
        if (m) { result.type = m[1].trim(); break; }
      }
    }

    const releaseDatePatterns = [
      /입고\s*예정일?\s*[:：]\s*(\d{4}\s*년?\s*\d{1,2}\s*(?:월|분기))/,
      /입고\s*예정일?\s*[:：]\s*(\d{2}\s*년\s*\d{1,2}\s*(?:월|분기))/,
      /예정일\s*[:：]\s*(\d{4}\s*년?\s*\d{1,2}\s*(?:월|분기))/,
      /예정일\s*[:：]\s*(\d{2}\s*년\s*\d{1,2}\s*(?:월|분기))/,
      /발매\s*[:：]?\s*(\d{4}[년\-]\s*\d{1,2}\s*(?:월|분기)?)/,
      /발매일\s*[:：]?\s*(\d{4}[년\-]\s*\d{1,2}\s*(?:월|분기)?)/,
      /발매\s*예정\s*[:：]?\s*(\d{4}[년\-]\s*\d{1,2}\s*(?:월|분기)?)/,
      /(\d{4}年\d{1,2}月)/,
      /(\d{4}\s*년\s*\d{1,2}\s*(?:월|분기))\s*발송/,
      /발매\s*(?:월\s*)?[:：]?\s*(\d{2}년\s*\d{1,2}\s*(?:월|분기)?)/,
      /발매일\s*[:：]?\s*(\d{2}년\s*\d{1,2}\s*(?:월|분기)?)/,
      /발매\s*예정\s*[:：]?\s*(\d{2}년\s*\d{1,2}\s*(?:월|분기)?)/,
      /(\d{2}\s*년\s*\d{1,2}\s*(?:월|분기))\s*발송/,
    ];
    for (const pattern of releaseDatePatterns) {
      const m = bodyText.match(pattern);
      if (m) {
        let dateStr = m[1].trim();
        const shortYearMatch = dateStr.match(/^(\d{2})(년)/);
        if (shortYearMatch) {
          const fullYear = Number(shortYearMatch[1]) >= 90 ? "19" + shortYearMatch[1] : "20" + shortYearMatch[1];
          dateStr = fullYear + dateStr.substring(2);
        }
        result.releaseDate = dateStr;
        break;
      }
    }

    if (!result.releaseDate && result.name) {
      const titleMatch = result.name.match(/^[(\[【\s]*(\d{2,4})\s*년\s*(\d{1,2})\s*(월|분기)[)\]】\s]*/);
      if (titleMatch) {
        let year = titleMatch[1];
        if (year.length === 2) year = (Number(year) >= 90 ? "19" : "20") + year;
        result.releaseDate = `${year}년 ${titleMatch[2]}${titleMatch[3]}`;
        const cleanName = result.name.slice(titleMatch[0].length).trim();
        if (cleanName) result.name = cleanName;
      }
    }

    if (result.imageUrl) {
      result.imageUrl = result.imageUrl.replace(/^https?:https?:\/\//, "https://");
      if (result.imageUrl.startsWith("//")) result.imageUrl = "https:" + result.imageUrl;
    }

    return result;
  }

  // --- Firebase HTTP 헬퍼 ---

  function gmFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: options.method || "GET",
        url,
        headers: options.headers || {},
        data: options.body || null,
        responseType: "json",
        onload(res) {
          resolve({ status: res.status, json: () => Promise.resolve(res.response) });
        },
        onerror() {
          reject(new Error("Network error"));
        },
      });
    });
  }

  // --- 인증 ---

  let currentUser = GM_getValue("authUser", null);

  function saveAuth(user) {
    currentUser = user;
    GM_setValue("authUser", user);
  }

  function clearAuth() {
    currentUser = null;
    GM_deleteValue("authUser");
  }

  async function refreshIdToken() {
    if (!currentUser?.refreshToken) return false;
    try {
      const res = await gmFetch(
        `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grant_type: "refresh_token", refresh_token: currentUser.refreshToken }),
        }
      );
      const data = await res.json();
      if (data.id_token) {
        currentUser.idToken = data.id_token;
        currentUser.refreshToken = data.refresh_token;
        saveAuth(currentUser);
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  // --- 중복 체크 ---

  async function checkDuplicate(sourceUrl) {
    if (!sourceUrl || !currentUser) return false;
    const queryUrl = `${FIRESTORE_URL}:runQuery`;
    const body = {
      structuredQuery: {
        from: [{ collectionId: "images" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              { fieldFilter: { field: { fieldPath: "sourceUrl" }, op: "EQUAL", value: { stringValue: sourceUrl } } },
              { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: currentUser.localId } } },
            ],
          },
        },
        limit: 1,
      },
    };
    try {
      const res = await gmFetch(queryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.idToken}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      return Array.isArray(data) && data.length > 0 && data[0].document;
    } catch (e) {
      return false;
    }
  }

  // --- 월 추측 ---

  function guessMonth(releaseDateStr, fallback) {
    if (!releaseDateStr) return fallback;
    const qMatch = releaseDateStr.match(/(\d{4})\s*년?\s*(\d)\s*분기/);
    if (qMatch) {
      const quarterToMonth = { 1: 1, 2: 4, 3: 7, 4: 10 };
      const m = quarterToMonth[parseInt(qMatch[2])] || 1;
      return `${qMatch[1]}-${String(m).padStart(2, "0")}`;
    }
    const match = releaseDateStr.match(/(\d{4})[年년\-\/]\s*(\d{1,2})/);
    if (match) return `${match[1]}-${String(parseInt(match[2])).padStart(2, "0")}`;
    return fallback;
  }

  // --- UI ---

  let extractedData = null;

  const fab = document.createElement("button");
  fab.id = "figcal-fab";
  fab.title = "피규어 캘린더";
  fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
  document.body.appendChild(fab);

  const panel = document.createElement("div");
  panel.id = "figcal-panel";

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let monthOptions = "";
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
    for (let m = 1; m <= 12; m++) {
      const val = `${y}-${String(m).padStart(2, "0")}`;
      const sel = val === defaultMonth ? " selected" : "";
      monthOptions += `<option value="${val}"${sel}>${val}</option>`;
    }
  }
  monthOptions += `<option value="미정">미정</option>`;

  panel.innerHTML = `
    <div class="figcal-inner">
      <!-- 로그인 섹션 -->
      <div id="figcal-login" style="display:none;">
        <h2>피규어 캘린더</h2>

        <div class="figcal-login-prompt">
          <p>사이트에서 로그인하면 자동으로 연동됩니다<br>(Google 로그인 포함)</p>
          <a href="https://figure-calendar.vercel.app/" target="_blank">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            피규어 캘린더에서 로그인
          </a>
        </div>

        <div class="figcal-divider"><span>또는 직접 로그인</span></div>

        <form class="figcal-login-form" id="figcal-login-form">
          <input type="email" id="figcal-email" placeholder="이메일" required />
          <input type="password" id="figcal-password" placeholder="비밀번호" required />
          <button type="submit" class="figcal-btn figcal-btn-secondary figcal-btn-full">이메일로 로그인</button>
        </form>
        <div id="figcal-login-error" class="figcal-status figcal-status-error"></div>
      </div>

      <!-- 메인 섹션 -->
      <div id="figcal-main" style="display:none;">
        <div class="figcal-user-bar">
          <span class="figcal-user-email" id="figcal-user-email"></span>
          <div class="figcal-user-bar-actions">
            <a href="https://figure-calendar.vercel.app/" target="_blank" class="figcal-site-link" title="사이트로 이동">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <button class="figcal-btn figcal-btn-danger" id="figcal-logout">로그아웃</button>
          </div>
        </div>

        <div class="figcal-preview" id="figcal-preview">
          <div class="figcal-preview-image" id="figcal-img-container">
            <img id="figcal-img" src="" alt="" />
          </div>

          <div class="figcal-field">
            <label>상품명</label>
            <input type="text" id="figcal-name" />
          </div>
          <div class="figcal-fields-row">
            <div class="figcal-field">
              <label>전체금액</label>
              <input type="text" id="figcal-price" />
            </div>
            <div class="figcal-field">
              <label>예약금</label>
              <input type="text" id="figcal-deposit" />
            </div>
          </div>
          <div class="figcal-fields-row">
            <div class="figcal-field">
              <label>잔금</label>
              <input type="text" id="figcal-remaining" />
            </div>
            <div class="figcal-field">
              <label>발매일</label>
              <input type="text" id="figcal-releaseDate" />
            </div>
          </div>
          <div class="figcal-fields-row">
            <div class="figcal-field">
              <label>제조사</label>
              <input type="text" id="figcal-manufacturer" />
            </div>
            <div class="figcal-field">
              <label>구매처</label>
              <input type="text" id="figcal-purchasePlace" />
            </div>
          </div>
          <div class="figcal-fields-row">
            <div class="figcal-field">
              <label>연월 (배정)</label>
              <select id="figcal-month">${monthOptions}</select>
            </div>
            <div class="figcal-field">
              <label>이미지 URL</label>
              <input type="url" id="figcal-imageUrl" />
            </div>
          </div>
          <button class="figcal-btn figcal-btn-primary figcal-btn-full" id="figcal-save" style="margin-top:12px;">찜 목록에 저장</button>
        </div>

        <div id="figcal-status" class="figcal-status"></div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // --- DOM 참조 ---
  const $login = panel.querySelector("#figcal-login");
  const $main = panel.querySelector("#figcal-main");
  const $loginForm = panel.querySelector("#figcal-login-form");
  const $loginError = panel.querySelector("#figcal-login-error");
  const $userEmail = panel.querySelector("#figcal-user-email");
  const $logoutBtn = panel.querySelector("#figcal-logout");
  const $preview = panel.querySelector("#figcal-preview");
  const $imgContainer = panel.querySelector("#figcal-img-container");
  const $img = panel.querySelector("#figcal-img");
  const $saveBtn = panel.querySelector("#figcal-save");
  const $status = panel.querySelector("#figcal-status");

  const $name = panel.querySelector("#figcal-name");
  const $price = panel.querySelector("#figcal-price");
  const $deposit = panel.querySelector("#figcal-deposit");
  const $remaining = panel.querySelector("#figcal-remaining");
  const $releaseDate = panel.querySelector("#figcal-releaseDate");
  const $manufacturer = panel.querySelector("#figcal-manufacturer");
  const $purchasePlace = panel.querySelector("#figcal-purchasePlace");
  const $month = panel.querySelector("#figcal-month");
  const $imageUrl = panel.querySelector("#figcal-imageUrl");

  // --- UI 로직 ---

  function showLogin() {
    $login.style.display = "block";
    $main.style.display = "none";
  }

  function showMain() {
    $login.style.display = "none";
    $main.style.display = "block";
    $userEmail.textContent = currentUser.email;
  }

  function showStatus(msg, type) {
    $status.textContent = msg;
    $status.className = "figcal-status " + (type === "error" ? "figcal-status-error" : "figcal-status-success");
    $status.style.display = "block";
    setTimeout(() => { $status.style.display = "none"; }, 5000);
  }

  // 추출 실행
  function doExtract() {
    $status.style.display = "none";
    try {
      const data = extractProductData();
      extractedData = data;

      $name.value = data.name || "";
      $price.value = data.price || "";
      $deposit.value = data.deposit || "";
      $remaining.value = data.remaining || "";
      $releaseDate.value = data.releaseDate || "";
      $manufacturer.value = data.manufacturer || "";
      $purchasePlace.value = data.purchasePlace || "";
      $imageUrl.value = data.imageUrl || "";
      $month.value = guessMonth(data.releaseDate, defaultMonth);

      if (data.imageUrl) {
        $img.src = data.imageUrl;
        $imgContainer.style.display = "block";
      } else {
        $imgContainer.style.display = "none";
      }

      $preview.classList.add("open");
    } catch (err) {
      $preview.classList.remove("open");
      showStatus("추출 실패: " + err.message, "error");
    }
  }

  // FAB 토글
  fab.addEventListener("click", () => {
    // 인증 상태 재확인
    const latest = GM_getValue("authUser", null);
    if (latest && (!currentUser || currentUser.localId !== latest.localId)) {
      currentUser = latest;
      showMain();
    } else if (!latest && currentUser) {
      currentUser = null;
      showLogin();
    }

    const isOpening = !panel.classList.contains("open");
    panel.classList.toggle("open");

    // 패널 열릴 때 로그인 상태면 바로 추출
    if (isOpening && currentUser) {
      doExtract();
    }
  });

  // 패널 외부 클릭 닫기
  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && e.target !== fab && !fab.contains(e.target)) {
      panel.classList.remove("open");
    }
  });

  // 이메일 로그인 (fallback)
  $loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    $loginError.style.display = "none";
    const email = panel.querySelector("#figcal-email").value;
    const password = panel.querySelector("#figcal-password").value;

    try {
      const res = await gmFetch(AUTH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      saveAuth({
        idToken: data.idToken,
        localId: data.localId,
        email: data.email,
        refreshToken: data.refreshToken,
      });
      showMain();
    } catch (err) {
      $loginError.textContent = "로그인 실패: " + err.message;
      $loginError.style.display = "block";
    }
  });

  // 로그아웃
  $logoutBtn.addEventListener("click", () => {
    clearAuth();
    $preview.classList.remove("open");
    showLogin();
  });

  // 저장
  $saveBtn.addEventListener("click", async () => {
    if (!currentUser) return;

    $saveBtn.disabled = true;
    $saveBtn.textContent = "저장 중...";

    const srcUrl = extractedData ? extractedData.sourceUrl : "";
    if (srcUrl) {
      const isDup = await checkDuplicate(srcUrl);
      if (isDup) {
        showStatus("이미 저장된 상품입니다.", "error");
        $saveBtn.disabled = false;
        $saveBtn.textContent = "찜 목록에 저장";
        return;
      }
    }

    const fields = {
      src: { stringValue: $imageUrl.value },
      month: { stringValue: $month.value },
      date: { stringValue: new Date().toISOString() },
      description: { stringValue: $name.value },
      uid: { stringValue: currentUser.localId },
      status: { stringValue: "꼴림" },
      teamStatus: { stringValue: $purchasePlace.value || "코아" },
      purchaseStatus: { stringValue: "찜" },
      manufacturer: { stringValue: $manufacturer.value },
      releaseDate: { stringValue: $releaseDate.value },
      sourceUrl: { stringValue: srcUrl },
      source: { stringValue: "tampermonkey" },
      type: { stringValue: (extractedData && extractedData.type) || "PVC" },
      size: { stringValue: (extractedData && extractedData.size) || "" },
      price: { stringValue: $price.value || "" },
      deposit: { stringValue: $deposit.value || "" },
      remaining: { stringValue: $remaining.value || "" },
      expectedCustoms: { stringValue: "" },
      storagePath: { nullValue: null },
    };

    try {
      let res = await gmFetch(`${FIRESTORE_URL}/images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentUser.idToken}`,
        },
        body: JSON.stringify({ fields }),
      });

      if (res.status === 401) {
        const refreshed = await refreshIdToken();
        if (refreshed) {
          res = await gmFetch(`${FIRESTORE_URL}/images`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${currentUser.idToken}`,
            },
            body: JSON.stringify({ fields }),
          });
        }
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      showStatus("저장되었습니다!", "success");
      $preview.classList.remove("open");
    } catch (err) {
      showStatus("저장 실패: " + err.message, "error");
    }

    $saveBtn.disabled = false;
    $saveBtn.textContent = "찜 목록에 저장";
  });

  // --- 초기화 ---
  if (currentUser) {
    showMain();
  } else {
    showLogin();
  }

  // ============================================================
  //  아카라이브: 네비게이션 바 피규어 캘린더 버튼 + 모달
  // ============================================================
  if (location.hostname.includes("arca.live")) {
    GM_addStyle(`
      #figcal-modal-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.65);
        z-index: 10000;
        display: none;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
      }
      #figcal-modal-backdrop.open { display: flex; }
      #figcal-modal {
        width: 95vw;
        height: 92vh;
        max-width: 1440px;
        background: #1a1a2e;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 24px 80px rgba(0,0,0,0.4);
        display: flex;
        flex-direction: column;
      }
      #figcal-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        background: #16213e;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        flex-shrink: 0;
      }
      #figcal-modal-title {
        font-size: 14px;
        font-weight: 600;
        color: #e2e8f0;
        margin: 0;
      }
      #figcal-modal-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #figcal-modal-newtab,
      #figcal-modal-close {
        width: 32px; height: 32px;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: #94a3b8;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 150ms;
        text-decoration: none;
      }
      #figcal-modal-newtab:hover,
      #figcal-modal-close:hover {
        background: rgba(255,255,255,0.1);
        color: #fff;
      }
      #figcal-modal iframe {
        flex: 1;
        width: 100%;
        border: none;
        background: #0a0a0a;
      }
      @media (max-width: 768px) {
        #figcal-modal {
          width: 100vw;
          height: 100vh;
          max-width: none;
          border-radius: 0;
        }
      }
    `);

    // 리프레셔 버튼 찾기
    let refresherWrapper = null;
    document.querySelectorAll(".navbar-nav > div > li > a.nav-link, .navbar-nav > li > a.nav-link").forEach((link) => {
      if (link.textContent.includes("리프레셔")) {
        refresherWrapper = link.closest("div") || link.closest("li");
      }
    });

    if (refresherWrapper && refresherWrapper.parentNode) {
      // 네비게이션 버튼 삽입
      const navWrapper = document.createElement("div");
      navWrapper.innerHTML = `<li class="nav-item dropdown"><a class="nav-link" href="#" id="figcal-nav-btn" style="cursor:pointer"><span class="d-inline">피규어 캘린더</span></a></li>`;
      refresherWrapper.parentNode.insertBefore(navWrapper, refresherWrapper.nextSibling);

      // 모달 생성
      const backdrop = document.createElement("div");
      backdrop.id = "figcal-modal-backdrop";
      backdrop.innerHTML = `
        <div id="figcal-modal">
          <div id="figcal-modal-header">
            <span id="figcal-modal-title">피규어 캘린더</span>
            <div id="figcal-modal-actions">
              <a id="figcal-modal-newtab" href="https://figure-calendar.vercel.app/" target="_blank" title="새 탭에서 열기">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
              <button id="figcal-modal-close" title="닫기">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <iframe id="figcal-iframe" src="about:blank" allow="clipboard-write"></iframe>
        </div>
      `;
      document.body.appendChild(backdrop);

      function openModal() {
        backdrop.classList.add("open");
        const iframe = document.getElementById("figcal-iframe");
        if (iframe.src === "about:blank") {
          iframe.src = "https://figure-calendar.vercel.app/";
        }
        document.body.style.overflow = "hidden";
      }

      function closeModal() {
        backdrop.classList.remove("open");
        document.body.style.overflow = "";
      }

      document.getElementById("figcal-nav-btn").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      });

      document.getElementById("figcal-modal-close").addEventListener("click", closeModal);

      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeModal();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && backdrop.classList.contains("open")) closeModal();
      });
    }
  }
})();
