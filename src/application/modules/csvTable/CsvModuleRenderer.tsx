import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { BlockRendererProps } from '../../interfaces/blockModule'; // Corrigé
import type { CsvTableData } from './csvTableModule';
import { PinoLogger } from '../../../infrastructure/logging/PinoLogger'; // Corrigé

const logger = new PinoLogger();
import { useEditorCommands } from '../../../application/context/EditorContext';

export const CsvModuleRenderer: React.FC<BlockRendererProps<CsvTableData>> = ({ 
  block,
  customData, 
  ...rest 
}) => {
  const { activeBlockId, updateBlock, setActiveBlockId } = useEditorCommands();
  const { headers, rows, rawCsv } = customData;
  const indentationLevel = (block.metadata && 'indentationLevel' in block.metadata && typeof block.metadata.indentationLevel === 'number') ? block.metadata.indentationLevel : 0;

  const isLocallyEditing = activeBlockId === block.id;
  const [editingCsvText, setEditingCsvText] = useState(rawCsv || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isLocallyEditing) {
        setEditingCsvText(rawCsv || ''); 
    }
  }, [isLocallyEditing, rawCsv]);

  useEffect(() => {
    if (isLocallyEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isLocallyEditing]);

  const handleInteractionTrigger = useCallback(() => {
    logger.debug(`[CsvModuleRenderer ${block.id}] Clic détecté pour édition.`);
    setActiveBlockId(block.id);
  }, [block.id, setActiveBlockId]);

  const internalSave = useCallback(() => {
    logger.debug(`[CsvModuleRenderer ${block.id}] Sauvegarde interne du CSV.`);
    updateBlock(block.id, block, {
      type: 'UPDATE_SOURCE_FOR_MODULE',
      newRawSource: editingCsvText,
      moduleType: 'csvTable'
    });
    setActiveBlockId(null);
  }, [block.id, editingCsvText, block, updateBlock, setActiveBlockId]);

  const internalCancel = useCallback(() => {
    logger.debug(`[CsvModuleRenderer ${block.id}] Annulation interne de l'édition CSV.`);
    setEditingCsvText(rawCsv || ''); 
    setActiveBlockId(null);    
  }, [rawCsv, setActiveBlockId]);

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditingCsvText(event.target.value);
    event.target.style.height = 'inherit';
    event.target.style.height = `${event.target.scrollHeight}px`;
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      if (event.ctrlKey || event.metaKey) { // Ctrl+Entrée ou Cmd+Entrée
        event.preventDefault();
        internalSave();
      } else if (!event.shiftKey) { // Entrée simple (sans Shift)
        event.preventDefault();
        internalSave();
      }
      // Si Shift+Entrée, le comportement par défaut (nouvelle ligne) est autorisé car il ne correspond à aucune des conditions ci-dessus.
    } else if (event.key === 'Escape') {
      event.preventDefault();
      internalCancel();
    }
  };

  const indentationPadding = useMemo(() => {
    return indentationLevel > 0 ? `${indentationLevel * 1.5}rem` : '0rem';
  }, [indentationLevel]);

  const combinedStyle: React.CSSProperties = useMemo(() => ({
    marginLeft: indentationPadding,
    width: '100%',
    overflowX: 'auto',
    // ...rest.style, // Retiré pour l'instant car `style` n'est pas une prop garantie de `rest`
  }), [indentationPadding]);

  // {...rest} est appliqué au div conteneur principal pour passer les attributs de dnd-kit

  if (isLocallyEditing) {
    return (
      <div 
        style={combinedStyle} 
        {...rest}
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          internalSave();
        }}
      > 
        <textarea
          ref={textareaRef}
          value={editingCsvText}
          onChange={handleTextareaChange}
          onKeyDown={handleTextareaKeyDown}
          className="block w-full font-mono text-sm p-2 border border-blue-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
          style={{ minHeight: '100px', resize: 'vertical' }}
        />
      </div>
    );
  }

  if (!headers || !rows) {
    return (
      <div style={combinedStyle} {...rest} className="text-red-500 p-2 border border-red-300 bg-red-50">
        Données CSV invalides ou non parsées pour le bloc {block.id}.
        <pre onClick={handleInteractionTrigger} style={{ cursor: 'pointer' }} title="Cliquer pour éditer le CSV">
          {rawCsv || '(CSV Vide)'}
        </pre>
      </div>
    );
  }

  const tableClasses = "table-auto w-full text-left border-collapse border border-gray-300 dark:border-gray-600";

  return (
    <div style={combinedStyle} {...rest} onClick={handleInteractionTrigger} title="Cliquer pour éditer le CSV">
      <table className={tableClasses} style={{ minWidth: '100%' }}>
        <thead>
          <tr>
            {headers.map((header: string, index: number) => (
              <th key={index} className="border border-gray-200 dark:border-gray-500 px-4 py-2 bg-gray-50 dark:bg-gray-700 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row: string[], rowIndex: number) => (
            <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-750">
              {row.map((cell: string, cellIndex: number) => (
                <td key={cellIndex} className="border border-gray-200 dark:border-gray-500 px-4 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && headers.length === 0 && (
        <p className="text-gray-500 italic p-2">Tableau CSV vide. Cliquez pour ajouter du contenu.</p>
      )}
    </div>
  );
};

// Pas de `displayName` nécessaire pour les composants exportés directement avec React.FC dans les modules.
// CsvModuleRenderer.displayName = 'CsvModuleRenderer'; // Optionnel

// `export default CsvModuleRenderer;` n'est pas nécessaire si vous l'exportez nommément `export const CsvModuleRenderer` 