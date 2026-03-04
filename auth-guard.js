// auth-guard.js
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Agar login nahi hai toh login page par bhej do
        window.location.href = 'login.html';
    }
});
