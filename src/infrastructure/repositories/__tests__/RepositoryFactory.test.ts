import { describe, it, expect, vi, beforeEach } from 'vitest';
// @ts-expect-error: TSC build struggles with dynamic import + mock usage detection
import { getConfigurationRepository, getSettingsRepositoryInstance, getLoggerInstance } from '../RepositoryFactory';
// @ts-expect-error: TSC build struggles with dynamic import + mock usage detection
import { LocalStorageConfigurationRepository } from '../../adapters/storage/LocalStorageConfigurationRepository';
// @ts-expect-error: TSC build struggles with dynamic import + mock usage detection
import { ConfigurationApiAdapter } from '../../adapters/api/ConfigurationApiAdapter';
// @ts-expect-error: TSC build struggles with dynamic import + mock usage detection
import { LocalStorageAppSettingsRepository } from '../../adapters/settings/LocalStorageAppSettingsRepository';
// @ts-expect-error: TSC build struggles with dynamic import + mock usage detection
import { PinoLogger } from '../../logging/PinoLogger';
// @ts-expect-error: TSC build struggles with dynamic import + mock usage detection
import { ILogger } from '../../../application/ports/logging';

// --- Mocker les dépendances AVANT toute importation ---
// Mock simple des implémentations concrètes
vi.mock('../../adapters/storage/LocalStorageConfigurationRepository');
vi.mock('../../adapters/api/ConfigurationApiAdapter');

// Mock plus détaillé pour contrôler getMode et logger.error
const mockGetMode = vi.fn();
const mockLogError = vi.fn();
vi.mock('../../adapters/settings/LocalStorageAppSettingsRepository', () => ({
  // Mock le constructeur lui-même pour suivre les appels
  LocalStorageAppSettingsRepository: vi.fn().mockImplementation(() => ({
    getMode: mockGetMode,
    // Autres méthodes si nécessaire pour l'instance...
    getSettings: vi.fn(),
    saveSettings: vi.fn(),
  }))
}));
vi.mock('../../logging/PinoLogger', () => {
  // Mock le constructeur lui-même
  return {
    PinoLogger: vi.fn().mockImplementation(() => ({
      error: mockLogError,
      log: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    }))
  };
});

// --- Fin des mocks ---

describe('RepositoryFactory', () => {

  // Déclarer les variables pour les fonctions importées dynamiquement
  let getConfigurationRepository: () => Promise<any>;
  let getSettingsRepositoryInstance: () => any;
  let getLoggerInstance: () => any;
  // Déclarer les variables pour les constructeurs mockés
  let MockLocalStorageConfigRepo: any;
  let MockApiAdapter: any;
  let MockAppSettingsRepo: any;
  let MockLogger: any;

  beforeEach(async () => {
    // 1. Réinitialiser l'état des modules avant chaque test
    vi.resetModules();

    // 2. Réinitialiser l'état des mocks globaux (fonctions mockées)
    mockGetMode.mockReset();
    mockLogError.mockReset();

    // 3. Importer dynamiquement la factory APRÈS resetModules
    const factoryModule = await import('../RepositoryFactory');
    getConfigurationRepository = factoryModule.getConfigurationRepository;
    getSettingsRepositoryInstance = factoryModule.getSettingsRepositoryInstance;
    getLoggerInstance = factoryModule.getLoggerInstance;

    // 4. Importer dynamiquement les classes mockées pour vérifier les appels constructeur
    // Important : Utiliser les mêmes chemins que dans vi.mock
    MockLocalStorageConfigRepo = (await import('../../adapters/storage/LocalStorageConfigurationRepository')).LocalStorageConfigurationRepository;
    MockApiAdapter = (await import('../../adapters/api/ConfigurationApiAdapter')).ConfigurationApiAdapter;
    MockAppSettingsRepo = (await import('../../adapters/settings/LocalStorageAppSettingsRepository')).LocalStorageAppSettingsRepository;
    MockLogger = (await import('../../logging/PinoLogger')).PinoLogger;

    // 5. S'assurer que les mocks des constructeurs sont aussi réinitialisés
    vi.mocked(MockLocalStorageConfigRepo).mockClear();
    vi.mocked(MockApiAdapter).mockClear();
    vi.mocked(MockAppSettingsRepo).mockClear();
    vi.mocked(MockLogger).mockClear();
  });

  it('getConfigurationRepository should call LocalStorageConfigurationRepository constructor when mode is "local"', async () => {
    mockGetMode.mockResolvedValue('local');
    await getConfigurationRepository();
    expect(mockGetMode).toHaveBeenCalledOnce();
    // Vérifier que le constructeur spécifique a été appelé
    expect(MockLocalStorageConfigRepo).toHaveBeenCalledTimes(1);
    expect(MockApiAdapter).not.toHaveBeenCalled();
  });

  it('getConfigurationRepository should call ConfigurationApiAdapter constructor when mode is "api"', async () => {
    mockGetMode.mockResolvedValue('api');
    await getConfigurationRepository();
    expect(mockGetMode).toHaveBeenCalledOnce();
    expect(MockApiAdapter).toHaveBeenCalledTimes(1);
    expect(MockLocalStorageConfigRepo).not.toHaveBeenCalled();
  });

  it('getConfigurationRepository should call LocalStorageConfigurationRepository constructor on error getting mode', async () => {
    const testError = new Error('Test error fetching mode');
    mockGetMode.mockRejectedValueOnce(testError);

    await getConfigurationRepository();

    expect(mockGetMode).toHaveBeenCalledOnce();
    // Vérifier l'appel au constructeur de fallback
    expect(MockLocalStorageConfigRepo).toHaveBeenCalledTimes(1);
    expect(MockApiAdapter).not.toHaveBeenCalled();
    // Vérifier l'unique log d'erreur consolidé
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to determine app mode or instantiate repository, falling back to local repository'),
      testError
    );
    // Vérifier que le logger a été instancié (nécessaire pour logger l'erreur)
    expect(MockLogger).toHaveBeenCalled();
  });

  it('getSettingsRepositoryInstance should call LocalStorageAppSettingsRepository constructor only once', () => {
    const instance1 = getSettingsRepositoryInstance();
    const instance2 = getSettingsRepositoryInstance();

    expect(MockAppSettingsRepo).toHaveBeenCalledTimes(1); // Singleton check
    expect(instance1).toBeDefined();
    expect(instance2).toBe(instance1); // Should be the same instance
  });

   it('getLoggerInstance should call PinoLogger constructor only once', () => {
    const instance1 = getLoggerInstance();
    const instance2 = getLoggerInstance();

    expect(MockLogger).toHaveBeenCalledTimes(1); // Singleton check
    expect(instance1).toBeDefined();
    expect(instance2).toBe(instance1);
   });
});
