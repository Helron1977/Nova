import React from 'react';
import { useUiStore } from '../../../application/state/uiStore';
import { useAuthStore } from '../../../application/state/authStore';

const Header: React.FC = () => {
  // Lire le thème et l'action depuis le store UI
  const { theme, toggleTheme, appMode, setAppMode } = useUiStore(); // Ajouter appMode et setAppMode
  // Lire l'état et les actions d'authentification
  const { user, isLoading, error, signInWithGoogle, logout } = useAuthStore();

  const renderAuthSection = () => {
    if (isLoading) {
      return <span className="text-xs opacity-75 mr-3">Chargement...</span>;
    }
    if (error) {
      return <span className="text-xs text-red-400 mr-3">Erreur Auth</span>;
    }
    if (user) {
      // Utilisateur connecté
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
      // Utilisateur déconnecté
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

  // TODO: Implémenter la logique pour toggleAdminMode, toggleDarkMode, et ouvrir la modale d'aide
  // Ces fonctions dépendront probablement d'un gestionnaire d'état global.

  return (
    <header className="bg-gradient-to-r from-blue-900 via-red-700 to-yellow-500 text-white p-3 shadow-md flex justify-between items-center">
      {/* Logo et Titre */}
      <div className="flex items-center font-bold text-lg tracking-wide">
        {/* Utiliser le nouveau logo SVG et l'agrandir */} 
        <img src="/nova.svg" alt="Logo Nova" height="48" className="h-12 mr-2" />
        <span className="text-xl font-semibold text-gray-800 dark:text-gray-200">Nova</span>
      </div>

      {/* Actions Header */}
      <div className="flex items-center">
        {/* Section Authentification */} 
        {renderAuthSection()}

        {/* Switch Mode Normal/Admin */} 
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

        {/* Bouton Dark Mode */}
        <button
          className="bg-white/15 hover:bg-white/25 transition-all duration-200 ease-in-out rounded-full w-10 h-10 flex items-center justify-center mr-3"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Passer au thème sombre' : 'Passer au thème clair'}
        >
           {/* Icône dynamique (exemple avec FontAwesome, assurez-vous qu'il est chargé) */}
           {theme === 'light' ? (
             <i className="fas fa-moon"></i>
           ) : (
             <i className="fas fa-sun"></i>
           )}
        </button>

        {/* Bouton Aide */}
        <button
          className="bg-white/15 hover:bg-white/25 transition-all duration-200 ease-in-out rounded-full w-10 h-10 flex items-center justify-center"
          onClick={() => console.warn('openHelpModal non implémenté')} // Placeholder
          title="Aide"
        >
          <i className="fas fa-question"></i> {/* Utilise FontAwesome */}
        </button>
      </div>
    </header>
  );
};

export default Header; 