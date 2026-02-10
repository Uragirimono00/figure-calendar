<!-- src/Login.svelte -->
<script>
  import { createEventDispatcher } from "svelte";
  import { auth } from "./firebase.js";
  import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

  const dispatch = createEventDispatcher();
  let email = "";
  let password = "";
  let error = "";

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      dispatch("authSuccess", { user: userCredential.user });
    } catch (e) {
      error = e.message;
    }
  }

  async function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      dispatch("authSuccess", { user: result.user });
    } catch (e) {
      error = e.message;
    }
  }

  function showSignup() {
    dispatch("showSignup");
  }
</script>

<div class="login-container">
  <form class="login-form" on:submit|preventDefault={handleLogin}>
    <div class="logo-section">
      <div class="logo-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <h1>Figure Calendar</h1>
      <p class="subtitle">피규어 컬렉션을 한눈에 관리하세요</p>
    </div>

    {#if error}
      <div class="error-msg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        {error}
      </div>
    {/if}

    <div class="field">
      <label for="login-email">이메일</label>
      <input id="login-email" type="email" placeholder="name@example.com" bind:value={email} required />
    </div>
    <div class="field">
      <label for="login-password">비밀번호</label>
      <input id="login-password" type="password" placeholder="비밀번호를 입력하세요" bind:value={password} required />
    </div>

    <button type="submit" class="btn-primary">로그인</button>

    <div class="divider">
      <span>또는</span>
    </div>

    <button type="button" class="btn-google" on:click={handleGoogleLogin}>
      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      Google로 계속하기
    </button>

    <p class="switch">
      아직 계정이 없으신가요?
      <a href="#" on:click|preventDefault={showSignup}>회원가입하기</a>
    </p>
  </form>
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: var(--space-4);
    background: var(--color-bg);
  }
  .login-form {
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
  .divider {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: var(--space-5) 0;
  }
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }
  .divider span {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
  .btn-google {
    width: 100%;
    padding: 10px;
    background-color: var(--color-surface);
    color: var(--color-text);
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    transition: background-color var(--transition-fast), border-color var(--transition-fast);
  }
  .btn-google:hover {
    background-color: var(--color-surface-hover);
    border-color: var(--color-border-hover);
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
    .login-form {
      padding: var(--space-6);
      border-radius: var(--radius-lg);
    }
  }
</style>
