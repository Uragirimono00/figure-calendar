const DEFAULTS = { fetchTarget: "posts", months: 3 };

document.addEventListener("DOMContentLoaded", async () => {
  const { settings = DEFAULTS } = await chrome.storage.local.get("settings");

  document.getElementById("fetchTarget").value = settings.fetchTarget;
  document.getElementById("months").value = settings.months;

  updateCacheInfo();

  document.getElementById("fetchTarget").addEventListener("change", save);
  document.getElementById("months").addEventListener("change", save);
  document.getElementById("clearCache").addEventListener("click", clearCache);
});

async function save() {
  const settings = {
    fetchTarget: document.getElementById("fetchTarget").value,
    months: parseInt(document.getElementById("months").value),
  };
  await clearCache();
  await chrome.storage.local.set({ settings });
}

async function clearCache() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith("cache:"));
  if (keys.length > 0) await chrome.storage.local.remove(keys);
  updateCacheInfo();
}

async function updateCacheInfo() {
  const all = await chrome.storage.local.get(null);
  const count = Object.keys(all).filter((k) => k.startsWith("cache:")).length;
  document.getElementById("cacheInfo").textContent = `저장된 유저: ${count}명`;
}
