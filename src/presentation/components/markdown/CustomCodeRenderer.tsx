import React, { useState, useEffect, useMemo, useCallback, forwardRef, ForwardedRef } from 'react';
import { type CodeBlock, type MermaidBlock, markdownToBlocks } from '@/application/logic/markdownParser';
import MermaidDiagram from './MermaidDiagram';

import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import { CoreBlockEditor } from '../editor/CoreBlockEditor';
import type { LanguageMode } from '../../../application/hooks/useBlockEditor';
import { Trash2 } from 'lucide-react';
import { marked, type Tokens } from 'marked';
import { getBlockModuleByCodeLanguage } from '@/application/logic/blockRegistry';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';

import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css'; // Thème sombre sympa
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-markup-templating'; // Requis pour PHP
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-sql';

type InlineToken = Tokens.Link | Tokens.Image | Tokens.Strong | Tokens.Em | Tokens.Codespan | Tokens.Br | Tokens.Del | Tokens.Text | Tokens.HTML | Tokens.Generic;

const logger = new PinoLogger();

const SUPPORTED_LANGUAGES: LanguageMode[] = [
  'text', 'markdown', 'javascript', 'typescript', 'jsx', 'tsx', 'python', 'html', 'css', 'json', 'yaml', 'shell', 'xml', 'sql', 'java', 'csharp', 'php', 'c', 'cpp', 'ruby', 'go', 'rust'
];

import { useEditorCommands } from '@/application/context/EditorContext';

interface CustomCodeRendererProps {
  block: CodeBlock | MermaidBlock;
  listIndex?: number;
  index?: number;
  [key: string]: any;
}

