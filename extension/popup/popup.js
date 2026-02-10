// popup.js - Firebase REST API 사용 (Manifest V3 CSP 호환)

const FIREBASE_API_KEY = "AIzaSyAVrkt_rugotCtw_k8nCVMM3_XpcIwilXI";
const FIREBASE_PROJECT_ID = "figure-calendar";
const GOOGLE_CLIENT_ID = "298840441957-71tfj4s4mbkdkisqme0hpjd095bhn4t6.apps.googleusercontent.com";
const AUTH_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
const AUTH_IDP_URL = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`;
const FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// DOM elements
const loginSection = document.getElementById("login-section");
const mainSection = document.getElementById("main-section");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const extractBtn = document.getElementById("extract-btn");
const loadingEl = document.getElementById("loading");
const previewEl = document.getElementById("preview");
const previewImg = document.getElementById("preview-img");
const previewImageContainer = document.getElementById("preview-image-container");
const saveBtn = document.getElementById("save-btn");
const statusMsg = document.getElementById("status-msg");

// Fields
const fieldName = document.getElementById("field-name");
const fieldPrice = document.getElementById("field-price");
const fieldDeposit = document.getElementById("field-deposit");
const fieldRemaining = document.getElementById("field-remaining");
const fieldReleaseDate = document.getElementById("field-releaseDate");
const fieldManufacturer = document.getElementById("field-manufacturer");
const fieldPurchasePlace = document.getElementById("field-purchasePlace");
const fieldMonth = document.getElementById("field-month");
const fieldImageUrl = document.getElementById("field-imageUrl");

let currentUser = null; // { idToken, localId, email, refreshToken }
let extractedData = null;

// Populate months
function populateMonths() {
  const now = new Date();
  for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement("option");
      opt.value = `${y}-${String(m).padStart(2, "0")}`;
      opt.textContent = opt.value;
      fieldMonth.appendChild(opt);
    }
  }
  const undecided = document.createElement("option");
  undecided.value = "미정";
  undecided.textContent = "미정";
  fieldMonth.appendChild(undecided);
  fieldMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
populateMonths();

function guessMonth(releaseDateStr) {
  if (!releaseDateStr) return fieldMonth.value;
  // 분기: "2026년 3분기" → 2026-07
  const qMatch = releaseDateStr.match(/(\d{4})\s*년?\s*(\d)\s*분기/);
  if (qMatch) {
    const quarterToMonth = { 1: 1, 2: 4, 3: 7, 4: 10 };
    const m = quarterToMonth[parseInt(qMatch[2])] || 1;
    return `${qMatch[1]}-${String(m).padStart(2, "0")}`;
  }
  const match = releaseDateStr.match(/(\d{4})[年년\-\/]\s*(\d{1,2})/);
  if (match) {
    return `${match[1]}-${String(parseInt(match[2])).padStart(2, "0")}`;
  }
  return fieldMonth.value;
}

// --- Auth: stored in chrome.storage.local ---
async function loadAuth() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["authUser"], (result) => {
      if (result.authUser) {
        currentUser = result.authUser;
        showMain();
      } else {
        showLogin();
      }
      resolve();
    });
  });
}

function saveAuth(user) {
  chrome.storage.local.set({ authUser: user });
}

function clearAuth() {
  chrome.storage.local.remove("authUser");
}

function showLogin() {
  loginSection.style.display = "block";
  mainSection.style.display = "none";
}

function showMain() {
  loginSection.style.display = "none";
  mainSection.style.display = "block";
  userEmailEl.textContent = currentUser.email;
}

// --- Token refresh ---
async function refreshIdToken() {
  if (!currentUser || !currentUser.refreshToken) return false;
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: currentUser.refreshToken,
      }),
    });
    const data = await res.json();
    if (data.id_token) {
      currentUser.idToken = data.id_token;
      currentUser.refreshToken = data.refresh_token;
      saveAuth(currentUser);
      return true;
    }
  } catch (e) {
    // ignore
  }
  return false;
}

// --- Login ---
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.style.display = "none";
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
    currentUser = {
      idToken: data.idToken,
      localId: data.localId,
      email: data.email,
      refreshToken: data.refreshToken,
    };
    saveAuth(currentUser);
    showMain();
  } catch (err) {
    loginError.textContent = "로그인 실패: " + err.message;
    loginError.style.display = "block";
  }
});

// --- Google Login ---
const googleLoginBtn = document.getElementById("google-login-btn");
googleLoginBtn.addEventListener("click", async () => {
  loginError.style.display = "none";
  googleLoginBtn.disabled = true;
  googleLoginBtn.textContent = "로그인 중...";

  try {
    const redirectUrl = chrome.identity.getRedirectURL();
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent("email profile")}`;

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    // Extract access_token from response URL
    const params = new URL(responseUrl.replace("#", "?")).searchParams;
    const accessToken = params.get("access_token");
    if (!accessToken) throw new Error("액세스 토큰을 받지 못했습니다.");

    // Exchange Google access token for Firebase ID token
    const res = await fetch(AUTH_IDP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `access_token=${accessToken}&providerId=google.com`,
        requestUri: redirectUrl,
        returnIdToken: true,
        returnSecureToken: true,
      }),
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    currentUser = {
      idToken: data.idToken,
      localId: data.localId,
      email: data.email,
      refreshToken: data.refreshToken,
    };
    saveAuth(currentUser);
    showMain();
  } catch (err) {
    if (!err.message.includes("canceled") && !err.message.includes("cancelled")) {
      loginError.textContent = "Google 로그인 실패: " + err.message;
      loginError.style.display = "block";
    }
  }

  googleLoginBtn.disabled = false;
  googleLoginBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg> Google로 로그인`;
});

// --- Logout ---
logoutBtn.addEventListener("click", () => {
  currentUser = null;
  clearAuth();
  showLogin();
});

// --- Extract ---
extractBtn.addEventListener("click", async () => {
  loadingEl.style.display = "block";
  previewEl.style.display = "none";
  statusMsg.style.display = "none";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { action: "extractProduct" });

    if (response) {
      extractedData = response;
      fieldName.value = response.name || "";
      fieldPrice.value = response.price || "";
      fieldDeposit.value = response.deposit || "";
      fieldRemaining.value = response.remaining || "";
      fieldReleaseDate.value = response.releaseDate || "";
      fieldManufacturer.value = response.manufacturer || "";
      fieldPurchasePlace.value = response.purchasePlace || "";
      fieldImageUrl.value = response.imageUrl || "";
      fieldMonth.value = guessMonth(response.releaseDate);

      if (response.imageUrl) {
        previewImg.src = response.imageUrl;
        previewImageContainer.style.display = "block";
      } else {
        previewImageContainer.style.display = "none";
      }

      previewEl.style.display = "flex";
    } else {
      showStatus("상품 정보를 추출할 수 없습니다.", "error");
    }
  } catch (err) {
    showStatus("추출 실패: 지원되는 상품 페이지에서 시도해주세요.", "error");
  }

  loadingEl.style.display = "none";
});

// --- Check duplicate by sourceUrl ---
async function checkDuplicate(sourceUrl) {
  if (!sourceUrl || !currentUser) return false;
  const queryUrl = `${FIRESTORE_URL}:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: "images" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "sourceUrl" }, op: "EQUAL", value: { stringValue: sourceUrl } } },
            { fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: currentUser.localId } } },
          ],
        },
      },
      limit: 1,
    },
  };
  try {
    const res = await fetch(queryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentUser.idToken}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 && data[0].document;
  } catch (e) {
    return false;
  }
}

