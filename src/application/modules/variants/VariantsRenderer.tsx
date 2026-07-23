import React, { useState, useEffect, useCallback } from 'react';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';
import type { VariantsBlockData } from './variantsModule';
import VariantsModule, { parseVariantsContent } from './variantsModule';
import { CoreBlockEditor } from '@/presentation/components/editor/CoreBlockEditor';
import { markdownToBlocks } from '@/application/logic/markdownParser';
import { useEditorCommands } from '@/application/context/EditorContext';
import { Check, Pencil, X } from 'lucide-react';

interface VariantsRendererSpecificProps extends BlockRendererProps<VariantsBlockData> {}

export const VariantsRenderer: React.FC<VariantsRendererSpecificProps> = ({
  block,
  customData,
}) => {
  const { activeBlockId, updateBlock, setActiveBlockId } = useEditorCommands();
  const [activeTab, setActiveTab] = useState(0);
  const [isEditingSource, setIsEditingSource] = useState(false);
  const [adoptedLabel, setAdoptedLabel] = useState<string | null>(null);

  const isEditingFromParent = activeBlockId === block.id;
  useEffect(() => {
    if (isEditingFromParent) setIsEditingSource(true);
  }, [isEditingFromParent]);

  const variants = customData.variants || [];

  // Si le contenu change sous nos pieds (regénération IA), on reste sur un
  // index valide plutôt que de pointer dans le vide.
  useEffect(() => {
    if (activeTab >= variants.length) setActiveTab(0);
  }, [variants.length, activeTab]);

  const handleSaveSource = useCallback(
    (newRawSource: string) => {
      updateBlock(block.id, block, {
        type: 'UPDATE_SOURCE_FOR_MODULE',
        newRawSource,
        moduleType: VariantsModule.type,
      });
      setIsEditingSource(false);
      setActiveBlockId(null);
    },
    [block, updateBlock, setActiveBlockId]
  );

  const handleAdopt = useCallback(
    (variant: VariantsBlockData['variants'][number]) => {
      // Remplace le bloc "variantsBlock" par du contenu Markdown normal —
      // même stratégie que pour un <nova:update> classique, donc le bloc
      // résultant redevient un paragraphe/section ordinaire, éditable
      // normalement, id d'origine conservé sur le premier bloc résultant.
      const newBlocks = markdownToBlocks(variant.content);
      updateBlock(block.id, block, {
        type: 'REPLACE_WITH_BLOCKS',
        newBlocks,
      });
      setAdoptedLabel(variant.label);
    },
    [block, updateBlock]
  );

  if (isEditingSource) {
    return (
      <div className="nova-variants-block-editing my-2" data-block-id={block.id}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Édition des variantes (format : --- label ---)
          </span>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => {
              setIsEditingSource(false);
              setActiveBlockId(null);
            }}
            aria-label="Fermer l'édition"
          >
            <X size={16} />
          </button>
        </div>
        <CoreBlockEditor
          blockId={block.id}
          initialContent={customData.rawSource || VariantsModule.defaultRawContent || ''}
          onSave={handleSaveSource}
          onCancel={() => {
            setIsEditingSource(false);
            setActiveBlockId(null);
          }}
        />
      </div>
    );
  }

  if (variants.length === 0) {
    return (
      <div
        className="p-3 my-2 border border-dashed text-gray-400 italic text-center rounded-lg cursor-pointer"
        data-block-id={block.id}
        onClick={() => setIsEditingSource(true)}
      >
        Aucune variante — cliquez pour en ajouter.
      </div>
    );
  }

  return (
    <div className="nova-variants-block my-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" data-block-id={block.id}>
      <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-x-auto">
        {variants.map((variant, index) => (
          <button
            key={`${variant.label}-${index}`}
            type="button"
            onClick={() => setActiveTab(index)}
            className={`px-3 py-1.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === index
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {variant.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 pr-2">
          <button
            type="button"
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={() => setIsEditingSource(true)}
            aria-label="Modifier les variantes"
            title="Modifier les variantes"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>

      <div className="p-3">
        <div className="prose dark:prose-invert max-w-none text-sm whitespace-pre-wrap">
          {variants[activeTab]?.content}
        </div>

        {adoptedLabel === null ? (
          <button
            type="button"
            onClick={() => handleAdopt(variants[activeTab])}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Check size={14} />
            Adopter « {variants[activeTab]?.label} »
          </button>
        ) : (
          <p className="mt-3 text-xs text-gray-400 italic">
            « {adoptedLabel} » a été adopté et remplace ce bloc.
          </p>
        )}
      </div>
    </div>
  );
};

// Réexport pour cohérence avec les autres modules qui exposent parseVariantsContent
// depuis le renderer si besoin d'une preview live future (édition du raw avec debounce).
export { parseVariantsContent };
