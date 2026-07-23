import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';
import type { PaletteBlockData } from './paletteModule';
import PaletteModule from './paletteModule';
import { CoreBlockEditor } from '@/presentation/components/editor/CoreBlockEditor';
import CustomColorPaletteRenderer from '@/presentation/components/markdown/CustomColorPaletteRenderer';
import type { ColorInfo } from '@/application/logic/markdownParser';
import { parsePaletteCodeContent } from '@/application/logic/markdownParser';

import { useEditorCommands } from '@/application/context/EditorContext';

// Fonction Debounce simple
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        timeoutId = null; // Libérer l'ID après éxeécution
        resolve(func(...args));
      }, waitFor);
    });
}

interface PaletteRendererSpecificProps extends BlockRendererProps<PaletteBlockData> {}

export const PaletteRenderer: React.FC<PaletteRendererSpecificProps> = ({
  block,
  customData,
  ...rest
}) => {
  const { activeBlockId, updateBlock, setActiveBlockId } = useEditorCommands();
  const isEffectivelyNew = customData.rawSource === PaletteModule.defaultRawContent;
  
  const propIsEditing = activeBlockId === block.id;
  const [isEditingSource, setIsEditingSource] = useState(isEffectivelyNew);
  
  useEffect(() => {
    setIsEditingSource(propIsEditing);
  }, [propIsEditing]);
  
  const currentEditingSourceRef = useRef<string>(customData.rawSource || PaletteModule.defaultRawContent || '');
  const [initialContentForEditor, setInitialContentForEditor] = useState<string>(customData.rawSource || PaletteModule.defaultRawContent || '');
  
  const [previewColors, setPreviewColors] = useState<ColorInfo[]>(customData.colors);
  const [editorKey, setEditorKey] = useState<number>(0);

  // Fonction pour mettre à jour la prévisualisation (sera débattue)
  const updatePreview = useCallback((source: string) => {
    try {
      const parsedColors = parsePaletteCodeContent(source);
      setPreviewColors(parsedColors);
    } catch (e) {
      console.warn("[PaletteRenderer] Erreur parsing pour preview débattue:", e); // Warn au lieu d'error pour moins de bruit
      setPreviewColors([]); 
    }
  }, []); // setPreviewColors est stable

  // Créer la version débattue de updatePreview
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedUpdatePreview = useCallback(debounce(updatePreview, 500), [updatePreview]);

  useEffect(() => {
    const currentActualSource = customData.rawSource || PaletteModule.defaultRawContent || '';
    currentEditingSourceRef.current = currentActualSource;
    setInitialContentForEditor(currentActualSource); 
    setPreviewColors(customData.colors || []);

    if (propIsEditing !== undefined && propIsEditing !== isEditingSource) {
      setIsEditingSource(propIsEditing);
      if (propIsEditing) {
        setEditorKey(prevKey => prevKey + 1);
        // Si on entre en édition, s'assurer que la preview est à jour avec le contenu initial
        updatePreview(currentActualSource);
      }
    }
  }, [propIsEditing, customData.rawSource, customData.colors, isEditingSource, updatePreview]); // Ajout de isEditingSource et updatePreview

  useEffect(() => {
    if (!isEditingSource) {
        setPreviewColors(customData.colors || []);
    }
  }, [isEditingSource, customData.colors]);

  const handleSaveSource = useCallback((newSourceFromEditor: string) => {
    updateBlock(block.id, block, {
      type: 'UPDATE_SOURCE_FOR_MODULE',
      newRawSource: newSourceFromEditor,
      moduleType: 'palette'
    });
    currentEditingSourceRef.current = newSourceFromEditor;
    // Mettre à jour la preview immédiatement à la sauvegarde
    updatePreview(newSourceFromEditor);
    setActiveBlockId(null);
  }, [block.id, block, updateBlock, setActiveBlockId, updatePreview]); // Ajout de updatePreview

  const handleCancelEditSource = useCallback(() => {
    const originalSource = customData.rawSource || PaletteModule.defaultRawContent || '';
    setInitialContentForEditor(originalSource);
    currentEditingSourceRef.current = originalSource;
    // Revenir aux couleurs originales
    updatePreview(originalSource);
    setActiveBlockId(null);
    setEditorKey(prevKey => prevKey + 1);
  }, [customData.rawSource, setActiveBlockId, updatePreview]); // customData.colors n'est plus nécessaire ici car updatePreview s'en charge


  const indentationPadding = `${((block.metadata as { indentationLevel?: number })?.indentationLevel ?? 0) * 1.5}rem`;

  const handleEditorContentChange = useCallback((newSource: string) => {
    currentEditingSourceRef.current = newSource;
    // Appeler la fonction débattue pour mettre à jour la preview
    debouncedUpdatePreview(newSource);
  }, [debouncedUpdatePreview]);

  if (isEditingSource) {
    return (
      <div ref={(rest as any).ref} {...rest} style={{ ...rest.style, marginLeft: indentationPadding }} className="nova-palette-editor p-3 my-2 border border-blue-500 rounded-lg bg-white dark:bg-gray-800 shadow-lg">
        {/* La prévisualisation est de retour, mais mise à jour avec debounce */}
        <CustomColorPaletteRenderer colors={previewColors} blockId={`${block.id}-preview`} />
        
        <div className="mt-3">
          <CoreBlockEditor
            key={editorKey}
            blockId={block.id}
            initialContent={initialContentForEditor}
            onSave={handleSaveSource}
            onCancel={handleCancelEditSource}
            onContentChange={handleEditorContentChange}
            languageMode="text"
            placeholder="Sur Coolors.co, cliquez sur 'Export' > 'CSS' > 'Copy Code' du premier bloc (celui avec les variables CSS), puis collez ici."
            autoFocus={true}
            hideInternalControls={false}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Format: <code>--nom-variable: #HexValue;</code> (une par ligne). La prévisualisation se met à jour après une courte pause.
        </p>
      </div>
    );
  }

  return (
    <div ref={(rest as any).ref} {...rest} style={{ ...rest.style, marginLeft: indentationPadding }} className="nova-palette-display group relative my-2">
      <CustomColorPaletteRenderer colors={previewColors} blockId={block.id} />
    </div>
  );
}; 