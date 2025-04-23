import React from 'react';
import type { ListItemBlock } from '@/application/logic/markdownParser';
import { renderInlineElements } from './InlineElementRenderer';

interface CustomListItemRendererProps {
  block: ListItemBlock;
  style?: React.CSSProperties;
  [key: string]: any;
}

const CustomListItemRenderer = React.forwardRef<
  HTMLLIElement,
  CustomListItemRendererProps
>(({ block, style, ...rest }, ref) => {
  const { children } = block.content;
  const { checked } = block.metadata;

  const renderedChildren = renderInlineElements(children, block.id);

  let content;
  if (checked === true) {
    content = (
      <>
        <input type="checkbox" checked readOnly disabled className="mr-2 align-middle" />
        <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{renderedChildren}</span>
      </>
    );
  } else if (checked === false) {
    content = (
      <>
        <input type="checkbox" readOnly disabled className="mr-2 align-middle" />
        {renderedChildren}
      </>
    );
  } else {
    content = renderedChildren;
  }

  return (
    <li 
      key={block.id} 
      ref={ref} 
      style={style} 
      {...rest}
    >
      {content}
    </li>
  );
});

CustomListItemRenderer.displayName = 'CustomListItemRenderer';

export default CustomListItemRenderer; 