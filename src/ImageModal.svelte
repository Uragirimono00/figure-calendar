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
        <div class="img-container">
            <!-- 대시보드에서 전달받은 이미지(src)를 그대로 사용 -->
            <img src={image.src} alt="Uploaded image" loading="eager" />
        </div>
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
            <button class="btn-save" on:click={save}>저장</button>
            <button class="btn-delete" on:click={deleteImage}>삭제</button>
            <button class="btn-close" on:click={closeModal}>닫기</button>
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
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(4px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    /* 다크모드: 배경 어둡게 처리 */
    :global(html.dark) .modal-backdrop {
        background: rgba(0,0,0,0.8);
    }

    .modal-content {
        background: #fff;
        border-radius: 12px;
        padding: 2rem;
        width: 90%;
        max-width: 600px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        animation: fadeIn 0.3s ease-out;
        overflow-y: auto;
        max-height: 90%;
        text-align: center;
    }

    /* 다크모드: 콘텐츠 배경, 글자 색상 변경 */
    :global(html.dark) .modal-content {
        background: #2c2c2c;
        color: #f1f1f1;
        box-shadow: 0 4px 10px rgba(0,0,0,0.6);
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .img-container {
        margin-bottom: 1rem;
    }

    .img-container img {
        display: block;
        margin: 0 auto;
        max-width: 100%;
        height: auto;
        border-radius: 8px;
    }

    textarea {
        width: 100%;
        padding: 0.5rem;
        font-size: 1rem;
        border: 1px solid #ddd;
        border-radius: 6px;
        resize: vertical;
        min-height: 80px;
        margin-bottom: 1rem;
        background: #f9f9f9;
        color: #333;
    }

    /* 다크모드: textarea 스타일 */
    :global(html.dark) textarea {
        background: #444;
        border: 1px solid #555;
        color: #eee;
    }

    .status-select {
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;
    }

    .status-select label {
        margin-right: 0.5rem;
        font-weight: bold;
        min-width: 80px;
    }

    .status-select select {
        flex: 1;
        padding: 0.4rem;
        font-size: 1rem;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #f9f9f9;
        color: #333;
    }

    /* 다크모드: select 요소 스타일 */
    :global(html.dark) .status-select select {
        background: #444;
        border: 1px solid #555;
        color: #eee;
    }

    .modal-buttons {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 1rem;
    }

    .modal-buttons button {
        padding: 0.6rem 1.2rem;
        font-size: 1rem;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .btn-save {
        background-color: #3498db;
        color: #fff;
    }

    .btn-save:hover {
        background-color: #2980b9;
    }

    .btn-delete {
        background-color: #e74c3c;
        color: #fff;
    }

    .btn-delete:hover {
        background-color: #c0392b;
    }

    .btn-close {
        background-color: #95a5a6;
        color: #fff;
    }

    .btn-close:hover {
        background-color: #7f8c8d;
    }

    /* 다크모드: 버튼 색상 약간 조정 */
    :global(html.dark) .btn-save {
        background-color: #2980b9;
    }
    :global(html.dark) .btn-save:hover {
        background-color: #1c638d;
    }
    :global(html.dark) .btn-delete {
        background-color: #c0392b;
    }
    :global(html.dark) .btn-delete:hover {
        background-color: #992d22;
    }
    :global(html.dark) .btn-close {
        background-color: #7f8c8d;
    }
    :global(html.dark) .btn-close:hover {
        background-color: #616a6b;
    }
</style>
