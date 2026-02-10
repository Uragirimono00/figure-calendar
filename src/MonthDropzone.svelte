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
    let dragOver = false;

    const paymentStatuses = ["예약금", "전액", "꼴림"];
    const teamStatuses = ["코아", "매하", "히탐", "래빗츠", "유메", "위북", "드리머", "중고"];

    function getStatusClass(status) {
        if (status === "예약금") return "status-reserve";
        if (status === "전액") return "status-full";
        if (status === "꼴림") return "status-kkolim";
        return "";
    }

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

    function convertImageToWebp(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0);
                    canvas.toBlob((blob) => {
                        if (blob) {
                            const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
                            const webpFile = new File([blob], newFileName, { type: "image/webp" });
                            resolve(webpFile);
                        } else {
                            reject(new Error("webp 변환에 실패했습니다."));
                        }
                    }, "image/webp", 0.8);
                };
                img.onerror = (err) => reject(err);
                img.src = e.target.result;
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    async function processFiles(files) {
        uploading = true;
        const uploadPromises = [];
        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            if (file.type !== "image/webp") {
                try {
                    file = await convertImageToWebp(file);
                } catch (error) {
                    console.error("webp 변환 실패:", error);
                    continue;
                }
            }
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
                        uid: userUid,
                        status: "예약금",
                        teamStatus: teamStatuses[0]
                    };
                    const docRef = await addDoc(collection(db, "images"), imageData);
                    const imageDataWithId = { ...imageData, id: docRef.id, storagePath: snapshot.ref.fullPath };
                    dispatch('imageUploaded', imageDataWithId);
                })
                .catch((error) => {
                    console.error("업로드 실패", error);
                });
            uploadPromises.push(uploadPromise);
        }
        await Promise.all(uploadPromises);
        uploading = false;
    }

    async function reencodeAndReuploadImage(image) {
        if (!image.src.endsWith(".webp")) {
            try {
                const response = await fetch(image.src);
                const blob = await response.blob();
                const tempFile = new File([blob], "temp", { type: blob.type });
                const webpFile = await convertImageToWebp(tempFile);
                const filePath = `images/${month}/${Date.now()}_${webpFile.name}`;
                const storageRefObj = ref(storage, filePath);
                const snapshot = await uploadBytes(storageRefObj, webpFile);
                const downloadURL = await getDownloadURL(snapshot.ref);
                image.src = downloadURL;
                image.storagePath = snapshot.ref.fullPath;
            } catch (error) {
                console.error("재업로드 실패:", error);
            }
        }
    }

    function handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        dragOver = true;
    }

    function handleDragLeave() {
        dragOver = false;
    }

    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        dragOver = false;

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
     class:drag-over={dragOver}
     on:dragover={handleDragOver}
     on:dragleave={handleDragLeave}
     on:drop={handleDrop}
     on:click={handleClick}
     tabindex="0" role="button"
     on:keydown={(event) => { if(event.key === 'Enter') handleClick(); }}>

    <div class="month-header">
        <span class="month-badge">{month}</span>
        {#if images.length > 0}
            <span class="image-count">{images.length}</span>
        {/if}
    </div>

    {#if uploading}
        <div class="loading-overlay">
            <div class="spinner"></div>
        </div>
    {/if}

    {#if images.length === 0 && !uploading}
        <div class="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span>이미지 업로드</span>
        </div>
    {/if}

    <div class="images-grid">
        {#each images as img (img.id)}
            <div class="image-container"
                 draggable="true"
                 on:dragstart={(event) => handleImageDragStart(img, event)}>
                <button class="delete-button" on:click={(event) => handleDelete(img, event)} title="이미지 삭제">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <button class="image-button" on:click={(event) => handleImageClick(img, event)}>
                    <img src={img.src} alt="Uploaded image" on:error={(e) => { e.target.src = ''; e.target.classList.add('img-error'); }} />
                    <div class="image-overlay"></div>
                    {#if img.purchaseStatus === "찜"}
                        <div class="wishlist-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        </div>
                    {/if}
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
    <input type="file" accept="image/*" multiple bind:this={fileInput} on:change={handleFileChange} style="display:none" />
</div>

<style>
    .month-dropzone {
        position: relative;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-lg);
        padding: var(--space-3);
        text-align: center;
        min-height: 180px;
        cursor: pointer;
        transition: all var(--transition);
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
    }
    .month-dropzone:hover {
        border-color: var(--color-border-hover);
        box-shadow: var(--shadow);
    }
    .month-dropzone.drag-over {
        border-color: var(--color-primary);
        background: var(--color-primary-bg);
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .month-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-bottom: var(--space-2);
    }
    .month-badge {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--color-primary);
        background: var(--color-primary-bg);
        padding: 2px var(--space-2);
        border-radius: var(--radius-full);
    }
    .image-count {
        font-size: 0.6875rem;
        color: var(--color-text-muted);
        background: var(--color-surface-hover);
        padding: 1px 6px;
        border-radius: var(--radius-full);
    }
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        flex: 1;
        color: var(--color-text-muted);
        padding: var(--space-6) 0;
    }
    .empty-state span {
        font-size: 0.75rem;
    }
    .images-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: var(--space-2);
        max-width: 100%;
    }
    .image-container {
        position: relative;
        border-radius: var(--radius);
        overflow: hidden;
    }
    .delete-button {
        position: absolute;
        top: 4px;
        left: 4px;
        width: 20px;
        height: 20px;
        background: rgba(239, 68, 68, 0.9);
        border: none;
        color: white;
        border-radius: var(--radius-full);
        cursor: pointer;
        display: none;
        z-index: 2;
        padding: 0;
        align-items: center;
        justify-content: center;
    }
    .image-container:hover .delete-button {
        display: flex;
    }
    .image-button {
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        width: 100%;
        position: relative;
        display: block;
    }
    .image-button:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
        border-radius: var(--radius);
    }
    .image-overlay {
        position: absolute;
        inset: 0;
        background: transparent;
        transition: background var(--transition-fast);
    }
    .image-container:hover .image-overlay {
        background: rgba(0, 0, 0, 0.08);
    }
    img {
        width: 100%;
        height: auto;
        object-fit: cover;
        display: block;
        border-radius: var(--radius);
        transition: transform var(--transition);
    }
    .image-container:hover img {
        transform: scale(1.03);
    }
    .wishlist-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 22px;
        height: 22px;
        background: rgba(239, 68, 68, 0.9);
        color: white;
        border-radius: var(--radius-full);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        backdrop-filter: blur(4px);
    }
    :global(img.img-error) {
        min-height: 80px;
        background: var(--color-surface-hover);
        display: flex;
        align-items: center;
        justify-content: center;
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
        padding: 1px 6px;
        font-size: 0.625rem;
        font-weight: 600;
        border-radius: var(--radius-full);
        transition: all var(--transition-fast);
        backdrop-filter: blur(4px);
    }
    .status-reserve {
        background-color: rgba(37, 99, 235, 0.9);
        color: #fff;
    }
    .status-full {
        background-color: rgba(34, 197, 94, 0.9);
        color: #fff;
    }
    .status-kkolim {
        background-color: rgba(245, 158, 11, 0.9);
        color: #fff;
    }
    .status-koa {
        background-color: rgba(139, 92, 246, 0.9);
        color: #fff;
    }
    .status-maeha {
        background-color: rgba(249, 115, 22, 0.9);
        color: #fff;
    }
    .status-hitam {
        background-color: rgba(16, 185, 129, 0.9);
        color: #fff;
    }
    .status-rabbits {
        background-color: rgba(59, 130, 246, 0.9);
        color: #fff;
    }
    .status-yume {
        background-color: rgba(234, 179, 8, 0.9);
        color: #fff;
    }
    .status-wibuk {
        background-color: rgba(239, 68, 68, 0.9);
        color: #fff;
    }
    .status-dreamer {
        background-color: rgba(236, 72, 153, 0.9);
        color: #fff;
    }
    .status-junggu {
        background-color: rgba(107, 114, 128, 0.9);
        color: #fff;
    }
    .loading-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--color-overlay);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10;
        border-radius: var(--radius-lg);
    }
    .spinner {
        border: 3px solid var(--color-border);
        border-top: 3px solid var(--color-primary);
        border-radius: 50%;
        width: 32px;
        height: 32px;
        animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
</style>
