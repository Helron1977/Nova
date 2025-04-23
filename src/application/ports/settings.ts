import { AppSettings, AppMode } from '../../domain/settings';

/**
 * Port définissant l'interface pour la gestion (lecture/écriture)
 * des paramètres de l'application.
 */
export interface IAppSettingsRepository {
  /**
   * Récupère l'objet complet des paramètres actuels.
   */
  getSettings(): Promise<AppSettings>;

  /**
   * Sauvegarde un nouvel objet de paramètres.
   * L'implémentation doit valider l'objet avant de sauvegarder.
   */
  saveSettings(settings: AppSettings): Promise<void>;

  /**
   * Raccourci pour obtenir directement le mode de fonctionnement actuel.
   */
  getMode(): Promise<AppMode>;
} 