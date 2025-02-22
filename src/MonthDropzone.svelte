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

    // 상태에 따라 CSS 클래스를 결정하는 함수
    function getStatusClass(status) {
        if (status === "예약금") return "status-reserve";
        if (status === "전액") return "status-full";
        if (status === "꼴림") return "status-kkolim";
        return "";
    }

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
                    // 업로드 시 기본 상태는 "예약금"으로 설정
                    const imageData = {
                        src: downloadURL,
                        month,
                        date: new Date().toISOString(),
                        description: "",
                        uid: userUid,
                        status: "예약금"
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

    // 삭제 버튼 이벤트
    function handleDelete(img, event) {
        event.stopPropagation();
        dispatch('imageDelete', { image: img });
    }

    // 상태 토글: "예약금" → "전액" → "꼴림" → "예약금" 순으로 순환
    function toggleStatus(image, event) {
        event.stopPropagation();
        let newStatus;
        if (image.status === "예약금") {
            newStatus = "전액";
        } else if (image.status === "전액") {
            newStatus = "꼴림";
        } else if (image.status === "꼴림") {
            newStatus = "예약금";
        } else {
            newStatus = "예약금";
        }
        dispatch('statusToggled', { image, newStatus });
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
                    <!-- 상태 띠: 이미지 내부 하단에 오버레이하며, 상태에 따른 클래스가 적용됨 -->
                    <div class="status-label {getStatusClass(img.status)}" on:click={(event) => toggleStatus(img, event)}>
                        {img.status}
                    </div>
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
        transition: background-color 0.3s ease, color 0.3s ease;
    }
    .month-dropzone:hover {
        background-color: #f9f9f9;
    }
    :global(html) .month-dropzone {
        color: inherit;
    }
    /* 다크모드 기본 스타일 */
    :global(html.dark) .month-dropzone {
        background-color: #2c2c2c;
        color: #fff;
    }
    /* 다크모드 호버 시: 배경은 밝은색, 텍스트는 어두운색으로 변경 */
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
        position: relative;
    }
    .image-button:focus {
        outline: 2px solid blue;
    }
    img {
        width: 100%;
        height: auto;
        object-fit: cover;
        display: block;
    }
    /* 상태 띠: 이미지 내부 하단에 오버레이 (이미지 크기에 맞게 auto 크기) */
    .status-label {
        position: absolute;
        bottom: 4px;
        left: 4px;
        padding: 0.2rem 0.5rem;
        font-size: 0.8rem;
        border-radius: 4px;
        transition: background-color 0.3s ease, color 0.3s ease;
    }
    /* 각 상태별 기본 배경색 (라이트 모드) */
    .status-reserve {
        background-color: #3498db; /* 예약금: 파란색 */
        color: #fff;
    }
    .status-full {
        background-color: #27ae60; /* 전액: 초록색 */
        color: #fff;
    }
    .status-kkolim {
        background-color: #e67e22; /* 꼴림: 주황색 */
        color: #fff;
    }
    /* 다크모드에서 기본 배경색 약간 어둡게 조정 */
    :global(html.dark) .status-reserve {
        background-color: #2980b9;
    }
    :global(html.dark) .status-full {
        background-color: #1e8449;
    }
    :global(html.dark) .status-kkolim {
        background-color: #d35400;
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
