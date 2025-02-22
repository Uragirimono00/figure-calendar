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

    // Login.svelte의 showSignup, Signup.svelte의 showLogin 이벤트에 대응
    function toggleAuthMode() {
        showSignup = !showSignup;
    }
</script>

{#if !user}
    {#if showSignup}
        <Signup on:authSuccess={handleAuthSuccess} on:showLogin={toggleAuthMode} />
    {:else}
        <Login on:authSuccess={handleAuthSuccess} on:showSignup={toggleAuthMode} />
    {/if}
{:else}
    <Dashboard {user} />
{/if}
