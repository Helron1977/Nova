import { describe, it, expect, vi, beforeEach, Mock, afterEach } from 'vitest';
import { LocalStorageConfigurationRepository } from '../LocalStorageConfigurationRepository';
import { Configuration, ConfigurationContent } from '../../../../domain'; // Ajuster chemin si besoin
import { ILogger } from '../../../../application/ports/logging';

// Mocker le Logger
const mockLogger: ILogger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Constantes du module testé
const LOCAL_STORAGE_KEY = 'nova_demo_configuration';
const DEMO_CONFIG_NAME = "Configuration de démonstration";
const FIXED_TIMESTAMP = '2024-01-01T12:00:00.000Z'; // Timestamp fixe pour les tests

const DEFAULT_DEMO_CONFIG: Configuration = {
    _id: 'demo-config',
    name: DEMO_CONFIG_NAME,
    preprompt: 'Créer un diagramme simple.',
    api: { url: '', key: '' },
    content: JSON.stringify({
        markdown: `# Guide d\'utilisation rapide\n\nCeci est la configuration de démonstration.`,
        mermaid: `graph TD\n    A[Éditer Code Mermaid] --> B{Prévisualiser};\n    B --> C[Sauvegarder/Exporter];`,
        timestamp: FIXED_TIMESTAMP // Utiliser la constante fixe ici
    } as ConfigurationContent)
};

