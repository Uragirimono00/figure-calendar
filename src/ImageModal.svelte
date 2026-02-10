<!-- src/ImageModal.svelte -->
<script>
    import { onMount, createEventDispatcher } from 'svelte';
    export let image;
    const dispatch = createEventDispatcher();

    let description = image.description || "";
    let status = image.status || "예약금";
    let teamStatus = image.teamStatus || "코아";
    let purchaseStatus = image.purchaseStatus || "";
    let manufacturer = image.manufacturer || "";
    let releaseDate = image.releaseDate || "";

    let type = image.type || "PVC";
    let size = image.size || "1/1";
    let priceRaw = image.price ? String(image.price) : "";
    let remainingRaw = image.remaining ? String(image.remaining) : "";
    let expectedCustomsRaw = image.expectedCustoms ? String(image.expectedCustoms) : "";
    $: priceFormatted = formatNumber(priceRaw);
    $: remainingFormatted = formatNumber(remainingRaw);
    $: expectedCustomsFormatted = formatNumber(expectedCustomsRaw);

    let purchaseDate = image.purchaseDate || "";
    let purchasePlace = image.purchasePlace || "ASL";

    $: showPaymentStatus = purchaseStatus !== "찜";

    let backdrop;
    let imageLoaded = false;

    function handleImageLoad() {
        imageLoaded = true;
    }

    function formatNumber(n) {
        if (!n) return "";
        return Number(n).toLocaleString();
    }

    function handlePriceInput(event) {
        let val = event.target.value.replace(/,/g, '').replace(/\D/g, '');
        priceRaw = val;
        save();
    }
    function handleRemainingInput(event) {
        let val = event.target.value.replace(/,/g, '').replace(/\D/g, '');
        remainingRaw = val;
        save();
    }
    function handleExpectedCustomsInput(event) {
        let val = event.target.value.replace(/,/g, '').replace(/\D/g, '');
        expectedCustomsRaw = val;
        save();
    }

    function save() {
        dispatch('save', {
            description,
            status,
            teamStatus,
            purchaseStatus,
            manufacturer,
            releaseDate,
            type,
            size,
            price: priceRaw,
            remaining: remainingRaw,
            expectedCustoms: expectedCustomsRaw,
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
        <div class="modal-header">
            <h3>상세 정보</h3>
            <button class="modal-close-btn" on:click={closeModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>

        <div class="modal-body">
            <div class="img-container">
                {#if !imageLoaded}
                    <div class="img-placeholder">
                        <div class="spinner"></div>
                    </div>
                {/if}
                <img src={image.src} alt="Uploaded image" loading="eager" on:load={handleImageLoad} style="display: {imageLoaded ? 'block' : 'none'}" />
            </div>

            <div class="form-section">
                <div class="field full-width">
                    <label for="modal-desc">설명</label>
                    <textarea id="modal-desc" bind:value={description} placeholder="이미지 설명 추가" on:input={save}></textarea>
                </div>

                <div class="fields-grid">
                    <div class="field">
                        <label for="modal-purchase-status">구매 상태</label>
                        <select id="modal-purchase-status" bind:value={purchaseStatus} on:change={save}>
                            <option value="">구매</option>
                            <option value="구매">구매</option>
                            <option value="찜">찜 (위시리스트)</option>
                        </select>
                    </div>

                    {#if showPaymentStatus}
                    <div class="field">
                        <label for="modal-status">결제 상태</label>
                        <select id="modal-status" bind:value={status} on:change={save}>
                            <option value="예약금">예약금</option>
                            <option value="전액">전액</option>
                            <option value="꼴림">꼴림</option>
                        </select>
                    </div>
                    {/if}

                    <div class="field">
                        <label for="modal-team">구매처</label>
                        <select id="modal-team" bind:value={teamStatus} on:change={save}>
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

                    <div class="field">
                        <label for="modal-manufacturer">제조사</label>
                        <input id="modal-manufacturer" type="text" bind:value={manufacturer} on:input={save} placeholder="제조사명" />
                    </div>

                    <div class="field">
                        <label for="modal-release-date">발매일</label>
                        <input id="modal-release-date" type="text" bind:value={releaseDate} on:input={save} placeholder="예: 2026년 10월" />
                    </div>

                    <div class="field">
                        <label for="modal-type">종류</label>
                        <select id="modal-type" bind:value={type} on:change={save}>
                            <option value="PVC">PVC</option>
                            <option value="레진">레진</option>
                        </select>
                    </div>

                    <div class="field">
                        <label for="modal-size">사이즈</label>
                        <select id="modal-size" bind:value={size} on:change={save}>
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

                    <div class="field">
                        <label for="modal-price">금액</label>
                        <input id="modal-price" type="text" value={priceFormatted} on:input={handlePriceInput} placeholder="0" />
                    </div>

                    <div class="field">
                        <label for="modal-remaining">남은 금액</label>
                        <input id="modal-remaining" type="text" value={remainingFormatted} on:input={handleRemainingInput} placeholder="0" />
                    </div>

                    <div class="field">
                        <label for="modal-customs">예상 관세</label>
                        <input id="modal-customs" type="text" value={expectedCustomsFormatted} on:input={handleExpectedCustomsInput} placeholder="0" />
                    </div>

                    <div class="field">
                        <label for="modal-date">구매일자</label>
                        <input id="modal-date" type="date" bind:value={purchaseDate} on:change={save} />
                    </div>
                </div>

                {#if image.sourceUrl}
                    <div class="field full-width source-url-field">
                        <label>원본 URL</label>
                        <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" class="source-url-link">{image.sourceUrl}</a>
                    </div>
                {/if}
            </div>
        </div>

        <div class="modal-footer">
            <button class="btn-delete" on:click={deleteImage}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                삭제
            </button>
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
        background: var(--color-overlay);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        padding: var(--space-4);
    }
    .modal-content {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-xl);
        width: 100%;
        max-width: 700px;
        max-height: 90vh;
        box-shadow: var(--shadow-lg);
        animation: modalIn 0.2s ease-out;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    @keyframes modalIn {
        from { opacity: 0; transform: scale(0.96) translateY(8px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-4) var(--space-5);
        border-bottom: 1px solid var(--color-border);
        flex-shrink: 0;
    }
    .modal-header h3 {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text);
    }
    .modal-close-btn {
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
    .modal-close-btn:hover {
        background: var(--color-surface-hover);
        color: var(--color-text);
    }
    .modal-body {
        overflow-y: auto;
        padding: var(--space-5);
        flex: 1;
    }
    .img-container {
        margin-bottom: var(--space-5);
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: var(--color-surface-hover);
    }
    .img-container img {
        display: block;
        width: 100%;
        height: auto;
        max-height: 400px;
        object-fit: contain;
    }
    .img-placeholder {
        width: 100%;
        height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .spinner {
        border: 3px solid var(--color-border);
        border-top: 3px solid var(--color-primary);
        border-radius: 50%;
        width: 32px;
        height: 32px;
        animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    .form-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }
    .full-width {
        width: 100%;
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
    }
    .field label {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-muted);
    }
    .field input,
    .field select,
    .field textarea {
        padding: var(--space-2) var(--space-3);
        font-size: 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        background: var(--color-surface);
        color: var(--color-text);
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }
    .field input:focus,
    .field select:focus,
    .field textarea:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    textarea {
        resize: vertical;
        min-height: 72px;
        line-height: 1.5;
    }
    .fields-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
    }
    .modal-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--space-3) var(--space-5);
        border-top: 1px solid var(--color-border);
        flex-shrink: 0;
    }
    .modal-footer button {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-4);
        font-size: 0.8125rem;
        font-weight: 500;
        border: none;
        border-radius: var(--radius);
        cursor: pointer;
        transition: all var(--transition-fast);
    }
    .btn-delete {
        background: transparent;
        color: var(--color-danger);
        border: 1px solid transparent;
    }
    .btn-delete:hover {
        background: rgba(239, 68, 68, 0.08);
        border-color: var(--color-danger);
    }
    .btn-close {
        background: var(--color-surface-hover);
        color: var(--color-text-secondary);
    }
    .btn-close:hover {
        background: var(--color-border);
        color: var(--color-text);
    }

    .source-url-field {
        margin-top: var(--space-2);
    }
    .source-url-link {
        font-size: 0.8125rem;
        color: var(--color-primary);
        word-break: break-all;
        line-height: 1.4;
    }
    .source-url-link:hover {
        text-decoration: underline;
    }

    @media (max-width: 640px) {
        .modal-backdrop {
            padding: 0;
            align-items: flex-end;
        }
        .modal-content {
            max-width: 100%;
            max-height: 95vh;
            border-radius: var(--radius-xl) var(--radius-xl) 0 0;
        }
        .fields-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
