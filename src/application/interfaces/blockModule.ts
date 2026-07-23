import type React from 'react';
import type { Block } from '../logic/markdownParser'; // Assumant que Block est exporté


/**
 * Props génériques pour les composants qui rendent un bloc dans l'éditeur.
 */
export interface BlockRendererProps<TData = Record<string, any>> {
  block: Block; // Le bloc complet, incluant son ID, type, etc.
  customData: TData; // Les données parsées spécifiques à ce type de bloc custom
  style?: React.CSSProperties;
}

/**
 * Props génériques pour les composants d'édition spécifiques à un bloc.
 * Actuellement moins défini, car cela dépendra beaucoup du bloc.
 */
export interface BlockEditorProps<TData = Record<string, any>> {
  blockId: string;
  initialData: TData;
  onSave: (newData: TData) => void; // Sauvegarde les données structurées
  onCancel: () => void;
  // ... autres props spécifiques à l'éditeur
}

/**
 * Définit la structure qu'un module de bloc custom doit fournir pour s'intégrer au système.
 */
export interface BlockModule<TData = Record<string, any>, TRawContent = string> {
  // Identifiant unique du type de bloc (ex: 'space', 'mermaid', 'customDiagram')
  // Ce type sera utilisé pour le champ `block.type` après parsing.
  type: string;

  // Le "langage" utilisé dans les blocs de code Markdown (ex: ```space) pour identifier ce type de bloc.
  // Si non défini, le `type` sera utilisé pour matcher le langage.
  codeBlockLanguage?: string;
  menuIcon?: React.ElementType; // NOUVEAU: Icône pour le menu "+"

  // NOUVEAU: Pour intégration automatique dans la Command Palette (Ctrl+K)
  paletteLabel?: string;
  paletteKeyword?: string;

  // Fonction pour parser le contenu brut d'un bloc de code en données structurées.
  // Prend la chaîne de contenu (ex: "h=30") et l'ID du bloc.
  // Retourne un objet de données (TData) pour ce bloc.
  parseContent: (rawContent: TRawContent, blockId: string) => TData;

  // Le composant React pour rendre le bloc dans l'éditeur.
  // Ce composant recevra les props définies dans BlockRendererProps<TData>.
  RendererComponent: React.ComponentType<BlockRendererProps<TData>>;

  /** Optionnel: Le composant React à utiliser pour éditer le bloc. */
  EditorComponent?: React.ComponentType<BlockEditorProps<TData>>;

  /** 
   * Optionnel: Sérialise les données structurées du bloc en sa représentation Markdown brute 
   * (généralement pour le contenu d'un bloc de code).
   * Si non fourni, le système peut se baser sur le rawMarkdown original ou une autre stratégie.
   */
  serializeContent?: (customData: TData) => string;

  // Optionnel: Fonction pour générer le HTML spécifique pour l'export de ce bloc.
  // Particulièrement utile si l'approche "extraire le HTML de React" n'est pas suffisante ou pas utilisée pour ce bloc.
  // Le `markedInstance` pourrait être passé pour permettre au bloc d'utiliser le parseur Markdown pour son contenu interne.
  serializeToHTML?: (data: TData, blockId: string, markedInstance?: any) => string;

  // Optionnel: Icône (nom de composant ou SVG string) pour le menu d'ajout de bloc.
  icon?: React.ElementType | string; // Permet plus de flexibilité

  // Optionnel: Nom d'affichage du bloc dans les menus.
  displayName?: string;

  // Optionnel: Indique si ce type de bloc peut être créé via le menu "Ajouter bloc".
  // Par défaut à true si `displayName` et `icon` sont fournis.
  // isCreatable?: boolean;

  // Optionnel: Valeur initiale par défaut pour le contenu brut lorsque ce bloc est créé.
  // Ex: pour 'space', pourrait être "h=20"
  defaultRawContent?: string;

  // NOUVEAU: Optionnel: Fonction pour créer les données customisées par défaut pour ce type de bloc.
  // Utilisé lors de la création d'un nouveau bloc pour initialiser customBlockData.
  createDefaultCustomData?: () => TData;

  // NOUVEAU: Optionnel: Fonction pour mettre à jour une instance de bloc à partir de sa source brute.
  // Prend le bloc actuel, la nouvelle source brute, et l'ID du bloc.
  // Retourne une nouvelle instance du bloc mise à jour.
  updateBlockFromSource?: (currentBlock: Block, rawSource: string, blockId: string) => Block;

  // NOUVEAU: Optionnel: Fonction pour fournir une représentation allégée du bloc pour l'IA (AST).
  // Permet de résumer les informations pertinentes et de masquer les données brutes trop lourdes (ex: SVG, Map data).
  getAIASTNode?: (block: Block) => Record<string, any>;

  // NOUVEAU: Optionnel: Instructions spécifiques à ce bloc destinées au "System Prompt" de l'IA.
  // Sera agrégé dans le contexte LLM pour apprendre à l'IA comment manipuler ce bloc.
  getAIPrompt?: () => string;

  // Optionnel: Le langage utilisé dans un bloc de code (ex: ```mermaid) 
  // qui doit être géré par ce module. 
  // codeLanguage?: string; // Supprimé car redondant avec codeBlockLanguage et moins précis.

  // menuIcon?: React.ElementType; // NOUVEAU: Icône pour le menu "+"  <-- Déplacé plus haut
} 