// background/service-worker.js
// Chrome extension lifecycle management

chrome.runtime.onInstalled.addListener(() => {
  console.log("피규어 캘린더 확장프로그램이 설치되었습니다.");
});
