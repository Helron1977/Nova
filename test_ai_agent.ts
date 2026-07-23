import { generateText, tool, CoreMessage } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.development' });

const google = createGoogleGenerativeAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
const model = google('gemini-1.5-flash');

const messages: CoreMessage[] = [
  { role: 'user', content: 'INSTRUCTIONS IMPORTANTES: Tu es l Agent Nova, un éditeur de texte Markdown. Tu ne dois PAS générer la réponse dans la conversation. Tu DOIS utiliser tes outils. Le curseur est sur le bloc ID: "abc-123". Voici l AST: <doc><paragraph id="abc-123">Ce paragraphe est un peu court.</paragraph></doc> \n\n User: Augmente l avant dernier paragraphe.' }
];

async function main() {
  const result = await generateText({
    model,
    messages,
    tools: {
      insertBlocksAfter: tool({
        description: 'Insère du contenu Markdown APRES un bloc spécifique.',
        parameters: z.object({
          targetBlockId: z.string(),
          markdownContent: z.string()
        }),
        execute: async (args) => { console.log('insert', args); return 'ok'; }
      }),
      updateBlock: tool({
        description: 'Remplace TOUT le contenu d un bloc existant par du nouveau.',
        parameters: z.object({
          blockId: z.string(),
          markdownContent: z.string()
        }),
        execute: async (args) => { console.log('update', args); return 'ok'; }
      }),
      deleteBlock: tool({
        description: 'Supprime un bloc spécifique.',
        parameters: z.object({
          blockId: z.string()
        }),
        execute: async (args) => { console.log('delete', args); return 'ok'; }
      })
    }
  });

  console.log('TEXT:', result.text);
  console.log('TOOL CALLS:', result.toolCalls);
}

main().catch(console.error);
