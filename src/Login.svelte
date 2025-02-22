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
    <h2>로그인</h2>
    {#if error}
      <p class="error">{error}</p>
    {/if}
    <input type="email" placeholder="이메일" bind:value={email} required />
    <input type="password" placeholder="비밀번호" bind:value={password} required />
    <button type="submit">이메일 로그인</button>
    <button type="button" on:click={handleGoogleLogin}>구글로 로그인</button>
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
    height: 100vh;
    background: #f2f2f2;
    transition: background 0.3s ease;
  }
  .login-form {
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
  .login-form h2 {
    margin-bottom: 1rem;
    font-size: 1.5rem;
    color: #333;
    transition: color 0.3s ease;
  }
  .login-form input {
    width: 100%;
    padding: 0.75rem;
    margin-bottom: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
    transition: background 0.3s ease, color 0.3s ease;
  }
  .login-form button {
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
  .login-form button:hover {
    background-color: #2980b9;
  }
  .login-form button[type="button"] {
    background-color: #db4437;
  }
  .login-form button[type="button"]:hover {
    background-color: #c23321;
  }
  .error {
    color: #e74c3c;
    margin-bottom: 1rem;
    text-align: center;
  }
  .switch {
    font-size: 0.9rem;
    color: #666;
    margin-top: 1rem;
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
  :global(html.dark) .login-container {
    background: #121212;
  }
  :global(html.dark) .login-form {
    background: #2c2c2c;
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  }
  :global(html.dark) .login-form h2 {
    color: #fff;
  }
  :global(html.dark) .login-form input {
    background: #333;
    border: 1px solid #555;
    color: #fff;
  }
  :global(html.dark) .login-form button {
    background-color: #555;
  }
  :global(html.dark) .login-form button:hover {
    background-color: #777;
  }
  :global(html.dark) .switch {
    color: #aaa;
  }
  :global(html.dark) .switch a {
    color: #81a1c1;
  }
</style>
