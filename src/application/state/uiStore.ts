import { create } from 'zustand';

// Type pour les modes d'application UI possibles
type AppMode = 'normal' | 'admin';

// Type pour les thèmes possibles
type Theme = 'light' | 'dark';

// Définir le type pour l'état global de l'UI
interface UiState {
  theme: Theme;
  appMode: AppMode; // Ajouter l'état pour le mode UI
  toggleTheme: () => void;
  setAppMode: (mode: AppMode) => void; // Ajouter l'action pour changer le mode UI
}

// Créer le store Zustand
export const useUiStore = create<UiState>((set) => ({
  // Valeur initiale du thème (pourrait être lue depuis localStorage plus tard)
  theme: 'light', 
  appMode: 'normal', // Mode UI initial
  // Action pour basculer le thème
  toggleTheme: () => set((state) => ({ 
    theme: state.theme === 'light' ? 'dark' : 'light' 
  })),
  setAppMode: (mode) => 
    set(() => ({
        appMode: mode,
    })),
})); 