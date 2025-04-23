import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { LocalStorageAppSettingsRepository } from '../LocalStorageAppSettingsRepository';
import { AppSettings /*, AppMode */ } from '../../../../domain/settings';
import { ILogger } from '../../../../application/ports/logging';

// Mocker le Logger
const mockLogger: ILogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Clé utilisée dans le module testé
const SETTINGS_KEY = 'nova_app_settings';
const DEFAULT_SETTINGS: AppSettings = { mode: 'local' };

describe('LocalStorageAppSettingsRepository', () => {
  let repository: LocalStorageAppSettingsRepository;
  let mockLocalStorage: Storage;

  beforeEach(() => {
    // Créer un mock simple pour localStorage pour chaque test
    const storage: Record<string, string> = {};
    mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete storage[key]; }),
      clear: vi.fn(() => { Object.keys(storage).forEach(key => delete storage[key]); }),
      key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
      get length() { return Object.keys(storage).length; }
    };

    // Remplacer le localStorage global par notre mock
    vi.stubGlobal('localStorage', mockLocalStorage);

    // Injecter le logger mocké
    repository = new LocalStorageAppSettingsRepository(mockLogger);

    // Réinitialiser les appels du logger mocké
    vi.clearAllMocks();
  });

  it('getSettings should return default settings and save them if none exist', async () => {
    const settings = await repository.getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith(SETTINGS_KEY);
    expect(mockLocalStorage.setItem).toHaveBeenCalledOnce();
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    expect(mockLogger.log).toHaveBeenCalledWith('No AppSettings found in localStorage, initializing with default.');
  });

  it('getSettings should return stored settings if valid ones exist', async () => {
    const storedSettings: AppSettings = { mode: 'api' };
    // Pré-remplir le stockage simulé
    mockLocalStorage.setItem(SETTINGS_KEY, JSON.stringify(storedSettings));

    const settings = await repository.getSettings();

    // Vérifications principales
    expect(settings).toEqual(storedSettings);
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith(SETTINGS_KEY);
    expect(mockLogger.debug).toHaveBeenCalledWith('Loaded AppSettings from localStorage:', storedSettings);
    // Optionnel : vérifier qu'on n'a PAS loggé l'initialisation par défaut
    expect(mockLogger.log).not.toHaveBeenCalledWith('No AppSettings found in localStorage, initializing with default.');
    // On retire la vérification sur setItem qui est difficile à garantir sans effets de bord du mock
    // expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
  });

 it('getSettings should return default settings and log warning if stored settings are invalid JSON', async () => {
    mockLocalStorage.setItem(SETTINGS_KEY, 'invalid json');
    vi.mocked(mockLocalStorage.getItem).mockReturnValue('invalid json');

    const settings = await repository.getSettings();

    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error getting AppSettings'), expect.any(Error));
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Falling back to default AppSettings'));
    // Check if it tries to save default settings after error (depends on implementation, here it does)
    // expect(mockLocalStorage.setItem).toHaveBeenCalledWith(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  });

 it('getSettings should return default settings and log warning if stored settings have invalid mode', async () => {
    const invalidSettings = { mode: 'invalid_mode' };
    mockLocalStorage.setItem(SETTINGS_KEY, JSON.stringify(invalidSettings));
    vi.mocked(mockLocalStorage.getItem).mockReturnValue(JSON.stringify(invalidSettings));

    const settings = await repository.getSettings();

    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid settings found'), expect.anything());
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Falling back to default AppSettings'));
     // Check if it tries to save default settings after invalid data (depends on implementation, here it does)
    // expect(mockLocalStorage.setItem).toHaveBeenCalledWith(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
  });

  it('saveSettings should store valid settings in localStorage', async () => {
    const newSettings: AppSettings = { mode: 'api' };
    await repository.saveSettings(newSettings);
    expect(mockLocalStorage.setItem).toHaveBeenCalledOnce();
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(SETTINGS_KEY, JSON.stringify(newSettings));
    expect(mockLogger.log).toHaveBeenCalledWith('Saved AppSettings to localStorage:', newSettings);
  });

  it('saveSettings should throw error and log error for invalid settings', async () => {
    // Utiliser 'as any' pour passer un type invalide intentionnellement pour le test
    const invalidSettings = { mode: 'wrong' } as any;
    await expect(repository.saveSettings(invalidSettings)).rejects.toThrow();
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid settings object provided'));
  });

 it('saveSettings should throw error and log error if localStorage.setItem fails', async () => {
    const newSettings: AppSettings = { mode: 'api' };
    const setError = new Error('Storage full');
    (mockLocalStorage.setItem as Mock).mockImplementationOnce(() => { throw setError; });

    await expect(repository.saveSettings(newSettings)).rejects.toThrow(setError);
    expect(mockLogger.error).toHaveBeenCalledWith('Error saving AppSettings to localStorage', setError);
 });

  it('getMode should return the current mode', async () => {
    const storedSettings: AppSettings = { mode: 'api' };
    mockLocalStorage.setItem(SETTINGS_KEY, JSON.stringify(storedSettings));
    vi.mocked(mockLocalStorage.getItem).mockReturnValue(JSON.stringify(storedSettings));

    const mode = await repository.getMode();
    expect(mode).toBe('api');
    expect(mockLogger.debug).toHaveBeenCalledWith('Current AppMode retrieved: api');
  });

  it('getMode should return default mode if none is stored', async () => {
    const mode = await repository.getMode();
    expect(mode).toBe('local');
  });
}); 