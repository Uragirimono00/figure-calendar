<!-- src/Dashboard.svelte -->
<script>
  import { onMount } from 'svelte';
  import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
  import { deleteObject, ref as storageRef } from 'firebase/storage';
  import { db, storage } from './firebase.js';
  import MonthDropzone from './MonthDropzone.svelte';
  import ImageModal from './ImageModal.svelte';

  export let user;
  let images = [];

  async function loadImages() {
    const q = query(collection(db, "images"), where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);
    const loadedImages = [];
    querySnapshot.forEach(docSnapshot => {
      loadedImages.push({ ...docSnapshot.data(), id: docSnapshot.id });
    });
    images = loadedImages;
  }

  onMount(() => {
    loadImages();
  });

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
    if (currentMonthIndex > 0) {
      currentMonthIndex--;
    }
  }
  function nextMonth() {
    if (currentMonthIndex < months.length - 1) {
      currentMonthIndex++;
    }
  }

  let modalVisible = false;
  let modalImage = null;

  function handleImageClicked(event) {
    modalImage = event.detail.image;
    modalVisible = true;
  }
  function handleModalSave(event) {
    const { description } = event.detail;
    modalImage.description = description;
    images = [...images];
    modalVisible = false;
    modalImage = null;
  }
  function handleModalClose() {
    modalVisible = false;
    modalImage = null;
  }
  async function handleModalDelete(event) {
    const { id, storagePath } = event.detail;
    try {
      // Firestore에서 삭제
      await deleteDoc(doc(db, "images", id));
      // Storage에서 삭제
      const sRef = storageRef(storage, storagePath);
      await deleteObject(sRef);
      images = images.filter(img => img.id !== id);
      modalVisible = false;
      modalImage = null;
    } catch (error) {
      console.error("Deletion failed:", error);
    }
  }
  function handleImageUpload(event) {
    images = [...images, event.detail];
  }
</script>

<div class="dashboard">
  <h2>{selectedYear} 이미지 업로드</h2>

  <!-- 연도 선택 컨트롤 -->
  <div class="year-control">
    <button on:click={prevYear} disabled={parseInt(selectedYear) <= startYear}>←</button>
    <select bind:value={selectedYear}>
      {#each Array.from({ length: (endYear - startYear + 1) }, (_, i) => (startYear + i).toString()) as yearOption}
        <option value={yearOption}>{yearOption}</option>
      {/each}
    </select>
    <button on:click={nextYear} disabled={parseInt(selectedYear) >= endYear}>→</button>
  </div>

  <!-- 보기 모드 토글 -->
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
                on:imageClicked={handleImageClicked} />
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
                on:imageClicked={handleImageClicked} />
      </div>
    </div>
  {/if}
</div>

{#if modalVisible}
  <ImageModal
          image={modalImage}
          on:save={handleModalSave}
          on:close={handleModalClose}
          on:delete={handleModalDelete} />
{/if}

<style>
  .dashboard {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 1rem;
  }
  .year-control {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .year-control select {
    padding: 0.5rem;
  }
  .view-toggle {
    text-align: center;
    margin-bottom: 1rem;
  }
  .months-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
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
  button {
    padding: 0.5rem 1rem;
    cursor: pointer;
  }
</style>
