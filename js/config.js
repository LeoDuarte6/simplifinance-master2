// js/config.js

const firebaseConfig = {
    apiKey: "AIzaSyC_cE9GxsDsa59b_neWmzhcbwWo4_iTQqc",
    authDomain: "simplifinancellc-a6795.firebaseapp.com",
    projectId: "simplifinancellc-a6795",
    storageBucket: "simplifinancellc-a6795.firebasestorage.app",
    messagingSenderId: "599812082035",
    appId: "1:599812082035:web:1d02b29892a2a912745d06",
    measurementId: "G-J2VYJETRJK"
};

/**
 * Manages Firebase initialization and service retrieval.
 */
export class FirebaseConfig {
    static async initialize() {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js");
        return initializeApp(firebaseConfig);
    }

    static async getFirebaseServices(app) {
        const { getAuth } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
        const { getFunctions } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js");
        const { getStorage } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js");

        return {
            auth: getAuth(app),
            db: getFirestore(app),
            functions: getFunctions(app),
            storage: getStorage(app),
        };
    }
}

/**
 * Application-wide constants.
 */
export const APP_CONSTANTS = {
    ADMIN_EMAIL: "admin@simplifinance.com",
    STORAGE_KEYS: {
        SIGNUP_DATA: 'simplifinance_signupData',
        SELECTED_PLAN: 'simplifinance_selectedPlan'
    }
};