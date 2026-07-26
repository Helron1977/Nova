import React, { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Block } from '@/application/logic/markdownParser'; // ImageBlock n'est plus explicitement utilisé ici
import { markdownToBlocks } from '@/application/logic/markdownParser';
import Button from '../base/Button';
import { Send, ImagePlus, Rows, CheckSquare, Trash2, Sparkles } from 'lucide-react'; // Ajout des icônes

// Props mises à jour
interface PersistentInputZoneProps {
  onAddBlock: (newBlock: Block) => void;
  isSelectionModeActive: boolean;
  selectedBlockCount: number;
  onToggleSelectionMode: () => void;
  onDeleteSelectedBlocks: () => void;
  onSubmitPrompt?: (prompt: string) => void;
  isGenerating?: boolean;
}

const PersistentInputZone: React.FC<PersistentInputZoneProps> = ({
  onAddBlock,
  isSelectionModeActive,
  selectedBlockCount,
  onToggleSelectionMode,
  onDeleteSelectedBlocks,
  onSubmitPrompt,
  isGenerating = false,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isAIPromptMode, setIsAIPromptMode] = useState(false); // NOUVEAU
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };

  const addBlocks = useCallback((blocksToAdd: Block[]) => {
    if (blocksToAdd && blocksToAdd.length > 0) {
      let lastId = '';
      blocksToAdd.forEach(block => {
        const newId = uuidv4();
        lastId = newId;
        onAddBlock({ ...block, id: newId }); // Assure un ID unique
      });
      // Auto-scroll vers le dernier bloc ajouté
      setTimeout(() => window.dispatchEvent(new CustomEvent('nova-set-active-block', { detail: lastId })), 50);
    }
  }, [onAddBlock]);

  const handleSubmit = useCallback(() => {
    const trimmedInput = inputValue.trim();
    if (trimmedInput === '' || isGenerating) {
      return;
    }

    if (isAIPromptMode && onSubmitPrompt) {
      onSubmitPrompt(trimmedInput);
      setInputValue('');
      return;
    }

    const newBlocks = markdownToBlocks(trimmedInput);
    if (newBlocks && newBlocks.length > 0) {
      addBlocks(newBlocks);
    } else {
      // Fallback si le parsing ne retourne rien mais qu'il y a du texte
      const fallbackParagraph: Block = {
        id: uuidv4(),
        type: 'paragraph',
        content: { children: [{ type: 'text', value: trimmedInput }] },
        metadata: { indentationLevel: 0 }, // Assurez-vous que metadata est bien typé
        rawMarkdown: trimmedInput,
      };
      addBlocks([fallbackParagraph]);
    }
    setInputValue('');
  }, [inputValue, addBlocks, isAIPromptMode, onSubmitPrompt]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleFileDrop = useCallback(async (files: FileList) => {
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const imageName = file.name.split('.').slice(0, -1).join('.') || 'image';
          const imageMd = `![${imageName}](${base64data})`;
          const imageBlocks = markdownToBlocks(imageMd);
          if (imageBlocks && imageBlocks.length > 0) {
            addBlocks(imageBlocks);
          }
        };
        reader.onerror = () => {
          console.error('Erreur de lecture du fichier image.');
        };
        reader.readAsDataURL(file);
      }
      // Pourrait gérer d'autres types de fichiers ici (ex: .md)
    }
  }, [addBlocks]);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const onDragLeave = () => {
    setIsDraggingOver(false);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileDrop(files);
    } else if (event.dataTransfer.types.includes('text/plain')) {
      const droppedText = event.dataTransfer.getData('text/plain');
      setInputValue(prev => prev + droppedText);
    }
    event.dataTransfer.clearData();
  };

  const handleImageUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      handleFileDrop(event.target.files);
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (event.clipboardData.files && event.clipboardData.files.length > 0) {
      event.preventDefault();
      handleFileDrop(event.clipboardData.files);
    }
  }, [handleFileDrop]);

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-gray-100 dark:bg-gray-900 p-3 border-t border-gray-300 dark:border-gray-700 shadow-top z-50 print:hidden
                  ${isDraggingOver ? 'outline-dashed outline-2 outline-offset-[-4px] outline-blue-500 dark:outline-blue-400' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="max-w-4xl mx-auto flex items-center space-x-2"> {/* items-center pour alignement vertical */}
        {/* Boutons de gestion de la sélection */}
        <Button
          onClick={onToggleSelectionMode}
          variant={isSelectionModeActive ? "default" : "outline"}
          size="sm"
          title={isSelectionModeActive ? "Désactiver le mode sélection" : "Activer le mode sélection de blocs"}
          className="p-2" // Padding uniforme
        >
          {isSelectionModeActive ? <CheckSquare size={18} /> : <Rows size={18} />}
        </Button>

        {isSelectionModeActive && selectedBlockCount > 0 && (
          <Button
            onClick={onDeleteSelectedBlocks}
            variant="destructive"
            size="sm"
            title={`Supprimer les ${selectedBlockCount} bloc(s) sélectionné(s)`}
            className="p-2" // Padding uniforme
          >
            <Trash2 size={18} />
            {selectedBlockCount > 0 && <span className="ml-1.5 text-xs">({selectedBlockCount})</span>}
          </Button>
        )}
        {/* Fin des boutons de sélection */}

        {/* NOUVEAU : Bouton Mode IA */}
        <Button 
          onClick={() => setIsAIPromptMode(!isAIPromptMode)} 
          variant={isAIPromptMode ? "default" : "outline"} 
          size="sm" 
          title={isAIPromptMode ? "Désactiver Nova AI" : "Demander à Nova AI"} 
          className={`p-2 transition-all ${isAIPromptMode ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
        >
          <Sparkles size={18} className={isAIPromptMode ? "animate-pulse" : ""} />
        </Button>

        {!isAIPromptMode && (
          <>
            <Button onClick={handleImageUploadClick} variant="outline" size="sm" title="Ajouter une image (déposer ou cliquer)" className="p-2">
              <ImagePlus size={18} />
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelected}
              accept="image/*"
              multiple
              className="hidden"
            />
          </>
        )}
        
        <textarea
          id="nova-agent-input"
          ref={textareaRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isGenerating ? "Nova réfléchit et travaille sur le document..." : (isAIPromptMode ? "Demandez à Nova de modifier le bloc sélectionné, de corriger des fautes, ou de générer du contenu..." : "Écrire du Markdown, déposer un fichier image... (Ctrl+Enter pour ajouter)")}
          className={`flex-grow p-2 border rounded-md resize-none focus:ring-2 focus:border-transparent text-sm dark:bg-gray-800 dark:text-white transition-colors duration-300 ${
            isAIPromptMode 
              ? 'border-purple-500 focus:ring-purple-500 shadow-inner' 
              : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
          } ${isGenerating ? 'opacity-75' : ''}`}
          rows={2}
        />
        <Button 
          onClick={handleSubmit} 
          disabled={isGenerating}
          variant={isAIPromptMode ? "default" : "default"} 
          size="sm" 
          title={isAIPromptMode ? "Envoyer à l'IA (Ctrl+Enter)" : "Ajouter le bloc de texte (Ctrl+Enter)"} 
          className={`p-2 ${isAIPromptMode ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
        >
          <Send size={18} />
        </Button>
      </div>
    </div>
  );
};

export default PersistentInputZone;