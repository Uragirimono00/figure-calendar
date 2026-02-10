const functions = require("firebase-functions");
const { fetchPage, fetchNaverSmartStore } = require("./utils/fetchPage");
const { parseCafe24 } = require("./parsers/cafe24");
const { parseNaverSmartStore } = require("./parsers/naverSmartStore");
const { parseGeneric } = require("./parsers/generic");

exports.scrapeProduct = functions.region("asia-northeast3").https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "로그인이 필요합니다.");
  }

  const url = data.url;
  if (!url || typeof url !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "URL이 필요합니다.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    throw new functions.https.HttpsError("invalid-argument", "유효한 URL이 아닙니다.");
  }

  try {
    const hostname = parsedUrl.hostname.toLowerCase();

    let result;
    if (hostname.includes("comics-art") || hostname.includes("maniahouse")) {
      const html = await fetchPage(url);
      result = parseCafe24(html, url);
    } else if (hostname.includes("smartstore.naver.com")) {
      const html = await fetchNaverSmartStore(url);
      result = parseNaverSmartStore(html, url);
    } else {
      const html = await fetchPage(url);
      result = parseGeneric(html, url);
    }

    return result;
  } catch (error) {
    throw new functions.https.HttpsError("internal", `스크래핑 실패: ${error.message}`);
  }
});
