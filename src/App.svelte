<script>
    import { onMount } from "svelte";
    import { onAuthStateChanged } from "firebase/auth";
    import { auth } from "./firebase.js";
    import Login from "./Login.svelte";
    import Signup from "./Signup.svelte";
    import Dashboard from "./Dashboard.svelte";
    import PatchNotes from "./PatchNotes.svelte";
    import PrivacyPolicy from "./PrivacyPolicy.svelte";

    let user = null;
    let showSignup = false;
    let darkMode = false;
    // 현재 해시값에 따라 페이지를 분기 (기본값은 "dashboard")
    let currentPage = "dashboard";

    function updatePage() {
        const hash = window.location.hash;
        if (hash === "#/patch-notes") {
            currentPage = "patch-notes";
        } else if (hash === "#/privacy") {
            currentPage = "privacy";
        } else {
            currentPage = "dashboard";
        }
    }

    window.addEventListener("hashchange", updatePage);

    onMount(() => {
        updatePage();

        // 다크모드 초기 설정 (기본값 true)
        if (localStorage.getItem("darkMode") === null) {
            darkMode = true;
            localStorage.setItem("darkMode", "true");
        } else {
            darkMode = localStorage.getItem("darkMode") === "true";
        }
        updateDarkMode();

        onAuthStateChanged(auth, (currentUser) => {
            user = currentUser;
        });
    });

    function toggleAuthMode() {
        showSignup = !showSignup;
    }

    function toggleDarkMode() {
        darkMode = !darkMode;
        localStorage.setItem("darkMode", darkMode);
        updateDarkMode();
    }

    function updateDarkMode() {
        if (darkMode) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
    }
</script>

{#if currentPage === "privacy"}
    <PrivacyPolicy />
{:else if !user}
    {#if showSignup}
        <Signup on:authSuccess="{(e) => (user = e.detail.user)}" on:showLogin="{toggleAuthMode}" />
    {:else}
        <Login on:authSuccess="{(e) => (user = e.detail.user)}" on:showSignup="{toggleAuthMode}" />
    {/if}
{:else}
    {#if currentPage === "dashboard"}
        <Dashboard {user} />
    {:else if currentPage === "patch-notes"}
        <PatchNotes />
    {/if}
{/if}

<footer>
    <div class="footer-inner">
        {#if currentPage !== "dashboard"}
            <a href="#/">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                대시보드
            </a>
        {/if}
        {#if currentPage !== "patch-notes"}
            <a href="#/patch-notes">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                패치노트
            </a>
        {/if}
        {#if currentPage !== "privacy"}
            <a href="#/privacy">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                개인정보처리방침
            </a>
        {/if}
    </div>
</footer>

<button class="toggle-dark-mode" on:click="{toggleDarkMode}" title="{darkMode ? '라이트 모드' : '다크 모드'}">
    {#if darkMode}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    {:else}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    {/if}
</button>

<style>
    :global(html, body) {
        height: 100%;
        margin: 0;
    }
    footer {
        border-top: 1px solid var(--color-border);
        background: var(--color-surface);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
    }
    .footer-inner {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: var(--space-6);
        padding: var(--space-3) var(--space-4);
        max-width: 1280px;
        margin: 0 auto;
    }
    footer a {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-text-secondary);
        font-size: 0.8125rem;
        font-weight: 500;
        text-decoration: none;
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        transition: color var(--transition-fast), background-color var(--transition-fast);
    }
    footer a:hover {
        color: var(--color-primary);
        background-color: var(--color-primary-bg);
        text-decoration: none;
    }
    .toggle-dark-mode {
        position: fixed;
        bottom: var(--space-4);
        right: var(--space-4);
        background-color: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-full);
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: var(--color-text-secondary);
        z-index: 100;
        box-shadow: var(--shadow-md);
        transition: all var(--transition-fast);
    }
    .toggle-dark-mode:hover {
        background-color: var(--color-surface-hover);
        color: var(--color-primary);
        border-color: var(--color-primary);
        transform: scale(1.05);
    }
</style>
