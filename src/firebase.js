// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Firebase 콘솔에서 발급받은 설정 정보로 대체하세요.
const firebaseConfig = {
    apiKey: "AIzaSyAVrkt_rugotCtw_k8nCVMM3_XpcIwilXI",
    authDomain: "figure-calendar.firebaseapp.com",
    projectId: "figure-calendar",
    storageBucket: "figure-calendar.firebasestorage.app",
    messagingSenderId: "298840441957",
    appId: "1:298840441957:web:c60435af58798f5d11728c",
    measurementId: "G-B3NDQRECXK"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
