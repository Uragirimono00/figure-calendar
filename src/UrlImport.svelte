<!-- src/UrlImport.svelte -->
<script>
    import { createEventDispatcher, onMount } from 'svelte';
    import { db, functions, httpsCallable } from './firebase.js';
    import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';

    export let userUid;
    const dispatch = createEventDispatcher();

    let url = "";
    let loading = false;
    let error = "";

    // Scraped data
    let name = "";
    let price = "";
    let deposit = "";
    let remaining = "";
    let imageUrl = "";
    let manufacturer = "";
    let releaseDate = "";
    let purchasePlace = "";
    let sourceUrl = "";
    let month = "";
    let size = "";
    let type = "";
    let scraped = false;

    let backdrop;

    const months = [];
    const now = new Date();
    for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++) {
        for (let m = 1; m <= 12; m++) {
            months.push(`${y}-${String(m).padStart(2, '0')}`);
        }
    }

    function guessMonth(releaseDateStr) {
        const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (!releaseDateStr) return fallback;
        // 분기: "2026년 3분기" → 2026-07
        const qMatch = releaseDateStr.match(/(\d{4})\s*년?\s*(\d)\s*분기/);
        if (qMatch) {
            const quarterToMonth = { 1: 1, 2: 4, 3: 7, 4: 10 };
            const m = quarterToMonth[parseInt(qMatch[2])] || 1;
            return `${qMatch[1]}-${String(m).padStart(2, '0')}`;
        }
        const match = releaseDateStr.match(/(\d{4})[年년\-\/]\s*(\d{1,2})/);
        if (match) {
            return `${match[1]}-${String(parseInt(match[2])).padStart(2, '0')}`;
        }
        return fallback;
    }

    async function handleScrape() {
        if (!url.trim()) return;
        loading = true;
        error = "";
        scraped = false;
        try {
            const scrapeProduct = httpsCallable(functions, 'scrapeProduct');
            const result = await scrapeProduct({ url: url.trim() });
            const data = result.data;
            name = data.name || "";
            price = data.price || "";
            deposit = data.deposit || "";
            remaining = data.remaining || "";
            imageUrl = data.imageUrl || "";
            manufacturer = data.manufacturer || "";
            releaseDate = data.releaseDate || "";
            purchasePlace = data.purchasePlace || "";
            sourceUrl = data.sourceUrl || url.trim();
            size = data.size || "";
            type = data.type || "";
            month = guessMonth(releaseDate);
            scraped = true;
        } catch (err) {
            error = err.message || "스크래핑에 실패했습니다.";
        }
        loading = false;
    }

    async function handleSave() {
        loading = true;
        error = "";
        try {
            // 중복 체크: 같은 sourceUrl이 이미 존재하는지 확인
            if (sourceUrl) {
                const q = query(collection(db, "images"), where("sourceUrl", "==", sourceUrl), where("uid", "==", userUid));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    error = "이미 저장된 상품입니다.";
                    loading = false;
                    return;
                }
            }
            const imageData = {
                src: imageUrl,
                month,
                date: new Date().toISOString(),
                description: name,
                uid: userUid,
                status: "꼴림",
                teamStatus: purchasePlace || "코아",
                purchaseStatus: "찜",
                manufacturer,
                releaseDate,
                sourceUrl,
                source: "scrape",
                type: type || "PVC",
                size: size || "",
                price: price ? String(price) : "",
                remaining: remaining ? String(remaining) : "",
                deposit: deposit ? String(deposit) : "",
                expectedCustoms: "",
                storagePath: null
            };
            const docRef = await addDoc(collection(db, "images"), imageData);
            dispatch('imported', { ...imageData, id: docRef.id });
            dispatch('close');
        } catch (err) {
            error = err.message || "저장에 실패했습니다.";
        }
        loading = false;
    }

    function closeModal() {
        dispatch('close');
    }

    function formatNumber(n) {
        if (!n) return "";
        const num = Number(n);
        return isNaN(num) ? n : num.toLocaleString();
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
            <h3>URL로 상품 추가</h3>
            <button class="modal-close-btn" on:click={closeModal}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>

        <div class="modal-body">
            <div class="url-input-group">
                <input type="url" bind:value={url} placeholder="상품 페이지 URL을 입력하세요" on:keydown={(e) => { if(e.key === 'Enter') handleScrape(); }} disabled={loading} />
                <button class="btn-scrape" on:click={handleScrape} disabled={loading || !url.trim()}>
                    {#if loading && !scraped}
                        <span class="spinner-sm"></span>
                    {:else}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    {/if}
                    스크랩
                </button>
            </div>

            {#if error}
                <div class="error-msg">{error}</div>
            {/if}

            {#if scraped}
                <div class="preview-section">
                    {#if imageUrl}
                        <div class="preview-image">
                            <img src={imageUrl} alt={name} on:error={(e) => { e.target.style.display = 'none'; }} />
                        </div>
                    {/if}

                    <div class="form-section">
                        <div class="field full-width">
                            <label>상품명</label>
                            <input type="text" bind:value={name} />
                        </div>

                        <div class="fields-grid">
                            <div class="field">
                                <label>전체금액</label>
                                <input type="text" value={formatNumber(price)} on:input={(e) => { price = e.target.value.replace(/,/g, '').replace(/\D/g, ''); }} placeholder="0" />
                            </div>

                            <div class="field">
                                <label>예약금</label>
                                <input type="text" value={formatNumber(deposit)} on:input={(e) => { deposit = e.target.value.replace(/,/g, '').replace(/\D/g, ''); }} placeholder="0" />
                            </div>

                            <div class="field">
                                <label>잔금</label>
                                <input type="text" value={formatNumber(remaining)} on:input={(e) => { remaining = e.target.value.replace(/,/g, '').replace(/\D/g, ''); }} placeholder="0" />
                            </div>

                            <div class="field">
                                <label>발매일</label>
                                <input type="text" bind:value={releaseDate} placeholder="예: 2026년 10월" />
                            </div>

                            <div class="field">
                                <label>제조사</label>
                                <input type="text" bind:value={manufacturer} placeholder="제조사명" />
                            </div>

                            <div class="field">
                                <label>구매처</label>
                                <input type="text" bind:value={purchasePlace} placeholder="구매처" />
                            </div>

                            <div class="field">
                                <label>연월 (배정)</label>
                                <select bind:value={month}>
                                    {#each months as m}
                                        <option value={m}>{m}</option>
                                    {/each}
                                    <option value="미정">미정</option>
                                </select>
                            </div>

                            <div class="field">
                                <label>이미지 URL</label>
                                <input type="url" bind:value={imageUrl} placeholder="이미지 URL" />
                            </div>
                        </div>
                    </div>
                </div>
            {/if}
        </div>

        {#if scraped}
            <div class="modal-footer">
                <button class="btn-cancel" on:click={closeModal}>취소</button>
                <button class="btn-save" on:click={handleSave} disabled={loading}>
                    {#if loading}
                        <span class="spinner-sm"></span>
                    {/if}
                    찜 목록에 저장
                </button>
            </div>
        {/if}
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
        max-width: 640px;
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
    .url-input-group {
        display: flex;
        gap: var(--space-2);
    }
    .url-input-group input {
        flex: 1;
        padding: var(--space-2) var(--space-3);
        font-size: 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        background: var(--color-surface);
        color: var(--color-text);
    }
    .url-input-group input:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .btn-scrape {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-2) var(--space-3);
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: var(--radius);
        font-size: 0.8125rem;
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
        transition: background var(--transition-fast);
    }
    .btn-scrape:hover:not(:disabled) {
        background: var(--color-primary-hover);
    }
    .btn-scrape:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .error-msg {
        margin-top: var(--space-3);
        padding: var(--space-2) var(--space-3);
        background: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: var(--radius);
        color: var(--color-danger);
        font-size: 0.8125rem;
    }
    .preview-section {
        margin-top: var(--space-4);
    }
    .preview-image {
        margin-bottom: var(--space-4);
        border-radius: var(--radius-lg);
        overflow: hidden;
        background: var(--color-surface-hover);
        max-height: 250px;
    }
    .preview-image img {
        display: block;
        width: 100%;
        height: auto;
        max-height: 250px;
        object-fit: contain;
    }
    .form-section {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
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
    .field select {
        padding: var(--space-2) var(--space-3);
        font-size: 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        background: var(--color-surface);
        color: var(--color-text);
        transition: border-color var(--transition-fast);
    }
    .field input:focus,
    .field select:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .fields-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-3);
    }
    .modal-footer {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: var(--space-2);
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
    .btn-cancel {
        background: var(--color-surface-hover);
        color: var(--color-text-secondary);
    }
    .btn-cancel:hover {
        background: var(--color-border);
        color: var(--color-text);
    }
    .btn-save {
        background: var(--color-primary);
        color: white;
    }
    .btn-save:hover:not(:disabled) {
        background: var(--color-primary-hover);
    }
    .btn-save:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .spinner-sm {
        border: 2px solid rgba(255,255,255,0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        width: 14px;
        height: 14px;
        animation: spin 1s linear infinite;
        display: inline-block;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
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
