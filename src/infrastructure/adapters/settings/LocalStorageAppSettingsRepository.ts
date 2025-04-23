import { AppSettings, AppMode } from '../../../domain/settings';
import { IAppSettingsRepository } from '../../../application/ports/settings';
import { ILogger } from '../../../application/ports/logging';
import { PinoLogger } from '../../logging/PinoLogger';

const SETTINGS_KEY = 'nova_app_settings';
const DEFAULT_SETTINGS: AppSettings = { mode: 'local' }; // Mode local par défaut

/**
 * Implémentation du repository des paramètres d'application utilisant localStorage.
 */
export class LocalStorageAppSettingsRepository implements IAppSettingsRepository {
  private readonly logger: ILogger;

  constructor(logger?: ILogger) {
      this.logger = logger || new PinoLogger();
  }

  async getSettings(): Promise<AppSettings> {
    this.logger.debug('Attempting to load AppSettings from localStorage...');
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored) as AppSettings;
        // Validation pour s'assurer que la structure est correcte
        if (settings && (settings.mode === 'local' || settings.mode === 'api')) {
           this.logger.debug('Loaded AppSettings from localStorage:', settings);
           return settings;
        } else {
           this.logger.warn('Invalid settings found in localStorage, falling back to default.', { storedValue: stored });
           // Optionnel : supprimer l'entrée invalide
           // localStorage.removeItem(SETTINGS_KEY);
        }
      } else {
          this.logger.log('No AppSettings found in localStorage, initializing with default.');
          await this.saveSettings(DEFAULT_SETTINGS); // Sauvegarde le défaut s'il n'existe pas
          return { ...DEFAULT_SETTINGS }; // Retourne une copie du défaut
      }
    } catch (error) {
      this.logger.error('Error getting AppSettings from localStorage', error as Error);
    }
    // En cas d'erreur ou de valeur invalide, retourne le défaut
    this.logger.warn('Falling back to default AppSettings due to error or invalid stored value.');
    return { ...DEFAULT_SETTINGS }; // Retourne une copie pour éviter modification accidentelle
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.logger.debug('Attempting to save AppSettings to localStorage:', settings);
    try {
       // Validation stricte avant sauvegarde
       if (!settings || (settings.mode !== 'local' && settings.mode !== 'api')) {
           const errorMsg = `Invalid settings object provided: mode must be 'local' or 'api'. Received: ${JSON.stringify(settings)}`;
           this.logger.error(errorMsg);
           throw new Error(errorMsg); // Lancer une erreur pour indiquer l'échec
       }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      this.logger.log('Saved AppSettings to localStorage:', settings);
    } catch (error) {
      this.logger.error('Error saving AppSettings to localStorage', error as Error);
      // Propager l'erreur pour que l'appelant sache que la sauvegarde a échoué
      throw error;
    }
  }

   async getMode(): Promise<AppMode> {
      // Utilise getSettings pour s'assurer que les défauts sont gérés
      const settings = await this.getSettings();
      this.logger.debug(`Current AppMode retrieved: ${settings.mode}`);
      return settings.mode;
  }
} 