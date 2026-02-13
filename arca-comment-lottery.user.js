// ==UserScript==
// @name         arca.live 댓글 추첨기
// @namespace    arca-comment-lottery
// @version      1.2
// @description  아카라이브 게시글 댓글에서 조건에 맞는 댓글을 필터링하고 N명을 랜덤 추첨합니다.
// @match        *://arca.live/b/*/*
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/Uragirimono00/figure-calendar/master/arca-comment-lottery.user.js
// @downloadURL  https://raw.githubusercontent.com/Uragirimono00/figure-calendar/master/arca-comment-lottery.user.js
// ==/UserScript==

(function () {
  "use strict";

  // ===================== CSS =====================

  GM_addStyle(`
    #lottery-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 99998;
      width: 48px; height: 48px; border-radius: 50%;
      border: 1px solid #444; background: #1a1a2e; color: #e0e0e0;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      transition: background 0.2s, transform 0.2s; font-size: 22px;
    }
    #lottery-fab:hover { background: #16213e; transform: scale(1.1); }

    #lottery-backdrop {
      position: fixed; top:0; left:0; right:0; bottom:0;
      z-index: 99998; background: rgba(0,0,0,0.5); display: none;
    }
    #lottery-backdrop.open { display: block; }

    #lottery-panel {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%) scale(0.95);
      z-index: 99999; width: 520px; max-height: 85vh;
      background: #1a1a2e; color: #e0e0e0;
      font-family: -apple-system, "Malgun Gothic", sans-serif; font-size: 13px;
      border-radius: 12px; box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      display: none; flex-direction: column; overflow: hidden;
      opacity: 0; transition: opacity 0.2s, transform 0.2s;
    }
    #lottery-panel.open {
      display: flex; opacity: 1; transform: translate(-50%, -50%) scale(1);
    }

    #lottery-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 18px; border-bottom: 1px solid #333; flex-shrink: 0;
    }
    #lottery-header h3 { font-size: 15px; color: #fff; margin: 0; }
    #lottery-close {
      background: none; border: none; color: #888; cursor: pointer;
      font-size: 20px; padding: 4px;
    }
    #lottery-close:hover { color: #fff; }

    #lottery-body { flex: 1; overflow-y: auto; padding: 14px 18px; }
    #lottery-body::-webkit-scrollbar { width: 5px; }
    #lottery-body::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }

    .lot-section { margin-bottom: 14px; padding: 12px; background: #16213e; border-radius: 8px; }
    .lot-section-title {
      font-size: 12px; font-weight: bold; color: #aaa;
      margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
    }
    .lot-row { display: flex; gap: 8px; align-items: center; }
    .lot-row + .lot-row { margin-top: 8px; }
    .lot-row label { font-size: 11px; color: #888; width: 80px; flex-shrink: 0; }
    .lot-row input, .lot-row select {
      flex: 1; padding: 5px 8px; border: 1px solid #333; border-radius: 4px;
      background: #1a1a2e; color: #e0e0e0; font-size: 12px; min-width: 0;
    }
    .lot-row input::placeholder { color: #555; }
    .lot-row input[type="number"] { width: 60px; flex: none; }
    .lot-row input[type="datetime-local"] { flex: 1; }

    .lot-checkbox-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .lot-checkbox-row input[type="checkbox"] { accent-color: #e94560; width: 16px; height: 16px; }
    .lot-checkbox-row label { font-size: 12px; color: #ccc; cursor: pointer; width: auto; }
    .lot-hint { font-size: 10px; color: #666; margin-top: 4px; }

    #lottery-run-btn {
      width: 100%; padding: 10px; border: none; border-radius: 6px;
      background: #e94560; color: #fff; font-size: 14px; font-weight: bold;
      cursor: pointer; margin-top: 4px; transition: background 0.2s;
    }
    #lottery-run-btn:hover { background: #c73e54; }
    #lottery-run-btn:disabled { background: #555; cursor: not-allowed; color: #999; }

    #lottery-progress {
      margin-top: 10px; padding: 10px 12px; background: #0f3460;
      border-radius: 6px; font-size: 12px; color: #8ec5fc; display: none;
    }
    #lottery-progress .progress-bar-wrap {
      width: 100%; height: 6px; background: #1a1a2e;
      border-radius: 3px; margin-top: 6px; overflow: hidden;
    }
    #lottery-progress .progress-bar-fill {
      height: 100%; background: #e94560; border-radius: 3px; transition: width 0.3s;
    }

    #lottery-canvas-wrap { margin-top: 12px; text-align: center; display: none; }
    #lottery-canvas { border-radius: 8px; border: 1px solid #333; display: block; margin: 0 auto; }
    #lottery-footer {
      text-align: center; padding: 10px 18px 14px; font-size: 11px; color: #555;
      border-top: 1px solid #222; margin-top: 14px;
    }

    #lottery-anim-btns { margin-top: 8px; display: flex; gap: 8px; justify-content: center; }
    #lottery-anim-btns button {
      padding: 6px 16px; background: #0f3460; border: none;
      color: #8ec5fc; font-size: 12px; border-radius: 4px; cursor: pointer; display: none;
    }
    #lottery-anim-btns button:hover { background: #1a4a8a; }

    #lottery-result { margin-top: 14px; display: none; }
    .lot-result-header { font-size: 14px; font-weight: bold; color: #ffd43b; margin-bottom: 10px; text-align: center; }
    .lot-winner-list { background: #16213e; border-radius: 8px; padding: 10px; }
    .lot-winner-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 4px; border-bottom: 1px solid #222; font-size: 12px;
    }
    .lot-winner-item:last-child { border-bottom: none; }
    .lot-winner-rank { color: #ffd43b; font-weight: bold; width: 28px; flex-shrink: 0; }
    .lot-winner-name { flex: 1; color: #e0e0e0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lot-winner-comment {
      font-size: 10px; color: #666; margin-left: 8px;
      max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    #lottery-candidates { margin-top: 14px; display: none; }
    .lot-cand-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
    }
    .lot-cand-title { font-size: 13px; font-weight: bold; color: #aaa; }
    .lot-cand-count { font-size: 11px; color: #888; }
    .lot-cand-list {
      background: #0d1117; border: 1px solid #333; border-radius: 6px;
      max-height: 250px; overflow-y: auto; padding: 6px;
    }
    .lot-cand-list::-webkit-scrollbar { width: 4px; }
    .lot-cand-list::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
    .lot-cand-item {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 6px; border-bottom: 1px solid #1a1a2e; font-size: 12px;
    }
    .lot-cand-item:last-child { border-bottom: none; }
    .lot-cand-item:hover { background: rgba(255,255,255,0.03); }
    .lot-cand-item.excluded { opacity: 0.35; text-decoration: line-through; }
    .lot-cand-num { color: #555; font-size: 10px; width: 28px; flex-shrink: 0; text-align: right; }
    .lot-cand-link {
      color: #8ec5fc; text-decoration: none; flex: 1;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .lot-cand-link:hover { color: #fff; text-decoration: underline; }
    .lot-cand-exclude {
      background: none; border: 1px solid #444; color: #e94560;
      font-size: 10px; padding: 2px 6px; border-radius: 3px; cursor: pointer; flex-shrink: 0;
    }
    .lot-cand-exclude:hover { background: rgba(233,69,96,0.15); }
    .lot-cand-item.excluded .lot-cand-exclude { color: #51cf66; border-color: #51cf66; }
    .lot-cand-item.excluded .lot-cand-exclude:hover { background: rgba(81,207,102,0.15); }
    #lottery-confirm-btn {
      width: 100%; padding: 10px; border: none; border-radius: 6px;
      background: #51cf66; color: #fff; font-size: 14px; font-weight: bold;
      cursor: pointer; margin-top: 8px; transition: background 0.2s; display: none;
    }
    #lottery-confirm-btn:hover { background: #40c057; }

    #lottery-log { margin-top: 14px; display: none; }
    .lot-log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .lot-log-title { font-size: 13px; font-weight: bold; color: #aaa; }
    .lot-log-copy {
      background: #0f3460; border: none; color: #8ec5fc;
      font-size: 11px; padding: 3px 10px; border-radius: 4px; cursor: pointer;
    }
    .lot-log-copy:hover { background: #1a4a8a; }
    .lot-log-area {
      width: 100%; min-height: 200px; max-height: 350px;
      background: #0d1117; color: #8b949e; border: 1px solid #333;
      border-radius: 6px; padding: 10px; font-size: 11px;
      font-family: "Consolas", "Courier New", monospace;
      resize: vertical; overflow-y: auto; white-space: pre-wrap; word-break: break-all;
    }

    .lot-emoticon-grid {
      display: flex; flex-wrap: wrap; gap: 6px;
      max-height: 160px; overflow-y: auto; margin-top: 8px; padding: 4px;
    }
    .lot-emoticon-grid::-webkit-scrollbar { width: 4px; }
    .lot-emoticon-grid::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
    .lot-emoticon-pick {
      width: 48px; height: 48px; border-radius: 6px;
      border: 2px solid transparent; background: #1a1a2e;
      cursor: pointer; padding: 2px; position: relative;
      transition: border-color 0.15s, transform 0.15s;
    }
    .lot-emoticon-pick:hover { border-color: #555; transform: scale(1.08); }
    .lot-emoticon-pick.selected { border-color: #e94560; }
    .lot-emoticon-pick img, .lot-emoticon-pick video {
      width: 100%; height: 100%; object-fit: contain; border-radius: 4px; pointer-events: none;
    }
    .lot-emoticon-pick .lot-emo-count {
      position: absolute; bottom: 1px; right: 1px;
      background: rgba(0,0,0,0.7); color: #aaa; font-size: 9px;
      padding: 0 3px; border-radius: 3px; line-height: 1.4;
    }
    .lot-emo-actions { display: flex; gap: 4px; margin-left: auto; }
    .lot-emo-btn {
      background: #0f3460; border: none; color: #8ec5fc;
      font-size: 10px; padding: 3px 8px; border-radius: 3px; cursor: pointer;
    }
    .lot-emo-btn:hover { background: #1a4a8a; }

    .lot-tag-fixed {
      display: inline-block; padding: 1px 5px; border-radius: 3px;
      background: rgba(81,207,102,0.15); color: #51cf66; font-size: 10px; margin-left: 4px;
    }
    .lot-tag-account {
      display: inline-block; padding: 1px 5px; border-radius: 3px;
      background: rgba(255,212,59,0.15); color: #ffd43b; font-size: 10px; margin-left: 4px;
    }
  `);

  // ===================== UTILS =====================

  function getArticlePath() {
    const m = location.pathname.match(/^\/b\/([^/]+)\/(\d+)/);
    return m ? { channel: m[1], articleId: m[2] } : null;
  }

  const article = getArticlePath();
  if (!article) return;

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function formatDate(d) {
    const pad = n => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  // ===================== COMMENT PARSING =====================

  function parseCommentsFromDoc(doc) {
    const comments = [];
    for (const item of doc.querySelectorAll(".comment-item")) {
      const userInfo = item.querySelector(".user-info");
      if (!userInfo) continue;
      const filterEl = userInfo.querySelector("[data-filter]");
      if (!filterEl) continue;

      const username = filterEl.getAttribute("data-filter");
      const isFixed = !!userInfo.querySelector(".user-fixed");
      const isAccount = !!userInfo.querySelector(".ion-android-person");
      let userType = "anonymous";
      if (isFixed) userType = "fixed";
      else if (isAccount) userType = "account";

      const isReply = !!item.querySelector(".ion-android-arrow-dropup-circle");
      const timeEl = item.querySelector("time[datetime]");
      const datetime = timeEl ? new Date(timeEl.getAttribute("datetime")) : null;
      const textEl = item.querySelector(".message .text pre");
      const text = textEl ? textEl.textContent.trim() : "";

      const emoticons = [];
      for (const emo of item.querySelectorAll(".message .emoticon")) {
        const id = emo.getAttribute("data-id");
        if (id && !emoticons.includes(id)) emoticons.push(id);
      }

      comments.push({ commentId: item.id || "", username, userType, isFixed, isReply, datetime, text, emoticons });
    }
    return comments;
  }

  function getTotalCommentPages(doc) {
    let max = 1;
    for (const link of doc.querySelectorAll(".pagination .page-item .page-link")) {
      const m = (link.getAttribute("href") || "").match(/[?&]cp=(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1]));
    }
    return max;
  }

  async function fetchCommentPage(pageNum) {
    const url = `/b/${article.channel}/${article.articleId}?cp=${pageNum}`;
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return { doc, comments: parseCommentsFromDoc(doc) };
  }

  // ===================== UI BUILD =====================

  function buildUI() {
    const fab = document.createElement("button");
    fab.id = "lottery-fab";
    fab.title = "댓글 추첨기";
    fab.textContent = "\uD83C\uDFB2";
    document.body.appendChild(fab);

    const backdrop = document.createElement("div");
    backdrop.id = "lottery-backdrop";
    document.body.appendChild(backdrop);

    const panel = document.createElement("div");
    panel.id = "lottery-panel";
    panel.innerHTML = buildPanelHTML();
    document.body.appendChild(panel);

    fab.addEventListener("click", () => openPanel());
    backdrop.addEventListener("click", () => closePanel());
    panel.querySelector("#lottery-close").addEventListener("click", () => closePanel());
    panel.querySelector("#lottery-run-btn").addEventListener("click", () => runLottery());
    panel.querySelector("#lot-emoticon-scan").addEventListener("click", () => scanEmoticons());
    panel.querySelector("#lot-emo-sel-all").addEventListener("click", () => emoSelectAll(true));
    panel.querySelector("#lot-emo-desel-all").addEventListener("click", () => emoSelectAll(false));
    panel.querySelector(".lot-log-copy").addEventListener("click", () => copyLog());
    panel.querySelector("#lottery-save-btn").addEventListener("click", () => saveRecording());
    panel.querySelector("#lottery-replay-btn").addEventListener("click", () => replayAnimation());
    panel.querySelector("#lottery-confirm-btn").addEventListener("click", () => confirmLottery());

    panel.querySelector("#lot-exclude-reply").checked = true;
    panel.querySelector("#lot-exclude-reply").addEventListener("change", () => scanEmoticons());

    GM_registerMenuCommand("댓글 추첨기 열기", () => openPanel());
  }

  function openPanel() {
    document.getElementById("lottery-panel").classList.add("open");
    document.getElementById("lottery-backdrop").classList.add("open");
    scanEmoticons();
  }

  function closePanel() {
    document.getElementById("lottery-panel").classList.remove("open");
    document.getElementById("lottery-backdrop").classList.remove("open");
  }

  // ===================== EMOTICON PICKER =====================

  function syncEmoInput() {
    const grid = document.getElementById("lot-emoticon-grid");
    const input = document.getElementById("lot-emoticon-filter");
    const ids = [];
    grid.querySelectorAll(".lot-emoticon-pick.selected").forEach(p => ids.push(p.dataset.emoId));
    input.value = ids.join(", ");
  }

  function emoSelectAll(select) {
    const grid = document.getElementById("lot-emoticon-grid");
    grid.querySelectorAll(".lot-emoticon-pick").forEach(p => {
      if (select) p.classList.add("selected");
      else p.classList.remove("selected");
    });
    syncEmoInput();
  }

  function scanEmoticons() {
    const grid = document.getElementById("lot-emoticon-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const excludeReply = document.getElementById("lot-exclude-reply").checked;
    const emoMap = new Map();
    for (const item of document.querySelectorAll(".comment-item")) {
      if (excludeReply && item.querySelector(".ion-android-arrow-dropup-circle")) continue;
      for (const el of item.querySelectorAll(".message .emoticon")) {
        const dataId = el.getAttribute("data-id");
        if (!dataId) continue;
        if (emoMap.has(dataId)) { emoMap.get(dataId).count++; continue; }
        const isVid = el.tagName.toLowerCase() === "video";
        const src = isVid ? (el.getAttribute("poster") || el.getAttribute("src")) : el.getAttribute("src");
        emoMap.set(dataId, { src, count: 1 });
      }
    }

    if (emoMap.size === 0) {
      grid.innerHTML = '<div style="font-size:11px;color:#666;padding:4px;">이 페이지에서 아카콘을 찾을 수 없습니다.</div>';
      return;
    }

    const sorted = [...emoMap.entries()].sort((a, b) => b[1].count - a[1].count);
    const currentIds = new Set(
      document.getElementById("lot-emoticon-filter").value.split(",").map(s => s.trim()).filter(Boolean)
    );

    for (const [dataId, info] of sorted) {
      const pick = document.createElement("div");
      pick.className = "lot-emoticon-pick" + (currentIds.has(dataId) ? " selected" : "");
      pick.dataset.emoId = dataId;
      pick.title = `ID: ${dataId} (${info.count}회 사용)`;

      const img = document.createElement("img");
      img.src = info.src;
      img.loading = "lazy";
      pick.appendChild(img);

      const badge = document.createElement("span");
      badge.className = "lot-emo-count";
      badge.textContent = info.count;
      pick.appendChild(badge);

      pick.addEventListener("click", () => { pick.classList.toggle("selected"); syncEmoInput(); });
      grid.appendChild(pick);
    }
  }

  // ===================== PANEL HTML =====================

  function buildPanelHTML() {
    return `
      <div id="lottery-header">
        <h3>\uD83C\uDFB2 댓글 추첨기</h3>
        <button id="lottery-close">\u2715</button>
      </div>
      <div id="lottery-body">
        <div class="lot-section">
          <div class="lot-section-title">\uD83D\uDCC5 날짜 필터</div>
          <div class="lot-row">
            <label>시작 일시</label>
            <input type="datetime-local" id="lot-date-from" step="1">
          </div>
          <div class="lot-row">
            <label>종료 일시</label>
            <input type="datetime-local" id="lot-date-to" step="1">
          </div>
          <div class="lot-hint">비워두면 전체 기간의 댓글을 대상으로 합니다.</div>
        </div>

        <div class="lot-section">
          <div class="lot-section-title">\uD83D\uDD0D 댓글 내용 필터</div>
          <div class="lot-row">
            <label>포함 텍스트</label>
            <input type="text" id="lot-text-filter" placeholder="예: 참여 (비워두면 전체)">
          </div>
          <div class="lot-row">
            <label>제외 텍스트</label>
            <input type="text" id="lot-text-exclude" placeholder="예: 취소 (비워두면 제외 없음)">
          </div>
          <div class="lot-hint">포함 텍스트와 아카콘 필터는 OR 조건 (둘 중 하나라도 해당하면 포함). 제외 텍스트는 항상 적용됩니다.</div>
        </div>

        <div class="lot-section">
          <div class="lot-section-title">
            \uD83D\uDE00 아카콘 필터
            <div class="lot-emo-actions">
              <button class="lot-emo-btn" id="lot-emo-sel-all">전체선택</button>
              <button class="lot-emo-btn" id="lot-emo-desel-all">전체해제</button>
              <button class="lot-emo-btn" id="lot-emoticon-scan">\uD83D\uDD04 스캔</button>
            </div>
          </div>
          <div class="lot-emoticon-grid" id="lot-emoticon-grid"></div>
          <div class="lot-row" style="margin-top:8px;">
            <label>아카콘 ID</label>
            <input type="text" id="lot-emoticon-filter" placeholder="위에서 선택하거나 직접 입력" readonly>
          </div>
          <div class="lot-checkbox-row">
            <input type="checkbox" id="lot-any-emoticon">
            <label for="lot-any-emoticon">아카콘을 사용한 댓글 전부 포함</label>
          </div>
          <div class="lot-hint">썸네일 클릭으로 선택/해제. 여러 개 선택 가능.</div>
        </div>

        <div class="lot-section">
          <div class="lot-section-title">\u2699\uFE0F 추첨 설정</div>
          <div class="lot-row">
            <label>추첨 인원</label>
            <input type="number" id="lot-winner-count" value="1" min="1" max="9999">
            <span style="font-size:11px;color:#888;">명</span>
          </div>
          <div class="lot-checkbox-row">
            <input type="checkbox" id="lot-fixed-only" checked>
            <label for="lot-fixed-only">고정닉만 추첨 대상</label>
          </div>
          <div class="lot-checkbox-row">
            <input type="checkbox" id="lot-exclude-reply" checked>
            <label for="lot-exclude-reply">대댓글(답글) 제외</label>
          </div>
        </div>

        <button id="lottery-run-btn">\uD83C\uDFB0 추첨 시작</button>

        <div id="lottery-progress">
          <span id="lottery-progress-text">댓글 수집 중...</span>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" id="lottery-progress-bar" style="width:0%"></div>
          </div>
        </div>

        <div id="lottery-canvas-wrap">
          <canvas id="lottery-canvas" width="484" height="320"></canvas>
          <div id="lottery-anim-btns">
            <button id="lottery-replay-btn">\uD83D\uDD01 리플레이</button>
            <button id="lottery-save-btn">\uD83D\uDCBE 움짤 저장 (WebM)</button>
          </div>
        </div>

        <div id="lottery-result">
          <div class="lot-result-header"></div>
          <div class="lot-winner-list" id="lottery-winner-list"></div>
        </div>

        <div id="lottery-candidates">
          <div class="lot-cand-header">
            <span class="lot-cand-title">\uD83D\uDC65 추첨 대상자 목록</span>
            <span class="lot-cand-count" id="lottery-cand-count"></span>
          </div>
          <div class="lot-cand-list" id="lottery-cand-list"></div>
          <button id="lottery-confirm-btn">\u2705 대상자 확인 완료 - 추첨 진행</button>
        </div>

        <div id="lottery-log">
          <div class="lot-log-header">
            <span class="lot-log-title">\uD83D\uDCCB 추첨 로그</span>
            <button class="lot-log-copy">복사</button>
          </div>
          <div class="lot-log-area" id="lottery-log-area"></div>
        </div>

        <div id="lottery-footer">Made by @캬루는배신안함</div>
      </div>
    `;
  }

  // ===================== LOG & PROGRESS =====================

  let isRunning = false;
  let logLines = [];
  let pendingCandidates = null;
  let excludedUsers = new Set();
  let pendingWinnerCount = 0;

  function addLog(msg) {
    const ts = formatDate(new Date());
    logLines.push(`[${ts}] ${msg}`);
    const el = document.getElementById("lottery-log-area");
    if (el) { el.textContent = logLines.join("\n"); el.scrollTop = el.scrollHeight; }
  }

  function setProgress(text, pct) {
    const el = document.getElementById("lottery-progress");
    const t = document.getElementById("lottery-progress-text");
    const b = document.getElementById("lottery-progress-bar");
    if (el) el.style.display = "block";
    if (t) t.textContent = text;
    if (b) b.style.width = pct + "%";
  }

  // ===================== ANIMATION SYSTEM =====================

  const ANIM_COLORS = ["#ff6b6b","#ffd43b","#51cf66","#339af0","#cc5de8","#ff922b","#20c997","#e599f7","#f783ac","#748ffc","#a9e34b","#ffa94d"];
  let recordedBlob = null;
  let lastAnimWinners = null;
  let lastAnimCandidates = null;

  function truncName(name, max) {
    return name.length > max ? name.substring(0, max) + ".." : name;
  }

  // --- Winner Overlay (shared) ---
  function drawOverlay(ctx, W, H, winners) {
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "36px sans-serif";
    ctx.fillText("\uD83C\uDFC6", W / 2, H / 2 - 50);

    ctx.fillStyle = "#ffd43b";
    ctx.font = 'bold 18px "Malgun Gothic", sans-serif';
    ctx.fillText("\uB2F9\uCCA8\uC790 \uBC1C\uD45C!", W / 2, H / 2 - 14);

    const maxShow = Math.min(winners.length, 5);
    for (let i = 0; i < maxShow; i++) {
      ctx.fillStyle = i === 0 ? "#ffd43b" : "#e0e0e0";
      ctx.font = 'bold 14px "Malgun Gothic", sans-serif';
      ctx.fillText(`${i + 1}\uB4F1: ${winners[i].username}`, W / 2, H / 2 + 18 + i * 26);
    }
    if (winners.length > maxShow) {
      ctx.fillStyle = "#888";
      ctx.font = '12px "Malgun Gothic", sans-serif';
      ctx.fillText(`\uC678 ${winners.length - maxShow}\uBA85...`, W / 2, H / 2 + 18 + maxShow * 26);
    }
  }

  function showOverlayLoop(ctx, W, H, winners, durationMs) {
    return new Promise(resolve => {
      const start = performance.now();
      (function tick(now) {
        drawOverlay(ctx, W, H, winners);
        if (now - start < durationMs) requestAnimationFrame(tick);
        else resolve();
      })(performance.now());
    });
  }

  // --- Race (경마) ---
  function animRace(ctx, canvas, winners, candidates) {
    return new Promise(resolve => {
      const W = canvas.width, H = canvas.height, DUR = 6000;
      const maxR = Math.min(8, candidates.length);
      const winSet = new Set(winners.map(w => w.username));
      const nonW = shuffleArray(candidates.filter(c => !winSet.has(c.username)));
      const runnerData = [
        ...winners.slice(0, maxR).map((w, i) => ({ name: w.username, rank: i, isW: true })),
        ...nonW.slice(0, Math.max(0, maxR - winners.length)).map(c => ({ name: c.username, rank: 999, isW: false }))
      ];
      const runners = shuffleArray(runnerData);
      const trackH = Math.min(34, (H - 60) / runners.length);
      const trackTop = 44;
      const finishX = W - 16;
      const startX = 80;
      const trackLen = finishX - startX;

      const targets = runners.map(r => r.isW ? 1.0 - r.rank * 0.015 : 0.5 + Math.random() * 0.35);
      const phases = runners.map((_, i) => i * 2.1 + Math.random() * 3);
      const freqs = runners.map(() => 2 + Math.random() * 3);
      const emojis = ["\uD83C\uDFC7","\uD83D\uDC0E","\uD83E\uDD84","\uD83D\uDC06","\uD83D\uDC15","\uD83D\uDC3A","\uD83E\uDD8A","\uD83D\uDC31"];
      const t0 = performance.now();

      function frame(now) {
        const t = Math.min((now - t0) / DUR, 1);
        const ease = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2;

        ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = "#ffd43b"; ctx.font = 'bold 15px "Malgun Gothic", sans-serif';
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText("\uD83C\uDFC7 \uACBD\uB9C8 \uCD94\uCCA8!", W / 2, 8);

        // finish line
        ctx.save(); ctx.strokeStyle = "#e9456088"; ctx.lineWidth = 2; ctx.setLineDash([4,4]);
        ctx.beginPath(); ctx.moveTo(finishX, trackTop - 4); ctx.lineTo(finishX, trackTop + runners.length * trackH + 4); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "#e9456088"; ctx.font = "9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.fillText("FINISH", finishX, trackTop - 5);

        for (let i = 0; i < runners.length; i++) {
          const r = runners[i];
          const y = trackTop + i * trackH;
          const wobble = Math.sin(ease * freqs[i] * Math.PI * 2 + phases[i]) * 0.012;
          const prog = Math.min(ease * targets[i] + (t < 0.95 ? wobble : 0), targets[i]);
          const x = startX + prog * trackLen;

          ctx.fillStyle = "#16213e"; ctx.fillRect(startX, y + 1, trackLen, trackH - 2);
          ctx.fillStyle = ANIM_COLORS[i % ANIM_COLORS.length];
          ctx.globalAlpha = 0.75; ctx.fillRect(startX, y + 3, Math.max(0, x - startX), trackH - 6); ctx.globalAlpha = 1;

          ctx.font = `${Math.min(20, trackH - 6)}px sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(emojis[i % emojis.length], Math.min(x + 10, finishX), y + trackH / 2);

          ctx.fillStyle = "#ccc"; ctx.font = '10px "Malgun Gothic", sans-serif';
          ctx.textAlign = "right"; ctx.textBaseline = "middle";
          ctx.fillText(truncName(r.name, 6), startX - 4, y + trackH / 2);
        }

        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // --- Roulette (룰렛) ---
  function animRoulette(ctx, canvas, winners, candidates) {
    return new Promise(resolve => {
      const W = canvas.width, H = canvas.height, DUR = 7000, FLASH_DUR = 1500;
      const cx = W / 2, cy = H / 2 + 12;
      const radius = Math.min(W, H) / 2 - 45;
      const maxSeg = Math.min(12, candidates.length);
      const winSet = new Set(winners.map(w => w.username));
      const nonW = shuffleArray(candidates.filter(c => !winSet.has(c.username)));
      const winSlice = winners.slice(0, Math.min(winners.length, maxSeg));
      const segs = shuffleArray([ ...winSlice, ...nonW.slice(0, maxSeg - winSlice.length) ]);
      const winIdx = segs.findIndex(s => s.username === winners[0].username);
      const winIndices = new Set(segs.map((s, i) => winSet.has(s.username) ? i : -1).filter(i => i >= 0));
      const segA = (Math.PI * 2) / segs.length;
      const targetA = -Math.PI / 2 - winIdx * segA - segA / 2;
      const totalRot = Math.PI * 2 * (6 + Math.random() * 5) + targetA;
      const t0 = performance.now();
      const totalDur = DUR + FLASH_DUR;

      function frame(now) {
        const elapsed = now - t0;
        const t = Math.min(elapsed / DUR, 1);
        const ease = 1 - Math.pow(1 - t, 3.5);
        const angle = ease * totalRot;
        const flashing = elapsed > DUR;

        ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ffd43b"; ctx.font = 'bold 15px "Malgun Gothic", sans-serif';
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(`\uD83C\uDFB0 \uB8F0\uB819 \uCD94\uCCA8! (${winners.length}\uBA85)`, W / 2, 6);

        for (let i = 0; i < segs.length; i++) {
          const sa = angle + i * segA, ea = sa + segA;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, sa, ea); ctx.closePath();
          const isWinSeg = winIndices.has(i);
          if (flashing && isWinSeg) {
            const flash = Math.sin(elapsed / 120) > 0;
            ctx.fillStyle = flash ? "#ffd43b" : ANIM_COLORS[i % ANIM_COLORS.length];
            ctx.globalAlpha = 1;
          } else {
            ctx.fillStyle = ANIM_COLORS[i % ANIM_COLORS.length];
            ctx.globalAlpha = 0.85;
          }
          ctx.fill(); ctx.globalAlpha = 1;
          ctx.strokeStyle = "#0d1117"; ctx.lineWidth = 2; ctx.stroke();

          ctx.save(); ctx.translate(cx, cy); ctx.rotate(sa + segA / 2);
          ctx.fillStyle = "#fff"; ctx.font = (flashing && isWinSeg ? 'bold ' : '') + '11px "Malgun Gothic", sans-serif';
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(truncName(segs[i].username, 7), radius * 0.62, 0);
          ctx.restore();
        }

        // center
        ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fillStyle = "#1a1a2e"; ctx.fill(); ctx.strokeStyle = "#ffd43b"; ctx.lineWidth = 2; ctx.stroke();
        if (flashing && winners.length > 1) {
          ctx.fillStyle = "#ffd43b"; ctx.font = 'bold 12px sans-serif';
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(`${winners.length}`, cx, cy);
        }

        // pointer
        ctx.fillStyle = "#e94560"; ctx.beginPath();
        ctx.moveTo(cx, cy - radius - 12); ctx.lineTo(cx - 9, cy - radius - 28); ctx.lineTo(cx + 9, cy - radius - 28);
        ctx.closePath(); ctx.fill();

        if (elapsed < totalDur) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // --- Slot Machine (슬롯머신) ---
  function animSlot(ctx, canvas, winners, candidates) {
    return new Promise(resolve => {
      const W = canvas.width, H = canvas.height;
      const winCount = winners.length;
      const itemH = 36, slotTop = 50;
      const visible = Math.floor((H - slotTop - 20) / itemH);
      const centerIdx = Math.floor(visible / 2);
      const panelW = 320, panelX = (W - panelW) / 2;

      // build name list: place winners consecutively so they all show in the center area
      const winNames = new Set(winners.map(w => w.username));
      const otherNames = shuffleArray(candidates.filter(c => !winNames.has(c.username)).map(c => c.username));
      const names = [...otherNames, ...winners.map(w => w.username)];
      const firstWinPos = otherNames.length;
      // center the winner group: we want firstWinPos to land at centerIdx
      const totalScroll = names.length * 4 + firstWinPos - centerIdx;
      const DUR = 5500 + Math.min(winCount, 5) * 300;
      const FLASH_DUR = 1200;
      const totalTime = DUR + FLASH_DUR;
      const t0 = performance.now();

      function frame(now) {
        const elapsed = now - t0;
        const t = Math.min(elapsed / DUR, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        const scroll = ease * totalScroll;
        const stopped = elapsed > DUR;

        ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ffd43b"; ctx.font = 'bold 15px "Malgun Gothic", sans-serif';
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(`\uD83C\uDFB0 \uC2AC\uB86F\uBA38\uC2E0 \uCD94\uCCA8! (${winCount}\uBA85)`, W / 2, 8);

        ctx.fillStyle = "#16213e"; ctx.fillRect(panelX, slotTop, panelW, visible * itemH);

        ctx.save();
        ctx.beginPath(); ctx.rect(panelX, slotTop, panelW, visible * itemH); ctx.clip();

        for (let i = -1; i < visible + 2; i++) {
          const ni = Math.floor(scroll) + i;
          const ai = ((ni % names.length) + names.length) % names.length;
          const offset = scroll - Math.floor(scroll);
          const y = slotTop + (i - offset) * itemH;
          const isWin = winNames.has(names[ai]);

          if (stopped && isWin) {
            const flash = Math.sin(elapsed / 100) > 0;
            ctx.fillStyle = flash ? "rgba(255,212,59,0.3)" : "rgba(233,69,96,0.25)";
          } else {
            ctx.fillStyle = ANIM_COLORS[ai % ANIM_COLORS.length]; ctx.globalAlpha = 0.15;
          }
          ctx.fillRect(panelX + 4, y + 2, panelW - 8, itemH - 4);
          ctx.globalAlpha = 1;

          ctx.fillStyle = (stopped && isWin) ? "#ffd43b" : "#e0e0e0";
          ctx.font = (stopped && isWin) ? 'bold 14px "Malgun Gothic", sans-serif' : '14px "Malgun Gothic", sans-serif';
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const prefix = (stopped && isWin) ? "\u2B50 " : "";
          ctx.fillText(prefix + truncName(names[ai], 12), W / 2, y + itemH / 2);
        }
        ctx.restore();

        // highlight box (covers winner group)
        const hlY = slotTop + centerIdx * itemH;
        const hlCount = Math.min(winCount, visible - centerIdx);
        ctx.strokeStyle = "#e94560"; ctx.lineWidth = 3;
        ctx.strokeRect(panelX - 2, hlY, panelW + 4, itemH * hlCount);

        // arrows
        ctx.fillStyle = "#e94560";
        const arrowCY = hlY + (itemH * hlCount) / 2;
        ctx.beginPath(); ctx.moveTo(panelX - 14, arrowCY); ctx.lineTo(panelX - 4, arrowCY - 10); ctx.lineTo(panelX - 4, arrowCY + 10); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(panelX + panelW + 14, arrowCY); ctx.lineTo(panelX + panelW + 4, arrowCY - 10); ctx.lineTo(panelX + panelW + 4, arrowCY + 10); ctx.closePath(); ctx.fill();

        // fade edges
        const g1 = ctx.createLinearGradient(0, slotTop, 0, slotTop + itemH * 1.5);
        g1.addColorStop(0, "#0d1117"); g1.addColorStop(1, "rgba(13,17,23,0)");
        ctx.fillStyle = g1; ctx.fillRect(panelX, slotTop, panelW, itemH * 1.5);
        const g2 = ctx.createLinearGradient(0, slotTop + visible * itemH - itemH * 1.5, 0, slotTop + visible * itemH);
        g2.addColorStop(0, "rgba(13,17,23,0)"); g2.addColorStop(1, "#0d1117");
        ctx.fillStyle = g2; ctx.fillRect(panelX, slotTop + visible * itemH - itemH * 1.5, panelW, itemH * 1.5);

        if (elapsed < totalTime) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // --- Crane Game (인형뽑기) ---
  function animCrane(ctx, canvas, winners, candidates) {
    return new Promise(resolve => {
      const W = canvas.width, H = canvas.height;
      const maxBalls = Math.min(12, candidates.length);
      const winSet = new Set(winners.map(w => w.username));
      const nonW = shuffleArray(candidates.filter(c => !winSet.has(c.username)));
      const winSlice = winners.slice(0, Math.min(winners.length, maxBalls));
      const ballData = shuffleArray([
        ...winSlice.map(w => ({ name: w.username, isW: true })),
        ...nonW.slice(0, maxBalls - winSlice.length).map(c => ({ name: c.username, isW: false }))
      ]);

      const ballR = 22;
      const floorY = H - 50;
      const balls = ballData.map((b, i) => {
        const cols = Math.min(maxBalls, 6);
        const row = Math.floor(i / cols);
        const col = i % cols;
        const spacing = (W - 80) / cols;
        return {
          ...b,
          x: 60 + col * spacing + spacing / 2 + (Math.random() - 0.5) * 10,
          y: floorY - ballR - row * (ballR * 2 + 4),
          origX: 0, origY: 0,
          color: ANIM_COLORS[i % ANIM_COLORS.length],
          grabbed: false
        };
      });
      balls.forEach(b => { b.origX = b.x; b.origY = b.y; });

      const winBalls = balls.filter(b => b.isW);
      // average position of all winner balls as grab target
      const targetX = winBalls.reduce((s, b) => s + b.x, 0) / winBalls.length;
      const targetY = Math.min(...winBalls.map(b => b.y));
      const clawHomeX = W / 2, clawHomeY = 55;

      // phases: 0=move to target X, 1=descend, 2=grab+ascend, 3=move to center+show
      const phaseDur = [1500, 1200, 1500, 1200];
      const totalDur = phaseDur.reduce((a, b) => a + b, 0);
      const t0 = performance.now();

      function drawClaw(x, y, open, wide) {
        ctx.strokeStyle = "#888"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, y - 12); ctx.stroke();
        ctx.fillStyle = "#aaa";
        ctx.fillRect(x - 12, y - 14, 24, 10);
        const spread = open ? (wide ? 22 : 16) : (wide ? 10 : 6);
        ctx.strokeStyle = "#ccc"; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.lineTo(x - spread, y + 14); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 6, y - 4); ctx.lineTo(x + spread, y + 14); ctx.stroke();
        ctx.beginPath(); ctx.arc(x - spread, y + 14, 3, 0, Math.PI * 2); ctx.fillStyle = "#ccc"; ctx.fill();
        ctx.beginPath(); ctx.arc(x + spread, y + 14, 3, 0, Math.PI * 2); ctx.fillStyle = "#ccc"; ctx.fill();
      }

      function drawBall(b) {
        ctx.beginPath(); ctx.arc(b.x, b.y, ballR, 0, Math.PI * 2);
        ctx.fillStyle = b.color; ctx.globalAlpha = 0.9; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = b.isW && b.grabbed ? "#ffd43b" : "rgba(255,255,255,0.3)";
        ctx.lineWidth = b.isW && b.grabbed ? 3 : 2; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = '10px "Malgun Gothic", sans-serif';
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(truncName(b.name, 5), b.x, b.y);
      }

      const wide = winBalls.length > 1;

      function frame(now) {
        const elapsed = now - t0;
        const t = Math.min(elapsed / totalDur, 1);

        ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ffd43b"; ctx.font = 'bold 15px "Malgun Gothic", sans-serif';
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(`\uD83E\uDE9D \uC778\uD615\uBF51\uAE30 \uCD94\uCCA8! (${winSlice.length}\uBA85)`, W / 2, 6);

        ctx.strokeStyle = "#333"; ctx.lineWidth = 3;
        ctx.strokeRect(30, 28, W - 60, H - 56);
        ctx.fillStyle = "#222"; ctx.fillRect(30, 28, W - 60, 8);
        ctx.fillStyle = "#1a1a2e"; ctx.fillRect(30, floorY + ballR + 4, W - 60, 20);

        let clawX = clawHomeX, clawY = clawHomeY, clawOpen = true;
        let phase = 0, phaseT = 0, accum = 0;
        for (let p = 0; p < phaseDur.length; p++) {
          if (elapsed < accum + phaseDur[p]) { phase = p; phaseT = (elapsed - accum) / phaseDur[p]; break; }
          accum += phaseDur[p];
          if (p === phaseDur.length - 1) { phase = p; phaseT = 1; }
        }
        phaseT = Math.min(phaseT, 1);
        const ease = t => t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;

        if (phase === 0) {
          clawX = clawHomeX + (targetX - clawHomeX) * ease(phaseT);
          clawY = clawHomeY;
          clawOpen = true;
        } else if (phase === 1) {
          clawX = targetX;
          clawY = clawHomeY + (targetY - 20 - clawHomeY) * ease(phaseT);
          clawOpen = phaseT < 0.8;
        } else if (phase === 2) {
          clawX = targetX;
          clawY = (targetY - 20) + (clawHomeY - (targetY - 20)) * ease(phaseT);
          clawOpen = false;
          for (const wb of winBalls) {
            wb.grabbed = true;
            const offX = wb.origX - targetX;
            wb.x = clawX + offX * 0.4;
            wb.y = clawY + 22 + (wb.origY - targetY) * 0.3;
          }
        } else {
          clawX = targetX + (W / 2 - targetX) * ease(phaseT);
          clawY = clawHomeY;
          clawOpen = false;
          for (const wb of winBalls) {
            const offX = wb.origX - targetX;
            wb.x = clawX + offX * 0.4;
            wb.y = clawY + 22 + (wb.origY - targetY) * 0.3;
          }
        }

        for (const b of balls) { if (!b.grabbed) drawBall(b); }
        drawClaw(clawX, clawY, clawOpen, wide);
        for (const b of winBalls) { if (b.grabbed) drawBall(b); }

        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // --- Battle Royale (배틀로얄) ---
  function animBattleRoyale(ctx, canvas, winners, candidates) {
    return new Promise(resolve => {
      const W = canvas.width, H = canvas.height, DUR = 7000;
      const cx = W / 2, cy = H / 2 + 10;
      const maxR = Math.min(16, candidates.length);
      const winSet = new Set(winners.map(w => w.username));
      const nonW = shuffleArray(candidates.filter(c => !winSet.has(c.username)));
      const winSlice = winners.slice(0, Math.min(winners.length, maxR));
      const playerData = shuffleArray([
        ...winSlice.map(w => ({ name: w.username, isW: true })),
        ...nonW.slice(0, maxR - winSlice.length).map(c => ({ name: c.username, isW: false }))
      ]);

      const startRadius = Math.min(W, H) / 2 - 50;
      const players = playerData.map((p, i) => {
        const angle = (i / playerData.length) * Math.PI * 2 + Math.random() * 0.3;
        const dist = startRadius * (0.3 + Math.random() * 0.6);
        return {
          ...p,
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          alive: true,
          elimAt: 0,
          color: ANIM_COLORS[i % ANIM_COLORS.length],
          baseAngle: angle
        };
      });

      // schedule eliminations: non-winners get eliminated at random times between 15%~85% of duration
      const nonWinners = players.filter(p => !p.isW);
      const elimTimes = nonWinners.map(() => 0.15 + Math.random() * 0.7).sort((a, b) => a - b);
      nonWinners.forEach((p, i) => { p.elimAt = elimTimes[i]; });

      const t0 = performance.now();

      function frame(now) {
        const t = Math.min((now - t0) / DUR, 1);
        const zoneRadius = startRadius * (1 - t * 0.85);

        ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, W, H);

        // title
        ctx.fillStyle = "#ffd43b"; ctx.font = 'bold 15px "Malgun Gothic", sans-serif';
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        const aliveCount = players.filter(p => p.alive).length;
        ctx.fillText(`\u2694\uFE0F \uBC30\uD2C0\uB85C\uC584 \uCD94\uCCA8! (${winSlice.length}\uBA85) [\uC0DD\uC874: ${aliveCount}/${players.length}]`, W / 2, 6);

        // danger zone (red outside)
        ctx.beginPath(); ctx.arc(cx, cy, startRadius + 20, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(233,69,96,0.08)"; ctx.fill();

        // safe zone
        ctx.beginPath(); ctx.arc(cx, cy, zoneRadius, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(81,207,102,0.5)"; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(81,207,102,0.04)"; ctx.fill();

        // zone shrink warning rings
        ctx.beginPath(); ctx.arc(cx, cy, zoneRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(233,69,96,${0.2 + Math.sin(now / 200) * 0.15})`;
        ctx.lineWidth = 1; ctx.stroke();

        // eliminate players
        for (const p of players) {
          if (!p.isW && p.alive && t >= p.elimAt) {
            p.alive = false;
          }
        }

        // move alive players (wander inside zone)
        for (const p of players) {
          if (!p.alive) continue;
          p.vx += (Math.random() - 0.5) * 0.4;
          p.vy += (Math.random() - 0.5) * 0.4;
          p.vx *= 0.95; p.vy *= 0.95;
          p.x += p.vx; p.y += p.vy;

          // keep inside safe zone
          const dx = p.x - cx, dy = p.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = zoneRadius - 14;
          if (dist > maxDist && maxDist > 0) {
            const angle = Math.atan2(dy, dx);
            p.x = cx + Math.cos(angle) * maxDist;
            p.y = cy + Math.sin(angle) * maxDist;
            p.vx *= -0.5; p.vy *= -0.5;
          }
        }

        // draw eliminated players (faded X)
        for (const p of players) {
          if (p.alive) continue;
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = "#666"; ctx.font = '16px sans-serif';
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("\u2716", p.x, p.y);
          ctx.font = '8px "Malgun Gothic", sans-serif';
          ctx.fillText(truncName(p.name, 4), p.x, p.y + 14);
          ctx.globalAlpha = 1;
        }

        // draw alive players
        for (const p of players) {
          if (!p.alive) continue;
          const r = p.isW && t > 0.9 ? 13 + Math.sin(now / 100) * 2 : 11;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = p.color; ctx.globalAlpha = 0.85; ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = p.isW && t > 0.9 ? "#ffd43b" : "rgba(255,255,255,0.3)";
          ctx.lineWidth = p.isW && t > 0.9 ? 2.5 : 1.5; ctx.stroke();
          ctx.fillStyle = "#fff"; ctx.font = '9px "Malgun Gothic", sans-serif';
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(truncName(p.name, 4), p.x, p.y);
        }

        // crown on winners at the end
        if (t > 0.92) {
          for (const wp of players.filter(p => p.isW && p.alive)) {
            ctx.font = '18px sans-serif'; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
            ctx.fillText("\uD83D\uDC51", wp.x, wp.y - 14);
          }
        }

        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // --- Play & Record ---
  async function playAnimation(winners, candidates) {
    const wrap = document.getElementById("lottery-canvas-wrap");
    const canvas = document.getElementById("lottery-canvas");
    const ctx = canvas.getContext("2d");
    const saveBtn = document.getElementById("lottery-save-btn");
    const replayBtn = document.getElementById("lottery-replay-btn");
    wrap.style.display = "block";
    saveBtn.style.display = "none";
    replayBtn.style.display = "none";
    recordedBlob = null;
    lastAnimWinners = winners;
    lastAnimCandidates = candidates;

    const games = ["race", "roulette", "slot", "crane", "royale"];
    const game = games[Math.floor(Math.random() * games.length)];
    const gameNames = { race: "\uACBD\uB9C8", roulette: "\uB8F0\uB819", slot: "\uC2AC\uB86F\uBA38\uC2E0", crane: "\uC778\uD615\uBF51\uAE30", royale: "\uBC30\uD2C0\uB85C\uC584" };
    addLog(`\uCD94\uCCA8 \uC560\uB2C8\uBA54\uC774\uC158: ${gameNames[game]}`);

    // start recording
    let recorder = null, chunks = [];
    try {
      const stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.start();
    } catch (e) { recorder = null; }

    // play main animation
    if (game === "race") await animRace(ctx, canvas, winners, candidates);
    else if (game === "roulette") await animRoulette(ctx, canvas, winners, candidates);
    else if (game === "slot") await animSlot(ctx, canvas, winners, candidates);
    else if (game === "crane") await animCrane(ctx, canvas, winners, candidates);
    else await animBattleRoyale(ctx, canvas, winners, candidates);

    // show winner overlay with continuous frames for recording
    await sleep(400);
    await showOverlayLoop(ctx, canvas.width, canvas.height, winners, 2500);

    // stop recording
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      await new Promise(r => { recorder.onstop = r; });
      recordedBlob = new Blob(chunks, { type: "video/webm" });
      saveBtn.style.display = "inline-block";
      addLog("\uC6C0\uC9E4 \uC800\uC7A5 \uAC00\uB2A5");
    }
    replayBtn.style.display = "inline-block";
  }

  async function replayAnimation() {
    if (!lastAnimWinners || !lastAnimCandidates) return;
    await playAnimation(lastAnimWinners, lastAnimCandidates);
  }

  function saveRecording() {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lottery-${article.articleId}-${Date.now()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===================== LOTTERY LOGIC =====================

  async function runLottery() {
    if (isRunning) return;
    isRunning = true;
    logLines = [];
    pendingCandidates = null;
    excludedUsers = new Set();

    const runBtn = document.getElementById("lottery-run-btn");
    runBtn.disabled = true;
    runBtn.textContent = "\u23F3 추첨 진행 중...";

    const resultEl = document.getElementById("lottery-result");
    resultEl.style.display = "none";
    document.getElementById("lottery-candidates").style.display = "none";
    document.getElementById("lottery-confirm-btn").style.display = "none";
    document.getElementById("lottery-canvas-wrap").style.display = "none";
    document.getElementById("lottery-save-btn").style.display = "none";
    document.getElementById("lottery-replay-btn").style.display = "none";
    const logEl = document.getElementById("lottery-log");
    logEl.style.display = "block";
    document.getElementById("lottery-log-area").textContent = "";

    try {
      const dateFromVal = document.getElementById("lot-date-from").value;
      const dateToVal = document.getElementById("lot-date-to").value;
      const dateFrom = dateFromVal ? new Date(dateFromVal) : null;
      const dateTo = dateToVal ? new Date(dateToVal) : null;
      const textFilter = document.getElementById("lot-text-filter").value.trim();
      const textExclude = document.getElementById("lot-text-exclude").value.trim();
      const emoticonIds = document.getElementById("lot-emoticon-filter").value.split(",").map(s => s.trim()).filter(Boolean);
      const anyEmoticon = document.getElementById("lot-any-emoticon").checked;
      const winnerCount = parseInt(document.getElementById("lot-winner-count").value) || 1;
      const fixedOnly = document.getElementById("lot-fixed-only").checked;
      const excludeReply = document.getElementById("lot-exclude-reply").checked;

      addLog("=== \uB313\uAE00 \uCD94\uCCA8 \uC2DC\uC791 ===");
      addLog(`\uAC8C\uC2DC\uAE00: /b/${article.channel}/${article.articleId}`);
      addLog(`URL: ${location.href}`);
      addLog(`\uCD94\uCCA8 \uC778\uC6D0: ${winnerCount}\uBA85`);
      if (dateFrom) addLog(`\uC2DC\uC791 \uC77C\uC2DC: ${formatDate(dateFrom)}`);
      if (dateTo) addLog(`\uC885\uB8CC \uC77C\uC2DC: ${formatDate(dateTo)}`);
      if (textFilter) addLog(`\uD3EC\uD568 \uD14D\uC2A4\uD2B8: "${textFilter}"`);
      if (textExclude) addLog(`\uC81C\uC678 \uD14D\uC2A4\uD2B8: "${textExclude}"`);
      if (emoticonIds.length > 0) addLog(`\uC544\uCE74\uCF58 ID \uD544\uD130: ${emoticonIds.join(", ")}`);
      if (anyEmoticon) addLog(`\uC544\uCE74\uCF58 \uC0AC\uC6A9 \uB313\uAE00 \uC804\uBD80 \uD3EC\uD568: ON`);
      if (textFilter && (emoticonIds.length > 0 || anyEmoticon)) addLog(`\uD14D\uC2A4\uD2B8 + \uC544\uCE74\uCF58 \uD544\uD130: OR \uC870\uAC74 (\uB458 \uC911 \uD558\uB098\uB77C\uB3C4 \uD574\uB2F9\uD558\uBA74 \uD3EC\uD568)`);
      addLog(`\uACE0\uC815\uB2C9\uB9CC: ${fixedOnly ? "ON" : "OFF"}`);
      addLog(`\uB300\uB313\uAE00 \uC81C\uC678: ${excludeReply ? "ON" : "OFF"}`);
      addLog("");

      setProgress("\uCCAB \uD398\uC774\uC9C0 \uB85C\uB529 \uC911...", 0);
      addLog("\uB313\uAE00 \uD398\uC774\uC9C0 \uC218\uC9D1 \uC2DC\uC791...");

      const firstPage = await fetchCommentPage(1);
      const totalPages = getTotalCommentPages(firstPage.doc);
      addLog(`\uCD1D \uB313\uAE00 \uD398\uC774\uC9C0: ${totalPages}\uD398\uC774\uC9C0`);

      let allComments = [...firstPage.comments];
      addLog(`1\uD398\uC774\uC9C0: ${firstPage.comments.length}\uAC1C \uB313\uAE00 \uC218\uC9D1`);

      for (let p = 2; p <= totalPages; p++) {
        setProgress(`\uB313\uAE00 \uC218\uC9D1 \uC911... (${p}/${totalPages})`, ((p - 1) / totalPages) * 60);
        await sleep(500);
        const page = await fetchCommentPage(p);
        addLog(`${p}\uD398\uC774\uC9C0: ${page.comments.length}\uAC1C \uB313\uAE00 \uC218\uC9D1`);
        allComments = allComments.concat(page.comments);
      }

      setProgress("\uB313\uAE00 \uD544\uD130\uB9C1 \uC911...", 65);
      addLog("");
      addLog(`\uCD1D \uC218\uC9D1\uB41C \uB313\uAE00: ${allComments.length}\uAC1C`);

      let filtered = [...allComments];

      if (excludeReply) {
        const b = filtered.length;
        filtered = filtered.filter(c => !c.isReply);
        addLog(`\uB300\uB313\uAE00 \uC81C\uC678: ${b - filtered.length}\uAC1C \uC81C\uAC70 -> ${filtered.length}\uAC1C \uB0A8\uC74C`);
      }

      if (dateFrom || dateTo) {
        const b = filtered.length;
        filtered = filtered.filter(c => {
          if (!c.datetime) return false;
          if (dateFrom && c.datetime < dateFrom) return false;
          if (dateTo && c.datetime > dateTo) return false;
          return true;
        });
        addLog(`\uB0A0\uC9DC \uD544\uD130 \uC801\uC6A9: ${b - filtered.length}\uAC1C \uC81C\uAC70 -> ${filtered.length}\uAC1C \uB0A8\uC74C`);
      }

      if (fixedOnly) {
        const b = filtered.length;
        filtered = filtered.filter(c => c.isFixed);
        addLog(`\uACE0\uC815\uB2C9 \uD544\uD130 \uC801\uC6A9: ${b - filtered.length}\uAC1C \uC81C\uAC70 -> ${filtered.length}\uAC1C \uB0A8\uC74C`);
      } else {
        const b = filtered.length;
        filtered = filtered.filter(c => c.userType !== "anonymous");
        addLog(`\uC775\uBA85 \uC81C\uC678: ${b - filtered.length}\uAC1C \uC81C\uAC70 -> ${filtered.length}\uAC1C \uB0A8\uC74C`);
      }

      // 제외 텍스트 필터 (항상 적용)
      if (textExclude) {
        const b = filtered.length;
        filtered = filtered.filter(c => !c.text.includes(textExclude));
        addLog(`제외 텍스트 "${textExclude}" 적용: ${b - filtered.length}개 제거 -> ${filtered.length}개 남음`);
      }

      // 텍스트 + 아카콘 필터 (OR 조건)
      const hasTextFilter = !!textFilter;
      const hasEmoFilter = emoticonIds.length > 0 || anyEmoticon;
      const emoSet = new Set(emoticonIds);

      if (hasTextFilter && hasEmoFilter) {
        const b = filtered.length;
        filtered = filtered.filter(c => {
          const textMatch = c.text.includes(textFilter);
          const emoMatch = emoticonIds.length > 0
            ? c.emoticons.some(id => emoSet.has(id))
            : c.emoticons.length > 0;
          return textMatch || emoMatch;
        });
        addLog(`텍스트/아카콘 OR 필터 적용: ${b - filtered.length}개 제거 -> ${filtered.length}개 남음`);
      } else if (hasTextFilter) {
        const b = filtered.length;
        filtered = filtered.filter(c => c.text.includes(textFilter));
        addLog(`텍스트 필터 "${textFilter}" 적용: ${b - filtered.length}개 제거 -> ${filtered.length}개 남음`);
      } else if (emoticonIds.length > 0) {
        const b = filtered.length;
        filtered = filtered.filter(c => c.emoticons.some(id => emoSet.has(id)));
        addLog(`아카콘 ID [${emoticonIds.join(", ")}] 필터: ${b - filtered.length}개 제거 -> ${filtered.length}개 남음`);
      } else if (anyEmoticon) {
        const b = filtered.length;
        filtered = filtered.filter(c => c.emoticons.length > 0);
        addLog(`아카콘 사용 필터: ${b - filtered.length}개 제거 -> ${filtered.length}개 남음`);
      }

      setProgress("\uC911\uBCF5 \uACC4\uC815 \uC81C\uAC70 \uC911...", 80);

      const seenUsers = new Set();
      const uniqueComments = [];
      let dupCount = 0;
      for (const c of filtered) {
        if (seenUsers.has(c.username)) { dupCount++; continue; }
        seenUsers.add(c.username);
        uniqueComments.push(c);
      }
      addLog(`\uC911\uBCF5 \uACC4\uC815 \uC81C\uAC70: ${dupCount}\uAC1C \uC911\uBCF5 -> ${uniqueComments.length}\uBA85 \uACE0\uC720 \uCC38\uC5EC\uC790`);
      addLog("");
      addLog(`=== \uCD5C\uC885 \uCD94\uCCA8 \uB300\uC0C1: ${uniqueComments.length}\uBA85 ===`);

      for (let i = 0; i < uniqueComments.length; i++) {
        const c = uniqueComments[i];
        const tp = c.isFixed ? "[\uACE0\uC815\uB2C9]" : "[\uACC4\uC815]";
        const tm = c.datetime ? formatDate(c.datetime) : "\uC2DC\uAC04\uC5C6\uC74C";
        const ct = c.text || (c.emoticons.length > 0 ? `[\uC544\uCE74\uCF58:${c.emoticons.join(",")}]` : "[\uB0B4\uC6A9\uC5C6\uC74C]");
        addLog(`  ${i + 1}. ${tp} ${c.username} (${tm}) - ${ct}`);
      }

      if (uniqueComments.length === 0) {
        addLog(""); addLog("\uCD94\uCCA8 \uB300\uC0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
        setProgress("\uCD94\uCCA8 \uB300\uC0C1 \uC5C6\uC74C", 100);
        runBtn.disabled = false; runBtn.textContent = "\uD83C\uDFB0 \uCD94\uCCA8 \uC2DC\uC791";
        isRunning = false; return;
      }

      // 대상자 목록 표시 → 사용자 확인 대기
      pendingCandidates = uniqueComments;
      pendingWinnerCount = winnerCount;
      excludedUsers = new Set();
      displayCandidates(uniqueComments);
      setProgress("\uB300\uC0C1\uC790 \uD655\uC778 \uB300\uAE30 \uC911... \uC81C\uC678\uD560 \uC0AC\uB78C\uC744 \uC120\uD0DD\uD558\uC138\uC694.", 85);
      runBtn.disabled = false; runBtn.textContent = "\uD83C\uDFB0 \uCD94\uCCA8 \uC2DC\uC791";
      isRunning = false;

    } catch (err) {
      addLog(`\uC624\uB958 \uBC1C\uC0DD: ${err.message}`);
      setProgress("\uC624\uB958 \uBC1C\uC0DD", 100);
      runBtn.disabled = false; runBtn.textContent = "\uD83C\uDFB0 \uCD94\uCCA8 \uC2DC\uC791";
      isRunning = false;
    }
  }

  async function confirmLottery() {
    if (!pendingCandidates || isRunning) return;
    isRunning = true;

    const runBtn = document.getElementById("lottery-run-btn");
    runBtn.disabled = true;
    document.getElementById("lottery-confirm-btn").style.display = "none";

    // 제외된 사용자 필터링
    let finalCandidates = pendingCandidates;
    if (excludedUsers.size > 0) {
      finalCandidates = pendingCandidates.filter(c => !excludedUsers.has(c.username));
      addLog("");
      addLog(`=== 수동 제외: ${excludedUsers.size}명 제외 -> ${finalCandidates.length}명 남음 ===`);
      for (const name of excludedUsers) {
        addLog(`  제외: ${name}`);
      }
    }

    if (finalCandidates.length === 0) {
      addLog(""); addLog("\uCD94\uCCA8 \uB300\uC0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
      setProgress("\uCD94\uCCA8 \uB300\uC0C1 \uC5C6\uC74C", 100);
      runBtn.disabled = false; runBtn.textContent = "\uD83C\uDFB0 \uCD94\uCCA8 \uC2DC\uC791";
      isRunning = false; pendingCandidates = null; return;
    }

    const winnerCount = pendingWinnerCount;
    const actualWin = Math.min(winnerCount, finalCandidates.length);
    const shuffled = shuffleArray(finalCandidates);
    const winners = shuffled.slice(0, actualWin);

    addLog("");
    addLog(`=== \uCD94\uCCA8 \uACB0\uACFC (${actualWin}\uBA85) ===`);
    for (let i = 0; i < winners.length; i++) {
      const w = winners[i];
      const tp = w.isFixed ? "[\uACE0\uC815\uB2C9]" : "[\uACC4\uC815]";
      const ct = w.text || (w.emoticons.length > 0 ? "[\uC544\uCE74\uCF58]" : "");
      addLog(`  ${i + 1}\uB4F1: ${tp} ${w.username} ${ct}`);
    }

    // 애니메이션
    setProgress("\uCD94\uCCA8 \uC560\uB2C8\uBA54\uC774\uC158...", 90);
    await playAnimation(winners, finalCandidates);

    addLog(""); addLog("=== \uCD94\uCCA8 \uC644\uB8CC ===");
    setProgress("\uCD94\uCCA8 \uC644\uB8CC!", 100);

    displayResults(winners, finalCandidates.length);

    runBtn.disabled = false;
    runBtn.textContent = "\uD83C\uDFB0 \uCD94\uCCA8 \uC2DC\uC791";
    isRunning = false;
    pendingCandidates = null;
  }

  function updateCandCount() {
    const count = document.getElementById("lottery-cand-count");
    const total = pendingCandidates ? pendingCandidates.length : 0;
    const active = total - excludedUsers.size;
    count.textContent = excludedUsers.size > 0 ? `${active}명 / ${total}명 (${excludedUsers.size}명 제외)` : `${total}명`;
  }

  function displayCandidates(candidates) {
    const wrap = document.getElementById("lottery-candidates");
    const list = document.getElementById("lottery-cand-list");
    const confirmBtn = document.getElementById("lottery-confirm-btn");
    wrap.style.display = "block";
    confirmBtn.style.display = "block";
    updateCandCount();
    list.innerHTML = "";
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const tag = c.isFixed ? '<span class="lot-tag-fixed">\uACE0\uC815\uB2C9</span>' : '<span class="lot-tag-account">\uACC4\uC815</span>';
      const profileUrl = `https://arca.live/u/@${encodeURIComponent(c.username)}`;
      const item = document.createElement("div");
      item.className = "lot-cand-item";
      item.innerHTML = `<span class="lot-cand-num">${i + 1}</span><a class="lot-cand-link" href="${profileUrl}" target="_blank">${escapeHtml(c.username)}</a>${tag}`;

      const btn = document.createElement("button");
      btn.className = "lot-cand-exclude";
      btn.textContent = "\uC81C\uC678";
      btn.addEventListener("click", () => {
        const excluded = item.classList.toggle("excluded");
        if (excluded) {
          excludedUsers.add(c.username);
          btn.textContent = "\uBCF5\uC6D0";
        } else {
          excludedUsers.delete(c.username);
          btn.textContent = "\uC81C\uC678";
        }
        updateCandCount();
      });
      item.appendChild(btn);
      list.appendChild(item);
    }
  }

  function displayResults(winners, totalCandidates) {
    const resultEl = document.getElementById("lottery-result");
    resultEl.style.display = "block";
    resultEl.querySelector(".lot-result-header").textContent =
      `\uD83C\uDFC6 \uB2F9\uCCA8\uC790 ${winners.length}\uBA85 (${totalCandidates}\uBA85 \uC911)`;

    const list = document.getElementById("lottery-winner-list");
    list.innerHTML = "";
    for (let i = 0; i < winners.length; i++) {
      const w = winners[i];
      const tag = w.isFixed ? '<span class="lot-tag-fixed">\uACE0\uC815\uB2C9</span>' : '<span class="lot-tag-account">\uACC4\uC815</span>';
      const ct = w.text ? escapeHtml(w.text.substring(0, 40) + (w.text.length > 40 ? "..." : ""))
        : w.emoticons.length > 0 ? "[\uC544\uCE74\uCF58]" : "";
      const item = document.createElement("div");
      item.className = "lot-winner-item";
      item.innerHTML = `<span class="lot-winner-rank">${i + 1}</span><span class="lot-winner-name">${escapeHtml(w.username)}${tag}</span><span class="lot-winner-comment">${ct}</span>`;
      list.appendChild(item);
    }
  }

  function copyLog() {
    const el = document.getElementById("lottery-log-area");
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
      const btn = document.querySelector(".lot-log-copy");
      const orig = btn.textContent;
      btn.textContent = "\u2713 \uBCF5\uC0AC\uB428";
      setTimeout(() => { btn.textContent = orig; }, 2000);
    });
  }

  // ===================== INIT =====================

  buildUI();

})();
