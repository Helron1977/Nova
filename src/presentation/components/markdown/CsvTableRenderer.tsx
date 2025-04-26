import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { CodeBlock } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

interface CsvTableRendererProps {
  block: CodeBlock;
  style?: React.CSSProperties;
  onUpdateBlockContent?: (blockId: string, newCode: string) => void;
  listIndex?: number;
  index?: number;
  onIncreaseIndentation?: (blockId: string) => void;
  onDecreaseIndentation?: (blockId: string) => void;
  [key: string]: any; // Pour props DND/data-*
}

// Fonction pour parser le CSV et rendre une table HTML simple
// Adapté de legacy_code/utils/test-csv.html
const parseCsvAndRenderTable = (csvContent: string | undefined, theme?: string): { headers: string[], rows: string[][] } | null => {
    if (!csvContent) return null;
    try {
        const lines = csvContent.trim().split(/\r?\n/); // Gérer \n et \r\n
        if (lines.length === 0) return { headers: [], rows: [] };

        // Utiliser une regex pour parser les lignes CSV, gérant les guillemets
        // Source simple: https://stackoverflow.com/a/14991797 - Peut nécessiter une lib plus robuste pour des cas complexes
        const parseCsvLine = (line: string): string[] => {
            const regex = /(\s*,\s*|"([^"]*)"|([^,]+))/g;
            const cells: string[] = [];
            let match;
            while ((match = regex.exec(line))) {
                if (match[2]) { // Guillemets capturés
                    cells.push(match[2]);
                } else { // Non guillemeté
                    cells.push(match[3] ? match[3].trim() : '');
                }
                if (match[1] === undefined || match[1] === null) break; // Fin de ligne
            }
            return cells;
        };
        
        const headers = parseCsvLine(lines[0]);
        const rows = lines.slice(1).map(line => parseCsvLine(line));

        // Assurer que toutes les lignes ont le même nombre de cellules que l'en-tête
        const numHeaders = headers.length;
        const consistentRows = rows.map(row => {
            if (row.length < numHeaders) {
                return [...row, ...Array(numHeaders - row.length).fill('')];
            } else if (row.length > numHeaders) {
                return row.slice(0, numHeaders);
            }
            return row;
        });

        return { headers, rows: consistentRows };
    } catch (error) {
        logger.error("[CsvTableRenderer] Error parsing CSV content:", error);
        return null;
    }
};

const CsvTableRenderer = React.forwardRef<
  HTMLDivElement,
  CsvTableRendererProps
>(({ block, style, onUpdateBlockContent, listIndex, index, onIncreaseIndentation, onDecreaseIndentation, ...rest }, ref) => {
  const { code: csvContent, language } = block.content;
  const { metadata } = block;
  const indentationLevel = metadata?.indentationLevel;

  const [isEditing, setIsEditing] = useState(false);
  const [editingCsv, setEditingCsv] = useState(csvContent || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const theme = language?.startsWith('csv-') ? language.substring(4) : '';

  // Parse CSV data for rendering
  const tableData = useMemo(() => parseCsvAndRenderTable(csvContent, theme), [csvContent, theme]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      setEditingCsv(csvContent || '');
      textareaRef.current.focus();
      // Ajuster la hauteur du textarea
      textareaRef.current.style.height = 'inherit';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [isEditing, csvContent]);

  const handleDoubleClick = useCallback(() => {
      if (onUpdateBlockContent) {
          setIsEditing(true);
      } else {
        logger.warn(`[CsvTableRenderer] Double click on table ${block.id} but onUpdateBlockContent is missing.`);
      }
  }, [onUpdateBlockContent, block.id]);

  const handleSave = useCallback(() => {
      if (!onUpdateBlockContent) return;
      logger.debug(`[CsvTableRenderer] Saving CSV for block ${block.id}`);
      // On envoie le CSV brut, handleBlockContentChange s'en chargera pour type 'code'
      onUpdateBlockContent(block.id, editingCsv);
      setIsEditing(false);
  }, [editingCsv, block.id, onUpdateBlockContent]);

  const handleCancel = useCallback(() => {
      setEditingCsv(csvContent || '');
      setIsEditing(false);
  }, [csvContent]);

  const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditingCsv(event.target.value);
      // Ajuster la hauteur dynamiquement
      event.target.style.height = 'inherit';
      event.target.style.height = `${event.target.scrollHeight}px`;
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // >> MODIFIÉ: Valider sur Entrée simple <<
      if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          logger.debug(`[CsvTableRenderer - ${block.id}] Enter pressed, saving...`);
          handleSave();
      }
      // Annuler sur Escape (INCHANGÉ)
      else if (event.key === 'Escape') {
          event.preventDefault();
          handleCancel();
      }
      // Laisser Shift+Enter / Ctrl+Enter insérer une nouvelle ligne (comportement par défaut du textarea)
  };

  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    return level > 0 ? `${level * 1.5}rem` : '0rem';
  }, [indentationLevel]);

  const combinedStyle = useMemo(() => ({
    ...style,
    marginLeft: indentationPadding,
    width: '100%', // S'assurer que le div prend la largeur
    overflowX: 'auto' // Ajouter un scroll horizontal si la table est trop large
  }), [style, indentationPadding]);

  if (isEditing) {
    return (
      <div ref={ref} style={combinedStyle} {...rest}>
        <textarea
          ref={textareaRef}
          value={editingCsv}
          onChange={handleTextareaChange}
          onKeyDown={handleTextareaKeyDown}
          onBlur={handleSave} // Sauvegarder quand on perd le focus
          className="block w-full font-mono text-sm p-2 border border-blue-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-200"
          style={{ minHeight: '100px', resize: 'vertical' }} // Hauteur min et redimensionnement vertical
        />
      </div>
    );
  }

  if (!tableData) {
    return (
        <div ref={ref} style={combinedStyle} {...rest} className="text-red-500 p-2 border border-red-300 bg-red-50">
            Erreur lors du parsing du CSV pour le bloc {block.id}.
            <pre onDoubleClick={handleDoubleClick} style={{ cursor: 'pointer' }}>{csvContent || '(Vide)'}</pre>
        </div>
    );
  }

  // Utiliser les classes Bootstrap pour le thème (simplifié)
  const tableClasses = `table table-bordered table-sm ${theme ? `table-${theme}` : ''}`.trim();

  return (
    <div ref={ref} style={combinedStyle} {...rest} onClick={handleDoubleClick} title="Cliquez pour éditer le CSV">
        <table className={tableClasses} style={{ minWidth: '100%' }}>
            <thead>
                <tr>
                    {tableData.headers.map((header, index) => <th key={index}>{header}</th>)}
                </tr>
            </thead>
            <tbody>
                {tableData.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                        {row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );
});

CsvTableRenderer.displayName = 'CsvTableRenderer';

export default CsvTableRenderer; 