const RenderTocFromTokens: React.FC<{ tokens: Tokens.List | undefined, level: number }> = ({ tokens, level }) => {
  if (!tokens || tokens.type !== 'list' || !tokens.items) {
    return null;
  }
  const paddingClass = `pl-${level * 4}`;
  return (
    <ul className={`list-none ${paddingClass}`}>
      {tokens.items.map((item, index) => {
        let linkText = '';
        let linkHref = '#';
        let nestedListTokens: Tokens.List | undefined = undefined;
        if (item.tokens && item.tokens.length > 0) {
          const contentToken = item.tokens.find(t => t.type === 'paragraph' || t.type === 'text') as Tokens.Paragraph | Tokens.Text | undefined;
          if (contentToken) {
            let potentialLinkTokensSource: InlineToken[] | undefined;
            if (contentToken.type === 'paragraph' && contentToken.tokens) {
              potentialLinkTokensSource = contentToken.tokens as InlineToken[];
            } else if (contentToken.type === 'text' && (contentToken as any).tokens) {
              potentialLinkTokensSource = (contentToken as any).tokens as InlineToken[];
            }
            if (potentialLinkTokensSource) {
              const linkToken = potentialLinkTokensSource.find(t => t.type === 'link') as Tokens.Link | undefined;
              if (linkToken) {
                linkText = linkToken.text;
                linkHref = linkToken.href;
              } else {
                linkText = contentToken.text || '';
              }
            } else if (contentToken.type === 'text') {
              const match = contentToken.text.match(/\\[(.*?)\\]\\(#.*?\\)/);
              if (match && match[1]) {
                linkText = match[1];
                const hrefMatch = contentToken.text.match(/\\(#(.*?)\\)/);
                if (hrefMatch && hrefMatch[1]) {
                  linkHref = `#${hrefMatch[1]}`;
                }
              } else {
                linkText = contentToken.text;
              }
            } else {
               linkText = contentToken.text || '';
            }
          }
          nestedListTokens = item.tokens.find(t => t.type === 'list') as Tokens.List | undefined;
        }
        return (
          <li key={index} className="mb-1">
            <a
              href={linkHref}
              onClick={(e) => {
                e.preventDefault();
                if (linkHref && linkHref.startsWith('#')) {
                  const targetId = linkHref.substring(1);
                  const targetElement = document.getElementById(targetId);
                  if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }
              }}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-sm cursor-pointer"
            >
              {linkText || 'Lien'}
            </a>
            {nestedListTokens && <RenderTocFromTokens tokens={nestedListTokens} level={level + 1} />}
          </li>
        );
      })}
    </ul>
  );
};

const CustomCodeRendererComponent = forwardRef<HTMLDivElement, CustomCodeRendererProps>(({
  block,
  listIndex,
  index,
  ...rest
}, ref: ForwardedRef<HTMLDivElement>) => {
  logger.debug(`[CustomCodeRenderer ID: ${block.id}] Rendering block. Type: ${block.type}, Language from content: ${(block.content as CodeBlock['content'])?.language}`);
  const { activeBlockId, setActiveBlockId, updateBlock, deleteBlock} = useEditorCommands();
  const isEditing = activeBlockId === block.id || rest.isEditingSource;
  const { id, metadata, type } = block;

  const [selectedLanguage, setSelectedLanguage] = useState<LanguageMode>(() => {
    const lang = (block.content as CodeBlock['content'])?.language;
    return SUPPORTED_LANGUAGES.includes(lang as LanguageMode) ? lang as LanguageMode : 'text';
  });

  // const content = block.content as CodeBlock['content'];
  const contentForModule = block.content as CodeBlock['content'];
  const moduleLanguage = contentForModule?.language || '';
  logger.debug(`[CustomCodeRenderer ID: ${id}] Attempting to find module. Language from contentForModule: ${contentForModule?.language}, derived moduleLanguage key: ${moduleLanguage}`);

  const module = type === 'code' ? getBlockModuleByCodeLanguage(moduleLanguage) : null;

  logger.debug(`[CustomCodeRenderer ID: ${id}] Module found for language '${moduleLanguage}':`, module ? `Type: ${module.type}, Has Renderer: ${!!module.RendererComponent}` : 'No module found');

  if (module && module.RendererComponent && !rest.isEditingSource) {
    logger.debug(`[CustomCodeRenderer ${id}] Module trouvé pour lang "${contentForModule?.language}". Utilisation de RendererComponent du module.`);
    const Renderer = module.RendererComponent;
    const customData = module.parseContent ? module.parseContent(contentForModule?.code || '', id) : {};
    
    const rendererProps: BlockRendererProps<any> = {
      block,
      customData,
      style: (rest as any).style
    };
    
    return <Renderer {...rendererProps} {...rest} />;
  }

  const indentationLevel = metadata?.indentationLevel ?? 0;
  const calculatedMarginLeft = useMemo(() => `${indentationLevel * 24}px`, [indentationLevel]);
  const initialEditorContent = useMemo(() => contentForModule?.code || '', [contentForModule]);

  useEffect(() => {
    if (type === 'code') {
      const langFromFile = contentForModule?.language as LanguageMode;
      if (langFromFile && SUPPORTED_LANGUAGES.includes(langFromFile) && langFromFile !== selectedLanguage) {
        setSelectedLanguage(langFromFile);
      }
    }
  }, [block, selectedLanguage, type, contentForModule]);

  useEffect(() => {
    if (!isEditing && type === 'code' && !module) {
      Prism.highlightAll();
    }
  }, [contentForModule?.code, contentForModule?.language, isEditing, type, module]);

  useEffect(() => {
    if (metadata?.isNewBlock && !isEditing) {
      setActiveBlockId(block.id);
      const updatedMetadata = { ...metadata };
      delete updatedMetadata.isNewBlock;
      updateBlock(id, block, { type: 'UPDATE_METADATA', metadata: updatedMetadata });
    }
  }, [metadata?.isNewisEditing, setActiveBlockId, updateBlock, id, block]);

  const handleEditorSave = (newRawContent: string) => {
    if (type === 'code') {
      const fullMarkdown = `\`\`\`${selectedLanguage}\n${newRawContent}\n\`\`\``;
      const newBlocks = markdownToBlocks(fullMarkdown);
      updateBlock(id, block, { type: 'REPLACE_WITH_BLOCKS', newBlocks });
    }
    setActiveBlockId(null);
    if (rest.setIsEditingSource) rest.setIsEditingSource(false);
  };

  const handleEditorCancel = useCallback(() => {
    if (type !== 'code') return;
    const originalLang = (contentForModule?.language && SUPPORTED_LANGUAGES.includes(contentForModule.language as LanguageMode))
                         ? contentForModule.language as LanguageMode
                         : 'text';
    setSelectedLanguage(originalLang);
    setActiveBlockId(null);
    if (rest.setIsEditingSource) rest.setIsEditingSource(false);
  }, [type, contentForModule, setActiveBlockId, rest]);

  const handleLanguageChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = event.target.value as LanguageMode;
    setSelectedLanguage(newLang);
  };

  if (type === 'code' && contentForModule?.language === 'summary') {
    const summaryMarkdown = typeof contentForModule?.code === 'string' ? contentForModule.code : '';
    let tocListToken: Tokens.List | undefined = undefined;
    if (summaryMarkdown) {
      try {
        const lexerResult = marked.lexer(summaryMarkdown);
        tocListToken = lexerResult.find(token => token.type === 'list') as Tokens.List | undefined;
      } catch (e) {
        logger.error("[CustomCodeRenderer Summary] Erreur lexing sommaire Markdown:", e);
      }
    }
    return (
      <div
        style={{ marginLeft: calculatedMarginLeft }}
        className="relative group nova-block code-block summary-block p-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-850 rounded-lg shadow-md text-sm"
        ref={ref}
        {...rest}
      >
        <h3 className="text-base font-semibold mb-3 text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 pb-2">
          Table des matières
        </h3>
        {tocListToken ? (
          <RenderTocFromTokens tokens={tocListToken} level={0} />
        ) : (
          <p className="text-gray-500 dark:text-gray-400">Sommaire vide ou erreur de génération.</p>
        )}
        <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => deleteBlock(id)}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-500 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="Supprimer le sommaire"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (type === 'mermaid') {
    const mermaidCode = contentForModule?.code || '';
    return (
      <div
        ref={ref}
        style={{ marginLeft: calculatedMarginLeft }}
        {...rest}
        className="nova-mermaid-block my-2 py-2 px-1 group relative"
        onClick={() => setActiveBlockId(id)}
      >
        <MermaidDiagram code={mermaidCode} />
        {/* deleteBlock exist on EditorContext */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => deleteBlock(id)}
            className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Supprimer le diagramme Mermaid"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (isEditing && type === 'code' && (!module || rest.isEditingSource)) {
    if (module && rest.isEditingSource) {
      return (
        <div ref={ref} style={{ marginLeft: calculatedMarginLeft }} {...rest} className="relative nova-code-block my-2">
          <CoreBlockEditor
            blockId={id}
            initialContent={initialEditorContent}
            onSave={handleEditorSave}
            onCancel={handleEditorCancel}
            languageMode={selectedLanguage}
            placeholder="Saisir le DSL..."
            autoFocus={true}
          />
        </div>
      );
    }

    return (
      <div ref={ref} style={{ marginLeft: calculatedMarginLeft }} {...rest} className="relative nova-code-block my-2">
        <div className="cm-editor-wrapper cm-code-editor-wrapper w-full p-2 border border-blue-500 rounded-md bg-white dark:bg-gray-900">
          <div className="mb-2 flex justify-between items-center">
            <select
              id={`lang-select-${id}`}
              value={selectedLanguage}
              onChange={handleLanguageChange}
              className="p-2 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
              aria-label="Choisir le langage du bloc de code"
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
          <CoreBlockEditor
            blockId={id}
            initialContent={initialEditorContent}
            onSave={handleEditorSave}
            onCancel={handleEditorCancel}
            languageMode={selectedLanguage}
            placeholder="Saisir votre code..."
            autoFocus={true}
          />
        </div>
      </div>
    );
  }

  const displayLanguageClass = contentForModule?.language ? `language-${contentForModule.language}` : 'language-text';
  const displayCode = contentForModule?.code || '';

  return (
    <div
      ref={ref}
      style={{ marginLeft: calculatedMarginLeft }}
      {...rest}
      className="relative nova-code-block my-2 group p-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-md transition-colors duration-150 ease-in-out"
      onClick={type === 'code' && !module ? () => setActiveBlockId(id) : undefined}
      title={type === 'code' && !isEditing && !module ? "Cliquer pour éditer" : undefined}
    >
      <pre className="p-3 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-sm" tabIndex={0}>
        <code className={displayLanguageClass}>{displayCode}</code>
      </pre>
      {type === 'code' && (!module || rest.isEditingSource) && (
         <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); deleteBlock(id); }}
              className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              title="Supprimer le bloc de code"
            >
              <Trash2 size={16} />
            </button>
          </div>
      )}
    </div>
  );
});

CustomCodeRendererComponent.displayName = 'CustomCodeRenderer';
export default React.memo(CustomCodeRendererComponent);