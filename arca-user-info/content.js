(function () {
  "use strict";

  const DEFAULTS = { fetchTarget: "posts", months: 3 };
  const MAX_CONCURRENT = 1;
  const FETCH_DELAY = 30000; // 30초 간격
  const BADGE_ATTR = "data-arca-user-badge";

  let settings = DEFAULTS;

  // --- 채널 추출 ---

  function getChannel() {
    const m = location.pathname.match(/^\/b\/([^\/]+)/);
    return m ? m[1] : null;
  }

  const CHANNEL = getChannel();
  if (!CHANNEL) return;

  // --- 유동닉 판별 ---

  function isAnonymous(username) {
    return username.startsWith("*") || username.includes("#");
  }

  // --- Rate-limited fetch 큐 ---

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
    activeCount++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        setTimeout(() => {
          activeCount--;
          processQueue();
        }, FETCH_DELAY);
      });
  }

  // --- 캐시 (영구 저장, 수동 초기화) ---

  async function getCached(key) {
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  async function setCache(key, data) {
    await chrome.storage.local.set({
      [key]: { ...data, fetchedAt: Date.now() },
    });
  }

  // --- 날짜 파싱 ---

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

    // "2024.01.15" or "2024-01-15"
    let m = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    // "01/15" or "01.15" (올해)
    m = text.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
    if (m) return new Date(new Date().getFullYear(), +m[1] - 1, +m[2]);

    // "N분 전", "N시간 전", "HH:MM" → 최근
    if (text.includes("전") || /^\d{1,2}:\d{2}$/.test(text)) return new Date();

    return null; // 파싱 불가 → 카운트에 포함
  }

  // --- 검색 페이지 fetch & 파싱 ---

  async function fetchSearchPage(target, keyword) {
    const url = `/b/${CHANNEL}?target=${target}&keyword=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseSearchResults(await res.text());
  }

  function parseSearchResults(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const cutoff = getCutoffDate(settings.months);

    const allRows = doc.querySelectorAll(".list-table .vrow");
    let count = 0;
    let stoppedByDate = false;

    for (const row of allRows) {
      if (
        row.classList.contains("notice") ||
        row.classList.contains("head") ||
        row.classList.contains("vrow-head")
      )
        continue;

      if (cutoff) {
        const rowDate = parseRowDate(row);
        if (rowDate && rowDate < cutoff) {
          stoppedByDate = true;
          break; // 날짜순 정렬이므로 이후 전부 오래된 글
        }
      }

      count++;
    }

    // 날짜 필터로 멈춘 게 아니고 페이지네이션이 있으면 더 있음
    const hasMore =
      !stoppedByDate &&
      !!doc.querySelector(
        ".pagination .page-item:not(.active):not(.disabled) a"
      );

    return { count, hasMore };
  }

  // --- 유저 정보 fetch ---

  async function fetchUserInfo(username) {
    const cacheKey = `cache:${CHANNEL}:${username}`;
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    const data = {};
    const target = settings.fetchTarget;

    if (target === "posts" || target === "both") {
      const r = await enqueue(() => fetchSearchPage("nickname", username));
      data.posts = r.count;
      data.postsMore = r.hasMore;
    }

    if (target === "comments" || target === "both") {
      const r = await enqueue(() => fetchSearchPage("comment", username));
      data.comments = r.count;
      data.commentsMore = r.hasMore;
    }

    await setCache(cacheKey, data);
    return data;
  }

  // --- 뱃지 ---

  function getColorClass(count) {
    if (count >= 20) return "arca-badge-green";
    if (count >= 5) return "arca-badge-default";
    if (count >= 1) return "arca-badge-yellow";
    return "arca-badge-red";
  }

  function createBadge(username, data) {
    const badge = document.createElement("span");
    badge.className = "arca-user-badge";
    badge.setAttribute(BADGE_ATTR, "");

    const enc = encodeURIComponent(username);
    const parts = [];

    if (data.posts != null) {
      const cls = getColorClass(data.posts);
      const txt = data.postsMore ? `${data.posts}+` : `${data.posts}`;
      parts.push(
        `<a href="/b/${CHANNEL}?target=nickname&keyword=${enc}" class="${cls}" target="_blank" title="작성글 검색">글 ${txt}</a>`
      );
    }

    if (data.comments != null) {
      const cls = getColorClass(data.comments);
      const txt = data.commentsMore ? `${data.comments}+` : `${data.comments}`;
      parts.push(
        `<a href="/b/${CHANNEL}?target=comment&keyword=${enc}" class="${cls}" target="_blank" title="댓글 검색">댓 ${txt}</a>`
      );
    }

    badge.innerHTML = parts.join(" · ");
    return badge;
  }

  function insertBadge(el, username, data) {
    if (el.parentElement?.querySelector(`[${BADGE_ATTR}]`)) return;
    if (el.querySelector(`[${BADGE_ATTR}]`)) return;
    el.after(createBadge(username, data));
  }

  // --- 작성자 요소 탐색 & 처리 ---

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

    // 캐시된 유저는 즉시 표시, 미캐시 유저만 fetch 큐에
    for (const [username, els] of tasks) {
      const cacheKey = `cache:${CHANNEL}:${username}`;
      const cached = await getCached(cacheKey);
      if (cached) {
        els.forEach((el) => insertBadge(el, username, cached));
        tasks.delete(username);
      }
    }

    // 나머지 fetch (순차적으로 느리게)
    for (const [username, els] of tasks) {
      fetchUserInfo(username)
        .then((data) => els.forEach((el) => insertBadge(el, username, data)))
        .catch((err) => console.warn(`[arca-user-info] ${username}:`, err));
    }
  }

  // --- SPA 대응: MutationObserver ---

  let scanTimeout = null;

  function scheduleScan() {
    if (scanTimeout) return;
    scanTimeout = setTimeout(() => {
      scanTimeout = null;
      processPage();
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

  // --- 설정 변경 감지 ---

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      settings = changes.settings.newValue || DEFAULTS;
    }
  });

  // --- 초기화 ---

  async function init() {
    const result = await chrome.storage.local.get("settings");
    settings = result.settings || DEFAULTS;
    processPage();
  }

  init();
})();
