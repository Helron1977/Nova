import React from 'react';
import {
  Pilcrow, Heading1, Heading2, SquareCode, GitGraph, Image, Quote, Table, Codepen, Minus, X 
} from 'lucide-react';

interface BlockTypeSelectorProps {
  onSelect: (type: string) => void;
  onClose: () => void;
  position: { top: number; left: number } | null;
}

const blockTypes = [
  { type: 'paragraph', label: 'Paragraphe', Icon: Pilcrow },
  { type: 'heading1', label: 'Titre 1', Icon: Heading1 },
  { type: 'heading2', label: 'Titre 2', Icon: Heading2 },
  { type: 'code', label: 'Code', Icon: SquareCode },
  { type: 'mermaid', label: 'Mermaid', Icon: GitGraph },
  { type: 'image', label: 'Image', Icon: Image },
  { type: 'blockquote', label: 'Citation', Icon: Quote },
  { type: 'table', label: 'Tableau', Icon: Table },
  { type: 'html', label: 'HTML', Icon: Codepen },
  { type: 'thematicBreak', label: 'Ligne', Icon: Minus },
];

const BlockTypeSelector: React.FC<BlockTypeSelectorProps> = ({ position, onSelect, onClose }) => {
  if (!position) {
    return null;
  }

  const handleSelect = (type: string) => {
    onSelect(type);
  };

  const radius = 80;
  const totalItems = blockTypes.length;
  const angleStep = (2 * Math.PI) / totalItems;

  return (
    <div 
      style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 50 }}
      className="transform -translate-x-1/2 -translate-y-1/2 
                 rounded-full border border-gray-300 dark:border-gray-600 
                 bg-white dark:bg-gray-800 shadow-xl 
                 flex flex-col items-center w-64 h-64 justify-center 
                 transition-all duration-300 ease-out 
                 scale-100 opacity-100"
      onMouseLeave={onClose}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        {blockTypes.map(({ type, label, Icon }, index) => {
          const angle = angleStep * index - Math.PI / 2;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          const buttonStyle: React.CSSProperties = {
            position: 'absolute',
            left: `calc(50% + ${x}px - 16px)`,
            top: `calc(50% + ${y}px - 16px)`,
            transition: 'opacity 0.2s ease-out 0.1s, transform 0.2s ease-out',
            opacity: 1,
          };

          return (
            <button
              key={type}
              onClick={() => { handleSelect(type); onClose(); }}
              className="w-8 h-8 flex items-center justify-center border rounded-full bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 dark:border-gray-600 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={buttonStyle}
              title={label}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>

      <button
        onClick={onClose}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 transition-opacity duration-200 ease-out delay-150 opacity-100"
        title="Annuler"
      >
        <X size={20} />
      </button>
    </div>
  );
};

export default BlockTypeSelector; 