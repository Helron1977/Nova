import React from 'react';
import type { CodeBlock, MermaidBlock } from '@/application/logic/markdownParser';
import MermaidDiagram from './MermaidDiagram';

interface CustomCodeRendererProps {
  block: CodeBlock | MermaidBlock;
}

const CustomCodeRenderer: React.FC<CustomCodeRendererProps> = ({ block }) => {
  const { code } = block.content;
  const language = block.type === 'code' ? block.content.language : 'mermaid';

  if (language === 'mermaid') {
    return <MermaidDiagram code={code} />;
  }

  const className = language ? `language-${language}` : undefined;

  return (
    <pre>
      <code className={className}>{code}</code>
    </pre>
  );
};

export default CustomCodeRenderer; 