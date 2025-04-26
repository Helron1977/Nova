import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { ParagraphBlock, InlineElement, TextInline, StrongInline, EmphasisInline, HTMLInline, LinkInline, InlineCodeElement, DeleteInline } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { keymap, EditorView } from '@codemirror/view';
import { history, historyKeymap,  insertNewline } from '@codemirror/commands';
import { Prec, EditorState, ChangeSpec } from '@codemirror/state';

// Instancier le logger au niveau du module
const logger = new PinoLogger();

// Helper pour sérialiser les éléments inline en Markdown
const renderInlineElementsToMarkdown = (elements: InlineElement[]): string => {
    let markdownString = '';

    elements?.forEach(element => {
        if (!element) return;

        switch (element.type) {
            case 'text':
                markdownString += (element as TextInline).value;
                break;
            case 'strong':
                markdownString += `**${renderInlineElementsToMarkdown((element as StrongInline).children)}**`;
                break;
            case 'emphasis':
                markdownString += `*${renderInlineElementsToMarkdown((element as EmphasisInline).children)}*`;
                break;
            case 'inlineCode':
                markdownString += `\`${(element as InlineCodeElement).value}\``;
                break;
            case 'link':
                const link = element as LinkInline;
                const linkText = renderInlineElementsToMarkdown(link.children);
                const titlePart = link.title ? ` \"${link.title}\"` : '';
                markdownString += `[${linkText}](${link.url}${titlePart})`;
                break;
            case 'delete':
                markdownString += `~~${renderInlineElementsToMarkdown((element as DeleteInline).children)}~~`;
                break;
            case 'html':
                markdownString += (element as HTMLInline).value;
                break;
            default:
                const unknownElement = element as any; 
                logger.warn(`[renderInlineElementsToMarkdown] Unhandled inline element type: ${unknownElement?.type}`, { element });
                break;
        }
    });

    return markdownString;
};

interface CustomParagraphRendererProps {
  block: ParagraphBlock;
  style?: React.CSSProperties;
  onUpdateBlockContent?: (blockId: string, newMarkdown: string) => void;
  listIndex?: number;
  index?: number;
  onIncreaseIndentation?: (blockId: string) => void;
  onDecreaseIndentation?: (blockId: string) => void;
  [key: string]: any;
}

// Interface pour les props du menu
interface InlineFormatMenuProps {
  isVisible: boolean;
  top: number;
  left: number;
  hasSelection: boolean;
  onClose: () => void;
  onFormat: (formatType: 'bold' | 'italic' | 'strikethrough' | 'link' | 'inlineCode') => void;
}

// Composant Menu avec boutons conditionnels et labels modifiés
const InlineFormatMenu: React.FC<InlineFormatMenuProps> = ({ isVisible, top, left, hasSelection, onClose, onFormat }) => {
  if (!isVisible) return null;

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: `${top}px`,
    left: `${left}px`,
    border: '1px solid #ccc',
    zIndex: 100,
    boxShadow: '2px 2px 5px rgba(0,0,0,0.2)',
    display: 'flex',
    gap: '5px',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: '4px',
    padding: '4px 8px',
  };

  const buttonStyle: React.CSSProperties = {
      border: '1px solid #ccc',
      borderRadius: '3px',
      padding: '2px 6px',
      cursor: 'pointer',
      backgroundColor: 'white',
  };



  const handleFormatClick = (formatType: 'bold' | 'italic' | 'strikethrough' | 'link' | 'inlineCode') => {
    onFormat(formatType);
    onClose();
  };

  return (
    <div style={menuStyle} onMouseDown={(e) => e.preventDefault()}> 
      {hasSelection ? (
        <>
          <button style={buttonStyle} onClick={() => handleFormatClick('bold')} title="Gras (Ctrl+B)">G</button>
          <button style={buttonStyle} onClick={() => handleFormatClick('italic')} title="Italique (Ctrl+I)">I</button>
          <button style={buttonStyle} onClick={() => handleFormatClick('strikethrough')} title="Barré">B</button>
          <button style={buttonStyle} onClick={() => handleFormatClick('inlineCode')} title="Code Inline">{`<>`}</button>
        </>
      ) : (
        <>
          <button style={buttonStyle} onClick={() => handleFormatClick('link')} title="Insérer Lien">Link</button>
          <button style={buttonStyle} onClick={() => handleFormatClick('inlineCode')} title="Insérer Code">Code</button>
        </>
      )}
    </div>
  );
};

