// Structure détaillée basée sur l'analyse de configscopy.json

/**
 * Représente le contenu éditable principal d'une configuration,
 * stocké comme une chaîne JSON sérialisée dans l'objet Configuration principal.
 */
export interface ConfigurationContent {
  markdown: string;
  mermaid: string;
  timestamp?: string; // ISO 8601
}

/**
 * Représente l'ensemble des paramètres et du contenu pour un cas d'usage
 * de l'application NOVA.
 */
export interface Configuration {
  _id: string; // Identifiant unique (provenant de la source de données legacy)
  name: string;
  preprompt?: string; // Optionnel
  api?: {            // Optionnel
    url?: string;
    key?: string;
  };
  /**
   * Attention : Contient une chaîne JSON qui doit être parsée
   * pour obtenir un objet ConfigurationContent.
   */
  content: string;
  created_at?: {      // Optionnel, format legacy
    "$$date": number; // Timestamp ms
  };
  updated_at?: {      // Optionnel, format legacy
    "$$date": number; // Timestamp ms
  };
}