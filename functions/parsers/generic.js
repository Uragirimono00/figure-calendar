const cheerio = require("cheerio");

function parseGeneric(html, url) {
  const $ = cheerio.load(html);
  const result = {
    name: "",
    price: "",
    imageUrl: "",
    manufacturer: "",
    releaseDate: "",
    purchasePlace: "",
    sourceUrl: url,
  };

  // Try JSON-LD Product
  const ldScripts = $('script[type="application/ld+json"]');
  ldScripts.each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      if (json["@type"] === "Product") {
        result.name = json.name || "";
        if (json.offers) {
          const offers = Array.isArray(json.offers) ? json.offers[0] : json.offers;
          result.price = offers.price || offers.lowPrice || "";
        }
        if (json.image) {
          result.imageUrl = Array.isArray(json.image) ? json.image[0] : json.image;
        }
        if (json.brand) {
          result.manufacturer = typeof json.brand === "string" ? json.brand : json.brand.name || "";
        }
      }
    } catch (e) {
      // ignore
    }
  });

  // Fallback: OG meta tags
  if (!result.name) {
    result.name = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
  }
  if (!result.imageUrl) {
    result.imageUrl = $('meta[property="og:image"]').attr("content") || "";
  }
  if (!result.price) {
    result.price = $('meta[property="product:price:amount"]').attr("content") || "";
  }

  // Try hostname for purchase place
  try {
    const hostname = new URL(url).hostname;
    result.purchasePlace = hostname.replace("www.", "");
  } catch (e) {
    // ignore
  }

  return result;
}

module.exports = { parseGeneric };
