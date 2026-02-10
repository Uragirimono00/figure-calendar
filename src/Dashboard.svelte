<!-- src/Dashboard.svelte -->
<script>
  import { onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
  import { deleteObject, ref as storageRef, uploadBytes, getDownloadURL, ref } from 'firebase/storage';
  import { db, storage, auth } from './firebase.js';
  import MonthDropzone from './MonthDropzone.svelte';
  import ImageModal from './ImageModal.svelte';
  import UrlImport from './UrlImport.svelte';
  import { signOut } from 'firebase/auth';
  import domtoimage from 'dom-to-image';

  // --- WebP 변환 및 재업로드 관련 함수들 ---
  function convertImageToWebp(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
              const webpFile = new File([blob], newFileName, { type: "image/webp" });
              resolve(webpFile);
            } else {
              reject(new Error("Conversion to webp failed"));
            }
          }, "image/webp", 0.8);
        };
        img.onerror = (err) => reject(err);
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  function isWebp(url) {
    try {
      const path = new URL(url).pathname;
      return path.endsWith('.webp');
    } catch (error) {
      return url.endsWith('.webp');
    }
  }

  async function reencodeAndReuploadImage(image) {
    if (image.src && !isWebp(image.src)) {
      try {
        const response = await fetch(image.src);
        const blob = await response.blob();
        const tempFile = new File([blob], "temp", { type: blob.type });
        const webpFile = await convertImageToWebp(tempFile);
        const filePath = `images/${image.month}/${Date.now()}_${webpFile.name}`;
        const storageRefObj = ref(storage, filePath);
        const snapshot = await uploadBytes(storageRefObj, webpFile);
        const downloadURL = await getDownloadURL(snapshot.ref);
        await updateDoc(doc(db, "images", image.id), { src: downloadURL, storagePath: snapshot.ref.fullPath });
        image.src = downloadURL;
        image.storagePath = snapshot.ref.fullPath;
      } catch (error) {
        console.error("재인코딩 및 재업로드 실패:", error);
      }
    }
  }

  // 헤더 관련
  let showHeader = true;
  let lastScrollY = 0;
  function handleScroll() {
    const currentScrollY = window.pageYOffset;
    if (currentScrollY > lastScrollY && currentScrollY > 50) {
      showHeader = false;
    } else {
      showHeader = true;
    }
    lastScrollY = currentScrollY;
  }
  function handleMouseMove(event) {
    if (event.clientY < 50) {
      showHeader = true;
    }
  }
  onMount(() => {
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  });

  // 쿠키 관련
  function setCookie(name, value, days) {
    let expires = "";
    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }
  function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  }

  export let user;
  let images = [];
  let imagesLoading = true;
  let downloading = false;
  let urlImportOpen = false;

  let conversionTotal = 0;
  let conversionProcessed = 0;

  let viewMode = 'grid';
  let sortCriteria = [];
  $: if (viewMode === 'table' && sortCriteria.length === 0) {
    sortCriteria = [{ column: 'month', direction: 'asc' }];
  }
  let visibleColumns = {
    src: true,
    month: true,
    description: true,
    purchaseStatus: true,
    status: true,
    teamStatus: true,
    type: true,
    size: true,
    price: true,
    remaining: true,
    expectedCustoms: true
  };

  onMount(() => {
    const savedVisibleColumns = getCookie(`visibleColumns-${user.uid}`);
    if (savedVisibleColumns) {
      try {
        visibleColumns = JSON.parse(savedVisibleColumns);
      } catch (e) {
        console.error("visibleColumns cookie 파싱 실패:", e);
      }
    }
  });
  function toggleColumn(column) {
    visibleColumns[column] = !visibleColumns[column];
  }

  async function loadImages() {
    imagesLoading = true;
    conversionTotal = 0;
    conversionProcessed = 0;
    try {
      const q = query(collection(db, "images"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const loadedImages = [];
      querySnapshot.forEach(docSnapshot => {
        const imageData = { ...docSnapshot.data(), id: docSnapshot.id };
        if (imageData.src && !isWebp(imageData.src)) {
          conversionTotal++;
        }
        loadedImages.push(imageData);
      });
      for (let i = 0; i < loadedImages.length; i++) {
        let imageData = loadedImages[i];
        if (imageData.src && !isWebp(imageData.src)) {
          await reencodeAndReuploadImage(imageData);
          conversionProcessed++;
        }
      }
      images = loadedImages;
    } catch (error) {
      console.error("이미지 불러오기 실패:", error);
    }
    imagesLoading = false;
  }
  onMount(() => {
    loadImages();
    const savedSortCriteria = getCookie(`sortCriteria-${user.uid}`);
    if (savedSortCriteria) {
      try {
        sortCriteria = JSON.parse(savedSortCriteria);
      } catch(e) {
        console.error("sortCriteria cookie 파싱 실패:", e);
      }
    }
  });
  $: if (user) {
    setCookie(`viewMode-${user.uid}`, viewMode, 30);
    setCookie(`sortCriteria-${user.uid}`, JSON.stringify(sortCriteria), 30);
    setCookie(`visibleColumns-${user.uid}`, JSON.stringify(visibleColumns), 30);
  }

  $: groupedImages = groupByMonth(images);
  function groupByMonth(images) {
    const groups = {};
    images.forEach(img => {
      if (!groups[img.month]) groups[img.month] = [];
      groups[img.month].push(img);
    });
    return groups;
  }

  const startYear = 2010;
  const endYear = 2035;
  let currentYear = new Date().getFullYear();
  let selectedYear = currentYear.toString();
  $: months = viewMode === 'table'
          ? [
            ...Array.from({ length: 12 }, (_, i) => `${Number(selectedYear) - 1}-${String(i + 1).padStart(2, '0')}`),
            ...Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`),
            ...Array.from({ length: 12 }, (_, i) => `${Number(selectedYear) + 1}-${String(i + 1).padStart(2, '0')}`)
          ]
          : Array.from({ length: 12 }, (_, i) => `${selectedYear}-${String(i + 1).padStart(2, '0')}`);

  function handleUrlImported(event) {
    images = [...images, event.detail];
  }

  // 필터 변수들
  let filterMonth = "";
  let filterDescription = "";
  let filterPurchaseStatus = "";
  let filterStatus = "";
  let filterTeamStatus = "";
  let filterType = "";
  let filterSize = "";
  let filterPriceMin = "";
  let filterPriceMax = "";
  let filterRemainingMin = "";
  let filterRemainingMax = "";
  let filterExpectedCustomsMin = "";
  let filterExpectedCustomsMax = "";

  $: filteredImages = images.filter(img => {
    const price = Number(img.price) || 0;
    const remaining = Number(img.remaining) || 0;
    const expectedCustoms = Number(img.expectedCustoms) || 0;
    const imgPurchaseStatus = img.purchaseStatus || "구매";
    return (!filterMonth || img.month.includes(filterMonth))
            && (!filterDescription || img.description.includes(filterDescription))
            && (!filterPurchaseStatus || imgPurchaseStatus === filterPurchaseStatus)
            && (!filterStatus || img.status === filterStatus)
            && (!filterTeamStatus || img.teamStatus === filterTeamStatus)
            && (!filterType || img.type === filterType)
            && (!filterSize || img.size === filterSize)
            && (!filterPriceMin || price >= Number(filterPriceMin))
            && (!filterPriceMax || price <= Number(filterPriceMax))
            && (!filterRemainingMin || remaining >= Number(filterRemainingMin))
            && (!filterRemainingMax || remaining <= Number(filterRemainingMax))
            && (!filterExpectedCustomsMin || expectedCustoms >= Number(filterExpectedCustomsMin))
            && (!filterExpectedCustomsMax || expectedCustoms <= Number(filterExpectedCustomsMax));
  });

  let filterVisible = {
    month: false,
    description: false,
    purchaseStatus: false,
    status: false,
    teamStatus: false,
    type: false,
    size: false,
    price: false,
    remaining: false,
    expectedCustoms: false
  };

  let filterPanelOpen = false;
  let columnPanelOpen = false;

  $: sortedFilteredImages = [...filteredImages].sort((a, b) => {
    for (const criteria of sortCriteria) {
      const { column, direction } = criteria;
      let valA = a[column];
      let valB = b[column];
      if (column === 'month') {
        const [yearA, monthA] = valA.split('-').map(Number);
        const [yearB, monthB] = valB.split('-').map(Number);
        if (yearA !== yearB) {
          return direction === "asc" ? yearA - yearB : yearB - yearA;
        }
        if (monthA !== monthB) {
          return direction === "asc" ? monthA - monthB : monthB - monthA;
        }
      } else if (["price", "remaining", "expectedCustoms"].includes(column)) {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
        if (valA !== valB) {
          return direction === "asc" ? valA - valB : valB - valA;
        }
      } else {
        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
      }
    }
    return 0;
  });

  let currentMonthIndex = 0;
  function prevYear() {
    let yearNum = parseInt(selectedYear);
    if (yearNum > startYear) {
      yearNum--;
      selectedYear = yearNum.toString();
    }
  }
  function nextYear() {
    let yearNum = parseInt(selectedYear);
    if (yearNum < endYear) {
      yearNum++;
      selectedYear = yearNum.toString();
    }
  }
  function prevMonth() {
    if (currentMonthIndex > 0) currentMonthIndex--;
  }
  function nextMonth() {
    if (currentMonthIndex < months.length - 1) currentMonthIndex++;
  }

  let modalVisible = false;
  let modalImage = null;
  function handleImageClicked(event) {
    modalImage = event.detail.image;
    modalVisible = true;
  }
  async function handleModalSave(event) {
    const { description, status, teamStatus, purchaseStatus, manufacturer, releaseDate, type, size, price, remaining, expectedCustoms, purchaseDate } = event.detail;
    modalImage.description = description;
    modalImage.status = status;
    modalImage.teamStatus = teamStatus;
    modalImage.purchaseStatus = purchaseStatus;
    modalImage.manufacturer = manufacturer;
    modalImage.releaseDate = releaseDate;
    modalImage.type = type;
    modalImage.size = size;
    modalImage.price = price;
    modalImage.remaining = remaining;
    modalImage.expectedCustoms = expectedCustoms;
    modalImage.purchaseDate = purchaseDate;
    images = [...images];
    try {
      await updateDoc(doc(db, "images", modalImage.id), {
        description, status, teamStatus, purchaseStatus, manufacturer, releaseDate, type, size, price, remaining, expectedCustoms, purchaseDate
      });
    } catch (error) {
      console.error("저장 실패:", error);
    }
  }
  function handleModalClose() {
    modalVisible = false;
    modalImage = null;
  }
  async function handleImageDelete(event) {
    const { image } = event.detail;
    if (confirm("이미지를 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, "images", image.id));
        if (image.storagePath) {
          const sRef = storageRef(storage, image.storagePath);
          await deleteObject(sRef);
        }
        images = images.filter(img => img.id !== image.id);
        await tick();
      } catch (error) {
        console.error("이미지 삭제 실패:", error);
      }
    }
  }
  function handleImageUpload(event) {
    images = [...images, event.detail];
  }
  async function handleStatusToggled(event) {
    const { image, newStatus } = event.detail;
    try {
      await updateDoc(doc(db, "images", image.id), { status: newStatus });
      images = images.map(img => img.id === image.id ? { ...img, status: newStatus } : img);
    } catch (error) {
      console.error("Status update failed:", error);
    }
  }
  async function handleTeamStatusToggled(event) {
    const { image, newTeamStatus } = event.detail;
    try {
      await updateDoc(doc(db, "images", image.id), { teamStatus: newTeamStatus });
      images = images.map(img => img.id === image.id ? { ...img, teamStatus: newTeamStatus } : img);
    } catch (error) {
      console.error("Team status update failed:", error);
    }
  }
  async function updateTeamStatusFromDropdown(image, newTeamStatus) {
    try {
      await updateDoc(doc(db, "images", image.id), { teamStatus: newTeamStatus });
      images = images.map(img => img.id === image.id ? { ...img, teamStatus: newTeamStatus } : img);
    } catch (error) {
      console.error("Team status update failed:", error);
    }
  }
  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  }
  async function handleImageMoved(event) {
    const { id, fromMonth, toMonth } = event.detail;
    const imageToMove = images.find(img => img.id === id);
    if (imageToMove) {
      try {
        await updateDoc(doc(db, "images", id), { month: toMonth });
        imageToMove.month = toMonth;
        images = [...images];
      } catch (error) {
        console.error("이미지 이동 실패:", error);
      }
    }
  }
  async function saveDashboardImage() {
    downloading = true;
    const captureArea = document.querySelector('.capture-area');
    if (!captureArea) {
      downloading = false;
      return;
    }
    const noScrollStyle = document.createElement("style");
    noScrollStyle.id = "no-scroll-style";
    noScrollStyle.innerHTML = `* { overflow: hidden !important; }`;
    document.head.appendChild(noScrollStyle);
    const editableElements = captureArea.querySelectorAll('input, select');
    const replacements = [];
    editableElements.forEach(element => {
      const span = document.createElement('span');
      span.style.fontSize = window.getComputedStyle(element).fontSize;
      span.style.fontFamily = window.getComputedStyle(element).fontFamily;
      span.style.padding = window.getComputedStyle(element).padding;
      if (element.tagName.toLowerCase() === 'input') {
        span.textContent = element.value;
      } else if (element.tagName.toLowerCase() === 'select') {
        const selectedOption = element.options[element.selectedIndex];
        span.textContent = selectedOption ? selectedOption.textContent : '';
      }
      element.parentNode.insertBefore(span, element);
      element.style.display = 'none';
      replacements.push({ element, span });
    });
    try {
      const dataUrl = await domtoimage.toPng(captureArea, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `dashboard_${new Date().toISOString()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("이미지 저장 실패:", error);
    }
    replacements.forEach(({ element, span }) => {
      span.remove();
      element.style.display = '';
    });
    const existingNoScrollStyle = document.getElementById("no-scroll-style");
    if (existingNoScrollStyle) {
      existingNoScrollStyle.remove();
    }
    downloading = false;
  }

  let sidebarVisible = false;
  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
  }

  $: totalPrice = images.reduce((sum, img) => sum + (Number(img.price) || 0), 0);
  $: totalRemaining = images.reduce((sum, img) => sum + (Number(img.remaining) || 0), 0);
  $: totalCustoms = images.reduce((sum, img) => sum + (Number(img.expectedCustoms) || 0), 0);
  $: overallTotal = totalPrice + totalRemaining + totalCustoms;
  function formatNumber(n) {
    const num = Number(n);
    return isNaN(num) ? "0" : num.toLocaleString();
  }
  visibleColumns = {
    ...visibleColumns,
    type: visibleColumns.type ?? true,
    size: visibleColumns.size ?? true,
    purchaseStatus: visibleColumns.purchaseStatus ?? true
  };
  filterVisible = {
    ...filterVisible,
    type: false,
    size: false,
    purchaseStatus: false
  };
  const purchaseStatusOptions = ["", "구매", "찜"];
  const typeOptions = ["", "PVC", "레진"];
  const sizeOptions = ["", "1/1", "1/1.5", "1/2", "1/2.5", "1/3", "1/3.5", "1/4", "1/4.5", "1/5", "1/5.5", "1/6", "1/6.5", "1/7", "1/7.5", "1/8", "1/8.5", "1/9", "1/9.5", "1/10", "1/10.5", "1/11", "1/11.5", "1/12"];
  const statusOptions = ["", "예약금", "전액", "꼴림"];
  const teamStatusOptions = ["", "코아", "매하", "히탐", "래빗츠", "유메", "위북", "드리머", "중고"];

  async function updateImageField(image, field, newValue) {
    try {
      await updateDoc(doc(db, "images", image.id), { [field]: newValue });
      images = images.map(img => img.id === image.id ? { ...img, [field]: newValue } : img);
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
    }
  }

  function handleSort(column) {
    const idx = sortCriteria.findIndex(c => c.column === column);
    if (idx !== -1) {
      if (sortCriteria[idx].direction === 'asc') {
        sortCriteria[idx].direction = 'desc';
      } else {
        sortCriteria.splice(idx, 1);
      }
    } else {
      sortCriteria.push({ column, direction: 'asc' });
    }
    sortCriteria = [...sortCriteria];
  }

  const columnLabels = {
    src: '이미지',
    month: '연월',
    description: '설명',
    purchaseStatus: '구매 상태',
    status: '결제 상태',
    teamStatus: '구매처',
    type: '종류',
    size: '사이즈',
    price: '금액',
    remaining: '남은 금액',
    expectedCustoms: '예상 관세'
  };

  const filterLabels = {
    month: '연월',
    description: '설명',
    purchaseStatus: '구매 상태',
    status: '결제 상태',
    teamStatus: '구매처',
    type: '종류',
    size: '사이즈',
    price: '금액',
    remaining: '남은 금액',
    expectedCustoms: '예상 관세'
  };
</script>

{#if user}
  <header class="dashboard-header" class:hide={!showHeader}>
    <div class="header-inner">
      <div class="view-switch">
        <button on:click={() => viewMode = 'grid'} class:active={viewMode==='grid'} title="연도로보기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          <span class="view-label">그리드</span>
        </button>
        <button on:click={() => viewMode = 'single'} class:active={viewMode==='single'} title="월로보기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span class="view-label">월별</span>
        </button>
        <button on:click={() => viewMode = 'table'} class:active={viewMode==='table'} title="표로보기">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span class="view-label">테이블</span>
        </button>
      </div>
      <div class="header-actions">
        <button class="url-import-btn" on:click={() => urlImportOpen = true} title="URL 추가">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          <span class="url-label">URL 추가</span>
        </button>
        <button class="hamburger" on:click={toggleSidebar} title="메뉴">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </div>
    </div>
  </header>

  {#if sidebarVisible}
    <div class="sidebar-backdrop" on:click={toggleSidebar}></div>
    <aside class="sidebar" transition:fly={{ x: 320, duration: 250 }}>
      <div class="sidebar-header">
        <h3>메뉴</h3>
        <button class="close-btn" on:click={toggleSidebar}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="sidebar-user">
        <div class="user-avatar">
          {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
        </div>
        <div class="user-info">
          <span class="user-email">{user.email || '사용자'}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <h4>금액 요약</h4>
        <div class="totals-grid">
          <div class="total-card">
            <span class="total-label">금액</span>
            <span class="total-value">{formatNumber(totalPrice)}원</span>
          </div>
          <div class="total-card">
            <span class="total-label">남은 금액</span>
            <span class="total-value">{formatNumber(totalRemaining)}원</span>
          </div>
          <div class="total-card">
            <span class="total-label">예상 관세</span>
            <span class="total-value">{formatNumber(totalCustoms)}원</span>
          </div>
          <div class="total-card total-card-accent">
            <span class="total-label">전체 합계</span>
            <span class="total-value">{formatNumber(overallTotal)}원</span>
          </div>
        </div>
      </div>

      <div class="sidebar-actions">
        <button on:click={saveDashboardImage} class="sidebar-btn btn-save" disabled={downloading}>
          {#if downloading}
            <span class="spinner-button"></span>
            저장중...
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            이미지 저장
          {/if}
        </button>
        <button on:click={handleLogout} class="sidebar-btn btn-logout">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          로그아웃
        </button>
      </div>
    </aside>
  {/if}
{/if}

{#if imagesLoading}
  <div class="dashboard-loading">
    <div class="loading-content">
      <div class="spinner"></div>
      {#if conversionTotal > 0}
        <p class="loading-text">WebP 인코딩 중... ({conversionProcessed} / {conversionTotal})</p>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {conversionTotal > 0 ? (conversionProcessed / conversionTotal * 100) : 0}%"></div>
        </div>
      {:else}
        <p class="loading-text">이미지를 불러오는 중...</p>
      {/if}
    </div>
  </div>
{/if}

<div class="dashboard">
  {#if viewMode !== 'table'}
    <div class="year-control">
      <button class="year-btn" on:click={prevYear} disabled={parseInt(selectedYear) <= startYear}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <select class="year-select" bind:value={selectedYear}>
        {#each Array.from({ length: (endYear - startYear + 1) }, (_, i) => (startYear + i).toString()) as yearOption}
          <option value={yearOption}>{yearOption}</option>
        {/each}
      </select>
      <button class="year-btn" on:click={nextYear} disabled={parseInt(selectedYear) >= endYear}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  {/if}

  <div class="capture-area">
    {#if viewMode === 'grid'}
      <div class="months-grid">
        {#each months as monthKey}
          <MonthDropzone
                  month={monthKey}
                  userUid={user.uid}
                  images={groupedImages[monthKey] || []}
                  on:imageUploaded={handleImageUpload}
                  on:imageClicked={handleImageClicked}
                  on:imageDelete={handleImageDelete}
                  on:statusToggled={handleStatusToggled}
                  on:teamStatusToggled={handleTeamStatusToggled}
                  on:imageMoved={handleImageMoved} />
        {/each}
        <MonthDropzone
                month="미정"
                userUid={user.uid}
                images={groupedImages["미정"] || []}
                on:imageUploaded={handleImageUpload}
                on:imageClicked={handleImageClicked}
                on:imageDelete={handleImageDelete}
                on:statusToggled={handleStatusToggled}
                on:teamStatusToggled={handleTeamStatusToggled}
                on:imageMoved={handleImageMoved} />
      </div>
    {:else if viewMode === 'single'}
      <div class="single-view">
        <div class="navigation">
          <button class="nav-btn" on:click={prevMonth} disabled={currentMonthIndex === 0}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="nav-month">{months[currentMonthIndex]}</span>
          <button class="nav-btn" on:click={nextMonth} disabled={currentMonthIndex === months.length - 1}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        <div class="month-single">
          <MonthDropzone
                  month={months[currentMonthIndex]}
                  userUid={user.uid}
                  images={groupedImages[months[currentMonthIndex]] || []}
                  on:imageUploaded={handleImageUpload}
                  on:imageClicked={handleImageClicked}
                  on:imageDelete={handleImageDelete}
                  on:statusToggled={handleStatusToggled}
                  on:teamStatusToggled={handleTeamStatusToggled}
                  on:imageMoved={handleImageMoved} />
        </div>
      </div>
    {:else if viewMode === 'table'}
      <div class="table-view-container">
        <div class="table-toolbar">
          <button class="toolbar-btn" class:active={filterPanelOpen} on:click={() => filterPanelOpen = !filterPanelOpen}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            필터
          </button>
          <button class="toolbar-btn" class:active={columnPanelOpen} on:click={() => columnPanelOpen = !columnPanelOpen}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
            컬럼
          </button>
        </div>

        {#if filterPanelOpen}
          <div class="panel filter-panel">
            <div class="filter-chips">
              {#each Object.entries(filterLabels) as [key, label]}
                <button class="chip" class:active={filterVisible[key]} on:click={() => filterVisible[key] = !filterVisible[key]}>
                  {label}
                </button>
              {/each}
            </div>
            <div class="filter-fields">
              {#if filterVisible.month}
                <div class="filter-field">
                  <label>연월</label>
                  <input type="text" bind:value={filterMonth} placeholder="연월 검색" list="monthList" />
                  <datalist id="monthList">
                    {#each months as m}
                      <option value={m} />
                    {/each}
                  </datalist>
                </div>
              {/if}
              {#if filterVisible.description}
                <div class="filter-field">
                  <label>설명</label>
                  <input type="text" bind:value={filterDescription} placeholder="설명 검색" />
                </div>
              {/if}
              {#if filterVisible.purchaseStatus}
                <div class="filter-field">
                  <label>구매 상태</label>
                  <select bind:value={filterPurchaseStatus}>
                    {#each purchaseStatusOptions as opt}
                      <option value={opt}>{opt === "" ? "전체" : opt}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if filterVisible.status}
                <div class="filter-field">
                  <label>결제 상태</label>
                  <select bind:value={filterStatus}>
                    {#each statusOptions as opt}
                      <option value={opt}>{opt === "" ? "전체" : opt}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if filterVisible.teamStatus}
                <div class="filter-field">
                  <label>구매처</label>
                  <select bind:value={filterTeamStatus}>
                    {#each teamStatusOptions as opt}
                      <option value={opt}>{opt === "" ? "전체" : opt}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if filterVisible.type}
                <div class="filter-field">
                  <label>종류</label>
                  <select bind:value={filterType}>
                    {#each typeOptions as opt}
                      <option value={opt}>{opt === "" ? "전체" : opt}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if filterVisible.size}
                <div class="filter-field">
                  <label>사이즈</label>
                  <select bind:value={filterSize}>
                    {#each sizeOptions as opt}
                      <option value={opt}>{opt === "" ? "전체" : opt}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if filterVisible.price}
                <div class="filter-field filter-range">
                  <label>금액</label>
                  <div class="range-inputs">
                    <input type="text" bind:value={filterPriceMin} placeholder="최소" />
                    <span class="range-sep">~</span>
                    <input type="text" bind:value={filterPriceMax} placeholder="최대" />
                  </div>
                </div>
              {/if}
              {#if filterVisible.remaining}
                <div class="filter-field filter-range">
                  <label>남은 금액</label>
                  <div class="range-inputs">
                    <input type="text" bind:value={filterRemainingMin} placeholder="최소" />
                    <span class="range-sep">~</span>
                    <input type="text" bind:value={filterRemainingMax} placeholder="최대" />
                  </div>
                </div>
              {/if}
              {#if filterVisible.expectedCustoms}
                <div class="filter-field filter-range">
                  <label>예상 관세</label>
                  <div class="range-inputs">
                    <input type="text" bind:value={filterExpectedCustomsMin} placeholder="최소" />
                    <span class="range-sep">~</span>
                    <input type="text" bind:value={filterExpectedCustomsMax} placeholder="최대" />
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}

        {#if columnPanelOpen}
          <div class="panel column-panel">
            <div class="column-chips">
              {#each Object.entries(columnLabels) as [key, label]}
                <button class="chip" class:active={visibleColumns[key]} on:click={() => toggleColumn(key)}>
                  {label}
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <div class="table-wrapper">
          <table class="images-table">
            <thead>
            <tr>
              {#if visibleColumns.src}
                <th>이미지</th>
              {/if}
              {#if visibleColumns.month}
                <th class="sortable" on:click={() => handleSort('month')}>
                  연월
                  {#if sortCriteria.find(c => c.column === 'month')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'month').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
              {#if visibleColumns.description}
                <th class="sortable" on:click={() => handleSort('description')}>
                  설명
                  {#if sortCriteria.find(c => c.column === 'description')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'description').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
              {#if visibleColumns.purchaseStatus}
                <th class="sortable" on:click={() => handleSort('purchaseStatus')}>
                  구매 상태
                  {#if sortCriteria.find(c => c.column === 'purchaseStatus')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'purchaseStatus').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
              {#if visibleColumns.status}
                <th class="sortable" on:click={() => handleSort('status')}>
                  결제 상태
                  {#if sortCriteria.find(c => c.column === 'status')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'status').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
              {#if visibleColumns.teamStatus}
                <th class="sortable" on:click={() => handleSort('teamStatus')}>
                  구매처
                  {#if sortCriteria.find(c => c.column === 'teamStatus')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'teamStatus').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
              {#if visibleColumns.type}
                <th class="sortable" on:click={() => handleSort('type')}>
                  종류
                  {#if sortCriteria.find(c => c.column === 'type')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'type').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
              {#if visibleColumns.size}
                <th class="sortable" on:click={() => handleSort('size')}>
                  사이즈
                  {#if sortCriteria.find(c => c.column === 'size')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'size').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
              {#if visibleColumns.price}
                <th class="sortable" on:click={() => handleSort('price')}>
                  금액
                  {#if sortCriteria.find(c => c.column === 'price')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'price').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
              {#if visibleColumns.remaining}
                <th class="sortable" on:click={() => handleSort('remaining')}>
                  남은 금액
                  {#if sortCriteria.find(c => c.column === 'remaining')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'remaining').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
              {#if visibleColumns.expectedCustoms}
                <th class="sortable" on:click={() => handleSort('expectedCustoms')}>
                  예상 관세
                  {#if sortCriteria.find(c => c.column === 'expectedCustoms')}
                    <span class="sort-icon">{sortCriteria.find(c => c.column === 'expectedCustoms').direction === 'asc' ? '▲' : '▼'}</span>
                  {/if}
                </th>
              {/if}
            </tr>
            </thead>
            <tbody>
            {#each sortedFilteredImages as img, i}
              <tr class:stripe={i % 2 === 1}>
                {#if visibleColumns.src}
                  <td><img src={img.src} alt="Image" class="table-thumb" /></td>
                {/if}
                {#if visibleColumns.month}
                  <td>
                    <select bind:value={img.month} on:blur={(e) => updateImageField(img, 'month', e.target.value)}>
                      {#each months as m}
                        <option value={m}>{m}</option>
                      {/each}
                    </select>
                  </td>
                {/if}
                {#if visibleColumns.description}
                  <td>
                    <input type="text" value={img.description} on:blur={(e) => updateImageField(img, 'description', e.target.value)} />
                  </td>
                {/if}
                {#if visibleColumns.purchaseStatus}
                  <td>
                    <select value={img.purchaseStatus || '구매'} on:blur={(e) => updateImageField(img, 'purchaseStatus', e.target.value)}>
                      {#each purchaseStatusOptions as opt}
                        {#if opt !== ""}
                          <option value={opt}>{opt}</option>
                        {/if}
                      {/each}
                    </select>
                  </td>
                {/if}
                {#if visibleColumns.status}
                  <td>
                    <select bind:value={img.status} on:blur={(e) => updateImageField(img, 'status', e.target.value)}>
                      {#each statusOptions as opt}
                        <option value={opt}>{opt}</option>
                      {/each}
                    </select>
                  </td>
                {/if}
                {#if visibleColumns.teamStatus}
                  <td>
                    <select bind:value={img.teamStatus} on:blur={(e) => updateImageField(img, 'teamStatus', e.target.value)}>
                      {#each teamStatusOptions as opt}
                        <option value={opt}>{opt}</option>
                      {/each}
                    </select>
                  </td>
                {/if}
                {#if visibleColumns.type}
                  <td>
                    <select bind:value={img.type} on:blur={(e) => updateImageField(img, 'type', e.target.value)}>
                      {#each typeOptions as opt}
                        <option value={opt}>{opt}</option>
                      {/each}
                    </select>
                  </td>
                {/if}
                {#if visibleColumns.size}
                  <td>
                    <select bind:value={img.size} on:blur={(e) => updateImageField(img, 'size', e.target.value)}>
                      {#each sizeOptions as opt}
                        <option value={opt}>{opt}</option>
                      {/each}
                    </select>
                  </td>
                {/if}
                {#if visibleColumns.price}
                  <td>
                    <input type="number" value={img.price} on:blur={(e) => updateImageField(img, 'price', e.target.value)} />
                  </td>
                {/if}
                {#if visibleColumns.remaining}
                  <td>
                    <input type="number" value={img.remaining} on:blur={(e) => updateImageField(img, 'remaining', e.target.value)} />
                  </td>
                {/if}
                {#if visibleColumns.expectedCustoms}
                  <td>
                    <input type="number" value={img.expectedCustoms} on:blur={(e) => updateImageField(img, 'expectedCustoms', e.target.value)} />
                  </td>
                {/if}
              </tr>
            {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
</div>

{#if modalVisible}
  <ImageModal
          image={modalImage}
          on:save={handleModalSave}
          on:close={handleModalClose}
          on:delete={(e) => {
      const { id, storagePath } = e.detail;
      (async () => {
        try {
          await deleteDoc(doc(db, "images", id));
          if (storagePath) {
            const sRef = storageRef(storage, storagePath);
            await deleteObject(sRef);
          }
          images = images.filter(img => img.id !== id);
          await tick();
          modalVisible = false;
          modalImage = null;
        } catch (error) {
          console.error("모달 이미지 삭제 실패:", error);
        }
      })();
    }} />
{/if}

{#if urlImportOpen}
  <UrlImport
          userUid={user.uid}
          on:imported={handleUrlImported}
          on:close={() => urlImportOpen = false} />
{/if}

<style>
  /* ===== Header ===== */
  .dashboard-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--color-border);
    transition: transform 0.3s ease-in-out;
  }
  :global(html.dark) .dashboard-header {
    background: rgba(10, 10, 10, 0.9);
  }
  .dashboard-header.hide {
    transform: translateY(-100%);
  }
  .header-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-2) var(--space-4);
    max-width: 1440px;
    margin: 0 auto;
  }

  /* ===== View Switch (Segment Control) ===== */
  .view-switch {
    display: flex;
    background: var(--color-surface-hover);
    border-radius: var(--radius);
    padding: 3px;
    gap: 2px;
  }
  .view-switch button {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }
  .view-switch button.active {
    background: var(--color-surface);
    color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }
  .view-switch button:hover:not(.active) {
    color: var(--color-text-secondary);
  }
  .view-label {
    display: none;
  }
  @media (min-width: 640px) {
    .view-label {
      display: inline;
    }
  }

  /* ===== Header Actions ===== */
  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .url-import-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }
  .url-import-btn:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }
  .url-label {
    display: none;
  }
  @media (min-width: 640px) {
    .url-label {
      display: inline;
    }
  }

  /* ===== Hamburger ===== */
  .hamburger {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: var(--radius);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .hamburger:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }

  /* ===== Sidebar ===== */
  .sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    height: 100%;
    background-color: var(--color-surface);
    border-left: 1px solid var(--color-border);
    z-index: 100;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .sidebar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--color-overlay);
    z-index: 90;
  }
  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
  }
  .sidebar-header h3 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .close-btn:hover {
    background: var(--color-surface-hover);
    color: var(--color-text);
  }
  .sidebar-user {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--color-border);
  }
  .user-avatar {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    background: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    flex-shrink: 0;
  }
  .user-info {
    overflow: hidden;
  }
  .user-email {
    font-size: 0.8125rem;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    display: block;
  }
  .sidebar-section {
    padding: var(--space-4) var(--space-5);
  }
  .sidebar-section h4 {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    margin-bottom: var(--space-3);
  }
  .totals-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }
  .total-card {
    background: var(--color-surface-hover);
    border-radius: var(--radius);
    padding: var(--space-3);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .total-card-accent {
    grid-column: 1 / -1;
    background: var(--color-primary-bg);
  }
  .total-label {
    font-size: 0.6875rem;
    color: var(--color-text-muted);
    font-weight: 500;
  }
  .total-value {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text);
  }
  .total-card-accent .total-value {
    color: var(--color-primary);
  }
  .sidebar-actions {
    padding: var(--space-4) var(--space-5);
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    border-top: 1px solid var(--color-border);
  }
  .sidebar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: none;
    border-radius: var(--radius);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .btn-save {
    background: var(--color-primary);
    color: white;
  }
  .btn-save:hover {
    background: var(--color-primary-hover);
  }
  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-logout {
    background: transparent;
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
  }
  .btn-logout:hover {
    background: var(--color-surface-hover);
    color: var(--color-danger);
    border-color: var(--color-danger);
  }
  .spinner-button {
    border: 2px solid rgba(255,255,255,0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    width: 14px;
    height: 14px;
    animation: spin 1s linear infinite;
    display: inline-block;
  }

  /* ===== Loading ===== */
  .dashboard-loading {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--color-overlay);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1001;
  }
  .loading-content {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    box-shadow: var(--shadow-lg);
    min-width: 240px;
  }
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top: 3px solid var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .loading-text {
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    text-align: center;
  }
  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--color-border);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
  }

  /* ===== Dashboard ===== */
  .dashboard {
    min-height: 100vh;
    margin: 0 auto;
    padding: 56px var(--space-4) var(--space-4) var(--space-4);
    background-color: var(--color-bg);
    color: var(--color-text);
  }

  /* ===== Year Control ===== */
  .year-control {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) 0;
  }
  .year-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .year-btn:hover:not(:disabled) {
    background: var(--color-primary-bg);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .year-select {
    padding: var(--space-2) var(--space-3);
    font-size: 0.9375rem;
    font-weight: 600;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    min-width: 100px;
    text-align: center;
  }

  /* ===== Capture Area ===== */
  .capture-area {
    position: relative;
    background-color: var(--color-bg);
    padding: var(--space-3) 0;
    color: var(--color-text);
  }

  /* ===== Grid View ===== */
  .months-grid {
    display: grid;
    gap: var(--space-4);
    grid-template-columns: repeat(6, 1fr);
  }
  @media (max-width: 1280px) {
    .months-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  @media (max-width: 1024px) {
    .months-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 768px) {
    .months-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 640px) {
    .months-grid {
      grid-template-columns: 1fr;
    }
    .sidebar {
      width: 100%;
    }
  }

  /* ===== Single View ===== */
  .single-view {
    text-align: center;
  }
  .navigation {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }
  .nav-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .nav-btn:hover:not(:disabled) {
    background: var(--color-primary-bg);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  .nav-month {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
    min-width: 100px;
  }
  .month-single {
    display: flex;
    justify-content: center;
  }

  /* ===== Table View ===== */
  .table-view-container {
    position: relative;
  }
  .table-toolbar {
    display: flex;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .toolbar-btn {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .toolbar-btn:hover {
    border-color: var(--color-border-hover);
    color: var(--color-text);
  }
  .toolbar-btn.active {
    background: var(--color-primary-bg);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  /* ===== Filter/Column Panel ===== */
  .panel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-4);
    margin-bottom: var(--space-3);
  }
  .filter-chips,
  .column-chips {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-3);
  }
  .column-chips {
    margin-bottom: 0;
  }
  .chip {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-full);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  .chip:hover {
    border-color: var(--color-border-hover);
  }
  .chip.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }
  .filter-fields {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--space-3);
  }
  .filter-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }
  .filter-field label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }
  .filter-field input,
  .filter-field select {
    padding: var(--space-2) var(--space-3);
    font-size: 0.8125rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text);
  }
  .range-inputs {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .range-inputs input {
    flex: 1;
    min-width: 0;
  }
  .range-sep {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    flex-shrink: 0;
  }

  /* ===== Table ===== */
  .table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
  }
  .images-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .images-table th,
  .images-table td {
    padding: var(--space-2) var(--space-3);
    text-align: left;
    border-bottom: 1px solid var(--color-border);
  }
  .images-table th {
    background-color: var(--color-surface-hover);
    color: var(--color-text-secondary);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    position: sticky;
    top: 0;
    white-space: nowrap;
  }
  .images-table th.sortable {
    cursor: pointer;
    user-select: none;
  }
  .images-table th.sortable:hover {
    color: var(--color-primary);
  }
  .sort-icon {
    font-size: 0.625rem;
    margin-left: 2px;
    color: var(--color-primary);
  }
  .images-table tbody tr {
    transition: background-color var(--transition-fast);
  }
  .images-table tbody tr:hover {
    background-color: var(--color-surface-hover);
  }
  .images-table tbody tr.stripe {
    background-color: var(--color-surface);
  }
  .images-table tbody tr.stripe:hover {
    background-color: var(--color-surface-hover);
  }
  .images-table td select,
  .images-table td input {
    padding: var(--space-1) var(--space-2);
    font-size: 0.8125rem;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--color-text);
    transition: border-color var(--transition-fast);
    width: 100%;
    min-width: 60px;
  }
  .images-table td select:focus,
  .images-table td input:focus {
    border-color: var(--color-primary);
    background: var(--color-surface);
  }
  .table-thumb {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: var(--radius-sm);
  }
</style>
