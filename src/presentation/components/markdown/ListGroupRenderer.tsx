import React, { Fragment } from 'react';
import type { ListItemBlock } from '@/application/logic/markdownParser';
import { markdownComponentsConfig } from '@/presentation/config/markdownComponentsConfig';
import CustomListWrapper from './CustomListWrapper';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger(); 

// --- Types et Helpers déplacés depuis MarkdownRenderer ---

// Helper type pour la structure interne de la liste
type ListNestingNode = {
  tag: 'ul' | 'ol';
  depth: number;
  children: (ListItemBlock | ListNestingNode)[];
};

// Fonction pour rendre récursivement la structure de liste imbriquée
const renderNestedList = (
  node: ListNestingNode | ListItemBlock, 
  index: number, 
  parentKey: string, 
  onUpdateBlockContent?: (blockId: string, newText: string) => void
): React.JSX.Element => {
  logger.debug(`[RenderList] Rendering node at index ${index}, parentKey: ${parentKey}, type: ${('type' in node) ? node.type : node.tag}`);

  if ('type' in node && node.type === 'listItem') {
    // Revenir à l'appel direct du composant de rendu via la config
    const BlockComponent = markdownComponentsConfig.listItem;
    if (!BlockComponent) {
        logger.error(`[RenderList] ListItem renderer not found in config!`);
        return <Fragment key={node.id}>Erreur: Renderer manquant</Fragment>;
    }
    // Note : Ce BlockComponent (CustomListItemRenderer) applique déjà ref, style, attrs
    // mais ici, nous ne lui passons pas ces props DND car ce contexte n'est pas triable.
    // Il recevra seulement la prop 'block'.
    return <BlockComponent 
             key={node.id} 
             block={node} 
             onUpdateBlockContent={onUpdateBlockContent}
           />;
    
  } else if ('tag' in node) {
    const currentListKey = `${parentKey}-child-${index}`;
    logger.debug(`[RenderList] Rendering ${node.tag} wrapper with key ${currentListKey}, children count: ${node.children.length}`);
    return (
      <CustomListWrapper key={currentListKey} ordered={node.tag === 'ol'}>
        {node.children.map((child: ListItemBlock | ListNestingNode, childIndex: number) => 
          renderNestedList(child, childIndex, currentListKey, onUpdateBlockContent) 
        )}
      </CustomListWrapper>
    );
  } else {
      logger.error("[RenderList] Error: Unknown node type in list structure", { node });
      return <Fragment key={`${parentKey}-error-${index}`}>Erreur de noeud de liste</Fragment>;
  }
};

// Fonction pour construire la structure de liste imbriquée
const buildListTree = (listItems: ListItemBlock[]): ListNestingNode | null => {
  logger.debug('[BuildTree] Building tree for items:', listItems.map(item => item.id)); // Log IDs
  if (!listItems || listItems.length === 0) return null;

  const rootNode: ListNestingNode = {
    tag: listItems[0].metadata.ordered ? 'ol' : 'ul',
    depth: 0,
    children: [],
  };
  const stack: ListNestingNode[] = [rootNode];

  listItems.forEach((item, itemIndex) => {
    const currentDepth = item.metadata.depth;
    const currentTag = item.metadata.ordered ? 'ol' : 'ul';
    logger.debug(`[BuildTree] Processing item ${itemIndex} (ID: ${item.id}): depth=${currentDepth}, ordered=${item.metadata.ordered}`);

    while (stack.length - 1 > currentDepth) {
       logger.debug(`[BuildTree] Popping ${stack[stack.length - 1].tag} at depth ${stack[stack.length - 1].depth} because item depth is ${currentDepth}`);
       stack.pop();
    }

    let parentNode = stack[stack.length - 1];
    logger.debug(`[BuildTree] Parent node is ${parentNode.tag} at depth ${parentNode.depth}. Item depth: ${currentDepth}`);

    if (currentDepth > parentNode.depth) {
        if (currentDepth !== parentNode.depth + 1) {
             logger.warn(`[BuildTree] Depth jump detected! Item ID ${item.id} depth ${currentDepth}, parent depth ${parentNode.depth}`);
        }
        logger.debug(`[BuildTree] Creating new ${currentTag} list at depth ${currentDepth} under parent depth ${parentNode.depth}`);
        const newNode: ListNestingNode = {
            tag: currentTag,
            depth: currentDepth,
            children: [],
        };
        parentNode.children.push(newNode);
        stack.push(newNode);
        parentNode = newNode;
    } 

    logger.debug(`[BuildTree] Adding item ID ${item.id} to ${parentNode.tag} at depth ${parentNode.depth}`);
    parentNode.children.push(item);
  });

  logger.debug('[BuildTree] Final generated tree structure (root node):', rootNode);
  return rootNode;
};

// --- Composant Principal ListGroupRenderer ---

interface ListGroupRendererProps {
  listItems: ListItemBlock[];
  onUpdateBlockContent?: (blockId: string, newText: string) => void;
}

const ListGroupRenderer: React.FC<ListGroupRendererProps> = ({ listItems, onUpdateBlockContent }) => {
  logger.debug('[ListGroupRenderer] Rendering group with items:', listItems);
  const listTree = buildListTree(listItems);

  if (listTree) {
    // Utiliser l'ID du premier item pour la clé racine
    const rootListKey = `${listItems[0]?.id || 'list'}-listroot`; 
    return renderNestedList(listTree, 0, rootListKey, onUpdateBlockContent);
  } else {
    logger.warn('[ListGroupRenderer] buildListTree returned null for group:', listItems);
    return null; // Ne rien rendre si l'arbre n'a pas pu être construit
  }
};

export default ListGroupRenderer; 