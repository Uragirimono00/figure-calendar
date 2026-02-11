<!-- src/FeatureRequests.svelte -->
<script>
    import { onMount } from "svelte";
    import { db } from "./firebase.js";
    import {
        collection,
        addDoc,
        getDocs,
        deleteDoc,
        doc,
        query,
        where,
        orderBy,
    } from "firebase/firestore";

    export let user;

    const ADMIN_EMAIL = "gudtj7578@gmail.com";
    $: isAdmin = user.email === ADMIN_EMAIL;

    let content = "";
    let requests = [];
    let loading = true;
    let submitting = false;

    onMount(() => {
        loadRequests();
    });

    async function loadRequests() {
        loading = true;
        try {
            const col = collection(db, "featureRequests");
            let q;
            if (isAdmin) {
                q = query(col, orderBy("createdAt", "desc"));
            } else {
                q = query(col, where("uid", "==", user.uid), orderBy("createdAt", "desc"));
            }
            const snapshot = await getDocs(q);
            requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("Failed to load requests:", e);
        }
        loading = false;
    }

    async function handleSubmit() {
        if (!content.trim() || submitting) return;
        submitting = true;
        try {
            const docRef = await addDoc(collection(db, "featureRequests"), {
                uid: user.uid,
                email: user.email,
                content: content.trim(),
                createdAt: new Date().toISOString(),
            });
            requests = [
                { id: docRef.id, uid: user.uid, email: user.email, content: content.trim(), createdAt: new Date().toISOString() },
                ...requests,
            ];
            content = "";
        } catch (e) {
            console.error("Failed to submit request:", e);
            alert("요청 제출에 실패했습니다. 다시 시도해 주세요.");
        }
        submitting = false;
    }

    async function handleDelete(id) {
        if (!confirm("이 요청을 삭제하시겠습니까?")) return;
        try {
            await deleteDoc(doc(db, "featureRequests", id));
            requests = requests.filter((r) => r.id !== id);
        } catch (e) {
            console.error("Failed to delete request:", e);
        }
    }

    function formatDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }
</script>

<main class="feature-requests">
    <div class="container">
        <h1 class="page-title">기능 요청</h1>

        <form class="submit-form" on:submit|preventDefault={handleSubmit}>
            <div class="field">
                <label for="req-content">원하는 기능을 설명해 주세요</label>
                <textarea
                    id="req-content"
                    bind:value={content}
                    placeholder="예: 월별 통계 차트를 추가해 주세요..."
                    rows="4"
                ></textarea>
            </div>
            <button type="submit" class="btn-submit" disabled={!content.trim() || submitting}>
                {#if submitting}
                    제출 중...
                {:else}
                    제출
                {/if}
            </button>
        </form>

        <section class="requests-list">
            <h2 class="section-title">
                {#if isAdmin}전체 요청 목록{:else}내 요청 목록{/if}
            </h2>

            {#if loading}
                <div class="loading">
                    <div class="spinner"></div>
                </div>
            {:else if requests.length === 0}
                <p class="empty">아직 요청이 없습니다.</p>
            {:else}
                {#each requests as req (req.id)}
                    <article class="request-card">
                        <div class="request-header">
                            {#if isAdmin}
                                <span class="request-email">{req.email}</span>
                            {/if}
                            <span class="request-date">{formatDate(req.createdAt)}</span>
                        </div>
                        <p class="request-content">{req.content}</p>
                        {#if isAdmin}
                            <button class="btn-delete" on:click={() => handleDelete(req.id)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                삭제
                            </button>
                        {/if}
                    </article>
                {/each}
            {/if}
        </section>
    </div>
</main>

<style>
    .feature-requests {
        min-height: 100vh;
        padding: var(--space-8) var(--space-4);
        padding-bottom: calc(var(--space-8) + 60px);
        background-color: var(--color-bg);
        color: var(--color-text);
    }
    .container {
        max-width: 640px;
        margin: 0 auto;
    }
    .page-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text);
        margin-bottom: var(--space-6);
    }

    /* 제출 폼 */
    .submit-form {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-5);
        margin-bottom: var(--space-8);
        box-shadow: var(--shadow-sm);
    }
    .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        margin-bottom: var(--space-4);
    }
    .field label {
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-muted);
    }
    .field textarea {
        padding: var(--space-2) var(--space-3);
        font-size: 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        background: var(--color-surface);
        color: var(--color-text);
        resize: vertical;
        min-height: 72px;
        line-height: 1.5;
        font-family: inherit;
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }
    .field textarea:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
    .btn-submit {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-2) var(--space-5);
        font-size: 0.875rem;
        font-weight: 600;
        color: #fff;
        background: var(--color-primary);
        border: none;
        border-radius: var(--radius);
        cursor: pointer;
        transition: background var(--transition-fast), opacity var(--transition-fast);
    }
    .btn-submit:hover:not(:disabled) {
        background: var(--color-primary-hover);
    }
    .btn-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* 목록 */
    .section-title {
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: var(--space-4);
    }
    .loading {
        display: flex;
        justify-content: center;
        padding: var(--space-8) 0;
    }
    .spinner {
        border: 3px solid var(--color-border);
        border-top: 3px solid var(--color-primary);
        border-radius: 50%;
        width: 28px;
        height: 28px;
        animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    .empty {
        text-align: center;
        color: var(--color-text-muted);
        font-size: 0.875rem;
        padding: var(--space-6) 0;
    }
    .request-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-4) var(--space-5);
        margin-bottom: var(--space-3);
        box-shadow: var(--shadow-sm);
    }
    .request-header {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        margin-bottom: var(--space-2);
    }
    .request-email {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--color-primary);
    }
    .request-date {
        font-size: 0.75rem;
        color: var(--color-text-muted);
    }
    .request-content {
        font-size: 0.875rem;
        line-height: 1.6;
        color: var(--color-text-secondary);
        white-space: pre-wrap;
        word-break: break-word;
        margin: 0;
    }
    .btn-delete {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        margin-top: var(--space-3);
        padding: var(--space-1) var(--space-2);
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-danger);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all var(--transition-fast);
    }
    .btn-delete:hover {
        background: rgba(239, 68, 68, 0.08);
        border-color: var(--color-danger);
    }
</style>
