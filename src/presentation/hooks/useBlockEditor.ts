import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorState, Compartment, ChangeSpec, Extension } from '@codemirror/state';
import { EditorView, keymap, placeholder as placeholderExt, DOMEventHandlers } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentMore, indentLess, insertNewlineAndIndent } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { basicSetup } from 'codemirror';

// Importation des langages CodeMirror
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
// import { shell } from '@codemirror/lang-shell'; // Temporairement commenté
import { rust } from '@codemirror/lang-rust';

// Étendre LanguageMode avec les nouveaux langages
export type LanguageMode = 
  | 'markdown' 
  | 'javascript' 
  | 'typescript' // Géré via javascript({ typescript: true })
  | 'python' 
  | 'html' 
  | 'css' 
  | 'json' 
  | 'xml'
  | 'sql'
  | 'java'
  | 'cpp'
  | 'php'
  // | 'shell' // Temporairement commenté
  | 'rust'
  | 'text'; // Mode texte brut par défaut

export type InlineFormatType = 'bold' | 'italic' | 'strikethrough' | 'link' | 'inlineCode' | 'image';

// RENOMMER et EXPORTER CETTE INTERFACE pour l'utiliser dans CoreBlockEditor.tsx
export interface CoreBlockEditorProps { // Anciennement UseBlockEditorProps
  blockId: string;
  initialContent: string;
  languageMode?: LanguageMode;
  onSave: (newContent: string) => void;
  onCancel: () => void;
  onBlockIndent?: () => void;
  onBlockOutdent?: () => void;
  onToggleCheckbox?: (currentContent: string) => string | null;
  placeholder?: string;
  autoFocus?: boolean;
  enableInlineFormatting?: boolean;
  singleLine?: boolean;
  autosave?: boolean;
  onContentChange?: (newContent: string) => void;
  hideInternalControls?: boolean; // Ajout pour masquer les boutons Valider/Annuler
}

const languageCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

// Mise à jour de getLanguageExtension pour gérer les nouveaux langages
const getLanguageExtension = (mode?: LanguageMode): Extension => {
  switch (mode) {
    case 'markdown':
      return markdown({ base: markdownLanguage, codeLanguages: languages });
    case 'javascript':
      return javascript();
    case 'typescript':
      return javascript({ typescript: true });
    case 'python':
      return python();
    case 'html':
      return html();
    case 'css':
      return css();
    case 'json':
      return json();
    case 'xml':
      return xml();
    case 'sql':
      return sql();
    case 'java':
      return java();
    case 'cpp':
      return cpp();
    case 'php':
      return php();
    // case 'shell': // Temporairement commenté
    //   return shell(); 
    case 'rust':
      return rust();
    case 'text': // Mode texte brut par défaut
    default:
      return []; // Aucune extension spécifique, ou une extension pour texte brut si disponible
  }
};

// EXPORTER CETTE INTERFACE
export interface InlineMenuState {
  show: boolean;
  top: number;
  left: number;
  hasSelection: boolean;
}

// Extension CodeMirror pour limiter à une seule ligne
function singleLineExtension(onSave: (content: string) => void): Extension[] {
  return [
    EditorView.domEventHandlers({
      // Bloquer Enter (valider au lieu d'insérer une nouvelle ligne)
      keydown(event, view) {
        if (event.key === 'Enter') {
          event.preventDefault();
          onSave(view.state.doc.toString());
          return true;
        }
        return false;
      },
      // Bloquer le collage de retour à la ligne
      paste(event, view) {
        const clipboard = event.clipboardData?.getData('text');
        if (clipboard && clipboard.includes('\n')) {
          event.preventDefault();
          const filtered = clipboard.replace(/\n/g, ' ');
          view.dispatch({ changes: { from: view.state.selection.main.from, to: view.state.selection.main.to, insert: filtered } });
          return true;
        }
        return false;
      }
    }),
    EditorState.transactionFilter.of(tr => {
      // Bloquer toute insertion de nouvelle ligne
      if (tr.newDoc.lines > 1) {
        const text = tr.newDoc.toString().replace(/\n/g, ' ');
        return [tr.startState.update({ changes: { from: 0, to: tr.startState.doc.length, insert: text } })];
      }
      return tr;
    }),
    EditorView.theme({
      '.cm-content': { overflowY: 'hidden', maxHeight: '2.5em' },
    })
  ];
}