const CustomParagraphRendererComponent = React.forwardRef<
  HTMLDivElement,
  CustomParagraphRendererProps
>(({ block, style, onUpdateBlockContent, listIndex, index, onIncreaseIndentation, onDecreaseIndentation, ...rest }, ref) => {

  // << AJOUT: Log pour vérifier les props d'indentation >>
  logger.debug(`[CustomParagraphRenderer ${block.id}] Received props: onIncreaseIndentation is ${typeof onIncreaseIndentation}, onDecreaseIndentation is ${typeof onDecreaseIndentation}`);

  const { children } = block.content;
  const { indentationLevel } = block.metadata;
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const { id } = block;

  // --- Début: State et Refs pour le menu ---
  const viewRef = useRef<EditorView | null>(null);
  const [menuState, setMenuState] = useState<{ isVisible: boolean; top: number; left: number; hasSelection: boolean }>({
    isVisible: false,
    top: 0,
    left: 0,
    hasSelection: false,
  });
  // --- Fin: State et Refs pour le menu ---

  useEffect(() => {
    if (!isEditing) {
        const markdownText = renderInlineElementsToMarkdown(children);
        logger.debug(`[CustomParagraphRenderer - ${block.id}] useEffect triggered (not editing). Serialized children to Markdown:`, markdownText);
        setEditText(markdownText);
    } else {
         logger.debug(`[CustomParagraphRenderer - ${block.id}] useEffect triggered (editing). Skipping editText update.`);
    }
  }, [children, block.id, isEditing]);

  const handleClick = useCallback(() => {
    const currentMarkdown = renderInlineElementsToMarkdown(children);
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Entering edit mode. Initial Markdown:`, currentMarkdown);
    setEditText(currentMarkdown); 
    setIsEditing(true);
  }, [children, block.id]);

  const handleSave = useCallback(() => {
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Saving Markdown:`, editText);
    if (onUpdateBlockContent) {
      logger.debug(`[CustomParagraphRenderer - ${block.id}] Calling onUpdateBlockContent.`);
      onUpdateBlockContent(block.id, editText);
    } else {
      logger.warn(`[CustomParagraphRenderer - ${block.id}] onUpdateBlockContent is not defined. Cannot save changes.`);
    }
    setIsEditing(false);
  }, [editText, onUpdateBlockContent, block.id]);

  const handleCancel = useCallback(() => {
    const originalMarkdown = renderInlineElementsToMarkdown(children);
    logger.debug(`[CustomParagraphRenderer - ${block.id}] Cancelling edit. Resetting Markdown to:`, originalMarkdown);
    setEditText(originalMarkdown);
    setIsEditing(false);
    setMenuState({ isVisible: false, top: 0, left: 0, hasSelection: false });
  }, [children, block.id]);

  const closeMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  const handleContextMenu = useCallback((event: MouseEvent, view: EditorView): boolean => {
    event.preventDefault();
    const editorRect = view.dom.getBoundingClientRect();
    const menuTop = event.clientY - editorRect.top + 5;
    const menuLeft = event.clientX - editorRect.left + 5;
    const hasSelection = !view.state.selection.main.empty;
    logger.debug(`[CustomParagraphRenderer - ${id}] Context menu triggered. Has selection: ${hasSelection}`);
    setMenuState({ isVisible: true, top: menuTop, left: menuLeft, hasSelection: hasSelection });
    return true;
  }, [closeMenu, id]);

  const handleFormat = useCallback((formatType: 'bold' | 'italic' | 'strikethrough' | 'link' | 'inlineCode') => {
    const view = viewRef.current;
    if (!view) return;
    const mainSelection = view.state.selection.main;
    let changes: ChangeSpec[] = [];
    let prefix = '';
    let suffix = '';
    logger.debug(`[CustomParagraphRenderer - ${id}] Formatting as: ${formatType}`);

    switch (formatType) {
      case 'bold':
        prefix = '**'; suffix = '**';
        break;
      case 'italic':
        prefix = '*'; suffix = '*';
        break;
      case 'strikethrough':
        prefix = '~~'; suffix = '~~';
        break;
      case 'link':
        const selectedText = view.state.doc.sliceString(mainSelection.from, mainSelection.to);
        const url = prompt("Entrez l'URL du lien :", "https://") || "";
        if (url) {
          const linkText = selectedText || "texte du lien";
          const markdownLink = `[${linkText}](${url})`;
          changes.push({ from: mainSelection.from, to: mainSelection.to, insert: markdownLink });
        } else {
          return; // Ne rien faire si l'URL est annulée ou vide
        }
        break; // Sortir pour ne pas appliquer prefix/suffix
      case 'inlineCode':
        prefix = '`'; suffix = '`';
        // Si pas de sélection, insérer les backticks et placer le curseur entre
        if (mainSelection.empty) {
          changes.push({ from: mainSelection.from, insert: '``' });
          // Déplacer le curseur après l'insertion
          view.dispatch({ changes, selection: { anchor: mainSelection.from + 1 } });
          return; // Sortir car la transaction est déjà faite
        }
        break;
    }

    // Pour bold, italic, strikethrough (et inlineCode avec sélection)
    if (prefix && !mainSelection.empty) {
      changes.push({ from: mainSelection.from, insert: prefix });
      changes.push({ from: mainSelection.to, insert: suffix });
    }

    // Appliquer les changements (sauf pour link et inlineCode sans sélection qui ont déjà dispatché)
    if (changes.length > 0) {
        view.dispatch({ changes });
        // Refocus l'éditeur après l'action du menu
        view.focus();
    }

  }, [id]);

  const handleCreateEditor = useCallback((view: EditorView, state: EditorState) => {
    viewRef.current = view;
  }, []);

  const indentationPadding = useMemo(() => {
    const level = indentationLevel ?? 0;
    if (level > 0) {
        return `${level * 1.5}rem`;
    } 
    return '0rem';
  }, [indentationLevel]);

  const combinedStyle = useMemo(() => ({ 
      ...style, 
      paddingLeft: indentationPadding 
  }), [style, indentationPadding]);

  const customKeyBindings = useMemo(() => keymap.of([
     // Ajouter Ctrl+B pour Bold, Ctrl+I pour Italic
     {
        key: "Mod-b",
        run: () => { handleFormat('bold'); return true; }
     },
     {
        key: "Mod-i",
        run: () => { handleFormat('italic'); return true; }
     },
      {
          key: "Enter",
          run: () => {
              logger.debug(`[CustomParagraphRenderer - ${id}] Enter key pressed. Calling handleSave.`);
              handleSave();
              return true; 
          },
          shift: insertNewline 
      },
      {
          key: "Escape",
          run: () => {
              if (menuState.isVisible) {
                   closeMenu();
              } else {
                   handleCancel();
              }
              return true; 
          }
      },
      {
          key: "Tab",
          run: () => {
              if (onIncreaseIndentation) {
                  onIncreaseIndentation(id);
                  return true;
              }
              return false;
          },
          shift: () => {
              if (onDecreaseIndentation) {
                  onDecreaseIndentation(id);
                  return true;
              }
              return false;
          }
      },
  ]), [handleSave, handleCancel, onIncreaseIndentation, onDecreaseIndentation, id, closeMenu, menuState.isVisible, handleFormat]);

  const extensions = useMemo(() => [
      EditorView.domEventHandlers({
          contextmenu: handleContextMenu,
      }),
      history(),
      keymap.of([...historyKeymap]),
      markdown({ base: markdownLanguage, codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.theme({ "& .cm-gutters": { display: "none" } }),
      Prec.high(customKeyBindings),
  ], [customKeyBindings, handleContextMenu]);

  return (
    <div ref={ref} style={combinedStyle} {...rest} className="relative focus:outline-none">
      {isEditing ? (
        <>
          <CodeMirror
            value={editText}
            extensions={extensions}
            onChange={setEditText}
            onBlur={handleSave}
            autoFocus={true}
            className="codemirror-editor-instance w-full focus:outline-none bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
            minHeight="50px"
            onCreateEditor={handleCreateEditor}
          />
          <InlineFormatMenu
            isVisible={menuState.isVisible}
            top={menuState.top}
            left={menuState.left}
            hasSelection={menuState.hasSelection}
            onClose={closeMenu}
            onFormat={handleFormat}
          />
        </>
      ) : (
        <p 
          key={block.id}
          onClick={handleClick}
          title="Cliquez pour modifier"
        >
          {renderInlineElements(children, block.id)}
        </p>
      )}
      {menuState.isVisible && (
          <div
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
              onMouseDown={closeMenu}
          />
      )}
    </div>
  );
});

CustomParagraphRendererComponent.displayName = 'CustomParagraphRenderer';

const MemoizedCustomParagraphRenderer = React.memo(CustomParagraphRendererComponent);

export default MemoizedCustomParagraphRenderer; 