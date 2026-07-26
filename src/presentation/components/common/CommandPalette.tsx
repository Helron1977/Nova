import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useFloating, shift, limitShift, offset, autoUpdate, flip } from '@floating-ui/react-dom';

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
  anchorElement?: HTMLElement | null;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, options, anchorElement }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { refs, floatingStyles } = useFloating({
    elements: {
      reference: anchorElement,
    },
    placement: 'bottom-start',
    open: isOpen,
    middleware: [
      offset(10),
      flip(),
      shift({
        limiter: limitShift(),
        padding: 10,
      })
    ],
    whileElementsMounted: autoUpdate,
  });

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

  useEffect(() => {
      if (!isOpen) return;
      const handleClickOutside = (event: MouseEvent) => {
          const target = event.target as Node;
          if (anchorElement?.contains(target)) return;
          if (refs.floating.current && !refs.floating.current.contains(target)) {
              onClose();
          }
      };
      const timerId = setTimeout(() => {
           document.addEventListener('mousedown', handleClickOutside);
      }, 0);
      return () => {
          clearTimeout(timerId);
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, [isOpen, onClose, refs.floating, anchorElement]);

  if (!isOpen || !isMounted) return null;

  const content = (
    <div 
      ref={refs.setFloating}
      style={anchorElement ? { ...floatingStyles, zIndex: 100 } : { zIndex: 100 }}
      className={`w-full max-w-[320px] bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700 ${!anchorElement ? 'fixed top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2' : 'absolute'}`}
    >
      <div className="flex items-center px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <Search className="w-4 h-4 text-gray-400 mr-2" />
        <input
          ref={inputRef}
          type="text"
          className="w-full bg-transparent border-none focus:ring-0 text-sm text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          placeholder="Rechercher un bloc..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
        />
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => {
            const isSelected = index === selectedIndex;
            const Icon = option.Icon;
            return (
              <div
                key={option.id}
                className={`flex items-center px-3 py-2 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                onClick={() => {
                  option.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {Icon && <Icon className={`w-4 h-4 mr-3 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />}
                <div className="flex-1 flex items-center justify-between">
                  <span className="font-medium text-sm">{option.label}</span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="px-4 py-6 text-center text-sm text-gray-500">Aucun bloc trouvé.</div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
