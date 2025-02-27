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

  export let user;
  let images = [];
  let imagesLoading = true;
  $: cacheKey = `cachedImages-${user.uid}`;

  // 다운로드 진행 상태 플래그
  let downloading = false;

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
      localStorage.setItem(cacheKey, JSON.stringify(images));
    } catch (error) {
      console.error("이미지 불러오기 실패:", error);
    }
    imagesLoading = false;
  }

  onMount(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      images = JSON.parse(cached);
      imagesLoading = false;
    }
    loadImages();
  });

  // 이미지를 월별로 그룹화
  $: groupedImages = groupByMonth(images);
  function groupByMonth(images) {
    const groups = {};
    images.forEach(img => {
      if (!groups[img.month]) groups[img.month] = [];
      groups[img.month].push(img);
    });
    return groups;
  }

  const startYear = 2000;
  const endYear = 2099;
  let currentYear = new Date().getFullYear();
  let selectedYear = currentYear.toString();
  $: months = Array.from({ length: 12 }, (_, i) =>
          `${selectedYear}-${String(i + 1).padStart(2, '0')}`
  );

  let viewMode = 'grid';
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
    const { description, status, teamStatus, type, size, price, remaining, expectedCustoms, purchaseDate, purchasePlace } = event.detail;
    // 모달 내 상태 업데이트
    modalImage.description = description;
    modalImage.status = status;
    modalImage.teamStatus = teamStatus;
    modalImage.type = type;
    modalImage.size = size;
    modalImage.price = price;
    modalImage.remaining = remaining;
    modalImage.expectedCustoms = expectedCustoms;
    modalImage.purchaseDate = purchaseDate;
    modalImage.purchasePlace = purchasePlace;

    images = [...images];

    try {
      await updateDoc(doc(db, "images", modalImage.id), {
        description, status, teamStatus, type, size, price, remaining, expectedCustoms, purchaseDate, purchasePlace
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
        localStorage.setItem(cacheKey, JSON.stringify(images));
        await tick();
      } catch (error) {
        console.error("이미지 삭제 실패:", error);
      }
    }
  }

  function handleImageUpload(event) {
    images = [...images, event.detail];
    localStorage.setItem(cacheKey, JSON.stringify(images));
  }

  async function handleStatusToggled(event) {
    const { image, newStatus } = event.detail;
    try {
      await updateDoc(doc(db, "images", image.id), { status: newStatus });
      images = images.map(img => img.id === image.id ? { ...img, status: newStatus } : img);
      localStorage.setItem(cacheKey, JSON.stringify(images));
    } catch (error) {
      console.error("Status update failed:", error);
    }
  }

  async function handleTeamStatusToggled(event) {
    const { image, newTeamStatus } = event.detail;
    try {
      await updateDoc(doc(db, "images", image.id), { teamStatus: newTeamStatus });
      images = images.map(img => img.id === image.id ? { ...img, teamStatus: newTeamStatus } : img);
      localStorage.setItem(cacheKey, JSON.stringify(images));
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
        localStorage.setItem(cacheKey, JSON.stringify(images));
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
    try {
      const dataUrl = await domtoimage.toPng(captureArea, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `dashboard_${new Date().toISOString()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("이미지 저장 실패:", error);
    }
    downloading = false;
  }

  // 사이드바 표시 여부 및 토글 함수
  let sidebarVisible = false;
  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
  }

  // 총합 계산 (각 필드를 숫자로 변환)
  $: totalPrice = images.reduce((sum, img) => sum + (Number(img.price) || 0), 0);
  $: totalRemaining = images.reduce((sum, img) => sum + (Number(img.remaining) || 0), 0);
  $: totalCustoms = images.reduce((sum, img) => sum + (Number(img.expectedCustoms) || 0), 0);
  $: overallTotal = totalPrice + totalRemaining + totalCustoms;
</script>

{#if user}
  <header class="dashboard-header">
    <!-- 모든 크기에서 햄버거 메뉴만 표시 -->
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
        <span>금액: {totalPrice}원</span>
        <span>남은 금액: {totalRemaining}원</span>
        <span>예상 관세: {totalCustoms}원</span>
        <span>전체 합계: {overallTotal}원</span>
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
  <div class="year-control">
    <button on:click={prevYear} disabled={parseInt(selectedYear) <= startYear}>←</button>
    <select bind:value={selectedYear}>
      {#each Array.from({ length: (endYear - startYear + 1) }, (_, i) => (startYear + i).toString()) as yearOption}
        <option value={yearOption}>{yearOption}</option>
      {/each}
    </select>
    <button on:click={nextYear} disabled={parseInt(selectedYear) >= endYear}>→</button>
  </div>

  <div class="view-toggle">
    <button on:click={() => viewMode = viewMode === 'grid' ? 'single' : 'grid'}>
      {viewMode === 'grid' ? '1달씩 보기 (Single View)' : '캘린더 보기 (Grid View)'}
    </button>
  </div>

  <!-- 캡처 대상 영역 -->
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
        <!-- 항상 보이는 "미정" 칸 -->
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
    {:else}
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
          localStorage.setItem(cacheKey, JSON.stringify(images));
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
    align-items: center;
    gap: 1rem;
    z-index: 50;
  }
  /* 항상 햄버거 메뉴만 표시 */
  .mobile-header {
    display: block;
    margin-left: auto;
  }
  .hamburger {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: inherit;
  }
  /* 다크모드에서 햄버거 버튼 색상 강제 지정 */
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
  /* 닫기 버튼에 color: inherit 추가 */
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
    color: #fff;
  }
  .logout-button {
    padding: 0.5rem 1rem;
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.3s ease, color 0.3s ease;
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
    transition: background-color 0.3s ease;
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
    vertical-align: middle;
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
    margin: 0 auto;
    padding: 4rem 1rem;
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
    transition: color 0.3s ease;
  }
  .year-control select {
    padding: 0.5rem;
    transition: background-color 0.3s ease, color 0.3s ease;
  }
  .view-toggle {
    text-align: center;
    margin-bottom: 1rem;
  }
  .months-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: repeat(6, 1fr);
    max-width: 100%;
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
      grid-template-columns: repeat(1, 1fr);
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
  :global(.month-single .month-dropzone) {
    width: 100%;
  }
  button {
    padding: 0.5rem 1rem;
    cursor: pointer;
    transition: background-color 0.3s ease, color 0.3s ease;
  }
  .dashboard h2,
  .year-control,
  .hint {
    color: inherit;
  }
  .year-control select,
  .year-control button {
    color: inherit;
    background-color: transparent;
    border: 1px solid currentColor;
  }
  :global(html.dark) .year-control select {
    background-color: #333;
  }
  .capture-area {
    background-color: #fff;
    padding: 1rem;
    color: #333;
  }
  :global(html.dark) .capture-area {
    background-color: #1e1e1e;
    color: #fff;
  }
</style>