// --- Save to Firestore via REST API ---
saveBtn.addEventListener("click", async () => {
  if (!currentUser) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "저장 중...";

  // 중복 체크
  const srcUrl = extractedData ? extractedData.sourceUrl : "";
  if (srcUrl) {
    const isDup = await checkDuplicate(srcUrl);
    if (isDup) {
      showStatus("이미 저장된 상품입니다.", "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "찜 목록에 저장";
      return;
    }
  }

  // Firestore document fields
  const fields = {
    src: { stringValue: fieldImageUrl.value },
    month: { stringValue: fieldMonth.value },
    date: { stringValue: new Date().toISOString() },
    description: { stringValue: fieldName.value },
    uid: { stringValue: currentUser.localId },
    status: { stringValue: "꼴림" },
    teamStatus: { stringValue: fieldPurchasePlace.value || "코아" },
    purchaseStatus: { stringValue: "찜" },
    manufacturer: { stringValue: fieldManufacturer.value },
    releaseDate: { stringValue: fieldReleaseDate.value },
    sourceUrl: { stringValue: extractedData ? extractedData.sourceUrl : "" },
    source: { stringValue: "extension" },
    type: { stringValue: (extractedData && extractedData.type) || "PVC" },
    size: { stringValue: (extractedData && extractedData.size) || "" },
    price: { stringValue: fieldPrice.value || "" },
    deposit: { stringValue: fieldDeposit.value || "" },
    remaining: { stringValue: fieldRemaining.value || "" },
    expectedCustoms: { stringValue: "" },
    storagePath: { nullValue: null },
  };

  try {
    let res = await fetch(`${FIRESTORE_URL}/images`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${currentUser.idToken}`,
      },
      body: JSON.stringify({ fields }),
    });

    // Token expired → refresh and retry
    if (res.status === 401) {
      const refreshed = await refreshIdToken();
      if (refreshed) {
        res = await fetch(`${FIRESTORE_URL}/images`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser.idToken}`,
          },
          body: JSON.stringify({ fields }),
        });
      }
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message);
    }

    showStatus("저장되었습니다!", "success");
    previewEl.style.display = "none";
  } catch (err) {
    showStatus("저장 실패: " + err.message, "error");
  }

  saveBtn.disabled = false;
  saveBtn.textContent = "찜 목록에 저장";
});

function showStatus(msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = "status-msg " + (type === "error" ? "status-error" : "status-success");
  statusMsg.style.display = "block";
  setTimeout(() => { statusMsg.style.display = "none"; }, 5000);
}

// Init
loadAuth();
