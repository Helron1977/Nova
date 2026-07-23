import React, { useMemo, useState } from 'react';
import { type TableBlock, type InlineElement, markdownToBlocks } from '@/application/logic/markdownParser';

import { renderInlineElements } from './InlineElementRenderer';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { blocksToMarkdown } from '@/application/logic/markdownSerializer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

import { useEditorCommands } from '@/application/context/EditorContext';

interface CustomTableRendererProps {
  block: TableBlock;
  style?: React.CSSProperties;
  listIndex?: number;
  index?: number;
  attributes?: Record<string, any>;
}

const CustomTableRenderer = React.forwardRef<
  HTMLTableElement,
  CustomTableRendererProps
>(({ 
  block, 
  style, 
  listIndex,
  index,
  ...rest 
}, ref) => {
  const { activeBlockId, setActiveBlockId, updateBlock } = useEditorCommands();
  const isEditing = activeBlockId === block.id;

  const { align, rows } = block.content;
  const { metadata } = block;
  const indentationLevel = metadata?.indentationLevel;
  
  // États pour gérer l'édition
  const [editValue, setEditValue] = useState('');

  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    return level > 0 ? `${level * 1.5}rem` : '0rem';
  }, [indentationLevel]);

  const combinedStyle = useMemo(() => {
    // AJOUT: Calcul des pixels d'indentation
    const indentPx = (indentationLevel ?? 0) * 24; // Approx 1.5rem

    return {
      ...style,
      marginLeft: indentationPadding,
      // AJOUT: Calcul de la largeur et box-sizing
      width: `calc(100% - ${indentPx}px)`,
      maxWidth: '100%',
      boxSizing: 'border-box' as const,
    };
  }, [style, indentationPadding, indentationLevel]);

  // Handler pour le clic : passer en mode édition
  const handleClick = () => {
    try {
      // Convertir le bloc de tableau en Markdown
      const tableMarkdown = blocksToMarkdown([block]);
      logger.debug('[CustomTableRenderer] Converted table to Markdown for editing', { blockId: block.id });
      setEditValue(tableMarkdown);
      setActiveBlockId(block.id);
    } catch (error) {
      logger.error('[CustomTableRenderer] Error converting table to Markdown', { error, blockId: block.id });
    }
  };

  React.useEffect(() => {
    if (metadata?.isNewBlock && !isEditing) {
      try {
        const tableMarkdown = blocksToMarkdown([block]);
        setEditValue(tableMarkdown);
        setActiveBlockId(block.id);
        const updatedMetadata = { ...metadata };
        delete updatedMetadata.isNewBlock;
        updateBlock(block.id, block, { type: 'UPDATE_METADATA', metadata: updatedMetadata });
      } catch (error) {
        logger.error('[CustomTableRenderer] Error converting table for new block', error);
      }
    }
  }, [metadata?.isNewisEditing, setActiveBlockId, updateBlock, block]);

  // Handler pour sauvegarder les modifications
  const handleSave = () => {
    logger.debug('[CustomTableRenderer] Saving edited table', { blockId: block.id });
    const newBlocks = markdownToBlocks(editValue);
    updateBlock(block.id, block, { type: 'REPLACE_WITH_BLOCKS', newBlocks });
    setActiveBlockId(null);
  };

  // Handler pour annuler l'édition
  const handleCancel = () => {
    setActiveBlockId(null);
    logger.debug('[CustomTableRenderer] Cancelled table editing', { blockId: block.id });
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Si le focus passe à un enfant du composant, ignorer
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    handleSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Si en mode édition, afficher CodeMirror
  if (isEditing) {
    return (
      <div 
        style={{ marginLeft: indentationPadding }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        <CodeMirror
          value={editValue}
          onChange={setEditValue}
          extensions={[markdown()]}
          className="border border-gray-300 dark:border-gray-600 rounded p-2"
          theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
          autoFocus={true}
        />
      </div>
    );
  }

  // Vérifications pour le rendu du tableau
  if (!rows || rows.length === 0) {
    return null; // Ne rien rendre si pas de lignes
  }

  const headerRow = rows[0];
  const bodyRows = rows.slice(1);

  logger.debug('[CustomTableRenderer] Rendering table. Block ID:', block.id);
  logger.debug('[CustomTableRenderer] HeaderRow:', JSON.stringify(headerRow));
  logger.debug('[CustomTableRenderer] BodyRows:', JSON.stringify(bodyRows));
  logger.debug('[CustomTableRenderer] Align:', JSON.stringify(align));

  const getAlignmentStyle = (columnIndex: number): React.CSSProperties => {
    const alignment = align?.[columnIndex];
    switch (alignment) {
      case 'left':
        return { textAlign: 'left' };
      case 'center':
        return { textAlign: 'center' };
      case 'right':
        return { textAlign: 'right' };
      default:
        return {};
    }
  };

  // Rendu normal du tableau (mode lecture)
  return (
    <table 
      key={block.id} 
      ref={ref} 
      style={combinedStyle} 
      className="nova-block nova-table border-collapse border border-gray-300 dark:border-gray-600 my-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" 
      onClick={handleClick}
      title="Cliquez pour éditer le tableau"
      {...rest}
    >
      <thead>
        <tr>
          {headerRow.map((cellContent: InlineElement[], index: number) => (
            <th key={index} style={getAlignmentStyle(index)} >
              {renderInlineElements(cellContent, `${block.id}-th-${index}`)}
              {/* Static Header */}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {bodyRows.map((row: InlineElement[][], rowIndex: number) => {
          // S'assurer que row est bien un tableau avant de mapper
          if (!Array.isArray(row)) {
            logger.error('[CustomTableRenderer] Invalid row structure in bodyRows:', row);
            return <tr key={rowIndex}><td colSpan={headerRow?.length || 1}>Erreur de ligne</td></tr>;
          }
          return (
            <tr key={rowIndex}>
              {row.map((cellContent: InlineElement[], cellIndex: number) => {
                logger.debug('[CustomTableRenderer] Body Cell Content for renderInlineElements (new table):', JSON.stringify(cellContent));
                return (
                  <td key={cellIndex} style={getAlignmentStyle(cellIndex)} >
                    {renderInlineElements(cellContent, `${block.id}-td-${rowIndex}-${cellIndex}`)}
                    {/* Static Cell */}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  // // Rendu simplifié pour test (maintenant commenté)
  // logger.debug('[CustomTableRenderer] Attempting EXTREMELY simplified render for Block ID:', block.id);
  // return (
  //   <table ref={ref} style={combinedStyle} {...rest}>
  //     <thead>
  //       <tr>
  //         <th>Static Header 1</th>
  //       </tr>
  //     </thead>
  //     <tbody>
  //       <tr>
  //         <td>Static Body Cell 1</td>
  //       </tr>
  //     </tbody>
  //   </table>
  // );

});

CustomTableRenderer.displayName = 'CustomTableRenderer';

export default CustomTableRenderer; 