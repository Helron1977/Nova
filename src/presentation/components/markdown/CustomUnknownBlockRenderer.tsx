import React from 'react';
import type { Block } from '@/application/logic/markdownParser';

interface CustomUnknownBlockRendererProps {
  block: Block;
}

export const CustomUnknownBlockRenderer: React.FC<CustomUnknownBlockRendererProps> = ({ block }) => {
  return (
    <div className="p-4 my-2 border border-dashed border-red-500 bg-red-50 rounded-md">
      <p className="font-semibold text-red-700">Type de Bloc Inconnu</p>
      <p className="text-sm text-red-600">Le type de bloc "<span className="font-mono">{block.type}</span>" n'est pas reconnu ou ne peut pas être affiché.</p>
      <p className="mt-2 text-xs text-gray-500">ID du bloc: <span className="font-mono">{block.id}</span></p>
      {block.rawMarkdown && (
        <details className="mt-1 text-xs">
          <summary className="cursor-pointer text-gray-600">Voir le Markdown brut</summary>
          <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 overflow-x-auto">
            {block.rawMarkdown}
          </pre>
        </details>
      )}
    </div>
  );
}; 