export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * ATTENTION SÉCURITÉ :
 * Les clés d'API sont stockées en clair dans le localStorage.
 * Ce mécanisme n'est sûr que dans le cadre d'un usage purement local (Local-First, Electron-like, usage personnel).
 * En cas de déploiement public (SaaS), cette méthode expose les clés aux attaques XSS.
 * Pour une production publique, les clés doivent être retirées du client et un proxy backend doit être utilisé.
 */
const CONFIG_KEY = 'nova_ai_config';

const defaultConfig: AIConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
};

export const getAIConfig = (): AIConfig => {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      return { ...defaultConfig, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to parse AI config from local storage', error);
  }
  return defaultConfig;
};

export const saveAIConfig = (config: AIConfig): void => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save AI config to local storage', error);
  }
};
