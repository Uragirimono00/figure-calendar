<!-- src/App.svelte -->
<script>
    import { onAuthStateChanged } from "firebase/auth";
    import { auth } from "./firebase.js";
    import Login from "./Login.svelte";
    import Signup from "./Signup.svelte";
    import Dashboard from "./Dashboard.svelte";

    let user = null;
    let showSignup = false;

    onAuthStateChanged(auth, (currentUser) => {
        user = currentUser;
    });

    function handleAuthSuccess(event) {
        user = event.detail.user;
    }

    function toggleSignup() {
        showSignup = !showSignup;
    }
</script>

{#if !user}
    {#if showSignup}
        <Signup on:authSuccess={handleAuthSuccess} />
        <p>
            이미 계정이 있으신가요?
            <button on:click={() => showSignup = false}>로그인</button>
        </p>
    {:else}
        <Login on:authSuccess={handleAuthSuccess} />
        <p>
            계정이 없으신가요?
            <button on:click={() => showSignup = true}>회원가입</button>
        </p>
    {/if}
{:else}
    <Dashboard {user} />
{/if}
