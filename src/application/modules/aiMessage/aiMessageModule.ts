import { BlockModule } from '../../interfaces/blockModule';
import AiMessageRenderer, { AiMessageData } from './AiMessageRenderer';
import { Bot } from 'lucide-react';
import type { Block } from '../../logic/markdownParser';

const AiMessageModule: BlockModule<AiMessageData> = {
  type: 'ai-message',
  codeBlockLanguage: 'ai-message',
  displayName: 'Message IA',
  icon: Bot,
  
  parseContent: (rawContent: string): AiMessageData => {
    return {
      content: rawContent || "Je réfléchis...",
    };
  },

  serializeContent: (data: AiMessageData): string => {
    return data.content;
  },

  RendererComponent: AiMessageRenderer,
  
  defaultRawContent: "Bonjour, je suis l'IA de Nova.",

  // Ce bloc est ignoré par l'AST !
  getAIASTNode: (_block: Block): Record<string, any> => {
    return {
      type: 'ai-message',
      status: 'ignored' // Indique qu'il sera filtré (on s'assurera de l'ignorer dans astGenerator)
    };
  },

  getAIPrompt: () => ''
};

export default AiMessageModule;
