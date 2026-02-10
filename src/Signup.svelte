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
        <div class="logo-section">
            <div class="logo-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            </div>
            <h1>회원가입</h1>
            <p class="subtitle">Figure Calendar 계정을 만드세요</p>
        </div>

        {#if error}
            <div class="error-msg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                {error}
            </div>
        {/if}

        <div class="field">
            <label for="signup-email">이메일</label>
            <input id="signup-email" type="email" placeholder="name@example.com" bind:value={email} required />
        </div>
        <div class="field">
            <label for="signup-password">비밀번호</label>
            <input id="signup-password" type="password" placeholder="6자 이상 입력하세요" bind:value={password} required />
        </div>

        <button type="submit" class="btn-primary">계정 만들기</button>

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
        min-height: 100vh;
        padding: var(--space-4);
        background: var(--color-bg);
    }
    .signup-form {
        background: var(--color-surface);
        padding: var(--space-10);
        border-radius: var(--radius-xl);
        box-shadow: var(--shadow-lg);
        width: 100%;
        max-width: 400px;
        display: flex;
        flex-direction: column;
        border: 1px solid var(--color-border);
    }
    .logo-section {
        text-align: center;
        margin-bottom: var(--space-8);
    }
    .logo-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 56px;
        border-radius: var(--radius-lg);
        background: var(--color-primary);
        color: white;
        margin-bottom: var(--space-3);
    }
    .logo-section h1 {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--color-text);
        margin-bottom: var(--space-1);
    }
    .subtitle {
        font-size: 0.875rem;
        color: var(--color-text-muted);
    }
    .field {
        margin-bottom: var(--space-4);
    }
    .field label {
        margin-bottom: var(--space-1);
        font-size: 0.8125rem;
        font-weight: 500;
        color: var(--color-text-secondary);
    }
    .field input {
        width: 100%;
        padding: 10px var(--space-3);
        font-size: 0.875rem;
        border: 1px solid var(--color-border);
        border-radius: var(--radius);
        background: var(--color-surface);
        color: var(--color-text);
        transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
    }
    .field input:focus {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .btn-primary {
        width: 100%;
        padding: 10px;
        background-color: var(--color-primary);
        color: white;
        font-size: 0.875rem;
        font-weight: 600;
        border: none;
        border-radius: var(--radius);
        cursor: pointer;
        transition: background-color var(--transition-fast), transform var(--transition-fast);
    }
    .btn-primary:hover {
        background-color: var(--color-primary-hover);
    }
    .btn-primary:active {
        transform: scale(0.98);
    }
    .error-msg {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-3);
        margin-bottom: var(--space-4);
        font-size: 0.8125rem;
        color: var(--color-danger);
        background-color: rgba(239, 68, 68, 0.08);
        border: 1px solid rgba(239, 68, 68, 0.2);
        border-radius: var(--radius);
    }
    .switch {
        font-size: 0.8125rem;
        color: var(--color-text-muted);
        margin-top: var(--space-5);
        text-align: center;
    }
    .switch a {
        color: var(--color-primary);
        font-weight: 500;
        text-decoration: none;
        cursor: pointer;
    }
    .switch a:hover {
        text-decoration: underline;
    }

    @media (max-width: 480px) {
        .signup-form {
            padding: var(--space-6);
            border-radius: var(--radius-lg);
        }
    }
</style>
