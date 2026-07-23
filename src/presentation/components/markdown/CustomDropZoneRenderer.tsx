import React, { useCallback, useState, forwardRef, ForwardedRef, useRef } from 'react';
import type { DropZoneBlock } from '@/application/logic/markdownParser';
import { markdownToBlocks } from '@/application/logic/markdownParser';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';
import TurndownService from 'turndown';
import { UploadCloud, X } from 'lucide-react';

const logger = new PinoLogger();
const turndownService = new TurndownService();

import { useEditorCommands } from '@/application/context/EditorContext';

interface CustomDropZoneRendererProps {
  block: DropZoneBlock;
  style?: React.CSSProperties;
  [key: string]: any;
}

const CustomDropZoneRendererComponent = forwardRef<
  HTMLDivElement,
  CustomDropZoneRendererProps
>(({ block, style, listIndex, index, ...rest }, ref: ForwardedRef<HTMLDivElement>) => {
  const { updateBlock, deleteBlock } = useEditorCommands();
  const { id: blockId, metadata } = block;
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

  const processAndCommit = useCallback(async (dt: DataTransfer | null, files?: FileList | null) => {
    let markdownContent = '';
    const filesToProcess = files ?? dt?.files;

    if (filesToProcess && filesToProcess.length > 0) {
      logger.debug(`[CustomDropZoneRenderer ${blockId}] Processing ${filesToProcess.length} files.`);
      for (const file of Array.from(filesToProcess)) {
        if (file.type.startsWith('image/')) {
          try {
            const dataUrl = await readFileAsDataURL(file);
            markdownContent += `![${file.name}](${dataUrl})\n\n`;
          } catch (error) {
            logger.error(`[CustomDropZoneRenderer ${blockId}] Error reading image ${file.name}:`, error);
          }
        } else if (file.type === 'text/plain' || file.type === 'text/markdown' || file.name.endsWith('.md')) {
          try {
            const text = await file.text();
            markdownContent += text + '\n\n';
          } catch (error) {
            logger.error(`[CustomDropZoneRenderer ${blockId}] Error reading text file ${file.name}:`, error);
          }
        } else {
          logger.warn(`[CustomDropZoneRenderer ${blockId}] Unsupported file type: ${file.type}`);
        }
      }
    } else if (dt?.types.includes('text/html')) {
      const html = dt.getData('text/html');
      try {
        markdownContent = turndownService.turndown(html);
      } catch (error) {
        logger.error(`[CustomDropZoneRenderer ${blockId}] Error converting HTML:`, error);
        markdownContent = 'Erreur lors de la conversion du contenu HTML.';
      }
    } else if (dt?.types.includes('text/plain')) {
      markdownContent = dt.getData('text/plain');
    } else {
      logger.warn(`[CustomDropZoneRenderer ${blockId}] Unrecognized drop content.`);
      return;
    }

    if (markdownContent.trim()) {
      const newBlocks = markdownToBlocks(markdownContent.trim());
      updateBlock(blockId, block, { type: 'REPLACE_WITH_BLOCKS', newBlocks });
    }
  }, [blockId, updateBlock, block]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    await processAndCommit(event.dataTransfer);
  }, [processAndCommit]);

  const handleFileSelected = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      await processAndCommit(null, event.target.files);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processAndCommit]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    deleteBlock(blockId);
  }, [blockId, deleteBlock]);

  const indentationLevel = metadata?.indentationLevel ?? 0;
  const indentationStyle = {
    paddingLeft: indentationLevel > 0 ? `${indentationLevel * 1.5}rem` : '0rem',
  };

  return (
    <div
      ref={ref}
      style={{ ...style, ...indentationStyle }}
      className={`nova-dropzone-block p-6 my-2 border-2 rounded-lg text-center transition-all duration-150 ease-in-out relative cursor-pointer select-none
        ${isDraggingOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 scale-[1.01]'
          : 'border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleBrowseClick}
      title="Cliquer pour parcourir ou déposer des fichiers ici"
      {...rest}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept="image/*,.md,.txt,.markdown,text/plain,text/markdown"
        multiple
        className="hidden"
        onClick={(e) => e.stopPropagation()}
      />

      <UploadCloud
        size={32}
        className={`mx-auto mb-2 transition-colors ${isDraggingOver ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`}
      />
      <p className={`font-medium text-sm transition-colors ${isDraggingOver ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300'}`}>
        {isDraggingOver ? 'Relâchez pour déposer' : 'Déposez du contenu ici'}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
        Images, Markdown, texte, HTML — ou <span className="underline">cliquez pour parcourir</span>
      </p>

      <button
        onClick={handleRemove}
        className="absolute top-2 right-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors rounded-full p-0.5 hover:bg-red-50 dark:hover:bg-red-900/20"
        aria-label="Supprimer la zone de dépôt"
        title="Supprimer la zone de dépôt"
      >
        <X size={16} />
      </button>
    </div>
  );
});

CustomDropZoneRendererComponent.displayName = 'CustomDropZoneRenderer';
export default React.memo(CustomDropZoneRendererComponent);