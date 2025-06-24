// js/config.js

const firebaseConfig = {
    apiKey: "AIzaSyDRy7LBdKooljXxTuZq_FvpfXJv4Ec65wQ",
    authDomain: "simplifinance-65ac9.firebaseapp.com",
    projectId: "simplifinance-65ac9",
    storageBucket: "simplifinance-65ac9.firebasestorage.app",
    messagingSenderId: "122545134930",
    appId: "1:122545134930:web:2ff0a9c123179697fbae8b",
    measurementId: "G-GL5JQ4XM2V"
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