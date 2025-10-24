// src/firebase.ts
import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD3ioaao3BsPLrcSQCC7sg6wreWLGgXR00",
  authDomain: "sankaria.firebaseapp.com",
  projectId: "sankaria",
  storageBucket: "sankaria.firebasestorage.app",
  messagingSenderId: "45910266427",
  appId: "1:45910266427:web:423b141dbe8e76a54ac21e"
};

let app: FirebaseApp;
let authInstance: Auth;

try {
  app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  console.log("Firebase berhasil diinisialisasi.");
} catch (error) {
  console.error("Gagal menginisialisasi Firebase:", error);
  // @ts-ignore
  authInstance = {} as Auth;
}

export const auth = authInstance;