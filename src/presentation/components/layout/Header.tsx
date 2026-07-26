import React, { useRef, useState } from 'react';
import { useUiStore } from '../../../application/state/uiStore';
import { useAuthStore } from '../../../application/state/authStore';
import HelpModal from './HelpModal';
import { Sun, Moon, Download, Shield, HelpCircle, FilePlus, Upload, LogOut, BrainCircuit } from 'lucide-react';

import logoImage from '@/assets/images/nova.svg';

interface HeaderProps {
  onLoadMarkdown: (content: string) => void;
  onExport: () => void;
  onExportAST?: () => void;
  hasUnsavedChanges: boolean;
  documentName: string;
  onNewDocument: () => void;
  onChangeDocumentName: (newName: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  onLoadMarkdown,
  onExport,
  onExportAST,
  hasUnsavedChanges,
  documentName,
  onNewDocument,
  onChangeDocumentName,
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
      return <span className="text-xs text-white/80 mr-2">Chargement...</span>;
    }
    if (error) {
      return <span className="text-xs text-red-300 mr-2">Erreur Auth</span>;
    }
    if (user) {
      return (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium hidden sm:inline text-white">
            {user.displayName || user.email}
          </span>
          <button
            onClick={logout}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full transition-all duration-200 text-sm font-medium shadow-sm hover:shadow-md flex items-center gap-1.5"
            title="Se déconnecter"
          >
            <LogOut size={14} className="hidden sm:inline" /> Déconnexion
          </button>
        </div>
      );
    } else {
      return (
        <button
          onClick={signInWithGoogle}
          className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors text-sm font-medium shadow-sm"
          title="Se connecter avec Google"
        >
          Connexion
        </button>
      );
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content !== null && content !== undefined) {
        onLoadMarkdown(content);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.onerror = (e) => {
      console.error("Erreur de lecture", e);
      alert("Erreur lors de la lecture du fichier.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    reader.readAsText(file);
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 via-red-700 to-yellow-500 shadow-md px-4 py-3 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden transition-colors duration-200">
      
      {/* LEFT SECTION: Logo & Title */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2 group cursor-pointer" title="Nova">
            <img src={logoImage} alt="Logo Nova" className="h-8 w-8 drop-shadow-sm group-hover:scale-105 transition-transform" />
            <span className="font-bold text-white tracking-wide hidden sm:block">Nova</span>
        </div>
        
        <div className="hidden sm:block h-5 w-px bg-white/30 mx-1"></div>
        
        <input
          type="text"
          value={documentName}
          onChange={(e) => onChangeDocumentName(e.target.value)}
          className="flex-1 sm:flex-none bg-white/20 hover:bg-white/30 focus:bg-white/30 text-white font-semibold px-3 py-1.5 rounded-md outline-none transition-all w-32 sm:w-48 border border-transparent focus:ring-2 focus:ring-white/50 text-sm placeholder-white/80"
          placeholder="Nouveau Document"
        />
      </div>

      {/* RIGHT SECTION: Actions */}
      <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">

          <button
            onClick={onNewDocument}
            className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-all duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5"
            title="Nouveau document"
          >
            <FilePlus size={16} /> <span className="text-sm font-medium hidden sm:inline">Nouveau</span>
          </button>
          
          <button
            onClick={handleLoadClick}
            className="px-4 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-full transition-all duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5"
            title="Charger un fichier (.md)"
          >
            <Upload size={16} /> <span className="text-sm font-medium hidden sm:inline">Charger</span>
          </button>

          <button
            onClick={() => { if(onExport) onExport(); }}
            className={`relative px-4 py-1.5 rounded-full transition-all duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 text-white ${
              hasUnsavedChanges 
                ? 'bg-amber-500 hover:bg-amber-600' 
                : 'bg-orange-500 hover:bg-orange-600'
            }`}
            title={hasUnsavedChanges ? 'Exporter (modifications non sauvegardées)' : 'Exporter'}
          >
            <Download size={16} /> <span className="text-sm font-medium hidden sm:inline">Exporter</span>
            {hasUnsavedChanges && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-300 rounded-full border border-orange-500 animate-pulse" />
            )}
          </button>
        <div className="h-5 w-px bg-white/20 mx-2 hidden sm:block"></div>

        {/* AI Actions */}
        {onExportAST && (
          <button
            onClick={onExportAST}
            className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full transition-all duration-200 flex items-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5"
            title="Contexte IA (AST)"
          >
            <BrainCircuit size={16} /> <span className="text-sm font-medium hidden md:inline">Contexte IA</span>
          </button>
        )}

        <div className="h-5 w-px bg-white/20 mx-2 hidden sm:block"></div>

        {/* User & Settings */}
        {renderAuthSection()}
        
        <button
          className={`p-1.5 rounded-full transition-colors ${appMode === 'admin' ? 'bg-amber-400/20 text-amber-100' : 'text-white/80 hover:bg-white/20 hover:text-white'}`}
          onClick={() => setAppMode(appMode === 'normal' ? 'admin' : 'normal')}
          title={appMode === 'admin' ? 'Mode Admin Actif' : 'Activer Mode Admin'}
        >
          <Shield size={16} />
        </button>

        <button
          className="p-1.5 text-white/80 hover:bg-white/20 hover:text-white rounded-full transition-colors"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Thème Sombre' : 'Thème Clair'}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>

        <button
          className="p-1.5 text-white/80 hover:bg-white/20 hover:text-white rounded-full transition-colors"
          onClick={toggleHelpModal}
          title="Aide"
        >
          <HelpCircle size={16} />
        </button>

      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".md, .markdown"
        style={{ display: 'none' }}
      />
      {isHelpModalOpen && <HelpModal onClose={toggleHelpModal} />}
    </header>
  );
};

export default Header;