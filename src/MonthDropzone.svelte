<script>
    import { createEventDispatcher } from 'svelte';
    import { storage, db } from './firebase.js';
    import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
    import { collection, addDoc } from 'firebase/firestore';

    export let month = "";
    export let userUid; // Dashboard에서 전달받은 uid
    export let images = [];
    const dispatch = createEventDispatcher();
    let fileInput;

    async function processFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const filePath = `images/${month}/${Date.now()}_${file.name}`;
            const storageRefObj = ref(storage, filePath);
            try {
                const snapshot = await uploadBytes(storageRefObj, file);
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
            } catch (error) {
                console.error("Upload failed", error);
            }
        }
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
        fileInput.click();
    }

    function handleImageClick(img, event) {
        event.stopPropagation();
        dispatch('imageClicked', { image: img });
    }
</script>

<div class="month-dropzone"
     on:dragover={handleDragOver}
     on:drop={handleDrop}
     on:click={handleClick}
     tabindex="0" role="button"
     on:keydown={(event) => { if(event.key === 'Enter') handleClick(); }}>
    <h3>{month}</h3>
    <div class="images-grid">
        {#each images as img}
            <button class="image-button" on:click={(event) => handleImageClick(img, event)}>
                <img src={img.src} alt="Uploaded image" />
            </button>
        {/each}
    </div>
    <p class="hint">드래그앤드롭 또는 클릭하여 이미지를 업로드하세요</p>
    <input type="file" accept="image/*" multiple bind:this={fileInput} on:change={handleFileChange} style="display:none" />
</div>

<style>
    .month-dropzone {
        border: 2px dashed #ccc;
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
        min-height: 200px;
        position: relative;
        cursor: pointer;
    }
    .month-dropzone:hover {
        background-color: #f9f9f9;
    }
    .images-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 0.5rem;
        margin-top: 1rem;
    }
    .image-button {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
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
</style>
