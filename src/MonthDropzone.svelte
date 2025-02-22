<!-- src/MonthDropzone.svelte -->
<script>
    import { createEventDispatcher } from 'svelte';
    import { storage, db } from './firebase.js';
    import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
    import { collection, addDoc } from 'firebase/firestore';

    export let month = "";
    export let userUid;
    export let images = [];
    const dispatch = createEventDispatcher();
    let fileInput;

    let uploading = false;

    async function processFiles(files) {
        uploading = true;
        const uploadPromises = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = `images/${month}/${Date.now()}_${file.name}`;
            const storageRefObj = ref(storage, filePath);

            const uploadPromise = uploadBytes(storageRefObj, file)
                .then(async (snapshot) => {
                    const downloadURL = await getDownloadURL(snapshot.ref);
                    const imageData = {
                        src: downloadURL,
                        month,
                        date: new Date().toISOString(),
                        description: "",
                        uid: userUid
                    };
                    const docRef = await addDoc(collection(db, "images"), imageData);
                    const imageDataWithId = { ...imageData, id: docRef.id, storagePath: snapshot.ref.fullPath };
                    dispatch('imageUploaded', imageDataWithId);
                })
                .catch((error) => {
                    console.error("Upload failed", error);
                });

            uploadPromises.push(uploadPromise);
        }
        await Promise.all(uploadPromises);
        uploading = false;
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    }

    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        const files = event.dataTransfer.files;
        processFiles(files);
        event.dataTransfer.clearData();
    }

    function handleFileChange(event) {
        const files = event.target.files;
        processFiles(files);
    }

    function handleClick() {
        if (uploading) return;
        fileInput.click();
    }

    function handleImageClick(img, event) {
        event.stopPropagation();
        dispatch('imageClicked', { image: img });
    }

    // 삭제 버튼 이벤트: X 버튼 클릭 시 삭제 이벤트 전달
    function handleDelete(img, event) {
        event.stopPropagation();
        dispatch('imageDelete', { image: img });
    }
</script>

<div class="month-dropzone"
     on:dragover={handleDragOver}
     on:drop={handleDrop}
     on:click={handleClick}
     tabindex="0" role="button"
     on:keydown={(event) => { if(event.key === 'Enter') handleClick(); }}>
    <h3>{month}</h3>

    {#if uploading}
        <div class="loading-overlay">
            <div class="spinner"></div>
        </div>
    {/if}

    <div class="images-grid">
        {#each images as img (img.id)}
            <div class="image-container">
                <button class="delete-button" on:click={(event) => handleDelete(img, event)} title="이미지 삭제">×</button>
                <button class="image-button" on:click={(event) => handleImageClick(img, event)}>
                    <img src={img.src} alt="Uploaded image" />
                </button>
            </div>
        {/each}
    </div>
    <p class="hint">드래그앤드롭 또는 클릭하여 이미지를 업로드하세요</p>
    <input type="file" accept="image/*" multiple bind:this={fileInput} on:change={handleFileChange} style="display:none" />
</div>

<style>
    .month-dropzone {
        position: relative;
        border: 2px dashed #ccc;
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
        min-height: 200px;
        cursor: pointer;
        /* 부드러운 전환 효과 */
        transition: background-color 0.3s ease, color 0.3s ease;
    }
    .month-dropzone:hover {
        background-color: #f9f9f9;
    }

    /* 라이트 모드 기본 스타일은 그대로 사용 */
    :global(html) .month-dropzone {
        color: inherit;
    }

    /* 다크모드 기본 스타일 */
    :global(html.dark) .month-dropzone {
        background-color: #2c2c2c;
        color: #fff;
    }
    /* 다크모드 호버 시: 배경은 밝은색으로, 글자(날짜) 색상은 어두운색으로 변경 */
    :global(html.dark) .month-dropzone:hover {
        background-color: #f0f0f0;
        color: #333;
    }

    .images-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 0.5rem;
        margin-top: 1rem;
    }
    .image-container {
        position: relative;
    }
    .delete-button {
        position: absolute;
        top: 2px;
        left: 2px;
        background: rgba(255, 0, 0, 0.7);
        border: none;
        color: white;
        font-size: 1.2rem;
        line-height: 1;
        padding: 0 4px;
        border-radius: 50%;
        cursor: pointer;
        display: none;
        z-index: 2;
    }
    .image-container:hover .delete-button {
        display: block;
    }
    .image-button {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        width: 100%;
    }
    .image-button:focus {
        outline: 2px solid blue;
    }
    img {
        width: 100%;
        height: auto;
        object-fit: cover;
    }
    .hint {
        margin-top: 1rem;
        font-size: 0.9rem;
        color: #666;
    }
    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10;
    }
    .spinner {
        border: 4px solid #f3f3f3;
        border-top: 4px solid #3498db;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>
