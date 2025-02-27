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

<!-- 기존 헤더 영역 (필요에 따라 남기거나 제거 가능) -->
{#if !user}
    {#if showSignup}
        <Signup on:authSuccess={handleAuthSuccess} on:showLogin={toggleAuthMode} />
    {:else}
        <Login on:authSuccess={handleAuthSuccess} on:showSignup={toggleAuthMode} />
    {/if}
{:else}
    <Dashboard {user} />
{/if}

<!-- 오른쪽 하단에 다크모드 전환 아이콘 버튼 -->
<button class="toggle-dark-mode" on:click={toggleDarkMode}>
    {#if darkMode}
        <!-- 다크모드 상태이면 라이트모드로 전환할 수 있도록 태양 아이콘 표시 -->
        🌞
    {:else}
        <!-- 라이트모드 상태이면 다크모드로 전환할 수 있도록 달 아이콘 표시 -->
        🌜
    {/if}
</button>

<style>
    /* 기존 .totals CSS (이미 변경한 내용) */
    .totals {
        display: flex;
        gap: 1rem;
        font-weight: bold;
    }

    /* 오른쪽 하단에 고정된 다크모드 토글 버튼 */
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
