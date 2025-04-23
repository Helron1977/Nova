import { create } from 'zustand';
import { auth } from '../../infrastructure/firebase/firebaseConfig'; // Importer l'instance auth
import { onAuthStateChanged, type User, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

// Définir le type pour l'état d'authentification
interface AuthState {
  user: User | null; // L'objet User de Firebase ou null
  isLoading: boolean; // Pour indiquer si l'état d'auth est en cours de chargement initial
  error: Error | null; // Pour stocker une éventuelle erreur d'authentification
  // --- Actions --- 
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  // --- Interne (pas exposé directement à l'extérieur mais utilisé par le store) ---
  _setUser: (user: User | null) => void; // Pour mettre à jour l'utilisateur depuis l'observer
  _setLoading: (loading: boolean) => void;
  _setError: (error: Error | null) => void;
}

// Créer le store Zustand
export const useAuthStore = create<AuthState>((set /*, get */) => ({
  user: null,
  isLoading: true, // Commence en chargement
  error: null,

  // --- Actions --- 
  signInWithGoogle: async () => {
    set({ isLoading: true, error: null });
    console.time("signInPopup"); // Démarrer le chronomètre
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // L'état user sera mis à jour par onAuthStateChanged, pas besoin de set({ isLoading: false }) ici directement après succès.
    } catch (error: any) {
      console.error("Error during Google sign-in:", error);
      // Seulement définir l'état d'erreur si ce n'est pas une simple annulation du popup
      if (error?.code !== 'auth/popup-closed-by-user') {
        set({ error: error as Error });
      } else {
        // Optionnel: Si l'erreur EST une annulation, s'assurer que l'état d'erreur est nul
        set({ error: null }); 
      }
    } finally {
      console.timeEnd("signInPopup"); // Arrêter et afficher le temps écoulé
      // S'assurer que le chargement est terminé, peu importe le résultat (succès, erreur, annulation)
      set({ isLoading: false });
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });
    try {
      await signOut(auth);
      // L'état user sera mis à jour par onAuthStateChanged à null
      // set({ user: null, isLoading: false }); // L'observer le fera
    } catch (error) {
      console.error("Error during sign-out:", error);
      set({ error: error as Error, isLoading: false });
    }
  },

  // --- Méthodes internes pour l'observer --- 
  _setUser: (user) => set({ user }),
  _setLoading: (loading) => set({ isLoading: loading }),
  _setError: (error) => set({ error }),
}));

// --- Observer l'état d'authentification Firebase --- 
// Il est crucial d'écouter les changements d'état pour savoir si l'utilisateur
// est déjà connecté au chargement de l'app, ou après une redirection.
onAuthStateChanged(auth, (user) => {
  console.log('Auth State Changed:', user);
  useAuthStore.getState()._setUser(user); // Met à jour le store avec l'utilisateur actuel
  useAuthStore.getState()._setLoading(false); // Décommenté: Gérer à nouveau isLoading ici
  useAuthStore.getState()._setError(null); // Réinitialiser l'erreur
}, (error) => {
  // Gérer les erreurs de l'observer lui-même (rare)
  console.error("Error in onAuthStateChanged observer:", error);
  useAuthStore.getState()._setError(error); 
  useAuthStore.getState()._setLoading(false); // Décommenté: Gérer à nouveau isLoading ici
});

// Log initial pour débogage (optionnel)
console.log('Initial auth state:', useAuthStore.getState().user); 