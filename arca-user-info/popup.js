const DEFAULTS = {
  default: { months: 3, threshold: 5 },
  buy: { months: 6, threshold: 10 },
  sell: { months: 6, threshold: 10 },
};

const CATS = ["default", "buy", "sell"];

function migrateSettings(stored) {
  if (stored && stored.months != null && !stored.default) {
    return {
      default: { months: stored.months, threshold: stored.refreshThreshold || 5 },
      buy: DEFAULTS.buy,
      sell: DEFAULTS.sell,
    };
  }
  return stored;
}

document.addEventListener("DOMContentLoaded", async () => {
  let { settings } = await chrome.storage.local.get("settings");
  settings = migrateSettings(settings) || DEFAULTS;

  for (const cat of CATS) {
    const s = settings[cat] || DEFAULTS[cat];
    document.getElementById(`${cat}-months`).value = s.months;
    document.getElementById(`${cat}-threshold`).value = s.threshold;
  }
  document.getElementById("fetchDelay").value = settings.fetchDelay || 30;
  document.getElementById("channels").value = (settings.channels || []).join(", ");

  updateCacheInfo();
  startRateLimitCheck();

  // 캐시에 영향 없는 설정: 즉시 저장
  document.getElementById("fetchDelay").addEventListener("change", saveLight);
  document.getElementById("channels").addEventListener("change", saveLight);

  // 캐시에 영향 있는 설정: 적용 버튼으로만 저장
  document.getElementById("applySettings").addEventListener("click", applyCategorySettings);
  document.getElementById("clearCache").addEventListener("click", clearCache);
  document.getElementById("forceResume").addEventListener("click", forceResume);
  document.getElementById("exportData").addEventListener("click", exportData);
  document.getElementById("importData").addEventListener("click", () =>
    document.getElementById("importFile").click()
  );
  document.getElementById("importFile").addEventListener("change", importData);

  // 검색 & 필터
  document.getElementById("searchInput").addEventListener("input", updateCacheInfo);
  document.getElementById("filterSelect").addEventListener("change", updateCacheInfo);

  // 프록시
  document.getElementById("proxyToggle").addEventListener("click", toggleProxy);
  document.getElementById("proxyRotate").addEventListener("click", rotateProxy);
  document.getElementById("proxyRefresh").addEventListener("click", refreshProxyList);
  updateProxyStatus();
});

// 캐시에 영향 없는 설정만 저장 (fetchDelay, channels)
async function saveLight() {
  const { settings: prev } = await chrome.storage.local.get("settings");
  const s = prev || DEFAULTS;
  s.fetchDelay = parseInt(document.getElementById("fetchDelay").value);
  s.channels = document.getElementById("channels").value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  await chrome.storage.local.set({ settings: s });
}

// 조회 기간/기준 글 수 적용 + 캐시 삭제
async function applyCategorySettings() {
  if (!confirm("조회 설정을 변경하면 기존 캐시가 삭제됩니다.\n적용하시겠습니까?")) return;

  const settings = {};
  for (const cat of CATS) {
    settings[cat] = {
      months: parseInt(document.getElementById(`${cat}-months`).value),
      threshold: parseInt(document.getElementById(`${cat}-threshold`).value),
    };
  }
  settings.fetchDelay = parseInt(document.getElementById("fetchDelay").value);
  settings.channels = document.getElementById("channels").value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  await chrome.storage.local.set({ settings });

  // 캐시 삭제
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("cache:"));
  if (keys.length > 0) await chrome.storage.local.remove(keys);

  updateCacheInfo();
}

