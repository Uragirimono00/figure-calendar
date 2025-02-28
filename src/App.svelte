<script>
    import { onMount } from "svelte";
    import { onAuthStateChanged } from "firebase/auth";
    import { auth } from "./firebase.js";
    import Login from "./Login.svelte";
    import Signup from "./Signup.svelte";
    import Dashboard from "./Dashboard.svelte";
    import PatchNotes from "./PatchNotes.svelte";

    let user = null;
    let showSignup = false;
    let darkMode = false;
    // 현재 해시값에 따라 페이지를 분기 (기본값은 "dashboard")
    let currentPage = "dashboard";

    function updatePage() {
        const hash = window.location.hash;
        if (hash === "#/patch-notes") {
            currentPage = "patch-notes";
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

{#if !user}
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
    {#if currentPage !== "dashboard"}
        <a href="#/">대시보드</a>
    {/if}
    {#if currentPage !== "patch-notes"}
        <a href="#/patch-notes">패치노트 보기</a>
    {/if}
</footer>

<button class="toggle-dark-mode" on:click="{toggleDarkMode}">
    {#if darkMode}
        🌞
    {:else}
        🌜
    {/if}
</button>

<style>
    /* html과 body에 높이 100% 및 기본 마진 제거 */
    :global(html, body) {
        height: 100%;
        margin: 0;
    }
    /* 앱의 기본 컨테이너가 최소 100vh를 차지하도록 */
    main {
        min-height: 100vh;
    }
    footer {
        text-align: center;
        padding: 1rem;
        background: #f4f4f4;
        font-size: 0.9rem;
    }
    :global(html.dark) footer {
        background: #333;
        color: #fff;
    }
    footer a {
        margin: 0 0.5rem;
        color: inherit;
        text-decoration: none;
        font-weight: bold;
    }
    footer a:hover {
        text-decoration: underline;
    }
    .toggle-dark-mode {
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        background-color: #3498db;
        border: none;
        border-radius: 50%;
        width: 3rem;
        height: 3rem;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 1.5rem;
        color: #fff;
        z-index: 100;
        transition: background-color 0.3s ease;
    }
    .toggle-dark-mode:hover {
        background-color: #2980b9;
    }
</style>
