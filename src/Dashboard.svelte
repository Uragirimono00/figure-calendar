<!-- src/Dashboard.svelte -->
<script>
  import { onMount, tick } from 'svelte';
  import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
  import { deleteObject, ref as storageRef } from 'firebase/storage';
  import { db, storage, auth } from './firebase.js';
  import MonthDropzone from './MonthDropzone.svelte';
  import ImageModal from './ImageModal.svelte';
  import { signOut } from 'firebase/auth';

  export let user;
  let images = [];
  let imagesLoading = true;
  $: cacheKey = `cachedImages-${user.uid}`;

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
    const { description, status } = event.detail;
    modalImage.description = description;
    modalImage.status = status;
    images = [...images];
    try {
      await updateDoc(doc(db, "images", modalImage.id), { description, status });
    } catch (error) {
      console.error("설명 업데이트 실패:", error);
    }
    modalVisible = false;
    modalImage = null;
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

  // 상태 토글 이벤트 처리: DB 업데이트 후 UI 업데이트
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

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("로그아웃 실패:", error);
    }
  }
</script>

<!-- 상단 왼쪽 고정된 로그아웃 버튼 -->
{#if user}
  <header class="dashboard-header">
    <button on:click={handleLogout} class="logout-button">로그아웃</button>
  </header>
{/if}

{#if imagesLoading}
  <div class="dashboard-loading">
    <div class="spinner"></div>
    <p>이미지를 불러오는 중...</p>
  </div>
{/if}

<div class="dashboard">
  <h2>{selectedYear} 이미지 업로드</h2>

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
                on:statusToggled={handleStatusToggled} />
      {/each}
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
                on:statusToggled={handleStatusToggled} />
      </div>
    </div>
  {/if}
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
  /* 상단 왼쪽 고정 헤더 */
  .dashboard-header {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 100;
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
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .dashboard {
    margin: 2rem auto;
    padding: 1rem;
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
    /* 최대 4열로 구성하고, 열이 부족하면 남은 공간에 맞게 늘어남 */
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  /* 나머지 스타일은 그대로 유지 */
  .dashboard-header {
    position: fixed;
    top: 1rem;
    left: 1rem;
    z-index: 100;
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
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .dashboard {
    margin: 2rem auto;
    padding: 1rem;
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
  /* single-view 관련 스타일은 그대로 유지 */
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
</style>
