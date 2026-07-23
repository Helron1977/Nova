import React, { useState, useEffect } from 'react';
import type { CodeBlock } from '@/application/logic/markdownParser';
import { useDebouncedCallback } from 'use-debounce';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

interface CustomPaletteSourceEditorRendererProps {
  block: CodeBlock; // Contient l'ID et le code initial
  onUpdateBlockContent: (blockId: string, newText: string) => void;
  // Pas besoin de onRemoveBlock ici, car la suppression est gérée par SortableBlockItem
}

const CustomPaletteSourceEditorRenderer: React.FC<CustomPaletteSourceEditorRendererProps> = ({
  block,
  onUpdateBlockContent,
}) => {
  const [currentCode, setCurrentCode] = useState(block.content.code);

  // Mettre à jour le contenu local si le bloc externe change (par exemple, chargement de document)
  useEffect(() => {
    if (block.content.code !== currentCode) {
      logger.debug(`[PaletteSourceEditor ${block.id}] External code changed. Updating local state.`);
      setCurrentCode(block.content.code);
    }
  }, [block.content.code, block.id]); // Ne pas inclure currentCode ici pour éviter boucle

  const debouncedUpdate = useDebouncedCallback(
    (newText: string) => {
      logger.debug(`[PaletteSourceEditor ${block.id}] Debounced update triggered with:`, newText);
      onUpdateBlockContent(block.id, newText);
    },
    500 // Délai de debounce de 500ms
  );

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setCurrentCode(newText);
    debouncedUpdate(newText);
  };

  // Gérer le collage pour potentiellement déclencher une mise à jour plus rapide
  const handlePaste = () => {
    // Le handleChange sera aussi appelé, donc debouncedUpdate s'exécutera.
    // On pourrait vouloir forcer une mise à jour immédiate ici si nécessaire,
    // mais pour l'instant, laissons le debounce gérer.
    logger.debug(`[PaletteSourceEditor ${block.id}] Paste event detected.`);
  };

  // Empêcher la propagation de Enter pour ne pas créer de nouveau bloc par défaut (si applicable dans un contexte plus large)
  // et insérer un vrai saut de ligne dans le textarea.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      // Comportement par défaut du textarea pour Enter est déjà d'insérer un saut de ligne.
      // Si nous étions dans un contentEditable div, nous aurions besoin de event.preventDefault()
      // et d'insérer le saut de ligne manuellement. Pour un textarea, c'est bon.
    }
  };

  return (
    <div className="nova-palette-source-editor my-2" data-block-id={block.id}>
      <textarea
        value={currentCode}
        onChange={handleChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        placeholder="Collez vos variables de couleurs ici (ex: --nom-couleur: #RRGGBB;)"
        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-sm font-mono focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 transition-colors duration-150"
        rows={Math.max(3, currentCode.split('\n').length)} // Ajuster la hauteur dynamiquement
        spellCheck="false"
      />
      {/* On pourrait ajouter un petit message en dessous si on veut, ex: "La palette apparaîtra dès que le format est correct." */}
    </div>
  );
};

export default React.memo(CustomPaletteSourceEditorRenderer); 