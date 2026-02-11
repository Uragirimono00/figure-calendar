// ==UserScript==
// @name         arca.live 작성자 정보
// @namespace    arca-user-info
// @version      1.0
// @description  arca.live 게시글 작성자의 채널 내 활동 정보를 표시합니다.
// @match        *://arca.live/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Uragirimono00/figure-calendar/master/arca-user-info.user.js
// @downloadURL  https://raw.githubusercontent.com/Uragirimono00/figure-calendar/master/arca-user-info.user.js
// ==/UserScript==

(function () {
  "use strict";

  // ===================== STORAGE ABSTRACTION =====================

  const store = {
    get(key, defaultVal) {
      return GM_getValue(key, defaultVal);
    },
    set(key, val) {
      GM_setValue(key, val);
    },
    remove(key) {
      GM_deleteValue(key);
    },
    keys() {
      return GM_listValues();
    },
    getAll() {
      const result = {};
      for (const k of GM_listValues()) {
        result[k] = GM_getValue(k);
      }
      return result;
    },
    removeByPrefix(prefix) {
      for (const k of GM_listValues()) {
        if (k.startsWith(prefix)) GM_deleteValue(k);
      }
    },
  };

  // ===================== CONSTANTS & DEFAULTS =====================

  const DEFAULTS = {
    default: { months: 3, threshold: 5 },
    buy: { months: 6, threshold: 10 },
    sell: { months: 6, threshold: 10 },
    fetchDelay: 30,
  };
  const MAX_CONCURRENT = 1;
  let FETCH_DELAY = 30000;
  const REFRESH_COOLDOWN = 12 * 60 * 60 * 1000;
  const RATE_LIMIT_PAUSE = 5 * 60 * 1000;
  const DEOPAN_POLL_INTERVAL = 5 * 60 * 1000;
  const BADGE_ATTR = "data-arca-user-badge";

  let settings = DEFAULTS;
  let rateLimitedUntil = 0;

  // ===================== CSS INJECTION =====================

  GM_addStyle(`
    .arca-user-badge {
      display: inline-block;
      margin-left: 4px;
      padding: 1px 5px;
      font-size: 11px;
      line-height: 1.4;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.08);
      color: #aaa;
      vertical-align: middle;
      white-space: nowrap;
      font-weight: normal;
    }
    .arca-user-badge a { text-decoration: none; }
    .arca-user-badge a:hover { text-decoration: underline; }
    .arca-badge-red { color: #ff6b6b; }
    .arca-badge-yellow { color: #ffd43b; }
    .arca-badge-default { color: #adb5bd; }
    .arca-badge-green { color: #51cf66; }
    .arca-warn-row {
      background: rgba(255, 107, 107, 0.12) !important;
      border-left: 3px solid #ff6b6b !important;
    }
    .arca-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 12px 20px;
      background: rgba(30, 30, 50, 0.95);
      color: #ff6b6b;
      font-size: 13px;
      border-radius: 8px;
      border: 1px solid #ff6b6b33;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      z-index: 999999;
      opacity: 0;
      transform: translateY(20px);
      transition: opacity 0.3s, transform 0.3s;
      pointer-events: none;
    }
    .arca-toast.show { opacity: 1; transform: translateY(0); }
    #arca-captcha-backdrop {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.6); z-index: 999999;
    }

    /* ===== 설정 패널 ===== */
    #aui-toggle-btn {
      position: fixed;
      bottom: 70px;
      left: 16px;
      z-index: 99998;
      width: 36px; height: 36px;
      border-radius: 50%;
      border: 1px solid #333;
      background: #1a1a2e;
      color: #aaa;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transition: background 0.2s, color 0.2s;
    }
    #aui-toggle-btn:hover { background: #16213e; color: #fff; }

    #aui-panel {
      position: fixed;
      top: 0; left: 0; bottom: 0;
      width: 320px;
      z-index: 99999;
      background: #1a1a2e;
      color: #e0e0e0;
      font-family: -apple-system, "Malgun Gothic", sans-serif;
      font-size: 13px;
      box-shadow: 4px 0 24px rgba(0,0,0,0.5);
      transform: translateX(-100%);
      transition: transform 0.25s ease;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #aui-panel.open { transform: translateX(0); }
    #aui-panel-backdrop {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 99998; background: rgba(0,0,0,0.3);
      display: none;
    }
    #aui-panel-backdrop.open { display: block; }

    #aui-panel-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; border-bottom: 1px solid #333; flex-shrink: 0;
    }
    #aui-panel-header h3 { font-size: 14px; color: #fff; margin: 0; }
    #aui-panel-close {
      background: none; border: none; color: #888; cursor: pointer;
      font-size: 18px; padding: 4px;
    }
    #aui-panel-close:hover { color: #fff; }

    #aui-panel-body {
      flex: 1; overflow-y: auto; padding: 12px 16px;
    }
    #aui-panel-body::-webkit-scrollbar { width: 4px; }
    #aui-panel-body::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

    .aui-section {
      margin-bottom: 12px; padding: 10px;
      background: #16213e; border-radius: 6px;
    }
    .aui-section-title {
      font-size: 12px; font-weight: bold; color: #aaa; margin-bottom: 8px;
    }
    .aui-row {
      display: flex; gap: 8px; align-items: center;
    }
    .aui-row + .aui-row { margin-top: 6px; }
    .aui-row label {
      font-size: 11px; color: #888; width: 55px; flex-shrink: 0;
    }
    #aui-panel select, #aui-panel input[type="text"] {
      flex: 1; padding: 4px 6px; border: 1px solid #333; border-radius: 4px;
      background: #1a1a2e; color: #e0e0e0; font-size: 12px;
    }
    #aui-panel input[type="text"]::placeholder { color: #555; }

    #aui-panel button {
      width: 100%; padding: 8px; border: none; border-radius: 4px;
      background: #e94560; color: #fff; font-size: 12px; cursor: pointer;
    }
    #aui-panel button:hover { background: #c73e54; }
    .aui-btn-apply { background: #0f3460 !important; margin-top: 8px; }
    .aui-btn-apply:hover { background: #1a4a8a !important; }

    .aui-cache-info {
      margin: 10px 0 8px; font-size: 11px; color: #888;
    }
    .aui-btn-group { display: flex; gap: 6px; }
    .aui-btn-group button { flex: 1; }

    .aui-list-controls {
      display: flex; gap: 6px; margin-bottom: 8px;
    }
    .aui-list-controls input { flex: 1; min-width: 0; }
    .aui-list-controls select { width: auto; flex-shrink: 0; }

    .aui-user-list {
      max-height: 300px; overflow-y: auto; border-top: 1px solid #333;
    }
    .aui-user-list::-webkit-scrollbar { width: 4px; }
    .aui-user-list::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
    .aui-user-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 5px 0; border-bottom: 1px solid #222; font-size: 11px;
    }
    .aui-user-row .aui-name {
      color: #ccc; flex: 1; overflow: hidden;
      text-overflow: ellipsis; white-space: nowrap; margin-right: 6px;
    }
    .aui-user-row .aui-channel { color: #666; font-size: 9px; }
    .aui-user-row .aui-meta { text-align: right; white-space: nowrap; font-size: 10px; }
    .aui-user-row .aui-posts { font-weight: bold; }
    .aui-posts-red { color: #ff6b6b; }
    .aui-posts-green { color: #51cf66; }
    .aui-user-row .aui-time { color: #666; }
    .aui-recheck-tag {
      color: #ff6b6b; font-size: 9px; font-weight: bold;
      border: 1px solid #ff6b6b44; border-radius: 3px; padding: 0 3px; margin-left: 4px;
    }
    .aui-recheck-date { color: #666; font-size: 9px; margin-left: 4px; }
    .aui-btn-refetch {
      background: none !important; border: 1px solid #555 !important;
      color: #aaa !important; font-size: 9px !important;
      padding: 1px 5px !important; border-radius: 3px !important;
      cursor: pointer; width: auto !important; flex-shrink: 0; margin-left: 4px;
    }
    .aui-btn-refetch:hover {
      border-color: #e94560 !important; color: #e94560 !important;
      background: none !important;
    }
    .aui-btn-refetch.loading { color: #555 !important; pointer-events: none; }

    .aui-rate-limit-banner {
      background: rgba(233, 69, 96, 0.15); border: 1px solid #e9456044;
      border-radius: 6px; padding: 8px 10px; margin-bottom: 10px;
      font-size: 12px; color: #ff6b6b; text-align: center; display: none;
    }
    .aui-btn-resume {
      width: auto !important; margin-top: 6px;
      padding: 4px 10px !important; font-size: 11px !important;
    }
  `);

  // ===================== TOAST =====================

  function showToast(msg, duration = 5000) {
    let toast = document.querySelector(".arca-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "arca-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    requestAnimationFrame(() => {
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), duration);
    });
  }

  // ===================== CHANNEL / CATEGORY =====================

  function getChannel() {
    const m = location.pathname.match(/^\/b\/([^\/]+)/);
    return m ? m[1] : null;
  }

  const CHANNEL = getChannel();
  if (!CHANNEL) {
    initPanel(); // 패널은 전체 arca.live에서 접근 가능
    return;
  }

  function getCurrentCategory() {
    const cat = new URLSearchParams(location.search).get("category") || "";
    if (cat === "buy") return "buy";
    if (cat === "sell") return "sell";
    return "default";
  }

  function isDeopan() {
    const cat = new URLSearchParams(location.search).get("category") || "";
    return cat.includes("더판");
  }

  function getCatSettings(cat) {
    return settings[cat || getCurrentCategory()] || settings.default;
  }

  // ===================== ANONYMOUS CHECK =====================

  function isAnonymous(username) {
    return username.startsWith("*") || username.includes("#");
  }

  // ===================== RATE-LIMITED FETCH QUEUE =====================

  let activeCount = 0;
  const queue = [];

  function enqueue(fn) {
    return new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      processQueue();
    });
  }

  function processQueue() {
    if (activeCount >= MAX_CONCURRENT || queue.length === 0) return;

    const now = Date.now();
    if (now < rateLimitedUntil) {
      setTimeout(processQueue, rateLimitedUntil - now + 1000);
      return;
    }

    activeCount++;

    const lastFetchAt = store.get("lastFetchAt", 0);
    if (lastFetchAt) {
      const elapsed = Date.now() - lastFetchAt;
      if (elapsed < FETCH_DELAY) {
        activeCount--;
        setTimeout(processQueue, FETCH_DELAY - elapsed + 100);
        return;
      }
    }

    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve)
      .catch((err) => {
        if (err.message === "HTTP 429") {
          rateLimitedUntil = Date.now() + RATE_LIMIT_PAUSE;
          const mins = RATE_LIMIT_PAUSE / 60000;
          console.warn(`[arca-user-info] 429 감지, ${mins}분간 정지`);
          showToast(`\u26a0 요청 제한 감지 \u2014 ${mins}분간 수집 정지`);
          store.set("rateLimitedUntil", rateLimitedUntil);
        } else if (err.message === "CAPTCHA timeout") {
          rateLimitedUntil = Date.now() + 60000;
          showToast("\u26a0 캡챠 미해결 \u2014 1분 후 재시도", 5000);
          store.set("rateLimitedUntil", rateLimitedUntil);
        }
        throw err;
      })
      .catch(reject)
      .finally(() => {
        store.set("lastFetchAt", Date.now());
        setTimeout(() => {
          activeCount--;
          processQueue();
        }, getRandomDelay());
      });
  }

  // ===================== CAPTCHA DETECTION =====================

  function isCaptchaPage(html) {
    if (html.includes("list-table")) return false;
    return (
      html.includes("cf_chl_opt") ||
      html.includes("cdn-cgi/challenge-platform") ||
      html.includes("cf-turnstile") ||
      html.includes('id="challenge-form"') ||
      html.includes('class="g-recaptcha"') ||
      html.includes('class="h-captcha"')
    );
  }

  function showCaptchaOverlay(iframe) {
    iframe.style.cssText = [
      "position:fixed", "top:50%", "left:50%",
      "transform:translate(-50%,-50%)", "width:480px", "height:580px",
      "z-index:1000000", "border:2px solid #e94560", "border-radius:12px",
      "box-shadow:0 4px 40px rgba(0,0,0,0.7)", "background:#fff",
    ].join(";");

    if (!document.getElementById("arca-captcha-backdrop")) {
      const bd = document.createElement("div");
      bd.id = "arca-captcha-backdrop";
      document.body.appendChild(bd);
    }
  }

  function hideCaptchaOverlay(iframe) {
    iframe.style.cssText =
      "display:none;width:0;height:0;border:0;position:fixed;left:-9999px;";
    document.getElementById("arca-captcha-backdrop")?.remove();
  }

  // ===================== IFRAME-BASED FETCH =====================

  let iframeBusy = false;

  function browserFetch(url) {
    if (iframeBusy) {
      return new Promise((resolve, reject) => {
        const wait = () => {
          if (!iframeBusy) {
            browserFetch(url).then(resolve).catch(reject);
          } else {
            setTimeout(wait, 500);
          }
        };
        setTimeout(wait, 500);
      });
    }
    iframeBusy = true;
    return new Promise((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.sandbox = "allow-same-origin allow-forms allow-scripts";
      iframe.style.cssText =
        "display:none;width:0;height:0;border:0;position:fixed;left:-9999px;";

      let captchaMode = false;
      let captchaResolved = false;
      let timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout"));
      }, 20000);

      function cleanup() {
        clearTimeout(timeoutId);
        hideCaptchaOverlay(iframe);
        if (iframe.parentNode) iframe.remove();
        iframeBusy = false;
      }

      iframe.onload = () => {
        try {
          if (iframe.contentWindow?.location?.href === "about:blank") return;

          const doc = iframe.contentDocument;
          if (!doc) {
            cleanup();
            reject(new Error("Access denied"));
            return;
          }

          const html = doc.documentElement.outerHTML;

          if (isCaptchaPage(html)) {
            if (!captchaMode) {
              captchaMode = true;
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error("CAPTCHA timeout"));
              }, 5 * 60 * 1000);
              showCaptchaOverlay(iframe);
              showToast("\u26a0 캡챠가 감지되었습니다. 캡챠를 풀어주세요.", 30000);
            }
            return;
          }

          if (captchaMode && !captchaResolved) {
            captchaResolved = true;
            hideCaptchaOverlay(iframe);
            showToast("캡챠 해결! 다시 수집합니다.", 3000);
            iframe.style.cssText =
              "display:none;width:0;height:0;border:0;position:fixed;left:-9999px;";
            iframe.src = url;
            return;
          }

          cleanup();

          if (!html.includes("list-table")) {
            const title = doc.title || "";
            if (
              html.includes("rate_limit") ||
              title.includes("429") ||
              (title.includes("오류") && html.includes("429"))
            ) {
              reject(new Error("HTTP 429"));
              return;
            }
          }

          resolve(html);
        } catch (e) {
          cleanup();
          reject(e);
        }
      };

      iframe.onerror = () => {
        cleanup();
        reject(new Error("Load failed"));
      };

      iframe.src = url;
      document.body.appendChild(iframe);
    });
  }

  // ===================== RANDOM DELAY =====================

  function getRandomDelay() {
    const jitter = 0.5 + Math.random();
    return Math.round(FETCH_DELAY * jitter);
  }

  // ===================== CACHE =====================

  function getCached(key) {
    return store.get(key, null);
  }

  function setCache(key, data) {
    store.set(key, { ...data, fetchedAt: Date.now() });
  }

  // ===================== DATE PARSING =====================

  function getCutoffDate(months) {
    if (!months) return null;
    const d = new Date();
    d.setMonth(d.getMonth() - months);
    return d;
  }

  function parseRowDate(row) {
    const timeEl = row.querySelector("time[datetime]");
    if (timeEl) return new Date(timeEl.getAttribute("datetime"));

    const colTime = row.querySelector(".col-time");
    if (!colTime) return null;

    const text = colTime.textContent.trim();

    let m = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    m = text.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
    if (m) return new Date(new Date().getFullYear(), +m[1] - 1, +m[2]);

    if (text.includes("전") || /^\d{1,2}:\d{2}$/.test(text)) return new Date();

    return null;
  }

  // ===================== SEARCH & PARSE =====================

  async function fetchSearchPage(keyword, months) {
    const url = `/b/${CHANNEL}?target=nickname&keyword=${encodeURIComponent(keyword)}`;
    const html = await browserFetch(url);
    return parseSearchResults(html, months, keyword);
  }

  function parseSearchResults(html, months, exactNickname) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cutoff = getCutoffDate(months);

    const allRows = doc.querySelectorAll(".list-table .vrow");
    let count = 0;
    let stoppedByDate = false;
    const dates = [];

    for (const row of allRows) {
      if (
        row.classList.contains("notice") ||
        row.classList.contains("head") ||
        row.classList.contains("vrow-head")
      )
        continue;

      const rowDate = parseRowDate(row);

      if (cutoff) {
        if (rowDate && rowDate < cutoff) {
          stoppedByDate = true;
          break;
        }
      }

      if (exactNickname) {
        const filterEl = row.querySelector(".user-info [data-filter]");
        const author = filterEl ? filterEl.getAttribute("data-filter") : null;
        if (author !== exactNickname) continue;
      }

      count++;
      if (rowDate) dates.push(rowDate.getTime());
    }

    const hasMore =
      !stoppedByDate &&
      !!doc.querySelector(
        ".pagination .page-item:not(.active):not(.disabled) a"
      );

    return { count, hasMore, dates };
  }

  // ===================== USER INFO FETCH =====================

  function shouldRefresh(cached, threshold) {
    if (!cached || cached.posts == null) return true;
    if (cached.posts <= threshold) {
      return Date.now() - (cached.fetchedAt || 0) > REFRESH_COOLDOWN;
    }
    if (cached.recheckAt && Date.now() >= cached.recheckAt) return true;
    return false;
  }

  function calcRecheckAt(count, threshold, months, dates) {
    if (!months || count <= threshold || dates.length === 0) return null;

    const sorted = [...dates].sort((a, b) => a - b);
    const postsToLose = count - threshold;

    if (postsToLose > sorted.length) return null;

    const criticalDate = new Date(sorted[postsToLose - 1]);
    criticalDate.setMonth(criticalDate.getMonth() + months);
    return criticalDate.getTime();
  }

  async function fetchUserInfo(username, months, threshold) {
    const cacheKey = `cache:${CHANNEL}:${months}m:${username}`;
    const cached = getCached(cacheKey);
    if (cached && !shouldRefresh(cached, threshold)) return cached;

    const r = await enqueue(() => fetchSearchPage(username, months));
    let recheckAt;
    if (r.hasMore) {
      const halfPeriodMs = months
        ? Math.max(months * 15 * 24 * 3600 * 1000, 14 * 24 * 3600 * 1000)
        : 30 * 24 * 3600 * 1000;
      recheckAt = Date.now() + halfPeriodMs;
    } else {
      recheckAt = calcRecheckAt(r.count, threshold, months, r.dates);
    }
    const data = { posts: r.count, postsMore: r.hasMore, recheckAt };

    setCache(cacheKey, data);
    const txt = r.hasMore ? `${r.count}+` : `${r.count}`;
    showToast(`수집 완료: ${username} (글 ${txt}개)`, 3000);
    return data;
  }

  // ===================== BADGE =====================

  function getColorClass(count, threshold) {
    return count <= threshold ? "arca-badge-red" : "arca-badge-green";
  }

  function createBadge(username, data, threshold) {
    const badge = document.createElement("span");
    badge.className = "arca-user-badge";
    badge.setAttribute(BADGE_ATTR, "");

    const enc = encodeURIComponent(username);
    const cls = getColorClass(data.posts, threshold);
    const txt = data.postsMore ? `${data.posts}+` : `${data.posts}`;

    badge.innerHTML = `<a href="/b/${CHANNEL}?target=nickname&keyword=${enc}" class="${cls}" target="_blank" title="작성글 검색">글 ${txt}</a>`;
    return badge;
  }

  function insertBadge(el, username, data, threshold) {
    if (el.parentElement?.querySelector(`[${BADGE_ATTR}]`)) return;
    if (el.querySelector(`[${BADGE_ATTR}]`)) return;
    el.after(createBadge(username, data, threshold));

    const cat = getCurrentCategory();
    const deopan = isDeopan();
    if ((deopan || cat === "buy" || cat === "sell") && data.posts <= threshold) {
      const row = el.closest(".vrow");
      if (row && !row.classList.contains("arca-warn-row")) {
        row.classList.add("arca-warn-row");
        const label = deopan ? "더판" : cat === "buy" ? "구매" : "판매";
        showToast(
          `\u26a0 ${label} 기준 미달: ${username} (글 ${data.posts}개)`,
          7000
        );
      }
    }
  }

  function refreshBadgesFor(username, data) {
    const cs = getCatSettings();
    document.querySelectorAll("[data-filter]").forEach((el) => {
      if (el.getAttribute("data-filter") !== username) return;
      const userInfo = el.closest(".user-info");
      if (!userInfo) return;
      const oldBadge =
        userInfo.parentElement?.querySelector(`[${BADGE_ATTR}]`);
      if (oldBadge) oldBadge.remove();
      userInfo.dataset.arcaProcessed = "";
      insertBadge(userInfo, username, data, cs.threshold);
    });
  }

  // ===================== PAGE PROCESSING =====================

  function findUserElements() {
    return document.querySelectorAll(
      [
        ".vcol.col-author .user-info",
        ".article-head .member-info .user-info",
        ".comment-item .user-info",
      ].join(", ")
    );
  }

  function extractUsername(el) {
    const filterEl = el.querySelector("[data-filter]");
    return filterEl ? filterEl.getAttribute("data-filter") : null;
  }

  async function processPage() {
    const cs = getCatSettings();
    const elements = findUserElements();
    const tasks = new Map();

    elements.forEach((el) => {
      if (el.dataset.arcaProcessed) return;
      el.dataset.arcaProcessed = "1";

      const username = extractUsername(el);
      if (!username || isAnonymous(username)) return;

      if (!tasks.has(username)) tasks.set(username, []);
      tasks.get(username).push(el);
    });

    for (const [username, els] of tasks) {
      const cacheKey = `cache:${CHANNEL}:${cs.months}m:${username}`;
      const cached = getCached(cacheKey);
      if (cached) {
        els.forEach((el) => insertBadge(el, username, cached, cs.threshold));
        if (!shouldRefresh(cached, cs.threshold)) tasks.delete(username);
      }
    }

    for (const [username, els] of tasks) {
      fetchUserInfo(username, cs.months, cs.threshold)
        .then((data) =>
          els.forEach((el) => insertBadge(el, username, data, cs.threshold))
        )
        .catch((err) => console.warn(`[arca-user-info] ${username}:`, err));
    }
  }

  // ===================== 더판 MONITORING =====================

  function parseDeopanArticles(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const articles = [];
    for (const row of doc.querySelectorAll(".list-table .vrow")) {
      if (
        row.classList.contains("notice") ||
        row.classList.contains("head") ||
        row.classList.contains("vrow-head")
      )
        continue;

      const href = row.getAttribute("href") || "";
      const idMatch = href.match(/\/(\d+)/);
      if (!idMatch) continue;

      const filterEl = row.querySelector(".user-info [data-filter]");
      if (!filterEl) continue;
      const username = filterEl.getAttribute("data-filter");
      if (!username || isAnonymous(username)) continue;

      articles.push({ id: idMatch[1], username });
    }
    return articles;
  }

  async function pollDeopan() {
    if (Date.now() < rateLimitedUntil) return;

    const cs = getCatSettings("default");

    try {
      const url = `/b/${CHANNEL}?category=${encodeURIComponent("\ud83d\udd1e더판")}`;
      const html = await enqueue(() => browserFetch(url));

      const articles = parseDeopanArticles(html);
      const storeKey = `deopan:${CHANNEL}:seen`;
      const stored = store.get(storeKey, null);
      const seenIds = new Set(stored?.ids || []);
      const isFirstRun = seenIds.size === 0;

      store.set(storeKey, { ids: articles.map((a) => a.id) });

      if (isFirstRun) return;

      const newArticles = articles.filter((a) => !seenIds.has(a.id));
      if (newArticles.length === 0) return;

      const flagged = [];
      const uncached = [];

      for (const article of newArticles) {
        const cacheKey = `cache:${CHANNEL}:${cs.months}m:${article.username}`;
        const cached = getCached(cacheKey);
        if (cached && cached.posts != null) {
          if (cached.posts <= cs.threshold) {
            flagged.push(`${article.username}(글 ${cached.posts})`);
          }
        } else {
          uncached.push(article);
        }
      }

      if (flagged.length > 0) {
        showToast(
          `\ud83d\udea8 더판 기준 미달 신규글: ${flagged.join(", ")}`,
          10000
        );
      }

      for (const article of uncached) {
        fetchUserInfo(article.username, cs.months, cs.threshold)
          .then((data) => {
            if (data.posts <= cs.threshold) {
              showToast(
                `\ud83d\udea8 더판 기준 미달 신규글: ${article.username}(글 ${data.posts})`,
                10000
              );
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      console.warn("[arca-user-info] 더판 모니터링 오류:", err);
    }
  }

  // ===================== SPA NAVIGATION =====================

  let scanTimeout = null;

  function scheduleScan() {
    if (scanTimeout) return;
    scanTimeout = setTimeout(() => {
      scanTimeout = null;
      if (isChannelAllowed(settings)) processPage();
    }, 500);
  }

  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList" && m.addedNodes.length > 0) {
        scheduleScan();
        break;
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  // ===================== SETTINGS PANEL =====================

  function initPanel() {
    // 토글 버튼
    const toggleBtn = document.createElement("button");
    toggleBtn.id = "aui-toggle-btn";
    toggleBtn.title = "작성자 정보 설정";
    toggleBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
    document.body.appendChild(toggleBtn);

    // 백드롭
    const backdrop = document.createElement("div");
    backdrop.id = "aui-panel-backdrop";
    document.body.appendChild(backdrop);

    // 패널
    const panel = document.createElement("div");
    panel.id = "aui-panel";
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);

    // 이벤트
    toggleBtn.addEventListener("click", () => {
      panel.classList.toggle("open");
      backdrop.classList.toggle("open");
      if (panel.classList.contains("open")) updatePanelCacheInfo();
    });
    backdrop.addEventListener("click", () => {
      panel.classList.remove("open");
      backdrop.classList.remove("open");
    });
    panel.querySelector("#aui-panel-close").addEventListener("click", () => {
      panel.classList.remove("open");
      backdrop.classList.remove("open");
    });

    // 설정 로드
    loadPanelSettings();

    // 이벤트 바인딩
    panel.querySelector("#aui-fetchDelay").addEventListener("change", saveLightSettings);
    panel.querySelector("#aui-channels").addEventListener("change", saveLightSettings);
    panel.querySelector("#aui-applySettings").addEventListener("click", applyCategorySettings);
    panel.querySelector("#aui-clearCache").addEventListener("click", clearCacheAction);
    panel.querySelector("#aui-forceResume").addEventListener("click", forceResumeAction);
    panel.querySelector("#aui-exportData").addEventListener("click", exportDataAction);
    panel.querySelector("#aui-importData").addEventListener("click", () =>
      panel.querySelector("#aui-importFile").click()
    );
    panel.querySelector("#aui-importFile").addEventListener("change", importDataAction);
    panel.querySelector("#aui-searchInput").addEventListener("input", updatePanelCacheInfo);
    panel.querySelector("#aui-filterSelect").addEventListener("change", updatePanelCacheInfo);

    // Tampermonkey 메뉴 커맨드
    GM_registerMenuCommand("설정 열기", () => {
      panel.classList.add("open");
      backdrop.classList.add("open");
      updatePanelCacheInfo();
    });

    // 제한 배너 업데이트
    setInterval(updateRateLimitBanner, 1000);
  }

  function buildPanelHTML() {
    return `
      <div id="aui-panel-header">
        <h3>작성자 정보 설정</h3>
        <button id="aui-panel-close">\u2715</button>
      </div>
      <div id="aui-panel-body">

        <div class="aui-section">
          <div class="aui-section-title">활성 채널</div>
          <div class="aui-row">
            <input type="text" id="aui-channels" placeholder="bishoujofigure, anime ...">
          </div>
          <div style="font-size:10px;color:#666;margin-top:4px;">쉼표로 구분. 비우면 전체 채널에서 동작</div>
        </div>

        <div class="aui-section">
          <div class="aui-section-title">기본</div>
          <div class="aui-row">
            <label>조회 기간</label>
            <select id="aui-default-months">
              <option value="1">1개월</option>
              <option value="2">2개월</option>
              <option value="3">3개월</option>
              <option value="6">6개월</option>
              <option value="12">1년</option>
              <option value="0">전체</option>
            </select>
          </div>
          <div class="aui-row">
            <label>기준 글 수</label>
            <select id="aui-default-threshold">
              <option value="3">3개 이하</option>
              <option value="5">5개 이하</option>
              <option value="10">10개 이하</option>
              <option value="20">20개 이하</option>
            </select>
          </div>
        </div>

        <div class="aui-section">
          <div class="aui-section-title">구매글 (category=buy)</div>
          <div class="aui-row">
            <label>조회 기간</label>
            <select id="aui-buy-months">
              <option value="1">1개월</option>
              <option value="2">2개월</option>
              <option value="3">3개월</option>
              <option value="6">6개월</option>
              <option value="12">1년</option>
              <option value="0">전체</option>
            </select>
          </div>
          <div class="aui-row">
            <label>기준 글 수</label>
            <select id="aui-buy-threshold">
              <option value="3">3개 이하</option>
              <option value="5">5개 이하</option>
              <option value="10">10개 이하</option>
              <option value="20">20개 이하</option>
            </select>
          </div>
        </div>

        <div class="aui-section">
          <div class="aui-section-title">판매글 (category=sell)</div>
          <div class="aui-row">
            <label>조회 기간</label>
            <select id="aui-sell-months">
              <option value="1">1개월</option>
              <option value="2">2개월</option>
              <option value="3">3개월</option>
              <option value="6">6개월</option>
              <option value="12">1년</option>
              <option value="0">전체</option>
            </select>
          </div>
          <div class="aui-row">
            <label>기준 글 수</label>
            <select id="aui-sell-threshold">
              <option value="3">3개 이하</option>
              <option value="5">5개 이하</option>
              <option value="10">10개 이하</option>
              <option value="20">20개 이하</option>
            </select>
          </div>
        </div>

        <button id="aui-applySettings" class="aui-btn-apply">조회 설정 적용</button>

        <div class="aui-section">
          <div class="aui-section-title">수집 간격</div>
          <div class="aui-row">
            <label>대기 시간</label>
            <select id="aui-fetchDelay">
              <option value="5">5초</option>
              <option value="10">10초</option>
              <option value="15">15초</option>
              <option value="20">20초</option>
              <option value="30">30초</option>
              <option value="45">45초</option>
              <option value="60">60초</option>
            </select>
          </div>
        </div>

        <div class="aui-rate-limit-banner" id="aui-rateLimitBanner">
          <span id="aui-rateLimitText"></span>
          <button id="aui-forceResume" class="aui-btn-resume">제한 해제 &amp; 재수집</button>
        </div>

        <div class="aui-cache-info" id="aui-cacheInfo">저장된 유저: 0명</div>
        <div class="aui-list-controls">
          <input type="text" id="aui-searchInput" placeholder="닉네임 검색">
          <select id="aui-filterSelect">
            <option value="all">전체</option>
            <option value="red">기준 미달</option>
            <option value="green">기준 초과</option>
            <option value="recheck">재조회 대상</option>
          </select>
        </div>
        <div class="aui-user-list" id="aui-userList"></div>

        <div class="aui-section" style="margin-top:12px;">
          <div class="aui-section-title">데이터 관리</div>
          <div class="aui-btn-group">
            <button id="aui-exportData">내보내기</button>
            <button id="aui-importData">가져오기</button>
          </div>
          <input type="file" id="aui-importFile" accept=".json" style="display:none;">
          <button id="aui-clearCache" style="margin-top:6px;">캐시 초기화</button>
        </div>

      </div>
    `;
  }

  const CATS = ["default", "buy", "sell"];

  function loadPanelSettings() {
    const s = store.get("settings", DEFAULTS);
    for (const cat of CATS) {
      const c = s[cat] || DEFAULTS[cat];
      const mEl = document.getElementById(`aui-${cat}-months`);
      const tEl = document.getElementById(`aui-${cat}-threshold`);
      if (mEl) mEl.value = c.months;
      if (tEl) tEl.value = c.threshold;
    }
    const fdEl = document.getElementById("aui-fetchDelay");
    if (fdEl) fdEl.value = s.fetchDelay || 30;
    const chEl = document.getElementById("aui-channels");
    if (chEl) chEl.value = (s.channels || []).join(", ");
  }

  function saveLightSettings() {
    const s = store.get("settings", DEFAULTS);
    s.fetchDelay = parseInt(document.getElementById("aui-fetchDelay").value);
    s.channels = document.getElementById("aui-channels").value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    store.set("settings", s);
    settings = s;
    FETCH_DELAY = (s.fetchDelay || 30) * 1000;
  }

  function applyCategorySettings() {
    if (!confirm("조회 설정을 변경하면 기존 캐시가 삭제됩니다.\n적용하시겠습니까?"))
      return;

    const s = {};
    for (const cat of CATS) {
      s[cat] = {
        months: parseInt(document.getElementById(`aui-${cat}-months`).value),
        threshold: parseInt(document.getElementById(`aui-${cat}-threshold`).value),
      };
    }
    s.fetchDelay = parseInt(document.getElementById("aui-fetchDelay").value);
    s.channels = document.getElementById("aui-channels").value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    store.set("settings", s);
    settings = s;
    FETCH_DELAY = (s.fetchDelay || 30) * 1000;

    store.removeByPrefix("cache:");
    updatePanelCacheInfo();
  }

  function clearCacheAction() {
    if (!confirm("캐시를 초기화하시겠습니까?")) return;
    store.removeByPrefix("cache:");
    updatePanelCacheInfo();
  }

  function forceResumeAction() {
    rateLimitedUntil = 0;
    store.remove("rateLimitedUntil");
    updateRateLimitBanner();
    if (CHANNEL && isChannelAllowed(settings)) processPage();
  }

  function exportDataAction() {
    const all = store.getAll();
    delete all.rateLimitedUntil;
    delete all.lastFetchAt;

    const blob = new Blob([JSON.stringify(all, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `arca-user-info-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importDataAction(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("현재 데이터를 덮어씁니다.\n가져오시겠습니까?")) {
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (typeof data !== "object" || data === null) {
          alert("올바르지 않은 파일입니다.");
          return;
        }

        // 기존 데이터 전부 삭제 후 가져오기
        for (const k of store.keys()) {
          store.remove(k);
        }
        for (const [k, v] of Object.entries(data)) {
          store.set(k, v);
        }

        settings = data.settings || DEFAULTS;
        FETCH_DELAY = (settings.fetchDelay || 30) * 1000;
        loadPanelSettings();
        updatePanelCacheInfo();
      } catch (err) {
        alert("파일 읽기 실패: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function updateRateLimitBanner() {
    const banner = document.getElementById("aui-rateLimitBanner");
    if (!banner) return;

    const rlUntil = store.get("rateLimitedUntil", 0);
    if (!rlUntil || Date.now() >= rlUntil) {
      banner.style.display = "none";
      return;
    }
    const remaining = Math.ceil((rlUntil - Date.now()) / 1000);
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    banner.style.display = "block";
    document.getElementById("aui-rateLimitText").textContent =
      `\u26a0 요청 제한 중 \u2014 ${min}분 ${sec.toString().padStart(2, "0")}초 남음`;
  }

  function panelTimeAgo(ts) {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return `${sec}초 전`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}분 전`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}시간 전`;
    const day = Math.floor(hr / 24);
    return `${day}일 전`;
  }

  function panelFormatDate(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function updatePanelCacheInfo() {
    const curSettings = store.get("settings", DEFAULTS);
    const defThreshold = (curSettings.default || DEFAULTS.default).threshold;

    const entries = [];
    for (const key of store.keys()) {
      if (!key.startsWith("cache:")) continue;
      const val = store.get(key);
      const parts = key.split(":");
      const channel = parts[1] || "";
      const period = parts[2] || "";
      const username = parts.slice(3).join(":");
      entries.push({ channel, period, username, ...val });
    }

    entries.sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0));

    const queryEl = document.getElementById("aui-searchInput");
    const filterEl = document.getElementById("aui-filterSelect");
    const query = (queryEl?.value || "").trim().toLowerCase();
    const filter = filterEl?.value || "all";

    const filtered = entries.filter((e) => {
      if (query && !e.username.toLowerCase().includes(query)) return false;
      if (filter === "red") return e.posts != null && e.posts <= defThreshold;
      if (filter === "green") return e.posts != null && e.posts > defThreshold;
      if (filter === "recheck")
        return e.recheckAt && Date.now() >= e.recheckAt;
      return true;
    });

    const infoEl = document.getElementById("aui-cacheInfo");
    if (infoEl) {
      infoEl.textContent =
        `저장된 유저: ${entries.length}명` +
        (filtered.length !== entries.length
          ? ` (${filtered.length}명 표시)`
          : "");
    }

    const list = document.getElementById("aui-userList");
    if (!list) return;
    list.innerHTML = "";

    for (const e of filtered) {
      const row = document.createElement("div");
      row.className = "aui-user-row";
      const posts = e.posts != null ? e.posts : "?";
      const postsText = e.postsMore ? `${posts}+` : `${posts}`;
      const cls =
        e.posts != null && e.posts <= defThreshold
          ? "aui-posts-red"
          : "aui-posts-green";
      const ago = e.fetchedAt ? panelTimeAgo(e.fetchedAt) : "-";
      const needsRecheck = e.recheckAt && Date.now() >= e.recheckAt;
      const recheckTag = needsRecheck
        ? ` <span class="aui-recheck-tag">재조회</span>`
        : e.recheckAt
          ? ` <span class="aui-recheck-date">${panelFormatDate(e.recheckAt)}</span>`
          : "";

      row.innerHTML =
        `<span class="aui-name" title="${e.username}">${e.username} <span class="aui-channel">${e.channel} ${e.period}</span></span>` +
        `<span class="aui-meta"><span class="aui-posts ${cls}">글 ${postsText}</span>${recheckTag} \u00b7 <span class="aui-time">${ago}</span></span>`;

      const btn = document.createElement("button");
      btn.className = "aui-btn-refetch";
      btn.textContent = "조회";
      btn.addEventListener("click", () =>
        refetchUser(e.channel, e.period, e.username, btn)
      );
      row.appendChild(btn);

      list.appendChild(row);
    }
  }

  async function refetchUser(channel, period, username, btn) {
    btn.classList.add("loading");
    btn.textContent = "...";

    const cacheKey = `cache:${channel}:${period}:${username}`;
    store.remove(cacheKey);

    if (CHANNEL && CHANNEL === channel) {
      try {
        const cs = getCatSettings();
        const data = await fetchUserInfo(username, cs.months, cs.threshold);
        refreshBadgesFor(username, data);
      } catch (_) {}
    }

    await updatePanelCacheInfo();
  }

  // ===================== INITIALIZATION =====================

  function migrateSettings(stored) {
    if (stored && stored.months != null && !stored.default) {
      return {
        default: {
          months: stored.months,
          threshold: stored.refreshThreshold || 5,
        },
        buy: { months: 6, threshold: 10 },
        sell: { months: 6, threshold: 10 },
      };
    }
    return stored;
  }

  function migrateCacheRecheckAt() {
    for (const key of store.keys()) {
      if (!key.startsWith("cache:")) continue;
      const val = store.get(key);
      if (val.recheckAt != null) continue;
      if (!val.postsMore) continue;

      const parts = key.split(":");
      const periodStr = parts[2] || "";
      const months = parseInt(periodStr) || 0;
      const halfPeriodMs = months
        ? Math.max(months * 15 * 24 * 3600 * 1000, 14 * 24 * 3600 * 1000)
        : 30 * 24 * 3600 * 1000;

      store.set(key, {
        ...val,
        recheckAt: (val.fetchedAt || Date.now()) + halfPeriodMs,
      });
    }
  }

  function isChannelAllowed(s) {
    const channels = s.channels || [];
    return channels.length === 0 || channels.includes(CHANNEL);
  }

  function init() {
    const storedRL = store.get("rateLimitedUntil", 0);
    if (storedRL && Date.now() < storedRL) {
      rateLimitedUntil = storedRL;
    } else if (storedRL) {
      store.remove("rateLimitedUntil");
    }

    let stored = store.get("settings", null);
    if (stored) {
      stored = migrateSettings(stored);
      store.set("settings", stored);
    }
    settings = stored || DEFAULTS;
    FETCH_DELAY = (settings.fetchDelay || 30) * 1000;

    migrateCacheRecheckAt();

    // 패널은 항상 초기화
    initPanel();

    if (!isChannelAllowed(settings)) return;

    processPage();

    pollDeopan();
    setInterval(pollDeopan, DEOPAN_POLL_INTERVAL);
  }

  init();
})();
