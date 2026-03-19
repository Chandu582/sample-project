// config.js - Universal Configuration for STES ERP

// 1. Aapka Firebase Configuration (API Key wahi hai jo aapne bheji thi)



// Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyD_E3sVBKxA4z5nhFazs5X9Rcz7S1ila-o",
    authDomain: "st-teresa-school-9db80.firebaseapp.com",
    projectId: "st-teresa-school-9db80",
    storageBucket: "st-teresa-school-9db80.firebasestorage.app",
    messagingSenderId: "304381643274",
    appId: "1:304381643274:web:fac3182e3e1ecb8f24adf3"
  };





// 2. Initialize Firebase (Check karega ki pehle se load to nahi hai)
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase Connected Successfully via config.js");
} else if (typeof firebase === 'undefined') {
    console.error("Error: Firebase SDK load nahi hua hai. HTML me script tags check karein.");
}

// 3. Global Variables Export (Taaki har file me direct use ho sakein)
// Ab aap puri website me kahin bhi 'db' ya 'storage' likhoge to chalega
const db = typeof firebase.firestore === 'function' ? firebase.firestore() : null;
const storage = typeof firebase.storage === 'function' ? firebase.storage() : null; 

// (Optional) Agar Auth use karna ho to ise uncomment kar dena:
const auth = typeof firebase.auth === 'function' ? firebase.auth() : null;
