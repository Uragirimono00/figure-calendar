(function () {
  "use strict";

  const DEFAULTS = {
    default: { months: 3, threshold: 5 },
    buy: { months: 6, threshold: 10 },
    sell: { months: 6, threshold: 10 },
    fetchDelay: 30,
  };
  const MAX_CONCURRENT = 1;
  let FETCH_DELAY = 30000;
  const REFRESH_COOLDOWN = 12 * 60 * 60 * 1000; // 12시간
  const RATE_LIMIT_PAUSE = 5 * 60 * 1000; // 429 시 5분 정지
  const DEOPAN_POLL_INTERVAL = 5 * 60 * 1000; // 더판 5분 폴링
  const BADGE_ATTR = "data-arca-user-badge";

  let settings = DEFAULTS;
  let rateLimitedUntil = 0;

  // --- 토스트 ---

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

  // --- 채널 / 카테고리 ---

  function getChannel() {
    const m = location.pathname.match(/^\/b\/([^\/]+)/);
    return m ? m[1] : null;
  }

  const CHANNEL = getChannel();
  if (!CHANNEL) return;

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

  async function processQueue() {
    if (activeCount >= MAX_CONCURRENT || queue.length === 0) return;

    const now = Date.now();
    if (now < rateLimitedUntil) {
      setTimeout(processQueue, rateLimitedUntil - now + 1000);
      return;
    }

    // 즉시 락 — await 전에 잡아야 race condition 방지
    activeCount++;

    // 글로벌 딜레이: 다른 탭/새로고침에서 최근 수집했으면 대기
    const { lastFetchAt } = await chrome.storage.local.get("lastFetchAt");
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
      .catch(async (err) => {
        if (err.message === "HTTP 429") {
          // 프록시 활성 상태면 다음 프록시로 전환 시도
          try {
            const status = await chrome.runtime.sendMessage({ type: "proxy:status" });
            if (status?.enabled) {
              const result = await chrome.runtime.sendMessage({ type: "proxy:rotate", skip: true });
              if (result?.ok && result.proxy) {
                console.log(`[arca-user-info] 429 → 프록시 전환: ${result.proxy.host}:${result.proxy.port} (남은 ${result.remaining}개)`);
                showToast(`프록시 전환: ${result.proxy.host}:${result.proxy.port}`, 3000);
                // 짧은 대기 후 재시도 (5분 정지 대신)
                rateLimitedUntil = Date.now() + 3000;
                chrome.storage.local.set({ rateLimitedUntil });
                throw err;
              }
            }
          } catch (_) {}
          // 프록시 미사용 또는 전환 실패 → 기존 5분 정지
          rateLimitedUntil = Date.now() + RATE_LIMIT_PAUSE;
          const mins = RATE_LIMIT_PAUSE / 60000;
          console.warn(`[arca-user-info] 429 감지, ${mins}분간 정지`);
          showToast(`⚠ 요청 제한 감지 — ${mins}분간 수집 정지`);
          chrome.storage.local.set({ rateLimitedUntil });
        } else if (err.message === "CAPTCHA timeout") {
          rateLimitedUntil = Date.now() + 60000;
          showToast("⚠ 캡챠 미해결 — 1분 후 재시도", 5000);
          chrome.storage.local.set({ rateLimitedUntil });
        }
        throw err;
      })
      .catch(reject)
      .finally(() => {
        chrome.storage.local.set({ lastFetchAt: Date.now() });
        setTimeout(() => {
          activeCount--;
          processQueue();
        }, getRandomDelay());
      });
  }

  // --- 캡챠 감지 ---

  function isCaptchaPage(html) {
    // 정상 페이지에는 게시글 목록이 있음
    if (html.includes("list-table")) return false;

    return (
      html.includes("cf_chl_opt") ||
      html.includes("cdn-cgi/challenge-platform") ||
      html.includes("cf-turnstile") ||
      html.includes("id=\"challenge-form\"") ||
      html.includes("class=\"g-recaptcha\"") ||
      html.includes("class=\"h-captcha\"")
    );
  }

  function showCaptchaOverlay(iframe) {
    iframe.style.cssText = [
      "position:fixed",
      "top:50%",
      "left:50%",
      "transform:translate(-50%,-50%)",
      "width:480px",
      "height:580px",
      "z-index:1000000",
      "border:2px solid #e94560",
      "border-radius:12px",
      "box-shadow:0 4px 40px rgba(0,0,0,0.7)",
      "background:#fff",
    ].join(";");

    if (!document.getElementById("arca-captcha-backdrop")) {
      const bd = document.createElement("div");
      bd.id = "arca-captcha-backdrop";
      bd.style.cssText =
        "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:999999;";
      document.body.appendChild(bd);
    }
  }

  function hideCaptchaOverlay(iframe) {
    iframe.style.cssText =
      "display:none;width:0;height:0;border:0;position:fixed;left:-9999px;";
    document.getElementById("arca-captcha-backdrop")?.remove();
  }

  // --- iframe 기반 fetch (진짜 브라우저 탐색으로 요청) ---

  let iframeBusy = false;

  function browserFetch(url) {
    // 다른 iframe이 이미 동작 중이면 대기
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

          // 캡챠 감지 → 오버레이로 사용자에게 표시
          if (isCaptchaPage(html)) {
            if (!captchaMode) {
              captchaMode = true;
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error("CAPTCHA timeout"));
              }, 5 * 60 * 1000); // 캡챠 풀 시간 5분
              showCaptchaOverlay(iframe);
              showToast("⚠ 캡챠가 감지되었습니다. 캡챠를 풀어주세요.", 30000);
            }
            return; // 캡챠 풀릴 때까지 대기 (onload 다시 발생)
          }

          // 캡챠 해결 후 → 원래 URL 다시 로드
          if (captchaMode && !captchaResolved) {
            captchaResolved = true;
            hideCaptchaOverlay(iframe);
            showToast("캡챠 해결! 다시 수집합니다.", 3000);
            iframe.style.cssText =
              "display:none;width:0;height:0;border:0;position:fixed;left:-9999px;";
            iframe.src = url;
            return; // 원래 URL 로드 대기
          }

          // 정상 페이지
          cleanup();

          // 429 감지: 정상 페이지(게시글 목록)면 무시
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

  // --- 랜덤 딜레이 (사람처럼 불규칙하게) ---

  function getRandomDelay() {
    const jitter = 0.5 + Math.random(); // 0.5x ~ 1.5x
    return Math.round(FETCH_DELAY * jitter);
  }

  // --- 캐시 ---

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

    let m = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    m = text.match(/^(\d{1,2})[.\-/](\d{1,2})$/);
    if (m) return new Date(new Date().getFullYear(), +m[1] - 1, +m[2]);

    if (text.includes("전") || /^\d{1,2}:\d{2}$/.test(text)) return new Date();

    return null;
  }

  // --- 검색 페이지 fetch & 파싱 ---

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

      // 닉네임 정확히 일치하는 글만 카운트
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

  // --- 유저 정보 fetch ---

  function shouldRefresh(cached, threshold) {
    if (!cached || cached.posts == null) return true;
    // 기준 이하: 쿨다운 후 재조회
    if (cached.posts <= threshold) {
      return Date.now() - (cached.fetchedAt || 0) > REFRESH_COOLDOWN;
    }
    // 기준 초과: recheckAt 지나면 재조회
    if (cached.recheckAt && Date.now() >= cached.recheckAt) return true;
    return false;
  }

  // 기준 초과 유저의 재조회 날짜 계산
  // 가장 오래된 글들이 조회기간 밖으로 빠지면서 기준 이하가 되는 시점
  function calcRecheckAt(count, threshold, months, dates) {
    if (!months || count <= threshold || dates.length === 0) return null;

    const sorted = [...dates].sort((a, b) => a - b); // 오래된 순
    const postsToLose = count - threshold; // 빠져야 할 글 수

    if (postsToLose > sorted.length) return null;

    // postsToLose번째로 오래된 글이 조회기간 밖으로 나가는 날
    const criticalDate = new Date(sorted[postsToLose - 1]);
    criticalDate.setMonth(criticalDate.getMonth() + months);
    return criticalDate.getTime();
  }

  async function fetchUserInfo(username, months, threshold) {
    const cacheKey = `cache:${CHANNEL}:${months}m:${username}`;
    const cached = await getCached(cacheKey);
    if (cached && !shouldRefresh(cached, threshold)) return cached;

    const r = await enqueue(() => fetchSearchPage(username, months));
    let recheckAt;
    if (r.hasMore) {
      // 45+ 유저: 조회기간 절반 후 재조회 (최소 14일)
      const halfPeriodMs = months
        ? Math.max(months * 15 * 24 * 3600 * 1000, 14 * 24 * 3600 * 1000)
        : 30 * 24 * 3600 * 1000; // 전체 조회 시 30일
      recheckAt = Date.now() + halfPeriodMs;
    } else {
      recheckAt = calcRecheckAt(r.count, threshold, months, r.dates);
    }
    const data = { posts: r.count, postsMore: r.hasMore, recheckAt };

    await setCache(cacheKey, data);
    const txt = r.hasMore ? `${r.count}+` : `${r.count}`;
    showToast(`수집 완료: ${username} (글 ${txt}개)`, 3000);
    return data;
  }

  // --- 뱃지 ---

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

    // 기준 미달 경고 (더판 / 구매 / 판매)
    const cat = getCurrentCategory();
    const deopan = isDeopan();
    if ((deopan || cat === "buy" || cat === "sell") && data.posts <= threshold) {
      const row = el.closest(".vrow");
      if (row && !row.classList.contains("arca-warn-row")) {
        row.classList.add("arca-warn-row");
        const label = deopan
          ? "더판"
          : cat === "buy"
            ? "구매"
            : "판매";
        showToast(
          `⚠ ${label} 기준 미달: ${username} (글 ${data.posts}개)`,
          7000
        );
      }
    }
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

    // 캐시된 유저는 즉시 표시
    for (const [username, els] of tasks) {
      const cacheKey = `cache:${CHANNEL}:${cs.months}m:${username}`;
      const cached = await getCached(cacheKey);
      if (cached) {
        els.forEach((el) => insertBadge(el, username, cached, cs.threshold));
        if (!shouldRefresh(cached, cs.threshold)) tasks.delete(username);
      }
    }

    // 나머지 fetch
    for (const [username, els] of tasks) {
      fetchUserInfo(username, cs.months, cs.threshold)
        .then((data) =>
          els.forEach((el) => insertBadge(el, username, data, cs.threshold))
        )
        .catch((err) => console.warn(`[arca-user-info] ${username}:`, err));
    }
  }

  // --- 더판 모니터링 ---

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
      const url = `/b/${CHANNEL}?category=${encodeURIComponent("🔞더판")}`;
      const html = await enqueue(() => browserFetch(url));

      const articles = parseDeopanArticles(html);
      const storeKey = `deopan:${CHANNEL}:seen`;
      const stored = await chrome.storage.local.get(storeKey);
      const seenIds = new Set(stored[storeKey]?.ids || []);
      const isFirstRun = seenIds.size === 0;

      await chrome.storage.local.set({
        [storeKey]: { ids: articles.map((a) => a.id) },
      });

      if (isFirstRun) return;

      const newArticles = articles.filter((a) => !seenIds.has(a.id));
      if (newArticles.length === 0) return;

      const flagged = [];
      const uncached = [];

      for (const article of newArticles) {
        const cacheKey = `cache:${CHANNEL}:${cs.months}m:${article.username}`;
        const cached = await getCached(cacheKey);
        if (cached && cached.posts != null) {
          if (cached.posts <= cs.threshold) {
            flagged.push(`${article.username}(글 ${cached.posts})`);
          }
        } else {
          uncached.push(article);
        }
      }

      if (flagged.length > 0) {
        showToast(`🚨 더판 기준 미달 신규글: ${flagged.join(", ")}`, 10000);
      }

      for (const article of uncached) {
        fetchUserInfo(article.username, cs.months, cs.threshold)
          .then((data) => {
            if (data.posts <= cs.threshold) {
              showToast(
                `🚨 더판 기준 미달 신규글: ${article.username}(글 ${data.posts})`,
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

  // --- SPA 대응: MutationObserver ---

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

  // --- 설정 변경 감지 ---

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      settings = changes.settings.newValue || DEFAULTS;
      FETCH_DELAY = (settings.fetchDelay || 30) * 1000;
    }
  });

  // --- 팝업에서 개별 재조회 요청 ---

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "forceResume") {
      rateLimitedUntil = 0;
      chrome.storage.local.remove("rateLimitedUntil");
      processPage();
      sendResponse({ ok: true });
      return;
    }

    if (msg.type !== "refetch") return;
    if (msg.channel !== CHANNEL) {
      sendResponse({ ok: false, reason: "wrong channel" });
      return;
    }

    const cs = getCatSettings();
    fetchUserInfo(msg.username, cs.months, cs.threshold)
      .then((data) => {
        // 현재 페이지 뱃지도 갱신
        document.querySelectorAll("[data-filter]").forEach((el) => {
          if (el.getAttribute("data-filter") !== msg.username) return;
          const userInfo = el.closest(".user-info");
          if (!userInfo) return;
          const oldBadge = userInfo.parentElement?.querySelector(`[${BADGE_ATTR}]`);
          if (oldBadge) oldBadge.remove();
          userInfo.dataset.arcaProcessed = "";
          insertBadge(userInfo, msg.username, data, cs.threshold);
        });
        sendResponse({ ok: true, data });
      })
      .catch((err) => sendResponse({ ok: false, reason: err.message }));

    return true; // 비동기 응답
  });

  // --- 초기화 ---

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

  async function migrateCacheRecheckAt(s) {
    const all = await chrome.storage.local.get(null);
    const updates = {};

    for (const [key, val] of Object.entries(all)) {
      if (!key.startsWith("cache:")) continue;
      if (val.recheckAt != null) continue; // 이미 설정됨
      if (!val.postsMore) continue; // hasMore 아닌 항목은 스킵

      // cache:channel:Nm:username → months 추출
      const parts = key.split(":");
      const periodStr = parts[2] || "";
      const months = parseInt(periodStr) || 0;
      const halfPeriodMs = months
        ? Math.max(months * 15 * 24 * 3600 * 1000, 14 * 24 * 3600 * 1000)
        : 30 * 24 * 3600 * 1000;

      updates[key] = {
        ...val,
        recheckAt: (val.fetchedAt || Date.now()) + halfPeriodMs,
      };
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  }

  function isChannelAllowed(s) {
    const channels = s.channels || [];
    return channels.length === 0 || channels.includes(CHANNEL);
  }

  async function init() {
    const result = await chrome.storage.local.get(["settings", "rateLimitedUntil"]);

    // 저장된 제한 시간 복원
    if (result.rateLimitedUntil && Date.now() < result.rateLimitedUntil) {
      rateLimitedUntil = result.rateLimitedUntil;
    } else if (result.rateLimitedUntil) {
      // 만료된 제한 정리
      chrome.storage.local.remove("rateLimitedUntil");
    }

    let stored = result.settings;
    if (stored) {
      stored = migrateSettings(stored);
      if (stored !== result.settings) {
        await chrome.storage.local.set({ settings: stored });
      }
    }
    settings = stored || DEFAULTS;
    FETCH_DELAY = (settings.fetchDelay || 30) * 1000;

    // 기존 캐시 중 postsMore=true인데 recheckAt 없는 항목에 recheckAt 부여
    await migrateCacheRecheckAt(settings);

    if (!isChannelAllowed(settings)) return;

    processPage();

    pollDeopan();
    setInterval(pollDeopan, DEOPAN_POLL_INTERVAL);
  }

  init();
})();
