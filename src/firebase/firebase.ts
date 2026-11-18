import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';

const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

// Firebase Web App configuration for the Tori-Wear Firebase project
// Supports optional Vite env overrides while keeping defaults for bundled hosting
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyDjCUKp6_4nDzLegBjOJu7A9k5M-qBxqZM",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "tori-wear.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "tori-wear",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "tori-wear.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "587721360987",
  appId: env.VITE_FIREBASE_APP_ID || "1:587721360987:web:ddfe0f56d9dc9db8a8217e"
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
