const cheerio = require("cheerio");

// 제목에서 발매일 추출 + 제목 정리: "(26년3분기)상품명" → { name: "상품명", releaseDate: "2026년 3분기" }
function extractDateFromName(name) {
  if (!name) return { name, releaseDate: "" };
  const match = name.match(/^[(\[【\s]*(\d{2,4})\s*년\s*(\d{1,2})\s*(월|분기)[)\]】\s]*/);
  if (!match) return { name, releaseDate: "" };
  let year = match[1];
  if (year.length === 2) {
    year = (Number(year) >= 90 ? "19" : "20") + year;
  }
  const releaseDate = `${year}년 ${match[2]}${match[3]}`;
  const cleanName = name.slice(match[0].length).trim();
  return { name: cleanName || name, releaseDate };
}

function parseNaverSmartStore(html, url) {
  const $ = cheerio.load(html);
  const result = {
    name: "",
    price: "",
    deposit: "",
    remaining: "",
    imageUrl: "",
    manufacturer: "",
    releaseDate: "",
    purchasePlace: "네이버",
    sourceUrl: url,
    size: "",
    type: "",
  };

  // Strategy 1: __NEXT_DATA__ (Next.js based pages)
  const nextDataScript = $("script#__NEXT_DATA__").html();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const product =
        nextData.props?.pageProps?.product ||
        nextData.props?.pageProps?.initialState?.product?.A ||
        nextData.props?.pageProps?.initialState?.product?.a ||
        null;
      if (product) {
        result.name = product.name || product.productName || "";
        result.price = String(
          product.discountedSalePrice || product.salePrice || product.price || ""
        );
        if (product.representImage) {
          result.imageUrl = product.representImage.url || "";
        } else if (product.productImages && product.productImages.length > 0) {
          result.imageUrl = product.productImages[0].url || "";
        }
        result.manufacturer = product.maker || product.brand || "";
      }
    } catch (e) {
      // ignore
    }
  }

  // Strategy 2: __PRELOADED_STATE__ JSON
  if (!result.name) {
    const scripts = $("script").toArray();
    for (const script of scripts) {
      const text = $(script).html() || "";
      const match = text.match(/window\.__PRELOADED_STATE__\s*=\s*({.+})/);
      if (match) {
        try {
          const state = JSON.parse(match[1]);
          const product =
            state.product?.A ||
            state.product?.a ||
            state.product ||
            {};
          result.name = product.name || product.productName || "";
          result.price = String(
            product.salePrice ||
            product.discountedSalePrice ||
            product.price ||
            ""
          );
          if (product.representImage) {
            result.imageUrl = product.representImage.url || "";
          } else if (product.productImages && product.productImages.length > 0) {
            result.imageUrl = product.productImages[0].url || "";
          }
          result.manufacturer = product.maker || product.brand || "";
          break;
        } catch (e) {
          // ignore
        }
      }
    }
  }

  // Strategy 3: JSON-LD Product
  if (!result.name) {
    const ldScripts = $('script[type="application/ld+json"]');
    ldScripts.each((_, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json["@type"] === "Product") {
          result.name = json.name || "";
          if (json.offers) {
            const offers = Array.isArray(json.offers) ? json.offers : [json.offers];
            if (offers.length > 0) {
              result.price = String(offers[0].price || offers[0].lowPrice || "");
            }
          }
          if (json.image) {
            result.imageUrl = Array.isArray(json.image) ? json.image[0] : json.image;
          }
        }
      } catch (e) {
        // ignore
      }
    });
  }

  // Strategy 4: OG meta tags
  if (!result.name) {
    result.name = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
  }
  if (!result.imageUrl) {
    result.imageUrl = $('meta[property="og:image"]').attr("content") || "";
  }
  if (!result.price) {
    result.price = $('meta[property="product:price:amount"]').attr("content") || "";
  }

  // 본문 텍스트에서 상세 정보 추출
  const bodyText = $("body").text();

  // --- 제작사/제조사 ---
  if (!result.manufacturer) {
    const mfgPatterns = [
      /제작사\s*[:：]\s*([^\n\r,]+)/,
      /제조사\s*[:：]\s*([^\n\r,]+)/,
      /메이커\s*[:：]\s*([^\n\r,]+)/,
      /원형제작\s*[:：]\s*([^\n\r,]+)/,
    ];
    for (const p of mfgPatterns) {
      const m = bodyText.match(p);
      if (m) { result.manufacturer = m[1].trim(); break; }
    }
  }

  // --- 스케일 ---
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
    ];
    for (const p of typePatterns) {
      const m = bodyText.match(p);
      if (m) { result.type = m[1].trim(); break; }
    }
  }

  // --- 발매일/예정일 ---
  const releaseDatePatterns = [
    /예정일\s*[:：]\s*(\d{4}\s*년?\s*\d{1,2}\s*(?:월|분기))/,
    /예정일\s*[:：]\s*(\d{2}\s*년\s*\d{1,2}\s*(?:월|분기))/,
    /발매\s*[:：]?\s*(\d{4}[년\-]\s*\d{1,2}\s*(?:월|분기)?)/,
    /발매일\s*[:：]?\s*(\d{4}[년\-]\s*\d{1,2}\s*(?:월|분기)?)/,
    /발매\s*예정\s*[:：]?\s*(\d{4}[년\-]\s*\d{1,2}\s*(?:월|분기)?)/,
    /(\d{4}年\d{1,2}月)/,
    /(\d{4}\s*년\s*\d{1,2}\s*(?:월|분기))\s*발송/,
    /예정일\s*[:：]\s*(\d{4}\s*년?\s*\d{1,2}\s*월?\s*\d{1,2}\s*일?)/,
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

  // 제목에서 발매일 추출 (본문에서 못 찾은 경우)
  if (!result.releaseDate && result.name) {
    const extracted = extractDateFromName(result.name);
    if (extracted.releaseDate) {
      result.releaseDate = extracted.releaseDate;
      result.name = extracted.name;
    }
  }

  return result;
}

module.exports = { parseNaverSmartStore };
