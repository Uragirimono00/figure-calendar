<!-- src/App.svelte -->
<script>
    import { onAuthStateChanged } from "firebase/auth";
    import { auth } from "./firebase.js";
    import Login from "./Login.svelte";
    import Signup from "./Signup.svelte";
    import Dashboard from "./Dashboard.svelte";
    import { onMount } from "svelte";

    let user = null;
    let showSignup = false;
    let darkMode = false;

    onAuthStateChanged(auth, (currentUser) => {
        user = currentUser;
    });

    function handleAuthSuccess(event) {
        user = event.detail.user;
    }

    // 로그인/회원가입 전환 함수
    function toggleAuthMode() {
        showSignup = !showSignup;
    }

    // 다크모드 초기 상태 로드 (localStorage에 설정이 없으면 기본 다크모드 활성화)
    onMount(() => {
        if (localStorage.getItem('darkMode') === null) {
            darkMode = true;
            localStorage.setItem('darkMode', 'true');
        } else {
            darkMode = localStorage.getItem('darkMode') === 'true';
        }
        updateDarkMode();
    });

    // 다크모드 토글 함수
    function toggleDarkMode() {
        darkMode = !darkMode;
        localStorage.setItem('darkMode', darkMode);
        updateDarkMode();
    }

    // 다크모드 상태에 따라 html에 클래스 추가
    function updateDarkMode() {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
</script>

<header>
    <button on:click={toggleDarkMode}>
        {#if darkMode} 라이트 모드로 전환 {:else} 다크 모드로 전환 {/if}
    </button>
</header>

{#if !user}
    {#if showSignup}
        <Signup on:authSuccess={handleAuthSuccess} on:showLogin={toggleAuthMode} />
    {:else}
        <Login on:authSuccess={handleAuthSuccess} on:showSignup={toggleAuthMode} />
    {/if}
{:else}
    <Dashboard {user} />
{/if}

<style>
    header {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 100;
    }
    header button {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 4px;
        background-color: #3498db;
        color: #fff;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }
    header button:hover {
        background-color: #2980b9;
    }
    /* 라이트 모드 기본 스타일 */
    :global(html) {
        background-color: #f2f2f2;
        color: #333;
    }
    /* 다크모드 스타일 */
    :global(html.dark) {
        background-color: #121212;
        color: #fff; /* 글자색을 흰색으로 변경 */
    }
    :global(html.dark) button {
        background-color: #555;
        color: #fff;
    }
</style>
