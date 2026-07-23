// src/application/logic/blockRegistry.ts

import type { BlockModule } from '../interfaces/blockModule';
import { PinoLogger } from '../../infrastructure/logging/PinoLogger'; // Ajustez le chemin si nécessaire

const logger = new PinoLogger();

// Utilisation de Maps pour un accès plus efficace et pour stocker par différents identifiants si besoin
const modulesByType = new Map<string, BlockModule<any>>();
const modulesByCodeLanguage = new Map<string, BlockModule<any>>();

/**
 * Enregistre un nouveau module de bloc dans le système.
 * @param moduleInstance L'instance du module de bloc à enregistrer.
 */
export function registerBlockModule(moduleInstance: BlockModule<any>): void {
  if (!moduleInstance || !moduleInstance.type) {
    logger.error('[BlockRegistry] Tentative d\'enregistrement d\'un module invalide.', { moduleInstance });
    return;
  }

  if (modulesByType.has(moduleInstance.type)) {
    logger.warn(`[BlockRegistry] Un module pour le type "${moduleInstance.type}" est déjà enregistré. Il va être écrasé.`);
  }
  modulesByType.set(moduleInstance.type, moduleInstance);
  logger.debug(`[BlockRegistry] Module enregistré pour le type: "${moduleInstance.type}"`);

  // Enregistrer aussi par codeBlockLanguage si défini, sinon utiliser le type comme fallback pour le langage
  const languageKey = moduleInstance.codeBlockLanguage || moduleInstance.type;
  if (modulesByCodeLanguage.has(languageKey) && moduleInstance.codeBlockLanguage) {
    // Avertir seulement si un codeBlockLanguage explicite est écrasé
    logger.warn(`[BlockRegistry] Un module pour le codeBlockLanguage "${languageKey}" est déjà enregistré. Il va être écrasé.`);
  }
  modulesByCodeLanguage.set(languageKey, moduleInstance);
  logger.debug(`[BlockRegistry] Module enregistré pour le codeBlockLanguage: "${languageKey}" (associé au type "${moduleInstance.type}")`);
}

/**
 * Récupère un module de bloc par son identifiant de type.
 * @param type L'identifiant de type du bloc (ex: 'space', 'mermaid').
 * @returns Le module de bloc correspondant ou undefined s'il n'est pas trouvé.
 */
export function getBlockModuleByType<TData = any>(type: string): BlockModule<TData> | undefined {
  return modulesByType.get(type) as BlockModule<TData> | undefined;
}

/**
 * Retourne la liste complète de tous les modules enregistrés.
 */
export function getAllModules(): BlockModule<any>[] {
  return Array.from(modulesByType.values());
}

/**
 * Récupère un module de bloc par le langage spécifié dans un bloc de code Markdown (ex: ```mermaid).
 * @param language Le langage du bloc de code (ex: 'mermaid', 'space').
 * @returns Le module de bloc correspondant ou undefined s'il n'est pas trouvé.
 */
export function getBlockModuleByCodeLanguage<TData = any>(language: string): BlockModule<TData> | undefined {
  return modulesByCodeLanguage.get(language) as BlockModule<TData> | undefined;
}

/**
 * Récupère tous les modules de blocs enregistrés qui sont marqués comme "créables" par l'utilisateur.
 * (Exemple: pour peupler un menu d'ajout de bloc).
 * La logique de "isCreatable" est simplifiée ici, on retourne ceux avec un displayName.
 */
export function getCreatableBlockModules(): BlockModule<any>[] {
  const creatableModules: BlockModule<any>[] = [];
  modulesByType.forEach(moduleInstance => {
    // Un module est considéré comme créable s'il a un displayName et une icône (pour l'UI)
    // ou si sa propriété `isCreatable` est explicitement true.
    // Pour l'instant, on se base sur displayName comme indicateur simple.
    if (moduleInstance.displayName) { // && moduleInstance.icon - on pourrait ajouter cette condition
      creatableModules.push(moduleInstance);
    }
  });
  return creatableModules;
}

/**
 * Récupère toutes les instances de modules enregistrées.
 * @returns Un tableau de tous les modules de blocs enregistrés.
 */
export function getBlockModules(): BlockModule<any>[] {
  return Array.from(modulesByType.values());
}

// Potentiellement, d'autres fonctions utilitaires pour le registre pourraient être ajoutées ici. 