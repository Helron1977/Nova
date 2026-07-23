import React, { useRef, useState } from 'react';
import { useUiStore } from '../../../application/state/uiStore';
import { useAuthStore } from '../../../application/state/authStore';
import HelpModal from './HelpModal';
import { Download } from 'lucide-react'; // Supprimé: Trash2, Rows, CheckSquare

import logoImage from '@/assets/images/nova.svg';

// MODIFIÉ: Interface pour les props (sans les props de sélection)
interface HeaderProps {
  onLoadMarkdown: (content: string) => void;
  onExport: () => void;
  onExportAST?: () => void; // NOUVEAU: handler pour exporter l'AST
  hasUnsavedChanges: boolean;
  // Les props liées à la sélection ont été retirées
}

const Header: React.FC<HeaderProps> = ({
  onLoadMarkdown,
  onExport,
  onExportAST,
  hasUnsavedChanges,
}) => {
  const { theme, toggleTheme, appMode, setAppMode } = useUiStore();
  const { user, isLoading, error, signInWithGoogle, logout } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const toggleHelpModal = () => {
    setIsHelpModalOpen(!isHelpModalOpen);
  };

  const renderAuthSection = () => {
    if (isLoading) {
      return <span className="text-xs opacity-75 mr-3">Chargement...</span>;
    }
    if (error) {
      return <span className="text-xs text-red-400 mr-3">Erreur Auth</span>;
    }
    if (user) {
      return (
        <div className="flex items-center mr-3">
          <span className="text-sm mr-2 hidden sm:inline">{user.displayName || user.email}</span>
          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white text-xs py-1 px-3 rounded-full transition-colors duration-200"
            title="Se déconnecter"
          >
            Déconnexion
          </button>
        </div>
      );
    } else {
      return (
        <button
          onClick={signInWithGoogle}
          className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-3 rounded-full transition-colors duration-200 mr-3"
          title="Se connecter avec Google"
        >
          Connexion Google
        </button>
      );
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content !== null && content !== undefined) {
        onLoadMarkdown(content);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.onerror = (e) => {
      console.error("Erreur de lecture du fichier", e);
      alert("Erreur lors de la lecture du fichier.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
    reader.readAsText(file);
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 via-red-700 to-yellow-500 text-white p-3 shadow-md flex justify-between items-center print:hidden">
      <div className="flex items-center font-bold text-lg tracking-wide">
        <img src={logoImage} alt="Logo Nova" height="48" className="h-12 mr-2" />
        <span className="text-xl font-semibold text-white dark:text-gray-200">Nova</span>
      </div>

      <div className="flex items-center">
        <button
          onClick={handleLoadClick}
          className="bg-green-500 hover:bg-green-600 text-white text-xs py-1 px-3 rounded-full transition-colors duration-200 mr-3"
          title="Charger un fichier Markdown (.md)"
        >
          Charger
        </button>

        <button
          onClick={() => {
            console.log("--- BOUTON EXPORTER CLIQUÉ ---");
            if (!onExport) {
              console.log("ERREUR: onExport n'est pas défini!");
            } else {
              onExport();
            }
          }}
          className={`relative text-white text-xs py-1 px-3 rounded-full transition-colors duration-200 mr-3 flex items-center
            ${hasUnsavedChanges ? 'bg-amber-500 hover:bg-amber-600' : 'bg-purple-500 hover:bg-purple-600'}`}
          title={hasUnsavedChanges ? 'Exporter le document (modifications non sauvegardées)' : 'Exporter le document'}
        >
          <Download size={14} className="mr-1" /> Exporter
          {hasUnsavedChanges && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-400 rounded-full border border-white animate-pulse" />
          )}
        </button>

        {onExportAST && (
          <button
            onClick={onExportAST}
            className="bg-indigo-500 hover:bg-indigo-600 text-white text-xs py-1 px-3 rounded-full transition-colors duration-200 mr-3 flex items-center"
            title="Exporter la vue optimisée XML pour Gemini"
          >
            <Download size={14} className="mr-1" /> Contexte IA
          </button>
        )}

        {/* Les boutons de sélection ont été déplacés vers PersistentInputZone */}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".md, .markdown"
          style={{ display: 'none' }}
        />

        {renderAuthSection()}

        <div className="bg-white/10 rounded-full p-1 flex text-sm mr-3">
          <button
            className={`py-1 px-3 rounded-full transition-colors duration-200 ${appMode === 'normal' ? 'bg-sky-300 text-sky-900 font-semibold' : 'hover:bg-white/20'}`}
            onClick={() => setAppMode('normal')}
            title="Passer en mode Normal"
          >
            Normal
          </button>
          <button
            className={`py-1 px-3 rounded-full transition-colors duration-200 ${appMode === 'admin' ? 'bg-amber-300 text-amber-900 font-semibold' : 'hover:bg-white/20'}`}
            onClick={() => setAppMode('admin')}
            title="Passer en mode Admin"
          >
            Admin
          </button>
        </div>

        <button
          className="bg-white/15 hover:bg-white/25 transition-all duration-200 ease-in-out rounded-full w-10 h-10 flex items-center justify-center mr-3"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Passer au thème sombre' : 'Passer au thème clair'}
        >
          {theme === 'light' ? (
            <i className="fas fa-moon"></i>
          ) : (
            <i className="fas fa-sun"></i>
          )}
        </button>

        <button
          className="bg-white/15 hover:bg-white/25 transition-all duration-200 ease-in-out rounded-full w-10 h-10 flex items-center justify-center"
          onClick={toggleHelpModal}
          title="Aide"
        >
          <i className="fas fa-question"></i>
        </button>
      </div>

      {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
    </header>
  );
};

export default Header;