describe('LocalStorageConfigurationRepository', () => {
  let repository: LocalStorageConfigurationRepository;
  let mockLocalStorage: Storage;
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete storage[key]; }),
      clear: vi.fn(() => { storage = {}; }),
      key: vi.fn((index: number) => Object.keys(storage)[index] ?? null),
      get length() { return Object.keys(storage).length; }
    };
    vi.stubGlobal('localStorage', mockLocalStorage);

    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_TIMESTAMP));

    // Appeler le constructeur
    repository = new LocalStorageConfigurationRepository(mockLogger);
    
    // Vérifier ICI l'effet de l'initialisation si nécessaire, mais ne pas nettoyer les mocks tout de suite
    // Par exemple, on pourrait vérifier que setItem a été appelé si getItem a retourné null
    // if (mockLocalStorage.getItem(LOCAL_STORAGE_KEY) === null) {
    //    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    // }

    // Nettoyer les mocks seulement APRES l'instanciation, juste avant les tests individuels
    // Mais attention, si on nettoie ici, on perd l'historique de l'initialisation.
    // Il vaut mieux ne pas nettoyer ici et ajuster les tests qui s'attendent à un historique vierge.
    // vi.clearAllMocks(); <-- NE PAS NETTOYER ICI si on veut tester l'effet du constructeur
  });

  afterEach(() => {
      vi.clearAllMocks();
      vi.useRealTimers(); // Déjà présent, mais bon de le garder groupé
  });

  it('getAllNames should return only the demo config name', async () => {
    const names = await repository.getAllNames();
    expect(names).toEqual([DEMO_CONFIG_NAME]);
    expect(mockLogger.debug).toHaveBeenCalledWith('getAllNames called (local mode)');
  });

  // --- Tests pour findByName ---
  it('findByName should return null for non-demo name', async () => {
    const result = await repository.findByName('non-existent');
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith('Config name "non-existent" not found in local mode.');
  });

  it('findByName should return default demo config (already initialized by constructor)', async () => {
    // Le constructeur a déjà initialisé si le storage était vide.
    const result = await repository.findByName(DEMO_CONFIG_NAME);

    expect(result).toBeDefined();
    expect(result?._id).toBe(DEFAULT_DEMO_CONFIG._id);
    expect(result?.name).toBe(DEFAULT_DEMO_CONFIG.name);
    
    // getItem a été appelé par le constructeur (via initialize -> getConfig) ET par findByName -> getConfig
    expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(2); 
    // setItem a été appelé SEULEMENT par le constructeur (1 fois)
    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1); // <-- Doit maintenant être 1
  });

  it('findByName should return demo config from PRE-FILLED storage', async () => {
    // Pré-remplir AVANT l'instanciation pour tester le cas où le constructeur ne fait rien
    storage[LOCAL_STORAGE_KEY] = JSON.stringify({ ...DEFAULT_DEMO_CONFIG, preprompt: 'Stored Preprompt' });
    
    // Recréer l'instance avec le storage pré-rempli
    repository = new LocalStorageConfigurationRepository(mockLogger);
    vi.clearAllMocks(); // Effacer les mocks APRES cette nouvelle instanciation

    const result = await repository.findByName(DEMO_CONFIG_NAME);
    
    expect(result?.preprompt).toBe('Stored Preprompt');
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith(LOCAL_STORAGE_KEY);
    // setItem ne doit PAS avoir été appelé ni par le constructeur, ni par findByName
    expect(mockLocalStorage.setItem).not.toHaveBeenCalled(); 
  });

  // --- Tests pour findById ---
  it('findById should return null for non-demo id', async () => {
    const result = await repository.findById('invalid-id');
    expect(result).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalledWith('Config id "invalid-id" not found in local mode.');
  });

  it('findById should return demo config (already initialized by constructor)', async () => {
     // Le constructeur a déjà initialisé
    const result = await repository.findById(DEFAULT_DEMO_CONFIG._id);

    expect(result).toBeDefined();
    expect(result?._id).toBe(DEFAULT_DEMO_CONFIG._id);
    // getItem a été appelé par constructeur (1) + findById->findByName->getConfig (1) = 2 fois
    expect(mockLocalStorage.getItem).toHaveBeenCalledTimes(2); 
    // setItem a été appelé une fois par le constructeur
    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1); // <-- Doit maintenant être 1
  });

  // --- Tests pour save ---
  it('save should update the demo config in storage if name matches', async () => {
    // L'instance est créée, l'initialisation a eu lieu (setItem appelé 1 fois)
    const initialContent = JSON.parse(DEFAULT_DEMO_CONFIG.content) as ConfigurationContent;
    const updatedContent: ConfigurationContent = { ...initialContent, markdown: 'Updated Markdown' };
    const configToSave: Configuration = {
      ...DEFAULT_DEMO_CONFIG,
      content: JSON.stringify(updatedContent)
    };

    await repository.save(configToSave);

    const expectedSavedConfig = {
        ...configToSave,
        _id: DEFAULT_DEMO_CONFIG._id,
        name: DEMO_CONFIG_NAME
    }

    // setItem a été appelé 1x par constructeur + 1x par save = 2 fois au total
    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2); 
    // Le DERNIER appel doit être celui de save
    expect(mockLocalStorage.setItem).toHaveBeenLastCalledWith(LOCAL_STORAGE_KEY, JSON.stringify(expectedSavedConfig));
    expect(mockLogger.log).toHaveBeenCalledWith('Demo configuration updated.');
  });

  it('save should automatically stringify content if passed as object', async () => {
    const updatedContentObj = { markdown: 'New MD', mermaid: 'New MMD', timestamp: FIXED_TIMESTAMP };
    const configToSave = {
        ...DEFAULT_DEMO_CONFIG,
        content: updatedContentObj as any 
    };

    await repository.save(configToSave);

    // setItem appelé 1x par constructeur + 1x par save = 2 fois
    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
    const savedString = (mockLocalStorage.setItem as Mock).mock.calls[1][1]; // Le 2e appel (index 1)
    const savedObject = JSON.parse(savedString);
    expect(typeof savedObject.content).toBe('string');
    expect(JSON.parse(savedObject.content)).toEqual(updatedContentObj);
    expect(mockLogger.log).toHaveBeenCalledWith('Demo configuration updated.');
  });

  it('save should log warning and not save if name does not match demo config', async () => {
    const configToSave: Configuration = { ...DEFAULT_DEMO_CONFIG, name: 'Wrong Name' };
    await repository.save(configToSave);
    // setItem a été appelé 1 fois par le constructeur, mais PAS par ce save
    expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Attempted to save config with name Wrong Name`));
  });

  it('deleteById should log warning and do nothing', async () => {
    await repository.deleteById(DEFAULT_DEMO_CONFIG._id);
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Deletion is not supported in local demo mode.');

    await repository.deleteById('other-id');
    expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Deletion is not supported in local demo mode.');
  });
}); 