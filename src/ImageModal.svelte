<!-- src/ImageModal.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    export let image; // { id, src, date, description, month, storagePath }
    const dispatch = createEventDispatcher();

    let description = image.description || "";

    function save() {
        dispatch('save', { description });
    }

    function deleteImage() {
        if (confirm("이미지를 삭제하시겠습니까?")) {
            dispatch('delete', { id: image.id, storagePath: image.storagePath });
        }
    }

    function closeModal() {
        dispatch('close');
    }
</script>

<div class="modal-backdrop" on:click={closeModal}>
    <div class="modal-content" on:click|stopPropagation>
        <img src={image.src} alt="Selected image" />
        <textarea bind:value={description} placeholder="이미지 설명 추가"></textarea>
        <div class="modal-buttons">
            <button on:click={save}>저장</button>
            <button on:click={deleteImage}>삭제</button>
            <button on:click={closeModal}>닫기</button>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    .modal-content {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        max-width: 90%;
        max-height: 90%;
        overflow-y: auto;
    }
    img {
        max-width: 100%;
        height: auto;
    }
    textarea {
        width: 100%;
        height: 80px;
        margin-top: 1rem;
    }
    .modal-buttons {
        margin-top: 1rem;
        text-align: right;
    }
    button {
        margin-left: 0.5rem;
    }
</style>
