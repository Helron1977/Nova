import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";

// ---> AJOUT D'UN LOG POUR VÉRIFIER LES VARIABLES <--- 
console.log("[Firebase Config] Reading environment variables:");
console.log("VITE_FIREBASE_API_KEY:", import.meta.env.VITE_FIREBASE_API_KEY ? 'Chargée' : 'NON CHARGÉE'); // Ne pas logger la clé elle-même
console.log("VITE_FIREBASE_AUTH_DOMAIN:", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
console.log("VITE_FIREBASE_PROJECT_ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID);
console.log("VITE_LOG_LEVEL (for comparison):", import.meta.env.VITE_LOG_LEVEL);

// Récupérer les variables d'environnement (préfixées par VITE_)
const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Obtenir l'instance d'authentification et l'exporter
export const auth = getAuth(app);

// Exporter aussi l'app si nécessaire pour d'autres services Firebase (Firestore, etc.)
// export const firebaseApp = app; 