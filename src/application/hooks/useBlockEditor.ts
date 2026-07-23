import { useRef, useEffect, useState, useCallback } from 'react';
import { EditorView, keymap, placeholder as cmPlaceholder, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { EditorState, Prec } from '@codemirror/state';
import { markdown as langMarkdown, markdownLanguage } from '@codemirror/lang-markdown';
import { LanguageSupport, StreamLanguage } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { indentWithTab, history, defaultKeymap, insertNewlineAndIndent } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/legacy-modes/mode/yaml'; 
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { PinoLogger } from '../../infrastructure/logging/PinoLogger';

// AJOUT: Compteur pour les instances d'EditorView
let viewInstanceCounter = 0;

// --- Assurez-vous que les types sont correctement définis ou importés ---
export type LanguageMode = 
  | 'markdown'
  | 'javascript'
  | 'typescript'
  | 'jsx'
  | 'tsx'
  | 'html'
  | 'css'
  | 'json'
  | 'python'
  | 'yaml'
  | 'shell'
  | 'mermaid'
  | 'text'
  | 'xml'
  | 'sql'
  | 'java'
  | 'csharp'
  | 'php'
  | 'c'
  | 'cpp'
  | 'ruby'
  | 'go'
  | 'rust'
  | 'other';

// AJOUT/MODIFICATION: Export du type pour le formatage inline
export type InlineFormatType = 'bold' | 'italic' | 'code' | 'strikethrough' | 'link' | 'image'; // Étendre si besoin

// MODIFIÉ: Exporter InlineMenuState
export interface InlineMenuState {
  show: boolean;
  top: number;
  left: number;
  hasSelection: boolean;
}

// MODIFIÉ: Renommer en CoreBlockEditorProps et exporter
export interface CoreBlockEditorProps {
  blockId: string;
  initialContent: string;
  languageMode?: LanguageMode;
  onSave: (content: string) => void;
  onCancel: () => void;
  onBlockIndent?: () => void;  
  onBlockOutdent?: () => void; 
  enableInlineFormatting?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  singleLine?: boolean; 
  onContentChange?: (newContent: string) => void;
  hideInternalControls?: boolean;
  initialClickCoords?: { x: number, y: number } | null;
  // logger?: PinoLogger; // Optionnel: permettre de passer un logger externe
}
// --- Fin de la vérification des types ---

const logger = new PinoLogger(); // Instancier le logger

// Fonction pour obtenir l'extension de langage appropriée
const getLanguageExtension = (mode: LanguageMode): LanguageSupport | StreamLanguage<unknown> => {
  switch (mode) {
    case 'javascript':
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'html':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'python':
      return python();
    case 'yaml':
      return StreamLanguage.define(yaml);
    case 'shell':
      return StreamLanguage.define(shell);
    case 'markdown':
    case 'mermaid': // Mermaid utilise le parseur Markdown pour l'instant
    case 'other':
    default:
      return langMarkdown({ base: markdownLanguage, codeLanguages: languages });
  }
};

// MODIFIÉ: Utiliser CoreBlockEditorProps
export const useBlockEditor = (options: CoreBlockEditorProps) => {
  const {
    blockId,
    initialContent,
    languageMode = 'markdown',
    onSave,
    onCancel,
    onBlockIndent,
    onBlockOutdent,
    enableInlineFormatting = false,
    autoFocus = false,
    placeholder = '',
    singleLine = false,
    onContentChange,
    hideInternalControls = true,
    initialClickCoords,
  } = options;

  const editorDomRef = useRef<HTMLDivElement>(null);
  const [blockEditorView, setBlockEditorView] = useState<EditorView | null>(null);
  const blockEditorViewRef = useRef<EditorView | null>(null); // Pour l'accès dans les callbacks
  const [isEditorReady, setIsEditorReady] = useState<boolean>(false);
  const [inlineMenuState, setInlineMenuState] = useState<InlineMenuState>({ show: false, top: 0, left: 0, hasSelection: false });
  
  // AJOUT: Stocker l'ID de l'instance de l'éditeur
  const editorInstanceIdRef = useRef<number | null>(null);

  // --- LOG IN useEffect ---
  useEffect(() => {
    // AJOUT: Générer et stocker l'ID de l'instance
    editorInstanceIdRef.current = ++viewInstanceCounter;
    const currentEditorInstanceId = editorInstanceIdRef.current; // Pour la closure

    logger.debug(`[useBlockEditor - ${blockId} - ID ${currentEditorInstanceId}] Main effect. initial: "${initialContent.substring(0,20)}", lang: "${languageMode}"`);
    
    if (!editorDomRef.current) {
      logger.warn(`[useBlockEditor - ${blockId}] Editor DOM ref not available.`);
      return;
    }

    const extensions = [
        // --- Extensions de base manuelles --- 
        lineNumbers(),
        highlightActiveLine(),
        history(),
        drawSelection(), // Pour voir la sélection
        EditorView.lineWrapping,
        keymap.of([
          ...defaultKeymap, 
          indentWithTab, 
        ]),
        // --- Fin des extensions de base manuelles ---

        getLanguageExtension(languageMode), // Utiliser la fonction helper

        cmPlaceholder(placeholder),

        Prec.highest(keymap.of([
            {
                key: 'Tab',
                run: (): boolean => {
                    if (onBlockIndent) {
                        onBlockIndent();
                        return true; 
                    }
                    return false; 
                },
            },
            {
                key: 'Shift-Tab',
                run: (): boolean => {
                    if (onBlockOutdent) {
                        onBlockOutdent();
                        return true;
                    }
                    return false; 
                },
            },
            {
                key: 'Enter',
                run: (view): boolean => {
                    if (singleLine) {
                        const content = view.state.doc.toString();
                        onSave(content);
                        return true;
                    }
                    return insertNewlineAndIndent(view);
                },
            },
            {
                key: 'Mod-Enter',
                run: (view): boolean => {
                    const content = view.state.doc.toString();
                    onSave(content);
                    return true;
                },
            },
            {
                key: 'Escape',
                run: (): boolean => {
                    onCancel();
                    return true;
                },
            },
        ])),
        EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                // Gérer les changements si nécessaire
                if (onContentChange) {
                    onContentChange(update.state.doc.toString());
                }
            }
            if (update.selectionSet && enableInlineFormatting) {
                const { state } = update.view;
                const selection = state.selection.main;
                if (!selection.empty) {
                    const coords = update.view.coordsAtPos(selection.head);
                    if (coords) {
                        setInlineMenuState({ show: true, top: coords.bottom + 5, left: coords.left, hasSelection: true });
                    } else {
                        setInlineMenuState({ show: false, top: 0, left: 0, hasSelection: false });
                    }
                } else {
                    setInlineMenuState({ show: false, top: 0, left: 0, hasSelection: false });
                }
            } else if (enableInlineFormatting) {
                setInlineMenuState({ show: false, top: 0, left: 0, hasSelection: false });
            }

            if (update.view !== blockEditorViewRef.current) {
                blockEditorViewRef.current = update.view;
            }
        }),
    ];

    const filteredExtensions = extensions.filter(ext => ext != null);

    const startState = EditorState.create({
        doc: initialContent || '',
        extensions: filteredExtensions,
    });

    const newView = new EditorView({
        state: startState,
        parent: editorDomRef.current,
    });

    setBlockEditorView(newView);
    blockEditorViewRef.current = newView;
    setIsEditorReady(true);

    if (autoFocus) {
        // Double requestAnimationFrame assure que le navigateur a fini de peindre
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (newView && !newView.hasFocus) {
                    newView.focus();
                }
                if (initialClickCoords && newView) {
                    const pos = newView.posAtCoords({ x: initialClickCoords.x, y: initialClickCoords.y }, false);
                    if (pos !== null) {
                        newView.dispatch({ selection: { anchor: pos } });
                    }
                }
            });
        });
    }

    // Cleanup function
    return () => {
        logger.debug(`[useBlockEditor - ${blockId} - ID ${currentEditorInstanceId}] Cleanup effect.`);
        setIsEditorReady(false);
        newView?.destroy();
        setBlockEditorView(null);
        blockEditorViewRef.current = null;
    };

  // Correction des dépendances de l'effet principal
  }, [blockId, initialContent, languageMode, onSave, onCancel, onBlockIndent, onBlockOutdent, enableInlineFormatting, autoFocus, placeholder, singleLine, onContentChange, hideInternalControls, initialClickCoords]); 
  // Note: editorDomRef n'est pas une dépendance car c'est un ref stable.

  // Fonction pour appliquer le formatage inline
  const applyInlineFormat = useCallback((formatType: InlineFormatType) => {
    const view = blockEditorViewRef.current;
    if (!view) return;

    const { state } = view;
    const selection = state.selection.main;
    if (selection.empty) return;

    let changes: any[] = []; // ChangeSpec[] de @codemirror/state
    let newSelectionAnchorOffset = 0;

    switch (formatType) {
      case 'bold':
        if (selection.empty) {
          changes.push({ from: selection.from, insert: '****' });
          newSelectionAnchorOffset = 2;
        } else {
          changes.push({ from: selection.from, insert: '**' });
          changes.push({ from: selection.to, insert: '**' });
        }
        break;
      case 'italic':
        if (selection.empty) {
          changes.push({ from: selection.from, insert: '**' });
          newSelectionAnchorOffset = 1;
        } else {
          changes.push({ from: selection.from, insert: '*' });
          changes.push({ from: selection.to, insert: '*' });
        }
        break;
      case 'code':
        if (selection.empty) {
          changes.push({ from: selection.from, insert: '``' });
          newSelectionAnchorOffset = 1;
        } else {
          changes.push({ from: selection.from, insert: '`' });
          changes.push({ from: selection.to, insert: '`' });
        }
        break;
      // AJOUTER LES CAS MANQUANTS SI NÉCESSAIRE
      case 'strikethrough':
        // Logique pour barré
        break;
      case 'link':
        // Logique pour lien
        break;
      case 'image':
        // Logique pour image
        break;
    }
    if (changes.length > 0) {
      view.dispatch({
        changes,
        selection: selection.empty ? { anchor: selection.from + newSelectionAnchorOffset } : undefined,
        userEvent: 'format'
      });
      view.focus();
    }

  }, []);

  // Fonction pour fermer le menu inline
  const closeInlineMenu = useCallback(() => {
    setInlineMenuState(prev => ({ ...prev, show: false }));
  }, []);


  return {
    editorRef: editorDomRef, // Le ref pour le DOM parent
    isEditorReady,
    inlineMenuState,
    closeInlineMenu,
    applyInlineFormat,
    view: blockEditorView, // L'instance EditorView (peut être null)
    editorInstanceId: editorInstanceIdRef.current, // AJOUT: Retourner l'ID
  };
}; 