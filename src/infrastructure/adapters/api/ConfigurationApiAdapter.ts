// @ts-expect-error: TSC build struggles with unused import detection sometimes
import { Configuration, ConfigurationContent } from '../../../domain';
import { IConfigurationRepository } from '../../../application/ports/repositories';
import { ILogger } from '../../../application/ports/logging';
import { PinoLogger } from '../../logging/PinoLogger';

const API_BASE_URL = 'http://localhost:3000/api'; // Assumer que le serveur API tourne sur le port 3000

/**
 * Implémentation du repository de configuration utilisant une API REST externe.
 */
export class ConfigurationApiAdapter implements IConfigurationRepository {
  private readonly logger: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger || new PinoLogger();
  }

  private async handleApiResponse<T>(response: Response): Promise<T | null> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      this.logger.error(`API Error ${response.status}: ${errorData?.message || response.statusText}`, errorData);
      // On pourrait lancer une erreur spécifique ici pour une meilleure gestion en amont
      // throw new Error(`API Error ${response.status}: ${errorData?.message || response.statusText}`);
      return null;
    }
    // Gérer le cas 204 No Content (pour DELETE)
    if (response.status === 204) {
        return null as T; // Retourner null ou une valeur indiquant le succès sans contenu
    }
    try {
        return await response.json() as T;
    } catch (error) {
        this.logger.error('Failed to parse API response JSON', error as Error);
        return null;
    }
  }

  /**
   * Récupère tous les noms de configuration depuis l'API.
   */
  async getAllNames(): Promise<string[]> {
    this.logger.debug('Fetching all configuration names from API...');
    try {
      const response = await fetch(`${API_BASE_URL}/configs`);
      const configs = await this.handleApiResponse<Configuration[]>(response);
      if (configs) {
        return configs.map(config => config.name);
      }
    } catch (error) {
      this.logger.error('Network or fetch error in getAllNames', error as Error);
    }
    return []; // Retourner un tableau vide en cas d'erreur
  }

  /**
   * Récupère une configuration par son nom en filtrant côté client.
   */
  async findByName(name: string): Promise<Configuration | null> {
    this.logger.debug(`Fetching configuration by name "${name}" from API...`);
    try {
      // L'API ne fournit pas de findByName, on récupère tout et on filtre
      const response = await fetch(`${API_BASE_URL}/configs`);
      const configs = await this.handleApiResponse<Configuration[]>(response);
      if (configs) {
        const foundConfig = configs.find(config => config.name === name);
        if (foundConfig) {
            return foundConfig;
        }
      }
    } catch (error) {
      this.logger.error(`Network or fetch error in findByName for name: ${name}`, error as Error);
    }
    this.logger.warn(`Configuration with name "${name}" not found via API.`);
    return null;
  }

  /**
   * Récupère une configuration par son ID.
   */
  async findById(id: string): Promise<Configuration | null> {
    this.logger.debug(`Fetching configuration by ID "${id}" from API...`);
    try {
      const response = await fetch(`${API_BASE_URL}/configs/${id}`);
      return await this.handleApiResponse<Configuration>(response);
    } catch (error) {
      this.logger.error(`Network or fetch error in findById for ID: ${id}`, error as Error);
      return null;
    }
  }

  /**
   * Sauvegarde une configuration (création ou mise à jour via POST ou PUT).
   * Pour simplifier, on utilise POST pour créer (sans ID) et PUT pour mettre à jour (avec ID).
   * La logique exacte pourrait dépendre de comment l'UI gère les IDs.
   */
  async save(config: Configuration): Promise<void> {
    // Assurer que le content est bien une string JSON
    if (typeof config.content !== 'string') {
        this.logger.error('ConfigurationApiAdapter: config.content must be a stringified JSON.');
         try {
             config.content = JSON.stringify(config.content);
        } catch (e) {
            this.logger.error('Failed to stringify config.content before saving', e as Error);
            return; // Ne pas envoyer si la conversion échoue
        }
    }

    // Si l'ID existe et n'est pas un placeholder (comme 'demo-config'), on assume une mise à jour
    const isUpdate = config._id && config._id !== 'demo-config'; // Adapter si besoin
    const url = isUpdate ? `${API_BASE_URL}/configs/${config._id}` : `${API_BASE_URL}/configs`;
    const method = isUpdate ? 'PUT' : 'POST';

    this.logger.debug(`${method} request to ${url}...`, config);

    try {
        // Préparer les données pour l'API PUT (qui attend apiUrl/apiKey)
        const bodyData: any = {
            name: config.name,
            content: config.content,
            preprompt: config.preprompt
        };
        if (config.api) { // Envoyer les clés séparément comme attendu par le PUT
            bodyData.apiUrl = config.api.url;
            bodyData.apiKey = config.api.key;
        }
        if (!isUpdate) { // Si création (POST), on peut envoyer l'objet api directement
            bodyData.api = config.api;
        }

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyData),
        });

        const result = await this.handleApiResponse(response);
        if(response.ok) {
            this.logger.log(`Configuration ${isUpdate ? 'updated' : 'created'} successfully via API.`, result);
        } else {
             this.logger.error(`Failed to ${isUpdate ? 'update' : 'create'} configuration via API.`);
        }

    } catch (error) {
      this.logger.error(`Network or fetch error during ${method} to ${url}`, error as Error);
    }
  }

  /**
   * Supprime une configuration par son ID.
   */
  async deleteById(id: string): Promise<void> {
    this.logger.debug(`Deleting configuration with ID "${id}" via API...`);
    try {
      const response = await fetch(`${API_BASE_URL}/configs/${id}`, {
        method: 'DELETE',
      });
      // handleApiResponse gère la réponse (y compris 204)
      await this.handleApiResponse(response);
       if(response.ok) {
            this.logger.log(`Configuration with ID "${id}" deleted successfully via API.`);
        } else {
             this.logger.error(`Failed to delete configuration with ID "${id}" via API.`);
        }
    } catch (error) {
      this.logger.error(`Network or fetch error during DELETE for ID: ${id}`, error as Error);
    }
  }
}

// export default new ConfigurationApiAdapter(); 