async function exportData() {
  const all = await chrome.storage.local.get(null);
  // 임시 상태값은 제외
  delete all.rateLimitedUntil;
  delete all.lastFetchAt;

  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().slice(0, 10);
  a.download = `arca-user-info-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!confirm("현재 데이터를 덮어씁니다.\n가져오시겠습니까?")) {
    e.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (typeof data !== "object" || data === null) {
      alert("올바르지 않은 파일입니다.");
      return;
    }

    // 기존 데이터 전부 삭제 후 가져오기
    await chrome.storage.local.clear();
    await chrome.storage.local.set(data);

    // UI 갱신
    const settings = data.settings || DEFAULTS;
    for (const cat of CATS) {
      const s = settings[cat] || DEFAULTS[cat];
      document.getElementById(`${cat}-months`).value = s.months;
      document.getElementById(`${cat}-threshold`).value = s.threshold;
    }
    document.getElementById("fetchDelay").value = settings.fetchDelay || 30;
    document.getElementById("channels").value = (settings.channels || []).join(", ");
    updateCacheInfo();
  } catch (err) {
    alert("파일 읽기 실패: " + err.message);
  }

  e.target.value = "";
}

async function clearCache() {
  if (!confirm("캐시를 초기화하시겠습니까?")) return;

  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("cache:"));
  if (keys.length > 0) await chrome.storage.local.remove(keys);
  updateCacheInfo();
}

async function forceResume() {
  await chrome.storage.local.remove("rateLimitedUntil");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "forceResume" });
    }
  } catch (_) {}

  updateRateLimitBanner();
}

async function refetchUser(channel, period, username, btn) {
  btn.classList.add("loading");
  btn.textContent = "...";

  const cacheKey = `cache:${channel}:${period}:${username}`;
  await chrome.storage.local.remove(cacheKey);

  // content script에 재조회 요청
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: "refetch",
        channel,
        username,
      });
    }
  } catch (_) {
    // content script 미연결 시 무시 — 캐시만 삭제됨
  }

  await updateCacheInfo();
}

let rateLimitTimer = null;

function startRateLimitCheck() {
  updateRateLimitBanner();
  if (rateLimitTimer) clearInterval(rateLimitTimer);
  rateLimitTimer = setInterval(updateRateLimitBanner, 1000);
}

async function updateRateLimitBanner() {
  const { rateLimitedUntil } = await chrome.storage.local.get("rateLimitedUntil");
  const banner = document.getElementById("rateLimitBanner");
  if (!rateLimitedUntil || Date.now() >= rateLimitedUntil) {
    banner.style.display = "none";
    return;
  }
  const remaining = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
  const min = Math.floor(remaining / 60);
  const sec = remaining % 60;
  banner.style.display = "block";
  document.getElementById("rateLimitText").textContent =
    `⚠ 요청 제한 중 — ${min}분 ${sec.toString().padStart(2, "0")}초 남음`;
}

function formatDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function timeAgo(ts) {
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

async function updateCacheInfo() {
  const all = await chrome.storage.local.get(null);
  const curSettings = all.settings || DEFAULTS;
  const defThreshold = (curSettings.default || DEFAULTS.default).threshold;

  const entries = [];
  for (const [key, val] of Object.entries(all)) {
    if (!key.startsWith("cache:")) continue;
    // cache:channel:Nm:username
    const parts = key.split(":");
    const channel = parts[1] || "";
    const period = parts[2] || "";
    const username = parts.slice(3).join(":");
    entries.push({ channel, period, username, ...val });
  }

  entries.sort((a, b) => (b.fetchedAt || 0) - (a.fetchedAt || 0));

  // 검색 & 필터
  const query = (document.getElementById("searchInput")?.value || "").trim().toLowerCase();
  const filter = document.getElementById("filterSelect")?.value || "all";

  const filtered = entries.filter((e) => {
    if (query && !e.username.toLowerCase().includes(query)) return false;
    if (filter === "red") return e.posts != null && e.posts <= defThreshold;
    if (filter === "green") return e.posts != null && e.posts > defThreshold;
    if (filter === "recheck") return e.recheckAt && Date.now() >= e.recheckAt;
    return true;
  });

  document.getElementById("cacheInfo").textContent =
    `저장된 유저: ${entries.length}명` +
    (filtered.length !== entries.length ? ` (${filtered.length}명 표시)` : "");

  const list = document.getElementById("userList");
  list.innerHTML = "";

  for (const e of filtered) {
    const row = document.createElement("div");
    row.className = "user-row";
    const posts = e.posts != null ? e.posts : "?";
    const postsText = e.postsMore ? `${posts}+` : `${posts}`;
    const cls = e.posts != null && e.posts <= defThreshold ? "posts-red" : "posts-green";
    const ago = e.fetchedAt ? timeAgo(e.fetchedAt) : "-";
    const needsRecheck = e.recheckAt && Date.now() >= e.recheckAt;
    const recheckTag = needsRecheck
      ? ` <span class="recheck-tag">재조회</span>`
      : e.recheckAt
        ? ` <span class="recheck-date">${formatDate(e.recheckAt)}</span>`
        : "";
    row.innerHTML =
      `<span class="name" title="${e.username}">${e.username} <span class="channel">${e.channel} ${e.period}</span></span>` +
      `<span class="meta"><span class="posts ${cls}">글 ${postsText}</span>${recheckTag} · <span class="time">${ago}</span></span>`;

    const btn = document.createElement("button");
    btn.className = "btn-refetch";
    btn.textContent = "조회";
    btn.addEventListener("click", () => refetchUser(e.channel, e.period, e.username, btn));
    row.appendChild(btn);

    list.appendChild(row);
  }
}

// --- 프록시 ---

async function updateProxyStatus() {
  try {
    const status = await chrome.runtime.sendMessage({ type: "proxy:status" });
    const toggle = document.getElementById("proxyToggle");
    const statusEl = document.getElementById("proxyStatus");
    const infoEl = document.getElementById("proxyInfo");

    if (status.enabled) {
      toggle.textContent = "비활성화";
      toggle.classList.add("btn-proxy-on");
      statusEl.textContent = "활성";
      statusEl.style.color = "#51cf66";
      infoEl.style.display = "block";
      document.getElementById("proxyCount").textContent = status.count;
      const cur = status.current;
      const ipText = cur ? `${cur.host}:${cur.port}` : "-";
      const latencyText = cur?.latency != null ? ` (${cur.latency}ms)` : "";
      document.getElementById("proxyCurrentIp").textContent = ipText + latencyText;
    } else {
      toggle.textContent = "활성화";
      toggle.classList.remove("btn-proxy-on");
      statusEl.textContent = "비활성";
      statusEl.style.color = "#888";
      infoEl.style.display = "none";
    }
  } catch (_) {}
}

async function toggleProxy() {
  const toggle = document.getElementById("proxyToggle");
  const isOn = toggle.classList.contains("btn-proxy-on");

  toggle.textContent = "...";
  toggle.disabled = true;

  try {
    if (isOn) {
      await chrome.runtime.sendMessage({ type: "proxy:disable" });
    } else {
      const r = await chrome.runtime.sendMessage({ type: "proxy:enable" });
      if (!r?.ok) {
        proxyEnabled = false;
        alert(r?.reason || "사용 가능한 프록시를 찾지 못했습니다.");
      }
    }
  } catch (_) {}

  toggle.disabled = false;
  updateProxyStatus();
}

async function rotateProxy() {
  const btn = document.getElementById("proxyRotate");
  btn.textContent = "...";
  btn.disabled = true;

  try {
    await chrome.runtime.sendMessage({ type: "proxy:rotate" });
  } catch (_) {}

  btn.textContent = "다음 프록시";
  btn.disabled = false;
  updateProxyStatus();
}

async function refreshProxyList() {
  const btn = document.getElementById("proxyRefresh");
  btn.textContent = "...";
  btn.disabled = true;

  try {
    const r = await chrome.runtime.sendMessage({ type: "proxy:refresh" });
    if (r?.ok) {
      document.getElementById("proxyCount").textContent = r.count;
    }
  } catch (_) {}

  btn.textContent = "목록 새로고침";
  btn.disabled = false;
  updateProxyStatus();
}
