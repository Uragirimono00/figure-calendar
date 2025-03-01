<!-- src/Dashboard.svelte -->
<script>
  import { onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
  import { deleteObject, ref as storageRef } from 'firebase/storage';
  import { db, storage, auth } from './firebase.js';
  import MonthDropzone from './MonthDropzone.svelte';
  import ImageModal from './ImageModal.svelte';
  import { signOut } from 'firebase/auth';
  import domtoimage from 'dom-to-image';

  // 헤더 표시 여부를 제어할 변수
  let showHeader = true;
  let lastScrollY = 0;

  // 스크롤 이벤트 핸들러: 스크롤 방향에 따라 showHeader 토글
  function handleScroll() {
    const currentScrollY = window.pageYOffset;
    if (currentScrollY > lastScrollY && currentScrollY > 50) {
      showHeader = false;
    } else {
      showHeader = true;
    }
    lastScrollY = currentScrollY;
  }

  // 마우스 이동 이벤트 핸들러: 마우스가 상단 근처(예: 50px 미만)에 있으면 헤더 보이게
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

  // 쿠키 저장/불러오기 유틸리티 함수
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
  $: cacheKey = `cachedImages-${user.uid}`;

  let downloading = false;

  // 뷰 모드 (grid, single, table)
  let viewMode = 'grid';

  // 다중 정렬 조건 배열 (우선순위가 높은 순으로 저장됨)
  let sortCriteria = [];
  // 뷰 모드가 table일 경우 기본적으로 'month' 컬럼 정렬 조건을 추가합니다.
  $: if (viewMode === 'table' && sortCriteria.length === 0) {
    sortCriteria = [{ column: 'month', direction: 'asc' }];
  }

  // 사용자가 보여줄 테이블 컬럼 (true이면 표시)
  let visibleColumns = {
    src: true,
    month: true,
    description: true,
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
    try {
      const q = query(collection(db, "images"), where("uid", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const loadedImages = [];
      querySnapshot.forEach(docSnapshot => {
        loadedImages.push({ ...docSnapshot.data(), id: docSnapshot.id });
      });
      images = loadedImages;
      setCookie(cacheKey, JSON.stringify(images), 30);
    } catch (error) {
      console.error("이미지 불러오기 실패:", error);
    }
    imagesLoading = false;
  }

  onMount(() => {
    const cached = getCookie(cacheKey);
    if (cached) {
      images = JSON.parse(cached);
      imagesLoading = false;
    }
    loadImages();

    // 기존 단일 정렬 상태를 쿠키에서 불러오던 부분은 다중 정렬 조건에 맞게 확장할 수 있습니다.
    const savedSortCriteria = getCookie(`sortCriteria-${user.uid}`);
    if (savedSortCriteria) {
      try {
        sortCriteria = JSON.parse(savedSortCriteria);
      } catch(e) {
        console.error("sortCriteria cookie 파싱 실패:", e);
      }
    }
  });

  // 쿠키에 사용자 관련 설정 저장
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

  // 필터 상태들
  let filterMonth = "";
  let filterDescription = "";
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
    return (!filterMonth || img.month.includes(filterMonth))
            && (!filterDescription || img.description.includes(filterDescription))
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
    status: false,
    teamStatus: false,
    type: false,
    size: false,
    price: false,
    remaining: false,
    expectedCustoms: false
  };

  // 다중 정렬을 위한 함수: 조건 배열을 순회하며 정렬
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
      // 현재 조건에서 동일하면 다음 조건으로 넘어갑니다.
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
    const { description, status, teamStatus, type, size, price, remaining, expectedCustoms, purchaseDate } = event.detail;
    modalImage.description = description;
    modalImage.status = status;
    modalImage.teamStatus = teamStatus;
    modalImage.type = type;
    modalImage.size = size;
    modalImage.price = price;
    modalImage.remaining = remaining;
    modalImage.expectedCustoms = expectedCustoms;
    modalImage.purchaseDate = purchaseDate;
    images = [...images];
    try {
      await updateDoc(doc(db, "images", modalImage.id), {
        description, status, teamStatus, type, size, price, remaining, expectedCustoms, purchaseDate
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
        setCookie(cacheKey, JSON.stringify(images), 30);
        await tick();
      } catch (error) {
        console.error("이미지 삭제 실패:", error);
      }
    }
  }
  function handleImageUpload(event) {
    images = [...images, event.detail];
    setCookie(cacheKey, JSON.stringify(images), 30);
  }
  async function handleStatusToggled(event) {
    const { image, newStatus } = event.detail;
    try {
      await updateDoc(doc(db, "images", image.id), { status: newStatus });
      images = images.map(img => img.id === image.id ? { ...img, status: newStatus } : img);
      setCookie(cacheKey, JSON.stringify(images), 30);
    } catch (error) {
      console.error("Status update failed:", error);
    }
  }
  async function handleTeamStatusToggled(event) {
    const { image, newTeamStatus } = event.detail;
    try {
      await updateDoc(doc(db, "images", image.id), { teamStatus: newTeamStatus });
      images = images.map(img => img.id === image.id ? { ...img, teamStatus: newTeamStatus } : img);
      setCookie(cacheKey, JSON.stringify(images), 30);
    } catch (error) {
      console.error("Team status update failed:", error);
    }
  }
  async function updateTeamStatusFromDropdown(image, newTeamStatus) {
    try {
      await updateDoc(doc(db, "images", image.id), { teamStatus: newTeamStatus });
      images = images.map(img => img.id === image.id ? { ...img, teamStatus: newTeamStatus } : img);
      setCookie(cacheKey, JSON.stringify(images), 30);
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
        setCookie(cacheKey, JSON.stringify(images), 30);
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

    // 모든 태그에 overflow: hidden을 강제하는 스타일 태그를 추가
    const noScrollStyle = document.createElement("style");
    noScrollStyle.id = "no-scroll-style";
    noScrollStyle.innerHTML = `* { overflow: hidden !important; }`;
    document.head.appendChild(noScrollStyle);

    // 테이블 뷰 내의 모든 input과 select 요소를 span으로 대체하는 기존 로직
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

    // 캡처 후 원래 요소 복원
    replacements.forEach(({ element, span }) => {
      span.remove();
      element.style.display = '';
    });

    // 추가한 no-scroll 스타일 제거
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

  // 확장된 visibleColumns
  visibleColumns = {
    ...visibleColumns,
    type: visibleColumns.type ?? true,
    size: visibleColumns.size ?? true
  };

  // 확장된 filterVisible
  filterVisible = {
    ...filterVisible,
    type: false,
    size: false
  };

  // 새로운 드롭다운 옵션 (필터용)
  const typeOptions = ["", "PVC", "레진"];
  const sizeOptions = ["", "1/1", "1/1.5", "1/2", "1/2.5", "1/3", "1/3.5", "1/4", "1/4.5", "1/5", "1/5.5", "1/6", "1/6.5", "1/7", "1/7.5", "1/8", "1/8.5", "1/9", "1/9.5", "1/10", "1/10.5", "1/11", "1/11.5", "1/12"];

  const statusOptions = ["", "예약금", "전액", "꼴림"];
  const teamStatusOptions = ["", "코아", "매하", "히탐", "래빗츠", "유메", "위북", "드리머", "중고"];

  // 인라인 편집 시 DB에 저장하는 헬퍼 함수
  async function updateImageField(image, field, newValue) {
    try {
      await updateDoc(doc(db, "images", image.id), { [field]: newValue });
      images = images.map(img => img.id === image.id ? { ...img, [field]: newValue } : img);
      setCookie(cacheKey, JSON.stringify(images), 30);
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
    }
  }

  // 다중 정렬 조건을 업데이트하는 함수
  // 이미 존재하는 컬럼이면 방향을 토글하고, 2번째 클릭 시 조건에서 제거합니다.
  function handleSort(column) {
    const idx = sortCriteria.findIndex(c => c.column === column);
    if (idx !== -1) {
      if (sortCriteria[idx].direction === 'asc') {
        sortCriteria[idx].direction = 'desc';
      } else {
        // 이미 내림차순 상태라면 조건 제거 (또는 필요에 따라 유지할 수 있음)
        sortCriteria.splice(idx, 1);
      }
    } else {
      sortCriteria.push({ column, direction: 'asc' });
    }
    // 배열을 재할당하여 Svelte 반응성을 트리거
    sortCriteria = [...sortCriteria];
  }
</script>

{#if user}
  <header class="dashboard-header" class:hide={!showHeader}>
    <div class="view-switch">
      <button on:click={() => viewMode = 'grid'} class:selected={viewMode==='grid'} title="연도로보기">📆</button>
      <button on:click={() => viewMode = 'single'} class:selected={viewMode==='single'} title="월로보기">📅</button>
      <button on:click={() => viewMode = 'table'} class:selected={viewMode==='table'} title="표로보기">📋</button>
    </div>
    <div class="mobile-header">
      <button class="hamburger" on:click={toggleSidebar}>&#9776;</button>
    </div>
  </header>

  {#if sidebarVisible}
    <div class="sidebar-backdrop" on:click={toggleSidebar}></div>
    <aside class="sidebar" transition:fly={{ x: 300, duration: 300 }}>
      <button class="close-btn" on:click={toggleSidebar}>×</button>
      <button on:click={handleLogout} class="logout-button">로그아웃</button>
      <button on:click={saveDashboardImage} class="save-image-button" disabled={downloading}>
        {#if downloading}
          <span class="spinner-button"></span>
          저장중...
        {:else}
          대시보드 이미지 저장
        {/if}
      </button>
      <div class="totals">
        <span>금액: {formatNumber(totalPrice)}원</span>
        <span>남은 금액: {formatNumber(totalRemaining)}원</span>
        <span>예상 관세: {formatNumber(totalCustoms)}원</span>
        <span>전체 합계: {formatNumber(overallTotal)}원</span>
      </div>
    </aside>
  {/if}
{/if}

{#if imagesLoading}
  <div class="dashboard-loading">
    <div class="spinner"></div>
    <p>이미지를 불러오는 중...</p>
  </div>
{/if}

<div class="dashboard">
  {#if viewMode !== 'table'}
    <div class="year-control">
      <button on:click={prevYear} disabled={parseInt(selectedYear) <= startYear}>←</button>
      <select bind:value={selectedYear}>
        {#each Array.from({ length: (endYear - startYear + 1) }, (_, i) => (startYear + i).toString()) as yearOption}
          <option value={yearOption}>{yearOption}</option>
        {/each}
      </select>
      <button on:click={nextYear} disabled={parseInt(selectedYear) >= endYear}>→</button>
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
          <button on:click={prevMonth} disabled={currentMonthIndex === 0}>←</button>
          <span>{months[currentMonthIndex]}</span>
          <button on:click={nextMonth} disabled={currentMonthIndex === months.length - 1}>→</button>
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
        <div class="table-controls">
          <div class="filter-section">
            <div class="filter-icons">
              <button class:active={filterVisible.month} on:click={(e) => { e.target.blur(); filterVisible.month = !filterVisible.month; }} title="연월 필터">📅</button>
              <button class:active={filterVisible.description} on:click={(e) => { e.target.blur(); filterVisible.description = !filterVisible.description; }} title="설명 필터">💬</button>
              <button class:active={filterVisible.status} on:click={(e) => { e.target.blur(); filterVisible.status = !filterVisible.status; }} title="결제 상태 필터">🔘</button>
              <button class:active={filterVisible.teamStatus} on:click={(e) => { e.target.blur(); filterVisible.teamStatus = !filterVisible.teamStatus; }} title="구매처 필터">👥</button>
              <button class:active={filterVisible.type} on:click={(e) => { e.target.blur(); filterVisible.type = !filterVisible.type; }} title="종류 필터">📦</button>
              <button class:active={filterVisible.size} on:click={(e) => { e.target.blur(); filterVisible.size = !filterVisible.size; }} title="사이즈 필터">📏</button>
              <button class:active={filterVisible.price} on:click={(e) => { e.target.blur(); filterVisible.price = !filterVisible.price; }} title="금액 필터">💲</button>
              <button class:active={filterVisible.remaining} on:click={(e) => { e.target.blur(); filterVisible.remaining = !filterVisible.remaining; }} title="남은 금액 필터">💰</button>
              <button class:active={filterVisible.expectedCustoms} on:click={(e) => { e.target.blur(); filterVisible.expectedCustoms = !filterVisible.expectedCustoms; }} title="예상 관세 필터">📦</button>
            </div>
            <div class="filter-inputs">
              {#if filterVisible.month}
                <div class="filter-input">
                  <label>연월:</label>
                  <input type="text" bind:value={filterMonth} placeholder="연월 선택" list="monthList" />
                  <datalist id="monthList">
                    {#each months as m}
                      <option value={m} />
                    {/each}
                  </datalist>
                </div>
              {/if}
              {#if filterVisible.description}
                <div class="filter-input">
                  <label>설명:</label>
                  <input type="text" bind:value={filterDescription} placeholder="설명 필터" />
                </div>
              {/if}
              {#if filterVisible.status}
                <div class="filter-input">
                  <label>결제 상태:</label>
                  <select bind:value={filterStatus}>
                    {#each statusOptions as opt}
                      <option value={opt}>{opt === "" ? "전체" : opt}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if filterVisible.teamStatus}
                <div class="filter-input">
                  <label>구매처:</label>
                  <select bind:value={filterTeamStatus}>
                    {#each teamStatusOptions as opt}
                      <option value={opt}>{opt === "" ? "전체" : opt}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if filterVisible.type}
                <div class="filter-input">
                  <label>종류:</label>
                  <select bind:value={filterType}>
                    {#each typeOptions as opt}
                      <option value={opt}>{opt === "" ? "전체" : opt}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if filterVisible.size}
                <div class="filter-input">
                  <label>사이즈:</label>
                  <select bind:value={filterSize}>
                    {#each sizeOptions as opt}
                      <option value={opt}>{opt === "" ? "전체" : opt}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if filterVisible.price}
                <div class="filter-input">
                  <label>금액:</label>
                  <input type="text" bind:value={filterPriceMin} placeholder="최소 (원)" />
                  <input type="text" bind:value={filterPriceMax} placeholder="최대 (원)" />
                </div>
              {/if}
              {#if filterVisible.remaining}
                <div class="filter-input">
                  <label>남은 금액:</label>
                  <input type="text" bind:value={filterRemainingMin} placeholder="최소 (원)" />
                  <input type="text" bind:value={filterRemainingMax} placeholder="최대 (원)" />
                </div>
              {/if}
              {#if filterVisible.expectedCustoms}
                <div class="filter-input">
                  <label>예상 관세:</label>
                  <input type="text" bind:value={filterExpectedCustomsMin} placeholder="최소 (원)" />
                  <input type="text" bind:value={filterExpectedCustomsMax} placeholder="최대 (원)" />
                </div>
              {/if}
            </div>
          </div>
          <div class="column-toggle">
            <label><input type="checkbox" bind:checked={visibleColumns.src}> 이미지</label>
            <label><input type="checkbox" bind:checked={visibleColumns.month}> 연월</label>
            <label><input type="checkbox" bind:checked={visibleColumns.description}> 설명</label>
            <label><input type="checkbox" bind:checked={visibleColumns.status}> 결제 상태</label>
            <label><input type="checkbox" bind:checked={visibleColumns.teamStatus}> 구매처</label>
            <label><input type="checkbox" bind:checked={visibleColumns.type}> 종류</label>
            <label><input type="checkbox" bind:checked={visibleColumns.size}> 사이즈</label>
            <label><input type="checkbox" bind:checked={visibleColumns.price}> 금액</label>
            <label><input type="checkbox" bind:checked={visibleColumns.remaining}> 남은 금액</label>
            <label><input type="checkbox" bind:checked={visibleColumns.expectedCustoms}> 예상 관세</label>
          </div>
        </div>
        <table class="images-table">
          <thead>
          <tr>
            {#if visibleColumns.src}
              <th>이미지</th>
            {/if}
            {#if visibleColumns.month}
              <th on:click={() => handleSort('month')}>
                연월
                {#if sortCriteria.find(c => c.column === 'month')}
                  {sortCriteria.find(c => c.column === 'month').direction === 'asc' ? '▲' : '▼'}
                {/if}
              </th>
            {/if}
            {#if visibleColumns.description}
              <th on:click={() => handleSort('description')}>
                설명
                {#if sortCriteria.find(c => c.column === 'description')}
                  {sortCriteria.find(c => c.column === 'description').direction === 'asc' ? '▲' : '▼'}
                {/if}
              </th>
            {/if}
            {#if visibleColumns.status}
              <th on:click={() => handleSort('status')}>
                결제 상태
                {#if sortCriteria.find(c => c.column === 'status')}
                  {sortCriteria.find(c => c.column === 'status').direction === 'asc' ? '▲' : '▼'}
                {/if}
              </th>
            {/if}
            {#if visibleColumns.teamStatus}
              <th on:click={() => handleSort('teamStatus')}>
                구매처
                {#if sortCriteria.find(c => c.column === 'teamStatus')}
                  {sortCriteria.find(c => c.column === 'teamStatus').direction === 'asc' ? '▲' : '▼'}
                {/if}
              </th>
            {/if}
            {#if visibleColumns.type}
              <th on:click={() => handleSort('type')}>
                종류
                {#if sortCriteria.find(c => c.column === 'type')}
                  {sortCriteria.find(c => c.column === 'type').direction === 'asc' ? '▲' : '▼'}
                {/if}
              </th>
            {/if}
            {#if visibleColumns.size}
              <th on:click={() => handleSort('size')}>
                사이즈
                {#if sortCriteria.find(c => c.column === 'size')}
                  {sortCriteria.find(c => c.column === 'size').direction === 'asc' ? '▲' : '▼'}
                {/if}
              </th>
            {/if}
            {#if visibleColumns.price}
              <th on:click={() => handleSort('price')}>
                금액
                {#if sortCriteria.find(c => c.column === 'price')}
                  {sortCriteria.find(c => c.column === 'price').direction === 'asc' ? '▲' : '▼'}
                {/if}
              </th>
            {/if}
            {#if visibleColumns.remaining}
              <th on:click={() => handleSort('remaining')}>
                남은 금액
                {#if sortCriteria.find(c => c.column === 'remaining')}
                  {sortCriteria.find(c => c.column === 'remaining').direction === 'asc' ? '▲' : '▼'}
                {/if}
              </th>
            {/if}
            {#if visibleColumns.expectedCustoms}
              <th on:click={() => handleSort('expectedCustoms')}>
                예상 관세
                {#if sortCriteria.find(c => c.column === 'expectedCustoms')}
                  {sortCriteria.find(c => c.column === 'expectedCustoms').direction === 'asc' ? '▲' : '▼'}
                {/if}
              </th>
            {/if}
          </tr>
          </thead>
          <tbody>
          {#each sortedFilteredImages as img}
            <tr>
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
          setCookie(cacheKey, JSON.stringify(images), 30);
          await tick();
          modalVisible = false;
          modalImage = null;
        } catch (error) {
          console.error("모달 이미지 삭제 실패:", error);
        }
      })();
    }} />
{/if}

<style>
  .dashboard-header {
    position: fixed;
    top: 1rem;
    left: 1rem;
    right: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 50;
    transition: transform 0.3s ease-in-out;
  }
  .dashboard-header.hide {
    transform: translateY(-100%);
  }
  .view-switch button {
    background: none;
    border: none;
    font-size: 1.8rem;
    cursor: pointer;
    transition: transform 0.2s ease, opacity 0.2s ease;
    margin-right: 0.5rem;
    opacity: 0.5;
  }
  .view-switch button.selected {
    transform: scale(1.2);
    opacity: 1;
  }
  .mobile-header .hamburger {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: inherit;
  }
  :global(html.dark) .hamburger {
    color: #fff;
  }
  .sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 250px;
    height: 100%;
    background-color: #fff;
    padding: 1rem;
    box-shadow: -2px 0 5px rgba(0,0,0,0.3);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  :global(html.dark) .sidebar {
    background-color: #333;
    color: #fff;
  }
  .sidebar-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 90;
  }
  .close-btn {
    background: none;
    border: none;
    font-size: 1.5rem;
    align-self: flex-end;
    cursor: pointer;
    color: inherit;
  }
  .totals {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    font-weight: bold;
  }
  .totals span {
    padding: 0.5rem 1rem;
    border-radius: 4px;
    background-color: #3498db;
    color: #fff;
  }
  :global(html.dark) .totals span {
    background-color: #555;
  }
  .logout-button {
    padding: 0.5rem 1rem;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s ease;
  }
  :global(html.dark) .logout-button {
    background-color: #555;
    color: #fff;
  }
  .save-image-button {
    padding: 0.5rem 1rem;
    background-color: #27ae60;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
  }
  .save-image-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .spinner-button {
    border: 2px solid #fff;
    border-top: 2px solid transparent;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 1s linear infinite;
    display: inline-block;
    margin-right: 0.5rem;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .dashboard-loading {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255,255,255,0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 1001;
  }
  .spinner {
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    width: 60px;
    height: 60px;
    animation: spin 1s linear infinite;
  }
  .dashboard {
    min-height: 100%;
    margin: 0 auto;
    padding: 6rem 1rem 1rem 1rem;
    background-color: #fff;
    color: #333;
    transition: background-color 0.3s ease, color 0.3s ease;
  }
  :global(html.dark) .dashboard {
    background-color: #1e1e1e;
    color: #fff;
  }
  .year-control {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .year-control select,
  .year-control button {
    padding: 0.5rem;
    color: inherit;
    background-color: transparent;
    border: 1px solid currentColor;
  }
  .capture-area {
    position: relative;
    background-color: #fff;
    padding: 3rem 1rem 1rem 1rem;
    color: #333;
  }
  :global(html.dark) .capture-area {
    background-color: #1e1e1e;
    color: #fff;
  }
  .table-view-container {
    position: relative;
    overflow-x: auto;
  }
  :global(html.dark) .table-view-container {
    background-color: #1e1e1e;
    color: #fff;
  }
  .table-controls {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1rem;
  }
  .filter-section {
    flex: 1;
  }
  .filter-icons {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .filter-icons button {
    background: none;
    border: none;
    font-size: 1.4rem;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.2s;
  }
  .filter-icons button.active,
  .filter-icons button:hover {
    opacity: 1;
  }
  .filter-inputs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .filter-input {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .filter-input label {
    font-size: 0.9rem;
    width: 80px;
  }
  .filter-input input,
  .filter-input select {
    width: 100%;
    padding: 0.3rem;
    font-size: 0.9rem;
    border: 1px solid #ccc;
  }
  :global(html.dark) .filter-input input,
  :global(html.dark) .filter-input select {
    background-color: #444;
    border-color: #666;
    color: #fff;
  }
  .column-toggle {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    font-size: 0.9rem;
  }
  @media (max-width: 680px) {
    .column-toggle {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
      font-size: 0.8rem;
    }
    .column-toggle label {
      width: 100%;
      min-width: 80px;
      padding: 0.5rem;
      border-bottom: 1px solid #ccc;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }
  .images-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
  }
  .images-table th,
  .images-table td {
    border: 1px solid #ddd;
    padding: 0.5rem;
    text-align: center;
  }
  .images-table th {
    background-color: #3498db;
    color: #fff;
    cursor: pointer;
  }
  :global(html.dark) .images-table th {
    background-color: #444;
    border-color: #555;
  }
  .table-thumb {
    width: 50px;
    height: auto;
  }
  .months-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(6, 1fr);
  }
  @media (max-width: 1280px) {
    .months-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 680px) {
    .months-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 480px) {
    .months-grid {
      grid-template-columns: 1fr;
    }
  }
  .single-view {
    text-align: center;
  }
  .navigation {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .month-single {
    display: flex;
    justify-content: center;
  }
</style>
