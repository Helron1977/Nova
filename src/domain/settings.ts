/**
 * Définit les modes de fonctionnement possibles pour l'application,
 * notamment pour la source de données des configurations.
 */
export type AppMode = 'local' | 'api';

/**
 * Définit la structure des paramètres globaux de l'application.
 */
export interface AppSettings {
  /** Le mode de fonctionnement actuel (local ou api). */
  mode: AppMode;

  /** Autres paramètres futurs possibles... */
  // theme?: 'light' | 'dark';
  // language?: string;
} 