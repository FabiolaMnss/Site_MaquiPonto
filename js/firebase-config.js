import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDuLyWpcAHASO-qxzsoinbq4V7yhAAKNyI",
    authDomain: "maquiponto-site.firebaseapp.com",
    projectId: "maquiponto-site",
    storageBucket: "maquiponto-site.firebasestorage.app",
    messagingSenderId: "234795973026",
    appId: "1:234795973026:web:83dbad04f90a35de141afb"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
