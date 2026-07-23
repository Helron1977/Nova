import React, { useState } from 'react';
import { AIConfig, getAIConfig, saveAIConfig } from '../../../application/logic/configManager';
import Button from '../base/Button';
import { Save, ShieldCheck } from 'lucide-react';

const AdminSettings: React.FC = () => {
  const [config, setConfig] = useState<AIConfig>(getAIConfig());
  const [isSaved, setIsSaved] = useState(false);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig({ ...config, provider: e.target.value as AIConfig['provider'] });
    setIsSaved(false);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, apiKey: e.target.value });
    setIsSaved(false);
  };

  const handleBaseUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, baseUrl: e.target.value });
    setIsSaved(false);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({ ...config, model: e.target.value });
    setIsSaved(false);
  };

  const handleSave = () => {
    saveAIConfig(config);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="flex-grow w-full max-w-2xl mx-auto mt-10 p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center mb-6 text-indigo-600 dark:text-indigo-400">
        <ShieldCheck size={32} className="mr-3" />
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Paramètres Administrateur</h2>
      </div>

      <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-lg">
        <h3 className="text-red-800 dark:text-red-400 font-bold mb-2 flex items-center">
          <ShieldCheck className="mr-2" size={20} />
          Avertissement de Sécurité : Usage Local Uniquement
        </h3>
        <p className="text-red-700 dark:text-red-300 text-sm mb-2">
          Nova est conçu comme un éditeur <strong>Local-First</strong>. La clé API que vous saisissez ici est stockée en clair dans votre navigateur (<code>localStorage</code>) et les appels sont faits directement depuis le client.
        </p>
        <p className="text-red-700 dark:text-red-300 text-sm">
          <strong>NE DÉPLOYEZ PAS</strong> cette application publiquement sur internet avec vos clés API. Si vous souhaitez héberger Nova, supprimez les clés ici et configurez le fournisseur "Autre (Custom)" pour pointer vers votre propre proxy Backend sécurisé.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fournisseur d'IA</label>
          <select 
            value={config.provider}
            onChange={handleProviderChange}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="gemini">Google Gemini</option>
            <option value="ollama">Ollama (Local)</option>
            <option value="custom">Autre (Custom)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Clé API</label>
          <input 
            type="password"
            value={config.apiKey}
            onChange={handleApiKeyChange}
            placeholder="sk-..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modèle cible</label>
          <input 
            type="text"
            value={config.model || ''}
            onChange={handleModelChange}
            placeholder="ex: gpt-4o-mini"
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono"
          />
        </div>

        {(config.provider === 'custom' || config.provider === 'ollama') && (
          <div className="animate-fade-in-up">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">URL de Base (Base URL)</label>
            <input 
              type="url"
              value={config.baseUrl || ''}
              onChange={handleBaseUrlChange}
              placeholder={config.provider === 'ollama' ? "http://localhost:11434/v1" : "https://api.votre-serveur.com/v1"}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono"
            />
          </div>
        )}

        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end items-center">
          {isSaved && <span className="text-green-500 text-sm mr-4 flex items-center"><Check className="mr-1" size={16} /> Enregistré</span>}
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg flex items-center transition-colors shadow-sm">
            <Save size={18} className="mr-2" />
            Sauvegarder la configuration
          </Button>
        </div>
      </div>
    </div>
  );
};

// Lucide check icon pour le composant (on peut l'importer en haut, mais on le déclare inline pour plus de simplicité si oublié)
import { Check } from 'lucide-react';

export default AdminSettings;
