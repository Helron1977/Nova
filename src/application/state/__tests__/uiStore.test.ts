import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../uiStore';
import { act } from '@testing-library/react'; // Utile pour les mises à jour d'état

describe('useUiStore', () => {

  // Réinitialiser le store à son état initial avant chaque test
  beforeEach(() => {
    // Zustand garde l'état entre les tests, il faut le reset
    // La méthode .reset() n'existe pas par défaut, il faut la réinitialisation manuelle
    // Assurez-vous que l'état initial inclut tous les champs
    useUiStore.setState({ theme: 'light', appMode: 'normal' }); // Ajout appMode initial pour le mode UI
  });

  // --- Tests pour Theme ---
  it('should have initial theme as "light"', () => {
    const { theme } = useUiStore.getState();
    expect(theme).toBe('light');
  });

  it('toggleTheme should switch theme from light to dark', () => {
    const { toggleTheme } = useUiStore.getState();
    act(() => {
        toggleTheme();
    });
    const { theme } = useUiStore.getState();
    expect(theme).toBe('dark');
  });

  it('toggleTheme should switch theme from dark to light', () => {
    act(() => {
        useUiStore.setState({ theme: 'dark' });
    });
    const { toggleTheme } = useUiStore.getState();
    act(() => {
        toggleTheme();
    });
    const { theme } = useUiStore.getState();
    expect(theme).toBe('light');
  });

  // --- Tests pour AppMode (Mode UI Normal/Admin) ---
  it('should have initial appMode as "normal"', () => {
    // Note: l'état initial est défini dans beforeEach
    const { appMode } = useUiStore.getState();
    expect(appMode).toBe('normal');
  });

  it('setAppMode should switch UI mode to "admin"', () => {
    const { setAppMode } = useUiStore.getState();
    act(() => {
        setAppMode('admin');
    });
    const { appMode } = useUiStore.getState();
    expect(appMode).toBe('admin');
  });

  it('setAppMode should switch UI mode back to "normal"', () => {
    // Partir de l'état admin pour tester le retour à normal
    act(() => {
        useUiStore.setState({ appMode: 'admin' });
    });
    const { setAppMode } = useUiStore.getState();
    act(() => {
        setAppMode('normal');
    });
    const { appMode } = useUiStore.getState();
    expect(appMode).toBe('normal');
  });
}); 