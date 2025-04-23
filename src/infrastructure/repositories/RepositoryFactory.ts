import { IConfigurationRepository } from '../../application/ports/repositories';
import { IAppSettingsRepository } from '../../application/ports/settings';
import { LocalStorageConfigurationRepository } from '../adapters/storage/LocalStorageConfigurationRepository';
import { ConfigurationApiAdapter } from '../adapters/api/ConfigurationApiAdapter';
import { LocalStorageAppSettingsRepository } from '../adapters/settings/LocalStorageAppSettingsRepository';
import { ILogger } from '../../application/ports/logging';
import { PinoLogger } from '../logging/PinoLogger';

// --- Gestion des Instances (Singleton simplifié pour l'exemple) ---
// Dans une application React, ces instances seraient typiquement gérées via
// des Contextes, Zustand, Redux, ou un conteneur d'injection de dépendances.
let loggerInstance: ILogger | null = null;
let appSettingsRepoInstance: IAppSettingsRepository | null = null;
let localConfigRepoInstance: IConfigurationRepository | null = null;
let apiConfigRepoInstance: IConfigurationRepository | null = null;

function getLogger(): ILogger {
  if (!loggerInstance) {
    loggerInstance = new PinoLogger();
    loggerInstance.debug('Logger instance created.');
  }
  return loggerInstance;
}

function getAppSettingsRepository(): IAppSettingsRepository {
  if (!appSettingsRepoInstance) {
    appSettingsRepoInstance = new LocalStorageAppSettingsRepository(getLogger());
    getLogger().debug('AppSettingsRepository instance created.');
  }
  return appSettingsRepoInstance;
}

function getLocalConfigRepository(): IConfigurationRepository {
    if (!localConfigRepoInstance) {
        localConfigRepoInstance = new LocalStorageConfigurationRepository(getLogger());
        getLogger().debug('LocalConfigRepository instance created.');
    }
    return localConfigRepoInstance;
}

function getApiConfigRepository(): IConfigurationRepository {
    if (!apiConfigRepoInstance) {
        apiConfigRepoInstance = new ConfigurationApiAdapter(getLogger());
        getLogger().debug('ApiConfigRepository instance created.');
    }
    return apiConfigRepoInstance;
}
// --- Fin Gestion des Instances ---

/**
 * Factory principale pour obtenir l'instance de IConfigurationRepository appropriée
 * en fonction du mode de l'application actuellement configuré.
 * Gère la logique de sélection entre l'adaptateur local et l'adaptateur API.
 */
export async function getConfigurationRepository(): Promise<IConfigurationRepository> {
  const settingsRepo = getAppSettingsRepository();
  const logger = getLogger();
  logger.debug('getConfigurationRepository called. Determining mode...');
  try {
    const mode = await settingsRepo.getMode(); // Récupère le mode depuis le repo des settings
    logger.log(`Current application mode is: ${mode}. Providing corresponding repository.`);

    if (mode === 'api') {
      // TODO: Ajouter potentiellement un check de connectivité API ici avant de retourner l'adaptateur.
      // Ex: const isApiReachable = await checkApiHealth(API_BASE_URL);
      // if (!isApiReachable) { throw new Error('API is not reachable'); }
      return getApiConfigRepository();
    } else {
      // mode === 'local'
      return getLocalConfigRepository();
    }
  } catch (error) {
      logger.error(
          'Failed to determine app mode or instantiate repository, falling back to local repository.',
          error as Error
      );
      // En cas d'erreur (ex: lecture localStorage échoue), fallback sécurisé vers le mode local
      return getLocalConfigRepository();
  }
}

/**
 * Expose le repository des paramètres pour permettre leur modification
 * depuis d'autres parties de l'application (ex: une page de settings UI).
 */
export function getSettingsRepositoryInstance(): IAppSettingsRepository {
    return getAppSettingsRepository();
}

/**
 * Expose une instance du logger pour une utilisation centralisée si nécessaire.
 */
export function getLoggerInstance(): ILogger {
    return getLogger();
} 