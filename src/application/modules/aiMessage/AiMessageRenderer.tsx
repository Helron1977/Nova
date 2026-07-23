import React from 'react';
import { BlockRendererProps } from '../../interfaces/blockModule';
import { Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface AiMessageData {
  content: string;
}

const AiMessageRenderer: React.FC<BlockRendererProps<AiMessageData>> = ({ customData }) => {
  return (
    <div className="w-full my-4 p-4 rounded-xl border border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-900/10 shadow-sm relative group">
      <div className="absolute -top-3 -left-3 bg-blue-500 text-white p-1.5 rounded-full shadow-md">
        <Bot size={16} />
      </div>
      <div className="text-sm text-gray-800 dark:text-gray-200 prose prose-sm dark:prose-invert max-w-none ml-2">
        <ReactMarkdown>{customData.content}</ReactMarkdown>
      </div>
    </div>
  );
};

export default AiMessageRenderer;
