const cheerio = require("cheerio");

// 쇼핑몰 이름 필터 (제조사에서 제외)
const STORE_NAMES = ["코믹스아트", "comicsart", "매니아하우스", "maniahouse"];

function isStoreName(value) {
  const norm = value.toLowerCase().replace(/[\s\-_()（）]+/g, "");
  return STORE_NAMES.some((s) => norm.includes(s));
}

function parseCafe24(html, url) {
  const $ = cheerio.load(html);
  const result = {
    name: "",
    price: "",        // 전체금액 (판매가)
    deposit: "",      // 예약금
    remaining: "",    // 잔금 (전체금액 - 예약금)
    imageUrl: "",
    manufacturer: "",
    releaseDate: "",
    purchasePlace: "",
    sourceUrl: url,
    size: "",
    type: "",
  };

  // JSON-LD Product data
  const ldScripts = $('script[type="application/ld+json"]');
  ldScripts.each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      const product = json["@type"] === "Product" ? json : null;
      if (product) {
        result.name = product.name || "";
        if (product.image) {
          result.imageUrl = Array.isArray(product.image)
            ? product.image[0]
            : product.image;
        }

        // offers 배열에서 결제 옵션별 금액 추출
        if (product.offers) {
          const offers = Array.isArray(product.offers)
            ? product.offers
            : [product.offers];

          for (const offer of offers) {
            const name = (offer.name || "").toLowerCase();
            const price = String(offer.price || "").replace(/,/g, "");

            if (name.includes("전체결제") || name.includes("전액결제")) {
              result.price = price;
            } else if (name.includes("잔금")) {
              result.remaining = price;
            } else if (name.includes("예약금") || name.includes("1차결제") || name.includes("계약금")) {
              result.deposit = price;
            }
          }

          // 전체금액을 못 찾았으면 가장 높은 금액을 전체금액으로
          if (!result.price) {
            let maxPrice = 0;
            for (const offer of offers) {
              const p = Number(String(offer.price || "0").replace(/,/g, ""));
              if (p > maxPrice) maxPrice = p;
            }
            if (maxPrice > 0) result.price = String(maxPrice);
          }
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  });

  // Fallback: OG tags
  if (!result.name) {
    result.name = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
  }
  if (!result.imageUrl) {
    result.imageUrl = $('meta[property="og:image"]').attr("content") || "";
  }

  // 이미지 URL 정리: "https:https://..." 이중 프로토콜 수정
  if (result.imageUrl) {
    result.imageUrl = result.imageUrl.replace(/^https?:https?:\/\//, "https://");
    if (result.imageUrl.startsWith("//")) {
      result.imageUrl = "https:" + result.imageUrl;
    }
  }

  // 잔금 자동 계산 (예약금은 있지만 잔금이 없는 경우)
  if (result.deposit && !result.remaining && result.price) {
    const total = Number(result.price);
    const dep = Number(result.deposit);
    if (total > dep) {
      result.remaining = String(total - dep);
    }
  }

  // --- HTML 테이블/구조에서 상품 정보 추출 (상품 스펙 영역) ---
  // Cafe24 상품 스펙은 보통 th/td 또는 dt/dd 구조
  const specMap = {};
  $("table tr").each((_, tr) => {
    const th = $(tr).find("th").first().text().trim();
    const td = $(tr).find("td").first().text().trim();
    if (th && td) {
      specMap[th.replace(/\s+/g, "")] = td;
    }
  });
  // dt/dd 구조도 체크
  $("dl").each((_, dl) => {
    $(dl).find("dt").each((i, dt) => {
      const label = $(dt).text().trim();
      const dd = $(dt).next("dd");
      if (dd.length) {
        specMap[label.replace(/\s+/g, "")] = dd.text().trim();
      }
    });
  });

  // 스펙 테이블에서 정보 추출
  for (const [key, value] of Object.entries(specMap)) {
    const k = key.toLowerCase();
    // 제조사 (쇼핑몰 이름 제외)
    if (!result.manufacturer && (k.includes("제조사") || k.includes("메이커") || k.includes("브랜드"))) {
      if (!isStoreName(value)) {
        result.manufacturer = value;
      }
    }
    // 스케일/사이즈
    if (!result.size && (k.includes("스케일") || k.includes("사이즈") || k.includes("크기") || k.includes("전고") || k.includes("높이"))) {
      result.size = value;
    }
    // 재질
    if (!result.type && (k.includes("재질") || k.includes("소재") || k.includes("재료"))) {
      result.type = value;
    }
    // 발매일
    if (!result.releaseDate && (k.includes("발매") || k.includes("예정일") || k.includes("발송"))) {
      result.releaseDate = value;
    }
  }

  // --- 본문 텍스트에서 추가 정보 추출 (스펙 테이블에서 못 찾은 경우) ---
  const bodyText = $("body").text();

  // 제조사: 모든 매칭을 찾아서 쇼핑몰 이름이 아닌 첫 번째 값 사용
  if (!result.manufacturer) {
    const mfgPatterns = [
      /제조사\s*[:：]\s*([^\n\r,]+)/g,
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

  // 스케일/사이즈
  if (!result.size) {
    const sizePatterns = [
      /스케일\s*[:：]\s*([^\n\r,]+)/,
      /사이즈\s*[:：]\s*([^\n\r,]+)/,
      /크기\s*[:：]\s*([^\n\r,]+)/,
      /전고\s*[:：]\s*([^\n\r,]+)/,
      /높이\s*[:：]\s*([^\n\r,]+)/,
    ];
    for (const p of sizePatterns) {
      const m = bodyText.match(p);
      if (m) { result.size = m[1].trim(); break; }
    }
  }

  // 재질
  if (!result.type) {
    const typePatterns = [
      /재질\s*[:：]\s*([^\n\r,]+)/,
      /소재\s*[:：]\s*([^\n\r,]+)/,
    ];
    for (const p of typePatterns) {
      const m = bodyText.match(p);
      if (m) { result.type = m[1].trim(); break; }
    }
  }

  // --- 발매일 추출 ---
  if (!result.releaseDate) {
    const releaseDatePatterns = [
      /발매\s*[:：]?\s*(\d{4}[년\-]\s*\d{1,2}\s*월?)/,
      /발매일\s*[:：]?\s*(\d{4}[년\-]\s*\d{1,2}\s*월?)/,
      /발매\s*예정\s*[:：]?\s*(\d{4}[년\-]\s*\d{1,2}\s*월?)/,
      /(\d{4}年\d{1,2}月)/,
      /(\d{4}\s*년\s*\d{1,2}\s*월)\s*발송/,
      /발매\s*(?:월\s*)?[:：]?\s*(\d{2}년\s*\d{1,2}\s*월?)/,
      /발매일\s*[:：]?\s*(\d{2}년\s*\d{1,2}\s*월?)/,
      /발매\s*예정\s*[:：]?\s*(\d{2}년\s*\d{1,2}\s*월?)/,
      /(\d{2}\s*년\s*\d{1,2}\s*월)\s*발송/,
    ];
    for (const pattern of releaseDatePatterns) {
      const match = bodyText.match(pattern);
      if (match) {
        result.releaseDate = match[1].trim();
        break;
      }
    }
  }

  // 발매일 2자리 연도 → 4자리 변환
  if (result.releaseDate) {
    const shortYearMatch = result.releaseDate.match(/^(\d{2})(년)/);
    if (shortYearMatch) {
      const fullYear = Number(shortYearMatch[1]) >= 90 ? "19" + shortYearMatch[1] : "20" + shortYearMatch[1];
      result.releaseDate = fullYear + result.releaseDate.substring(2);
    }
  }

  // --- 구매처 결정 ---
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("comics-art")) {
      result.purchasePlace = "코아";
    } else if (hostname.includes("maniahouse")) {
      result.purchasePlace = "매하";
    }
  } catch (e) {
    // ignore
  }

  return result;
}

module.exports = { parseCafe24 };
