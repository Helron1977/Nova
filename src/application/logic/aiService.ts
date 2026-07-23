import { getAIConfig } from './configManager';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModelV4 } from '@ai-sdk/provider';

/**
 * ATTENTION SÉCURITÉ : DIRECT BROWSER API CALLS
 * Cette fonction instancie les modèles IA directement depuis le navigateur.
 * Cela signifie que les clés API circulent en clair dans le code client.
 * 
 * Cette approche est STRICTEMENT réservée à un usage "Local-First" (ordinateur personnel).
 * En cas de déploiement public, cette architecture est une faille de sécurité majeure (vol de clés).
 * Il faudra configurer un Proxy Backend (via l'option 'custom') pour cacher la clé côté serveur.
 */
export function getLanguageModel(): LanguageModelV4 | null {
  const config = getAIConfig();
  
  if (!config.apiKey && config.provider !== 'ollama' && config.provider !== 'custom') {
    return null; // Clé manquante
  }

  try {
    switch (config.provider) {
      case 'gemini': {
        const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
        let modelId = config.model?.trim() || 'gemini-1.5-flash-latest';
        if (modelId.startsWith('models/')) modelId = modelId.replace('models/', '');
        return google(modelId);
      }
      case 'openai':
      case 'custom':
      case 'ollama': {
        let baseUrl = config.baseUrl || 'https://api.openai.com/v1';
        if (config.provider === 'ollama' && !config.baseUrl) {
          baseUrl = 'http://localhost:11434/v1';
        }
        const openai = createOpenAI({ apiKey: config.apiKey || 'ollama', baseURL: baseUrl });
        return openai(config.model || 'gpt-4o-mini');
      }
      case 'anthropic': {
        // ATTENTION: Anthropic bloque par défaut les appels directs depuis le navigateur via CORS
        // car c'est une très mauvaise pratique de sécurité pour des applications web publiques.
        // L'en-tête 'anthropic-dangerous-direct-browser-access' force le contournement.
        // NE PAS UTILISER en production publique.
        const anthropic = createAnthropic({ 
          apiKey: config.apiKey, 
          baseURL: config.baseUrl,
          headers: {
            'anthropic-dangerous-direct-browser-access': 'true'
          }
        });
        return anthropic(config.model || 'claude-3-5-sonnet-20240620');
      }
      default:
        return null;
    }
  } catch (error) {
    console.error('Error creating LanguageModel:', error);
    return null;
  }
}
