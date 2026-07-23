import React from 'react';
import { useUiStore } from '../../../application/state/uiStore';
import { FileText, LayoutGrid, Cloud, CloudOff, Moon, Sun } from 'lucide-react';

interface FooterProps {
  blockCount: number;
  wordCount: number;
  hasUnsavedChanges: boolean;
}

const Footer: React.FC<FooterProps> = ({ blockCount, wordCount, hasUnsavedChanges }) => {
  const { theme, appMode } = useUiStore();

  return (
    <footer className="print:hidden bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-1.5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      {/* Left: document stats */}
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5" title="Nombre de blocs">
          <LayoutGrid size={12} className="opacity-70" />
          {blockCount} bloc{blockCount !== 1 ? 's' : ''}
        </span>
        <span className="flex items-center gap-1.5" title="Nombre de mots (estimé)">
          <FileText size={12} className="opacity-70" />
          {wordCount} mot{wordCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Center: save indicator */}
      <div className="flex items-center gap-1.5">
        {hasUnsavedChanges ? (
          <>
            <CloudOff size={13} className="text-amber-500" />
            <span className="text-amber-600 dark:text-amber-400 font-medium">Modifications non sauvegardées</span>
          </>
        ) : (
          <>
            <Cloud size={13} className="text-green-500" />
            <span className="text-green-600 dark:text-green-400">Sauvegardé</span>
          </>
        )}
      </div>

      {/* Right: mode + theme */}
      <div className="flex items-center gap-3">
        <span className={`capitalize px-1.5 py-0.5 rounded text-[10px] font-semibold ${appMode === 'admin' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
          {appMode}
        </span>
        <span className="flex items-center gap-1">
          {theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
          {theme === 'dark' ? 'Sombre' : 'Clair'}
        </span>
      </div>
    </footer>
  );
};

export default Footer;