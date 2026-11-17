import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';

// Firebase Web App configuration for the Tori-Wear Firebase project
export const firebaseConfig = {
  apiKey: "AIzaSyDjCUKp6_4nDzLegBjOJu7A9k5M-qBxqZM",
  authDomain: "tori-wear.firebaseapp.com",
  projectId: "tori-wear",
  storageBucket: "tori-wear.firebasestorage.app",
  messagingSenderId: "587721360987",
  appId: "1:587721360987:web:ddfe0f56d9dc9db8a8217e"
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication with Google Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configure Google Provider custom parameters to allow selecting account
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Enforce browser local persistence across sessions without unhandled rejections in restricted contexts
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(() => {});
