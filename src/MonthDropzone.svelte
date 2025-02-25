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

    // 기존 결제 상태 목록
    const paymentStatuses = ["예약금", "전액", "꼴림"];
    // 새로운 팀 상태 목록 (드리머 추가)
    const teamStatuses = ["코아", "매하", "히탐", "래빗츠", "유메", "위북", "드리머", "중고"];

    // 결제 상태에 따른 CSS 클래스 반환
    function getStatusClass(status) {
        if (status === "예약금") return "status-reserve";
        if (status === "전액") return "status-full";
        if (status === "꼴림") return "status-kkolim";
        return "";
    }

    // 팀 상태에 따른 CSS 클래스 반환
    function getTeamStatusClass(teamStatus) {
        if (teamStatus === "코아") return "status-koa";
        if (teamStatus === "매하") return "status-maeha";
        if (teamStatus === "히탐") return "status-hitam";
        if (teamStatus === "래빗츠") return "status-rabbits";
        if (teamStatus === "유메") return "status-yume";
        if (teamStatus === "위북") return "status-wibuk";
        if (teamStatus === "드리머") return "status-dreamer";
        if (teamStatus === "중고") return "status-junggu";
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
                    // 업로드 시 기본 결제 상태는 "예약금", 팀 상태는 "코아"로 설정
                    const imageData = {
                        src: downloadURL,
                        month,
                        date: new Date().toISOString(),
                        description: "",
                        uid: userUid,
                        status: "예약금",
                        teamStatus: teamStatuses[0]
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

        const fileList = event.dataTransfer.files;
        if (fileList && fileList.length > 0) {
            processFiles(fileList);
            event.dataTransfer.clearData();
            return;
        }

        try {
            const jsonData = event.dataTransfer.getData('application/json');
            if (jsonData) {
                const data = JSON.parse(jsonData);
                dispatch('imageMoved', { id: data.id, fromMonth: data.fromMonth, toMonth: month });
            }
        } catch (error) {
            console.error("드래그 데이터 파싱 실패:", error);
        }
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

    function handleDelete(img, event) {
        event.stopPropagation();
        dispatch('imageDelete', { image: img });
    }

    function toggleStatus(image, event) {
        event.stopPropagation();
        let currentIndex = paymentStatuses.indexOf(image.status);
        let newStatus = paymentStatuses[(currentIndex + 1) % paymentStatuses.length];
        dispatch('statusToggled', { image, newStatus });
    }

    function toggleTeamStatus(image, event) {
        event.stopPropagation();
        let currentIndex = teamStatuses.indexOf(image.teamStatus);
        let newTeamStatus = teamStatuses[(currentIndex + 1) % teamStatuses.length];
        dispatch('teamStatusToggled', { image, newTeamStatus });
    }

    function handleImageDragStart(img, event) {
        event.dataTransfer.setData('application/json', JSON.stringify({ id: img.id, fromMonth: month }));
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
            <div class="image-container"
                 draggable="true"
                 on:dragstart={(event) => handleImageDragStart(img, event)}>
                <button class="delete-button" on:click={(event) => handleDelete(img, event)} title="이미지 삭제">×</button>
                <button class="image-button" on:click={(event) => handleImageClick(img, event)}>
                    <img src={img.src} alt="Uploaded image" />
                    <div class="status-label payment-label {getStatusClass(img.status)}" on:click={(event) => toggleStatus(img, event)}>
                        {img.status}
                    </div>
                    <div class="status-label team-label {getTeamStatusClass(img.teamStatus)}" on:click={(event) => toggleTeamStatus(img, event)}>
                        {img.teamStatus}
                    </div>
                </button>
            </div>
        {/each}
    </div>
    <p class="hint">드래그앤드롭 또는 클릭하여 이미지를 업로드하세요</p>
    <input type="file" accept="image/*" multiple bind:this={fileInput} on:change={handleFileChange} style="display:none" />
</div>

<style>
    .images-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 0.5rem;
        margin-top: 1rem;
        max-width: 100%;
    }
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
    :global(html.dark) .month-dropzone {
        background-color: #2c2c2c;
        color: #fff;
    }
    :global(html.dark) .month-dropzone:hover {
        background-color: #f0f0f0;
        color: #333;
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
    .payment-label {
        position: absolute;
        bottom: 4px;
        left: 4px;
    }
    .team-label {
        position: absolute;
        bottom: 4px;
        right: 4px;
    }
    .status-label {
        padding: 0.2rem 0.5rem;
        font-size: 0.8rem;
        border-radius: 4px;
        transition: background-color 0.3s ease, color 0.3s ease;
    }
    .status-reserve {
        background-color: #3498db;
        color: #fff;
    }
    .status-full {
        background-color: #27ae60;
        color: #fff;
    }
    .status-kkolim {
        background-color: #e67e22;
        color: #fff;
    }
    .status-koa {
        background-color: #8e44ad;
        color: #fff;
    }
    .status-maeha {
        background-color: #d35400;
        color: #fff;
    }
    .status-hitam {
        background-color: #27ae60;
        color: #fff;
    }
    .status-rabbits {
        background-color: #2980b9;
        color: #fff;
    }
    .status-yume {
        background-color: #f39c12;
        color: #fff;
    }
    .status-wibuk {
        background-color: #c0392b;
        color: #fff;
    }
    .status-dreamer {
        background-color: #e91e63;
        color: #fff;
    }
    .status-junggu {
        background-color: #7f8c8d;
        color: #fff;
    }
    :global(html.dark) .status-junggu {
        background-color: #95a5a6;
    }
    :global(html.dark) .status-reserve {
        background-color: #2980b9;
    }
    :global(html.dark) .status-full {
        background-color: #1e8449;
    }
    :global(html.dark) .status-kkolim {
        background-color: #d35400;
    }
    :global(html.dark) .status-koa {
        background-color: #7d3c98;
    }
    :global(html.dark) .status-maeha {
        background-color: #ba4a00;
    }
    :global(html.dark) .status-hitam {
        background-color: #229954;
    }
    :global(html.dark) .status-rabbits {
        background-color: #2471a3;
    }
    :global(html.dark) .status-yume {
        background-color: #e67e22;
    }
    :global(html.dark) .status-wibuk {
        background-color: #a93226;
    }
    :global(html.dark) .status-dreamer {
        background-color: #c2185b;
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
