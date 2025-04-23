import React from 'react';
import type { ParagraphBlock } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';

interface CustomParagraphRendererProps {
  block: ParagraphBlock;
  style?: React.CSSProperties;
  [key: string]: any;
}

const CustomParagraphRenderer = React.forwardRef<
  HTMLParagraphElement,
  CustomParagraphRendererProps
>(({ block, style, ...rest }, ref) => {
  const { children } = block.content;

  return (
    <p 
      key={block.id} 
      ref={ref}
      style={style}
      {...rest}
    >
      {renderInlineElements(children, block.id)}
    </p>
  );
});

CustomParagraphRenderer.displayName = 'CustomParagraphRenderer';

export default CustomParagraphRenderer; 