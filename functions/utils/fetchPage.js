const fetch = require("node-fetch");

const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const MOBILE_UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": DESKTOP_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    timeout: 15000,
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

async function fetchNaverSmartStore(url) {
  // Strategy 1: Mobile page with referer
  const mobileUrl = url.replace("://smartstore.naver.com", "://m.smartstore.naver.com");
  const mobileHeaders = {
    "User-Agent": MOBILE_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9",
    "Referer": "https://search.naver.com/",
  };

  try {
    const res = await fetch(mobileUrl, { headers: mobileHeaders, timeout: 15000 });
    if (res.ok) return res.text();
  } catch (e) {
    // fall through
  }

  // Strategy 2: Desktop with referer
  const desktopHeaders = {
    "User-Agent": DESKTOP_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": "https://search.naver.com/",
  };

  const res = await fetch(url, { headers: desktopHeaders, timeout: 15000 });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }
  return res.text();
}

module.exports = { fetchPage, fetchNaverSmartStore };
