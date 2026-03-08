import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAleb0hnnHneHXCdiA2mTdfeKq489eTlkE",
    authDomain: "saham-41a8b.firebaseapp.com",
    projectId: "saham-41a8b",
    storageBucket: "saham-41a8b.firebasestorage.app",
    messagingSenderId: "682736310320",
    appId: "1:682736310320:web:aa99c6f59849f1b74ef5f5",
    measurementId: "G-E2WJ2Y5M6Q"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