// AJOUT: Compteur pour les instances d'EditorView
let viewInstanceCounter = 0;

export function useBlockEditor({
  blockId,
  initialContent,
  languageMode = 'markdown',
  onSave,
  onCancel,
  onBlockIndent,
  onBlockOutdent,
  placeholder,
  autoFocus = true,
  enableInlineFormatting = false,
  singleLine = false,
  autosave = false,
  onContentChange,
}: CoreBlockEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [isReady, setIsReady] = useState(false);

  // AJOUT: Stocker l'ID de l'instance de l'éditeur
  const editorInstanceIdRef = useRef<number | null>(null);

  const [inlineMenuState, setInlineMenuState] = useState<InlineMenuState>({
    show: false,
    top: 0,
    left: 0,
    hasSelection: false,
  });

  const closeInlineMenu = useCallback(() => {
    setInlineMenuState((prev) => ({ ...prev, show: false }));
  }, []);

  useEffect(() => {
    if (!inlineMenuState.show) return;
    const handleClickOutside = (/*event: MouseEvent*/) => {
      closeInlineMenu();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [inlineMenuState.show, closeInlineMenu]);

  const applyInlineFormat = useCallback((formatType: InlineFormatType) => {
    const view = viewRef.current;
    if (!view) return;

    view.focus();

    const mainSelection = view.state.selection.main;
    let changes: ChangeSpec[] = [];
    let newSelectionAnchorOffset = 0;

    // Ajout des logs pour le débogage
    console.log(`[useBlockEditor] applyInlineFormat called for type: ${formatType}`);
    console.log(`[useBlockEditor] Selection from: ${mainSelection.from}, to: ${mainSelection.to}, empty: ${mainSelection.empty}`);
    const lineAtFrom = view.state.doc.lineAt(mainSelection.from);
    console.log(`[useBlockEditor] Line @ from (${mainSelection.from}): L${lineAtFrom.number} '${lineAtFrom.text}' (length ${lineAtFrom.length})`);
    if (!mainSelection.empty) {
      const lineAtTo = view.state.doc.lineAt(mainSelection.to);
      console.log(`[useBlockEditor] Line @ to (${mainSelection.to}): L${lineAtTo.number} '${lineAtTo.text}' (length ${lineAtTo.length})`);
      console.log(`[useBlockEditor] Selected text: '${view.state.sliceDoc(mainSelection.from, mainSelection.to)}'`);
    }
    // Fin des logs de débogage

    switch (formatType) {
      case 'bold':
        if (mainSelection.empty) {
          changes.push({ from: mainSelection.from, insert: '****' });
          newSelectionAnchorOffset = 2;
        } else {
          changes.push({ from: mainSelection.from, insert: '**' });
          changes.push({ from: mainSelection.to, insert: '**' });
        }
        break;
      case 'italic':
        if (mainSelection.empty) {
          changes.push({ from: mainSelection.from, insert: '**' });
          newSelectionAnchorOffset = 1;
        } else {
          changes.push({ from: mainSelection.from, insert: '*' });
          changes.push({ from: mainSelection.to, insert: '*' });
        }
        break;
      case 'strikethrough':
         if (mainSelection.empty) {
          changes.push({ from: mainSelection.from, insert: '~~~~' }); 
          newSelectionAnchorOffset = 2;
        } else {
          changes.push({ from: mainSelection.from, insert: '~~' });
          changes.push({ from: mainSelection.to, insert: '~~' });
        }
        break;
      case 'link': {
        const url = prompt("Entrez l'URL du lien:", "https://");
        if (!url) return;
        const textToWrap = mainSelection.empty ? "texte du lien" : view.state.sliceDoc(mainSelection.from, mainSelection.to);
        changes.push({ from: mainSelection.from, to: mainSelection.to, insert: `[${textToWrap}](${url})` });
        newSelectionAnchorOffset = mainSelection.empty ? (`[${textToWrap}](${url})`).length : 0; 
        break;
      }
      case 'inlineCode':
        if (mainSelection.empty) {
          changes.push({ from: mainSelection.from, insert: '``' }); 
          newSelectionAnchorOffset = 1;
        } else {
          changes.push({ from: mainSelection.from, insert: '`' });
          changes.push({ from: mainSelection.to, insert: '`' });
        }
        break;
      case 'image': {
        if (mainSelection.empty) {
          const imageUrl = prompt("Entrez l'URL de l'image:", "https://");
          if (!imageUrl) break;

          const imageAlt = prompt("Entrez le texte alternatif pour l'image (laisser vide si aucun):", "");
          const altText = imageAlt === null ? "" : imageAlt;

          const markdownImage = `![${altText}](${imageUrl})`;
          changes.push({ from: mainSelection.from, insert: markdownImage });
        } else {
          console.warn("[useBlockEditor] L'insertion d'image sur une sélection existante n'est pas gérée.");
        }
        break;
      }
    }

    if (changes.length > 0) {
      view.dispatch({
        changes,
        selection: mainSelection.empty ? { anchor: mainSelection.from + newSelectionAnchorOffset } : undefined,
        userEvent: 'format'
      });
      view.focus();
    }
  }, []);

  const domEventHandlers: DOMEventHandlers<EditorView> = {
    contextmenu: (event: MouseEvent, view: EditorView) => {
      if (!enableInlineFormatting) return false;
      event.preventDefault();
      setInlineMenuState({
        show: true,
        top: event.clientY,
        left: event.clientX,
        hasSelection: !view.state.selection.main.empty,
      });
      return true;
    },
  };

  useEffect(() => {
    if (!editorRef.current) return;

    // AJOUT: Générer et stocker l'ID de l'instance
    editorInstanceIdRef.current = ++viewInstanceCounter;
    const currentEditorInstanceId = editorInstanceIdRef.current;
    console.log(`[useBlockEditor ${blockId}] MAIN useEffect RUN. Creating new EditorView ID: ${currentEditorInstanceId}. autoFocus: ${autoFocus}, initialContent: "${initialContent.substring(0, 30)}..."`);

    const extensions: Extension[] = [
      basicSetup,
      history(),
      EditorView.lineWrapping,
      languageCompartment.of(getLanguageExtension(languageMode)),
      keymap.of([
        {
/*           key: 'Mod-Enter',
          run: (targetViewInstance) => {
            // Mod-Enter sauvegarde toujours le contenu
            console.log(`[useBlockEditor ${blockId} - EditorView ${currentEditorInstanceId}] Mod-Enter pressed (save).`);
            if (viewRef.current && viewRef.current.state && viewRef.current.state.doc) {
              const content = viewRef.current.state.doc.toString();
              onSave(content);
            } else {
              console.warn(`[useBlockEditor ${blockId} - EditorView ${currentEditorInstanceId}] viewRef.current, its state, or doc is null on Mod-Enter (save).`);
            }
            return true; // Empêche le comportement par défaut
          }, */
        },
        {
          key: 'Enter',
          run: (targetView) => {
            // Enter insère une nouvelle ligne, sauf si singleLine
            if (singleLine) {
              return false; 
            }
            // Pour les éditeurs multi-lignes, insérer une nouvelle ligne.
            // Utilisation de insertNewlineAndIndent
            if (typeof insertNewlineAndIndent === 'function') {
               insertNewlineAndIndent(targetView);
            } else {
              console.warn("[useBlockEditor] insertNewlineAndIndent command not available. Default Enter behavior might occur.");
              return false; 
            }
            return true; // Comportement géré
          },
        },
        {
          key: 'Escape',
          run: (/*target*/) => {
            if (inlineMenuState.show) {
              closeInlineMenu();
              return true;
            }
            onCancel();
            return true;
          },
        },
        {
          key: 'Tab',
          run: (target) => {
            if (onBlockIndent) {
              onBlockIndent();
              return true;
            }
            return indentMore(target);
          },
          shift: (target) => {
            if (onBlockOutdent) {
              onBlockOutdent();
              return true;
            }
            return indentLess(target);
          }
        },
        {
            key: 'Mod-b',
            run: (/*view*/) => { 
                if (!enableInlineFormatting) return false;
                applyInlineFormat('bold');
                return true;
            }
        },
        {
            key: 'Mod-i',
            run: (/*view*/) => { 
                if (!enableInlineFormatting) return false;
                applyInlineFormat('italic');
                return true;
            }
        },
        ...defaultKeymap,
        ...historyKeymap,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          console.log(`[useBlockEditor ${blockId} - EditorView ${currentEditorInstanceId} - updateListener] docChanged. New content: "${update.state.doc.toString()}"`);
          if (onContentChange) {
            onContentChange(update.state.doc.toString());
          }
        }
        if (viewRef.current && autosave) { 
            // Logique pour l'autosave si nécessaire
        }
      }),
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
      ...(singleLine ? singleLineExtension(onSave) : []),
    ];

    if (enableInlineFormatting) {
      extensions.push(EditorView.domEventHandlers(domEventHandlers));
    }

    if (placeholder) {
      extensions.push(placeholderExt(placeholder));
    }

    const startState = EditorState.create({
      doc: initialContent,
      extensions,
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;
    setIsReady(true);

    if (autoFocus) {
      // Wrapping focus in setTimeout to ensure the editor is fully in the DOM and ready.
      setTimeout(() => {
        if (viewRef.current && editorRef.current && document.body.contains(editorRef.current)) {
            viewRef.current.focus();
            console.log(`[useBlockEditor ${blockId} - EditorView ${currentEditorInstanceId}] Focused.`);
        } else {
            console.warn(`[useBlockEditor ${blockId} - EditorView ${currentEditorInstanceId}] Could not focus. View or editorRef not current or not in DOM.`);
        }
      }, 0);
    }

    return () => {
      console.log(`[useBlockEditor ${blockId}] MAIN useEffect CLEANUP. Destroying EditorView ID: ${currentEditorInstanceId}.`);
      setIsReady(false);
      // Important: Il faut utiliser la 'view' de la closure de cet effet pour la destruction,
      // et vérifier viewRef.current pour éviter de le nullifier si une nouvelle vue a déjà été assignée.
      if (viewRef.current === view) {
          viewRef.current = null;
      }
      view.destroy();
    };
  }, [
    blockId, 
    languageMode, 
    placeholder, 
    autoFocus, 
    enableInlineFormatting, 
    onSave,
    onCancel, 
    onBlockIndent, 
    onBlockOutdent,
    closeInlineMenu,
    applyInlineFormat,
    singleLine,
    autosave,
    onContentChange
  ]);

  const setContent = (content: string) => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: content }
      });
    }
  };
  
  useEffect(() => {
    if (viewRef.current && initialContent !== viewRef.current.state.doc.toString() && isReady && !viewRef.current.hasFocus) {
    }
  }, [initialContent, isReady, blockId]);

  useEffect(() => {
    if (viewRef.current && isReady) {
      viewRef.current.dispatch({
        effects: languageCompartment.reconfigure(getLanguageExtension(languageMode))
      });
    }
  }, [languageMode, isReady]);

  return { 
    editorRef, 
    view: viewRef.current, 
    setContent, 
    isEditorReady: isReady,
    inlineMenuState,
    closeInlineMenu,
    applyInlineFormat,
    editorInstanceId: editorInstanceIdRef.current, // AJOUT: Retourner l'ID de l'instance
  };
} 