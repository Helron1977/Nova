import React, { useCallback } from 'react';
import { useBlockEditor, type InlineFormatType, type CoreBlockEditorProps } from '../../../application/hooks/useBlockEditor';
import { PinoLogger } from '../../../infrastructure/logging/PinoLogger';
import InlineFormatMenu from './InlineFormatMenu'; // Décommenté

const logger = new PinoLogger();

// Interface pour les props de InlineFormatMenu (simplifiée, car le composant lui-même n'est pas dans le scope de cette modification)
interface InlineFormatMenuDisplayProps {
  isVisible: boolean;
  top: number;
  left: number;
  hasSelection: boolean;
  onClose: () => void;
  onFormat: (formatType: InlineFormatType) => void;
}

const CoreBlockEditor: React.FC<CoreBlockEditorProps> = (props) => {
  const {
    blockId,
    initialContent,
    onSave,
    singleLine,
    enableInlineFormatting,

    // Props optionnelles de CoreBlockEditorProps qui ont des valeurs par défaut dans useBlockEditor
    // ou qui ne sont pas utilisées par CoreBlockEditor lui-même directement pour le rendu des contrôles.
    // onBlockIndent, onBlockOutdent, onToggleCheckbox, autosave sont gérées par useBlockEditor si passées.
  } = props;

  const {
    editorRef,
    view,
    // editorInstanceId, // Non utilisé directement par CoreBlockEditor pour le rendu
    inlineMenuState, // Contient isVisible, top, left, hasSelection
    closeInlineMenu,
    applyInlineFormat,
  } = useBlockEditor(props); // Passer toutes les props à useBlockEditor

  const handleValidate = useCallback(() => {
    if (view && view.state) {
      logger.debug(`[CoreBlockEditor - ${blockId}] handleValidate: Content from view.state.doc.toString() = "${view.state.doc.toString()}"`);
      onSave(view.state.doc.toString());
    } else {
      logger.warn(`[CoreBlockEditor - ${blockId}] handleValidate: Editor view or state not available.`);
      // Fallback au cas où, même si cela ne devrait pas arriver si isEditorReady est vrai pour les boutons
      onSave(initialContent); 
    }
  }, [view, onSave, initialContent, blockId]);

  const currentInlineMenuProps: InlineFormatMenuDisplayProps = {
    isVisible: inlineMenuState.show,
    top: inlineMenuState.top,
    left: inlineMenuState.left,
    hasSelection: inlineMenuState.hasSelection, // Utilisation correcte de .hasSelection
    onClose: closeInlineMenu,
    onFormat: applyInlineFormat,
  };

  const handleBlur = useCallback((e: React.FocusEvent) => {
    // Ignorer si le focus reste à l'intérieur du composant (ex: clics internes)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    logger.debug(`[CoreBlockEditor - ${blockId}] Blur detected, saving...`);
    // On décale la sauvegarde pour laisser le temps au navigateur de finaliser 
    // le transfert de focus (ex: clic sur la PersistentInputZone).
    // Sinon, le démontage immédiat de l'éditeur perturbe le focus.
    setTimeout(() => {
      handleValidate();
    }, 50);
  }, [handleValidate, blockId]);

  return (
    <div className="core-block-editor w-full" onBlur={handleBlur}>
      <div ref={editorRef} className={`cm-editor-container w-full ${singleLine ? 'cm-single-line' : ''}`} />
      {currentInlineMenuProps.isVisible && enableInlineFormatting && (
        <div 
          style={{ top: currentInlineMenuProps.top, left: currentInlineMenuProps.left }}
          className="absolute z-10"
        >
          <InlineFormatMenu {...currentInlineMenuProps} />
        </div>
      )}
    </div>
  );
};

export { CoreBlockEditor }; 