// config.js - Universal Configuration for STES ERP

// 1. Aapka Firebase Configuration (API Key wahi hai jo aapne bheji thi)


const firebaseConfig = {
  apiKey: "AIzaSyA2xmYtteRPlX8sa9p9VRE36dP2cnQnJ8k",
  authDomain: "sample-school-13ca4.firebaseapp.com",
  projectId: "sample-school-13ca4",
  storageBucket: "sample-school-13ca4.firebasestorage.app",
  messagingSenderId: "198448853287",
  appId: "1:198448853287:web:778646f4cb56a9ba7ff902"
};
// Your web app's Firebase configuration
  





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
