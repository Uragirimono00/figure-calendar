<script>
    import { onMount, createEventDispatcher } from 'svelte';
    export let image; // { id, src, date, description, month, storagePath, status, teamStatus }
    const dispatch = createEventDispatcher();

    let description = image.description || "";
    let status = image.status || "예약금";
    let teamStatus = image.teamStatus || "코아";
    let backdrop;

    function save() {
        dispatch('save', { description, status, teamStatus });
    }

    function deleteImage() {
        if (confirm("이미지를 삭제하시겠습니까?")) {
            dispatch('delete', { id: image.id, storagePath: image.storagePath });
        }
    }

    function closeModal() {
        dispatch('close');
    }

    onMount(() => {
        backdrop.focus();
    });
</script>

<div class="modal-backdrop" bind:this={backdrop} tabindex="-1" role="dialog"
     on:click={closeModal}
     on:keydown={(e) => { if(e.key === 'Escape') closeModal(); }}>
    <div class="modal-content" on:click|stopPropagation>
        <img src={image.src} alt="Uploaded image" />
        <textarea bind:value={description} placeholder="이미지 설명 추가"></textarea>

        <div class="status-select">
            <label>결제 상태:</label>
            <select bind:value={status}>
                <option value="예약금">예약금</option>
                <option value="전액">전액</option>
                <option value="꼴림">꼴림</option>
            </select>
        </div>

        <div class="status-select">
            <label>팀 상태:</label>
            <select bind:value={teamStatus}>
                <option value="코아">코아</option>
                <option value="매하">매하</option>
                <option value="히탐">히탐</option>
                <option value="래빗츠">래빗츠</option>
                <option value="유메">유메</option>
                <option value="위북">위북</option>
            </select>
        </div>

        <div class="modal-buttons">
            <button on:click={save}>저장</button>
            <button on:click={deleteImage}>삭제</button>
            <button on:click={closeModal}>닫기</button>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    .modal-content {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        max-width: 50vw;
        max-height: 90%;
        overflow-y: auto;
    }
    img {
        max-width: 100%;
        height: auto;
    }
    textarea {
        width: 100%;
        height: 80px;
        margin-top: 1rem;
    }
    .status-select {
        margin-top: 0.5rem;
        display: flex;
        align-items: center;
    }
    .status-select label {
        margin-right: 0.5rem;
        font-weight: bold;
    }
    .status-select select {
        padding: 0.3rem;
        border-radius: 4px;
        border: 1px solid #ccc;
    }
    .modal-buttons {
        margin-top: 1rem;
        text-align: right;
    }
    button {
        margin-left: 0.5rem;
    }
</style>
