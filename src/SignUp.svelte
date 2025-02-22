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
</script>

<form on:submit|preventDefault={handleSignUp}>
    <h2>회원가입</h2>
    {#if error}
        <p style="color:red">{error}</p>
    {/if}
    <input type="email" placeholder="이메일" bind:value={email} required />
    <input type="password" placeholder="비밀번호" bind:value={password} required />
    <button type="submit">회원가입</button>
</form>
