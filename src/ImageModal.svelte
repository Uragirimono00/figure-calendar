<!-- src/ImageModal.svelte -->
<script>
    import { onMount, createEventDispatcher } from 'svelte';
    export let image;
    // image 객체에 새 필드가 포함될 수 있습니다.
    // { id, src, date, description, month, storagePath, status, teamStatus, type, size, price, remaining, expectedCustoms, purchaseDate, purchasePlace }
    const dispatch = createEventDispatcher();

    let description = image.description || "";
    let status = image.status || "예약금";
    let teamStatus = image.teamStatus || "코아";

    // 새 필드들 (기본값 설정)
    let type = image.type || "PVC";
    let size = image.size || "1/1";
    let price = image.price || "";
    let remaining = image.remaining || "";
    let expectedCustoms = image.expectedCustoms || "";
    let purchaseDate = image.purchaseDate || "";
    let purchasePlace = image.purchasePlace || "ASL";

    let backdrop;
    let imageLoaded = false;

    function handleImageLoad() {
        imageLoaded = true;
    }

    // 자동 저장: 필드가 변경될 때마다 부모 컴포넌트에 save 이벤트를 보냅니다.
    function save() {
        dispatch('save', {
            description,
            status,
            teamStatus,
            type,
            size,
            price,
            remaining,
            expectedCustoms,
            purchaseDate,
            purchasePlace
        });
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
            {#if !imageLoaded}
                <div class="img-placeholder">
                    <div class="spinner"></div>
                </div>
            {/if}
            <img src={image.src} alt="Uploaded image" loading="eager" on:load={handleImageLoad} style="display: {imageLoaded ? 'block' : 'none'}" />
        </div>
        <textarea bind:value={description} placeholder="이미지 설명 추가" on:input={save}></textarea>

        <div class="status-select">
            <label>결제 상태:</label>
            <select bind:value={status} on:change={save}>
                <option value="예약금">예약금</option>
                <option value="전액">전액</option>
                <option value="꼴림">꼴림</option>
            </select>
        </div>

        <div class="status-select">
            <label>팀 상태:</label>
            <select bind:value={teamStatus} on:change={save}>
                <option value="코아">코아</option>
                <option value="매하">매하</option>
                <option value="히탐">히탐</option>
                <option value="래빗츠">래빗츠</option>
                <option value="유메">유메</option>
                <option value="위북">위북</option>
                <option value="드리머">드리머</option>
                <option value="ASL">ASL</option>
                <option value="중고">중고</option>
            </select>
        </div>

        <!-- 새 항목들 -->
        <div class="status-select">
            <label>종류:</label>
            <select bind:value={type} on:change={save}>
                <option value="PVC">PVC</option>
                <option value="레진">레진</option>
            </select>
        </div>

        <div class="status-select">
            <label>사이즈:</label>
            <select bind:value={size} on:change={save}>
                <option value="1/1">1/1</option>
                <option value="1/1.5">1/1.5</option>
                <option value="1/2">1/2</option>
                <option value="1/2.5">1/2.5</option>
                <option value="1/3">1/3</option>
                <option value="1/3.5">1/3.5</option>
                <option value="1/4">1/4</option>
                <option value="1/4.5">1/4.5</option>
                <option value="1/5">1/5</option>
                <option value="1/5.5">1/5.5</option>
                <option value="1/6">1/6</option>
                <option value="1/6.5">1/6.5</option>
                <option value="1/7">1/7</option>
                <option value="1/7.5">1/7.5</option>
                <option value="1/8">1/8</option>
                <option value="1/8.5">1/8.5</option>
                <option value="1/9">1/9</option>
                <option value="1/9.5">1/9.5</option>
                <option value="1/10">1/10</option>
                <option value="1/10.5">1/10.5</option>
                <option value="1/11">1/11</option>
                <option value="1/11.5">1/11.5</option>
                <option value="1/12">1/12</option>
            </select>
        </div>

        <div class="status-select">
            <label>금액:</label>
            <input type="number" bind:value={price} placeholder="금액 입력 (원)" on:input={save} />
        </div>

        <div class="status-select">
            <label>남은 금액:</label>
            <input type="number" bind:value={remaining} placeholder="남은 금액 입력 (원)" on:input={save} />
        </div>

        <div class="status-select">
            <label>예상 관세:</label>
            <input type="number" bind:value={expectedCustoms} placeholder="예상 관세 입력 (원)" on:input={save} />
        </div>

        <div class="status-select">
            <label>구매일자:</label>
            <input type="date" bind:value={purchaseDate} on:change={save} />
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
        position: relative;
    }
    .img-container img {
        display: block;
        margin: 0 auto;
        max-width: 100%;
        height: auto;
        border-radius: 8px;
    }
    .img-placeholder {
        width: 100%;
        height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #e0e0e0;
        border-radius: 8px;
    }
    .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
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
    .status-select select,
    .status-select input {
        flex: 1;
        padding: 0.4rem;
        font-size: 1rem;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: #f9f9f9;
        color: #333;
    }
    :global(html.dark) .status-select select,
    :global(html.dark) .status-select input {
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
