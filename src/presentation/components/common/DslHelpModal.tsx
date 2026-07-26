import React, { useEffect, useState } from 'react';
import { getBlockModules } from '../../../application/logic/blockRegistry';
import { X, BookOpen, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface DslHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBlockType?: string | null;
}

export const DslHelpModal: React.FC<DslHelpModalProps> = ({ isOpen, onClose, initialBlockType }) => {
  const [selectedModuleType, setSelectedModuleType] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialBlockType) {
        setSelectedModuleType(initialBlockType);
      } else {
        const modules = getBlockModules();
        if (modules.length > 0) {
          setSelectedModuleType(modules[0].type);
        }
      }
    }
  }, [isOpen, initialBlockType]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modules = getBlockModules();
  const selectedModule = modules.find(m => m.type === selectedModuleType);

  const renderHelpContent = (module: any) => {
    if (module.helpDescription) {
      if (typeof module.helpDescription === 'string') {
        return (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{module.helpDescription}</ReactMarkdown>
          </div>
        );
      }
      return module.helpDescription;
    }
    
    if (module.getAIPrompt) {
      const prompt = module.getAIPrompt();
      return (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{prompt}</ReactMarkdown>
        </div>
      );
    }

    return (
      <div className="text-gray-500 italic">
        Aucune aide disponible pour le module {module.displayName || module.type}.
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-800 dark:text-gray-100 font-semibold text-lg">
            <BookOpen size={20} className="text-indigo-500" />
            Documentation des Blocs (DSL)
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-1/3 border-r border-gray-100 dark:border-gray-800 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/50 p-4">
            <div className="space-y-1">
              {modules.map((m) => {
                const isSelected = selectedModuleType === m.type;
                const Icon = m.icon || ChevronRight;
                return (
                  <button
                    key={m.type}
                    onClick={() => setSelectedModuleType(m.type)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition-all duration-200
                      ${isSelected 
                        ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-700' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                  >
                    {typeof Icon !== 'string' ? <Icon size={16} /> : <span className="w-4 h-4" />}
                    <span className="font-medium truncate flex-1">{m.displayName || m.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Area */}
          <div className="w-2/3 overflow-y-auto p-8">
            {selectedModule ? (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-800">
                  {selectedModule.icon && typeof selectedModule.icon !== 'string' ? (
                    <selectedModule.icon size={28} className="text-indigo-500" />
                  ) : null}
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedModule.displayName || selectedModule.type}
                  </h2>
                </div>
                {renderHelpContent(selectedModule)}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                Sélectionnez un bloc pour voir sa documentation
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
