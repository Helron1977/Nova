import type { BaseBlock, UniversalBlockMetadata } from '@/application/logic/markdownParser';

export interface DrawingBlockData {
  svgPathCommands: string; // Contiendra les commandes de path SVG, ex: "M10 10 L20 20"
  width: number; 
  height: number; 
  strokeColor?: string;
  strokeWidth?: number;
}

export interface DrawingBlock extends BaseBlock {
  type: 'drawingBlock'; // Le type spécifique
  content: {
    code: string; // La source brute (commandes SVG)
    language: 'drawing'; // Le langage d'origine
    customBlockData: DrawingBlockData;
  };
  metadata: UniversalBlockMetadata; // Utiliser UniversalBlockMetadata
} 