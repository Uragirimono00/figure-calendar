// content/content.js - 상품 페이지에서 데이터 추출

const STORE_NAMES = ["코믹스아트", "comicsart", "매니아하우스", "maniahouse", "히어로타임", "herotime", "래빗츠", "rabbits"];
function isStoreName(value) {
  const norm = value.toLowerCase().replace(/[\s\-_()（）]+/g, "");
  return STORE_NAMES.some((s) => norm.includes(s));
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractProduct") {
    extractProductData().then((data) => sendResponse(data));
    return true; // keep channel open for async response
  }
});

// Read a window variable from the page context (content scripts can't access window JS directly)
function readPageVariable(code) {
  return new Promise((resolve) => {
    const eventName = "__figcal_" + Date.now();
    const script = document.createElement("script");
    script.textContent = `
      document.dispatchEvent(new CustomEvent("${eventName}", {
        detail: JSON.stringify((function(){ try { return ${code}; } catch(e) { return null; } })())
      }));
    `;
    const handler = (e) => {
      try { resolve(JSON.parse(e.detail)); } catch { resolve(null); }
    };
    document.addEventListener(eventName, handler, { once: true });
    document.documentElement.appendChild(script);
    script.remove();
    // Timeout fallback
    setTimeout(() => resolve(null), 500);
  });
}

async function extractProductData() {
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

  // Try JSON-LD Product
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

          // Fallback: if no named total found, use highest price
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
    } catch (e) {
      // ignore
    }
  }

  // Auto-calculate remaining if deposit exists but remaining doesn't
  if (result.deposit && !result.remaining && result.price) {
    const total = Number(result.price);
    const dep = Number(result.deposit);
    if (total > dep) {
      result.remaining = String(total - dep);
    }
  }

  // Naver SmartStore
  if (hostname.includes("smartstore.naver.com")) {
    // Strategy 1: Read __NEXT_DATA__ from DOM (Next.js)
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

    // Strategy 2: Inject into page context to read window variables
    if (!result.name) {
      const pageProduct = await readPageVariable(`
        (window.__PRELOADED_STATE__?.product?.A) ||
        (window.__PRELOADED_STATE__?.product?.a) ||
        (window.__PRELOADED_STATE__?.product) ||
        (window.__NEXT_DATA__?.props?.pageProps?.product) ||
        null
      `);
      if (pageProduct) {
        result.name = pageProduct.name || pageProduct.productName || result.name;
        result.price = String(pageProduct.discountedSalePrice || pageProduct.salePrice || pageProduct.price || result.price);
        if (pageProduct.representImage) result.imageUrl = pageProduct.representImage.url || result.imageUrl;
        result.manufacturer = pageProduct.maker || pageProduct.brand || result.manufacturer;
      }
    }

    // Strategy 3: Script tag regex fallback
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

  // Determine purchase place from hostname
  if (hostname.includes("comics-art")) {
    result.purchasePlace = "코아";
  } else if (hostname.includes("maniahouse")) {
    result.purchasePlace = "매하";
  } else if (hostname.includes("herotime")) {
    result.purchasePlace = "히어로타임";
  } else if (hostname.includes("rabbits")) {
    result.purchasePlace = "래빗츠";
  }

  // Fallback: OG meta tags
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

  // --- HTML 테이블/구조에서 상품 스펙 추출 (Cafe24 th/td, dl/dt/dd) ---
  const isCafe24 = hostname.includes("comics-art") || hostname.includes("maniahouse") || hostname.includes("herotime") || hostname.includes("rabbits");
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

  // --- 제작사/제조사 (쇼핑몰 이름 필터링) ---
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

  // --- 스케일/사이즈 ---
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

  // --- 재질 ---
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

  // --- 발매일/예정일/입고 ---
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

  // 제목에서 발매일 추출: "(26년3분기)상품명" → releaseDate + 정리된 상품명
  if (!result.releaseDate && result.name) {
    const titleMatch = result.name.match(/^[(\[【\s]*(\d{2,4})\s*년\s*(\d{1,2})\s*(월|분기)[)\]】\s]*/);
    if (titleMatch) {
      let year = titleMatch[1];
      if (year.length === 2) {
        year = (Number(year) >= 90 ? "19" : "20") + year;
      }
      result.releaseDate = `${year}년 ${titleMatch[2]}${titleMatch[3]}`;
      const cleanName = result.name.slice(titleMatch[0].length).trim();
      if (cleanName) result.name = cleanName;
    }
  }

  // Fix double-protocol image URLs (e.g. "https:https://...")
  if (result.imageUrl) {
    result.imageUrl = result.imageUrl.replace(/^https?:https?:\/\//, "https://");
    if (result.imageUrl.startsWith("//")) {
      result.imageUrl = "https:" + result.imageUrl;
    }
  }

  return result;
}
