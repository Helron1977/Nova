import React, { useState, useCallback } from 'react';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';
import type { ApiErrorsBlockData, FunctionalError } from './apiErrorsModule';
import ApiErrorsModule from './apiErrorsModule';
import { CoreBlockEditor } from '@/presentation/components/editor/CoreBlockEditor';
import { useEditorCommands } from '@/application/context/EditorContext';
import { Pencil, ArrowRight } from 'lucide-react';

interface ApiErrorsRendererSpecificProps extends BlockRendererProps<ApiErrorsBlockData> {}

const severityDotClass = (severity: FunctionalError['severity']) =>
  severity === 'blocking'
    ? 'bg-red-500 dark:bg-red-400'
    : 'bg-amber-500 dark:bg-amber-400';

const ErrorBadge: React.FC<{ error: FunctionalError }> = ({ error }) => {
  // data-error-desc alimente une règle CSS @media print (voir index.css) qui
  // affiche la description via `content: attr(...)` — l'attribut title seul
  // ne serait jamais visible au moment de l'impression / export PDF, faute
  // d'état ":hover" sur papier.
  return (
    <span
      className="nova-apierrors-badge inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
      title={error.description}
      data-error-desc={error.description}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${severityDotClass(error.severity)}`} />
      {error.isTransition ? (
        <>
          <span>{error.fromState}</span>
          <ArrowRight size={11} className="opacity-60" aria-hidden="true" />
          <span>{error.toState}</span>
        </>
      ) : (
        <span>{error.code ? `${error.code} · ${error.key}` : error.key}</span>
      )}
    </span>
  );
};

export const ApiErrorsRenderer: React.FC<ApiErrorsRendererSpecificProps> = ({ block, customData }) => {
  const { activeBlockId, updateBlock, setActiveBlockId } = useEditorCommands();
  const [isEditingSource, setIsEditingSource] = useState(activeBlockId === block.id);

  const handleSaveSource = useCallback(
    (newRawContent: string) => {
      const updatedBlock = ApiErrorsModule.updateBlockFromSource!(block, newRawContent, block.id);
      updateBlock(block.id, updatedBlock);
      setIsEditingSource(false);
      setActiveBlockId(null);
    },
    [block, updateBlock, setActiveBlockId]
  );

  if (isEditingSource) {
    return (
      <div className="nova-apierrors-block-editing my-2" data-block-id={block.id}>
        <CoreBlockEditor
          blockId={block.id}
          initialContent={customData.rawSource || ApiErrorsModule.defaultRawContent || ''}
          onSave={handleSaveSource}
          onCancel={() => {
            setIsEditingSource(false);
            setActiveBlockId(null);
          }}
        />
      </div>
    );
  }

  if (!customData.endpoints?.length) {
    return (
      <div
        className="p-3 my-2 border border-dashed text-gray-400 italic text-center rounded-lg cursor-pointer"
        data-block-id={block.id}
        onClick={() => setIsEditingSource(true)}
      >
        Aucune erreur fonctionnelle définie — cliquez pour éditer.
      </div>
    );
  }

  return (
    <div
      className="nova-apierrors-block my-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 relative group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      data-block-id={block.id}
      onClick={() => setIsEditingSource(true)}
      title="Cliquez pour éditer les erreurs fonctionnelles"
    >
      <button
        type="button"
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity print:hidden"
        onClick={(e) => { e.stopPropagation(); setIsEditingSource(true); }}
        aria-label="Modifier les erreurs fonctionnelles"
        title="Modifier les erreurs fonctionnelles"
      >
        <Pencil size={14} />
      </button>

      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" /> Récupérable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400" /> Bloquant
        </span>
        <span className="flex items-center gap-1.5">
          <ArrowRight size={11} className="opacity-60" aria-hidden="true" /> Transition d'état
        </span>
      </div>

      <div className="flex flex-col gap-2.5">
        {customData.endpoints.map((ep, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-blue-50 dark:bg-[#0d3b66] text-blue-800 dark:text-blue-50">
                {ep.method}
              </span>
              <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{ep.path}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ep.errors.map((err, j) => (
                <ErrorBadge key={j} error={err} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
