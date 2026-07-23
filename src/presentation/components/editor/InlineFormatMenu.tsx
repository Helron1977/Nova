import React from 'react';
import type { InlineFormatType } from '../../../application/hooks/useBlockEditor';

export interface InlineFormatMenuProps {
  isVisible: boolean;
  top: number;
  left: number;
  hasSelection: boolean;
  onClose: () => void;
  onFormat: (formatType: InlineFormatType) => void;
}

const InlineFormatMenu: React.FC<InlineFormatMenuProps> = ({
  isVisible,
  top,
  left,
  hasSelection,
  onFormat,
  onClose,
}) => {
  if (!isVisible) return null;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    border: '1px solid #ccc',
    zIndex: 1000,
    boxShadow: '2px 2px 5px rgba(0,0,0,0.2)',
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
    backgroundColor: '#f0f0f0', // Thème clair par défaut
    borderRadius: '4px',
    padding: '4px 8px',
  };

  // TODO: Adapter les styles pour un thème sombre si nécessaire
  // Exemple: si un prop theme='dark' est passé, ou via un contexte React ThemeContext

  const buttonStyle: React.CSSProperties = {
    border: '1px solid #aaa',
    borderRadius: '3px',
    padding: '3px 7px',
    cursor: 'pointer',
    backgroundColor: 'white',
    color: '#333',
    fontSize: '13px',
    lineHeight: '1.2',
  };

  const handleFormatAction = (e: React.MouseEvent, formatType: InlineFormatType) => {
    e.stopPropagation();
    e.preventDefault(); 
    onFormat(formatType);
    onClose(); // Fermer explicitement le menu après action
  };

  return (
    <div 
      style={menuStyle} 
      // Empêcher la fermeture du menu si on clique à l'intérieur du menu lui-même
      onMouseDown={(e) => e.stopPropagation()} 
      role="menu"
    >
      {/* Boutons toujours visibles (ou presque) */}
      <button style={buttonStyle} onMouseDown={(e) => handleFormatAction(e, 'bold')} title="Gras (Ctrl+B)">G</button>
      <button style={buttonStyle} onMouseDown={(e) => handleFormatAction(e, 'italic')} title="Italique (Ctrl+I)">I</button>

      {/* Boutons qui dépendent de si du texte est sélectionné ou non */}
      {hasSelection ? (
        <>
          {/* Apparaît si du texte est sélectionné */}
          <button style={buttonStyle} onMouseDown={(e) => handleFormatAction(e, 'code')} title="Code Inline">{`< >`}</button>
          <button style={buttonStyle} onMouseDown={(e) => handleFormatAction(e, 'strikethrough')} title="Barré">S</button>
        </>
      ) : (
        <>
          {/* Apparaît si pas de sélection (pour insérer un nouvel élément) */}
          <button style={buttonStyle} onMouseDown={(e) => handleFormatAction(e, 'link')} title="Insérer Lien">Lien</button>
          <button style={buttonStyle} onMouseDown={(e) => handleFormatAction(e, 'image')} title="Insérer Image">Image</button>
        </>
      )}
    </div>
  );
};

export default InlineFormatMenu; 