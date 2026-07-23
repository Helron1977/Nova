import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export interface CommandOption {
  id: string;
  label: string;
  keyword: string;
  Icon?: React.ElementType;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  options: CommandOption[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, options }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(query.toLowerCase()) || 
    option.keyword.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        setSelectedIndex(prev => (prev + 1) % filteredOptions.length);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        setSelectedIndex(prev => (prev - 1 + filteredOptions.length) % filteredOptions.length);
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (filteredOptions.length > 0) {
          filteredOptions[selectedIndex].action();
          onClose();
        }
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredOptions, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/50" onClick={onClose}>
      <div 
        className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-lg shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none focus:ring-0 text-gray-900 dark:text-white placeholder-gray-400"
            placeholder="Tapez une commande ou un mot-clé..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-2">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected = index === selectedIndex;
              const Icon = option.Icon;
              return (
                <div
                  key={option.id}
                  className={`flex items-center px-4 py-2 cursor-pointer ${isSelected ? 'bg-blue-500 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                  onClick={() => {
                    option.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {Icon && <Icon className="w-4 h-4 mr-3" />}
                  <div className="flex-1">
                    <span className="font-medium">{option.label}</span>
                    <span className={`ml-2 text-xs ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>/{option.keyword}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-4 py-3 text-center text-gray-500">Aucune commande trouvée.</div>
          )}
        </div>
      </div>
    </div>
  );
};
