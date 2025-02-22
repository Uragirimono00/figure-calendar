<!-- src/Signup.svelte -->
<script>
    import { createEventDispatcher } from "svelte";
    import { auth } from "./firebase.js";
    import { createUserWithEmailAndPassword } from "firebase/auth";

    const dispatch = createEventDispatcher();
    let email = "";
    let password = "";
    let error = "";

    async function handleSignUp(event) {
        event.preventDefault();
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            dispatch("authSuccess", { user: userCredential.user });
        } catch (e) {
            error = e.message;
        }
    }

    function showLogin() {
        dispatch("showLogin");
    }
</script>

<div class="signup-container">
    <form class="signup-form" on:submit|preventDefault={handleSignUp}>
        <h2>회원가입</h2>
        {#if error}
            <p class="error">{error}</p>
        {/if}
        <input type="email" placeholder="이메일" bind:value={email} required />
        <input type="password" placeholder="비밀번호" bind:value={password} required />
        <button type="submit">회원가입</button>
        <p class="switch">
            이미 계정이 있으신가요?
            <a href="#" on:click|preventDefault={showLogin}>로그인하기</a>
        </p>
    </form>
</div>

<style>
    .signup-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        background: #f2f2f2;
        transition: background 0.3s ease;
    }
    .signup-form {
        background: #fff;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        width: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: background 0.3s ease, color 0.3s ease;
    }
    .signup-form h2 {
        margin-bottom: 1rem;
        font-size: 1.5rem;
        color: #333;
        transition: color 0.3s ease;
    }
    .signup-form input {
        width: 100%;
        padding: 0.75rem;
        margin-bottom: 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 1rem;
        transition: background 0.3s ease, color 0.3s ease;
    }
    .signup-form button {
        width: 100%;
        padding: 0.75rem;
        margin-bottom: 0.5rem;
        border: none;
        border-radius: 4px;
        background-color: #3498db;
        color: #fff;
        font-size: 1rem;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }
    .signup-form button:hover {
        background-color: #2980b9;
    }
    .error {
        color: #e74c3c;
        margin-bottom: 1rem;
        text-align: center;
    }
    .switch {
        font-size: 0.9rem;
        color: #666;
        transition: color 0.3s ease;
    }
    .switch a {
        color: #3498db;
        text-decoration: none;
        cursor: pointer;
    }
    .switch a:hover {
        text-decoration: underline;
    }

    /* 다크모드 적용 */
    :global(html.dark) .signup-container {
        background: #121212;
    }
    :global(html.dark) .signup-form {
        background: #2c2c2c;
        color: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    }
    :global(html.dark) .signup-form h2 {
        color: #fff;
    }
    :global(html.dark) .signup-form input {
        background: #333;
        border: 1px solid #555;
        color: #fff;
    }
    :global(html.dark) .signup-form button {
        background-color: #555;
    }
    :global(html.dark) .signup-form button:hover {
        background-color: #777;
    }
    :global(html.dark) .switch {
        color: #aaa;
    }
    :global(html.dark) .switch a {
        color: #81a1c1;
    }
</style>
