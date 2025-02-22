<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  // 선택 가능한 연도와 월
  let selectedYear = "2024";
  let selectedMonth = "01";
  const years = ["2024", "2025", "2026"];
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

  function handleFileChange(event) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (e) => {
        // 선택한 연도와 월로 업로드할 이미지의 그룹을 지정합니다.
        const month = selectedYear + '-' + selectedMonth;
        dispatch('imageUploaded', { src: e.target.result, month, date: new Date() });
      };
      reader.readAsDataURL(file);
    }
  }
</script>

<div class="upload-container">
  <div class="select-container">
    <label for="year-select">Year:</label>
    <select id="year-select" bind:value={selectedYear}>
      {#each years as year}
        <option value={year}>{year}</option>
      {/each}
    </select>

    <label for="month-select">Month:</label>
    <select id="month-select" bind:value={selectedMonth}>
      {#each months as month}
        <option value={month}>{month}</option>
      {/each}
    </select>
  </div>
  <input type="file" accept="image/*" on:change={handleFileChange} multiple />
</div>

<style>
  .select-container {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
  }
  label {
    margin-right: 0.5rem;
  }
  input[type="file"] {
    margin: 1rem 0;
  }
</style>
