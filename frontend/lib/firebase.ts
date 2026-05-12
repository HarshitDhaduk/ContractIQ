import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  projectId: "contractiq-by-harshit",
  appId: "1:313551111184:web:eb8eb29b4a9bb3088ef695",
  apiKey: "AIzaSyDSeEcZ9Ua8spDEazJTPS-9oBwLbye9pEA",
  authDomain: "contractiq-by-harshit.firebaseapp.com",
  storageBucket: "contractiq-by-harshit.firebasestorage.app",
  messagingSenderId: "313551111184",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
