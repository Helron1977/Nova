import { Configuration } from '../../domain';

/**
 * Port définissant les opérations possibles sur les entités Configuration.
 * Les adaptateurs (LocalStorage, API) devront implémenter cette interface.
 */
export interface IConfigurationRepository {
  /**
   * Récupère toutes les configurations disponibles (ou leurs noms/IDs pour une liste).
   * Le mode "local" pourrait retourner une seule config de démo.
   * Le mode "api" appellerait le backend.
   */
  // Option 1: Retourner les objets complets (peut être lourd si beaucoup de configs)
  // getAll(): Promise<Configuration[]>;

  // Option 2: Retourner juste les noms ou IDs pour peupler le menu déroulant
  getAllNames(): Promise<string[]>;

  /**
   * Récupère une configuration par son nom.
   * Utile pour charger la configuration sélectionnée dans le menu déroulant.
   */
  findByName(name: string): Promise<Configuration | null>;

  /**
   * Récupère une configuration par son ID (utile si on gère des IDs uniques).
   */
  findById(id: string): Promise<Configuration | null>;

  /**
   * Sauvegarde une configuration (création ou mise à jour).
   * L'adaptateur déterminera s'il faut créer ou mettre à jour (basé sur _id?).
   */
  save(config: Configuration): Promise<void>;

  /**
   * Supprime une configuration par son ID.
   * Pertinent surtout en mode Admin / API.
   */
  deleteById(id: string): Promise<void>;

  // TODO: Ajouter d'autres méthodes si nécessaire (ex: méthodes spécifiques au mode admin?)
}

// TODO: Définir les interfaces pour les autres repositories (IDocumentRepository, IDiagramRepository) si nécessaire.