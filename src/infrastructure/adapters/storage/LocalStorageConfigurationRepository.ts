import { Configuration, ConfigurationContent } from '../../../domain';
import { IConfigurationRepository } from '../../../application/ports/repositories';
import { ILogger } from '../../../application/ports/logging';
import { PinoLogger } from '../../logging/PinoLogger';

const LOCAL_STORAGE_KEY = 'nova_demo_configuration';
const DEMO_CONFIG_NAME = "Configuration de démonstration";

// Structure de base pour la configuration de démonstration
const DEFAULT_DEMO_CONFIG: Configuration = {
  _id: 'demo-config',
  name: DEMO_CONFIG_NAME,
  preprompt: 'Créer un diagramme simple.',
  api: { url: '', key: '' }, // Pas d'API en mode démo
  content: JSON.stringify({
    markdown: `# Guide d\'utilisation rapide\n\nCeci est la configuration de démonstration.`, 
    mermaid: `graph TD\n    A[Éditer Code Mermaid] --> B{Prévisualiser};\n    B --> C[Sauvegarder/Exporter];`,
    timestamp: new Date().toISOString(),
  } as ConfigurationContent)
  // created_at et updated_at peuvent être omis ou gérés si nécessaire
};

/**
 * Implémentation du repository de configuration utilisant le Local Storage.
 * Gère principalement la configuration de démonstration pour le mode local.
 */
export class LocalStorageConfigurationRepository implements IConfigurationRepository {

  private readonly logger: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger || new PinoLogger();
    this.initializeDemoConfig();
  }

  private getConfigFromStorage(): Configuration | null {
    try {
      const item = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (item) {
        const config = JSON.parse(item) as Configuration;
        this.logger.debug('Configuration loaded from localStorage', config);
        return config;
      }
    } catch (error) {
      this.logger.error('Error reading configuration from localStorage:', error as Error);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    return null;
  }

  private saveConfigToStorage(config: Configuration): void {
    try {
      let contentToSave = config.content;
      if (typeof contentToSave !== 'string') {
        this.logger.warn('Content was not a string, attempting to stringify before saving to localStorage.');
        try {
             contentToSave = JSON.stringify(contentToSave);
        } catch (e) {
            this.logger.error('Failed to stringify config.content before saving', e as Error);
            throw e;
        }
      }
      const configWithStrContent = { ...config, content: contentToSave };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(configWithStrContent));
      this.logger.debug('Configuration saved to localStorage', configWithStrContent);
    } catch (error) {
      this.logger.error('Error saving configuration to localStorage:', error as Error);
    }
  }

  private initializeDemoConfig() {
    const config = this.getConfigFromStorage();
    if (!config) {
      this.logger.log('Initializing demo configuration in localStorage.');
      this.saveConfigToStorage(DEFAULT_DEMO_CONFIG);
    }
  }

  /**
   * Retourne uniquement le nom de la configuration de démonstration.
   */
  async getAllNames(): Promise<string[]> {
    this.logger.debug('getAllNames called (local mode)');
    return Promise.resolve([DEMO_CONFIG_NAME]);
  }

  /**
   * Récupère la configuration par son nom (ne fonctionne que pour la démo).
   */
  async findByName(name: string): Promise<Configuration | null> {
    this.logger.debug(`findByName called with name: ${name}`);
    if (name !== DEMO_CONFIG_NAME) {
      this.logger.warn(`Config name "${name}" not found in local mode.`);
      return Promise.resolve(null);
    }
    const config = this.getConfigFromStorage();
    return Promise.resolve(config);
  }

  /**
   * Récupère la configuration par ID (ne fonctionne que pour la démo).
   */
  async findById(id: string): Promise<Configuration | null> {
    this.logger.debug(`findById called with id: ${id}`);
    if (id !== DEFAULT_DEMO_CONFIG._id) {
        this.logger.warn(`Config id "${id}" not found in local mode.`);
        return Promise.resolve(null);
    }
    return this.findByName(DEMO_CONFIG_NAME);
  }

  /**
   * Sauvegarde la configuration (ne met à jour que la démo).
   */
  async save(config: Configuration): Promise<void> {
    this.logger.debug(`save called for config name: ${config.name}`);
    if (config.name !== DEMO_CONFIG_NAME) {
        this.logger.warn(`Attempted to save config with name ${config.name} in local mode. Only ${DEMO_CONFIG_NAME} is supported.`);
        return Promise.resolve();
    }
    const configToSave = {
        ...config,
        _id: DEFAULT_DEMO_CONFIG._id,
        name: DEMO_CONFIG_NAME
    };
    this.saveConfigToStorage(configToSave);
    this.logger.log(`Demo configuration updated.`);
    return Promise.resolve();
  }

  /**
   * Supprime la configuration par ID (désactivé pour la démo).
   */
  async deleteById(id: string): Promise<void> {
    this.logger.debug(`deleteById called with id: ${id}`);
    this.logger.warn('Deletion is not supported in local demo mode.');
    return Promise.resolve();
  }
}

// Exporter une instance ou la classe selon la stratégie d'injection de dépendances
// export default new LocalStorageConfigurationRepository(); 