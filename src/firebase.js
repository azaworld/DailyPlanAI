// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration object
const firebaseConfig = {
  apiKey: "AIzaSyBqiLtKT4RSDfKbrwbJHp98mB-7aF4wi9U",
  authDomain: "dailyplanner-446bf.firebaseapp.com",
  projectId: "dailyplanner-446bf",
  storageBucket: "dailyplanner-446bf.appspot.com",
  messagingSenderId: "123291898971",
  appId: "1:123291898971:web:1e6d61f9e31d6061e7db7e",
  measurementId: "G-NTZQF7D296"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth services
const db = getFirestore(app);
const auth = getAuth(app);

// Export everything you need
export { firebaseConfig, app, db, auth };