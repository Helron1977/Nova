// src/application/modules/apiFlow/apiFlowModule.ts
//
// Bloc "apiflow" : diagramme de conception d'API — une séquence d'appels
// d'endpoints, avec les objets métier qu'ils consomment/retournent, et les
// liaisons d'attributs entre appels successifs (quel attribut produit par un
// appel devient le paramètre d'un appel suivant).
//
// Rendu maison (pas mermaid) : la topologie est toujours une séquence
// linéaire bornée, pas un graphe arbitraire — un vrai layout engine serait
// disproportionné, et on perdrait le rendu à badges qui est la valeur du
// module.

import type { BlockModule } from '@/application/interfaces/blockModule';
import type { Block, UniversalBlockMetadata } from '@/application/logic/markdownParser';
import { ApiFlowRenderer } from './ApiFlowRenderer';
import { Workflow } from 'lucide-react';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

export interface ApiObject {
  name: string;
  attributes: string[];
}

export interface ApiCallParam {
  name: string;
  boundFromAttribute?: string; // attribut source déclaré dans le DSL (ex: "id")
  sourceCallIndex?: number | null; // résolu : index de l'appel qui produit cet attribut, null si non résolu
}

export interface ApiCall {
  method: string;
  path: string;
  params: ApiCallParam[];
  returns?: string;
  lane?: string;
}

export interface ApiFlowBlockData {
  objects: ApiObject[];
  calls: ApiCall[];
  rawSource: string;
}

const DEFAULT_RAW_CONTENT =
  'object User: id, name, email\n\n' +
  'call GET /users/{id} -> User [lane: user-service]\n';

const OBJECT_LINE_RE = /^object\s+(\w+)\s*:\s*(.+)$/i;
const CALL_LINE_RE =
  /^call\s+([A-Z]+)\s+(\S+?)(?:\(([^)]*)\))?\s*(?:->\s*(\w+))?\s*(?:\[lane:\s*([^\]]+)\])?\s*$/i;

function parseParams(raw: string | undefined): ApiCallParam[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const boundMatch = p.match(/^(\w+)\s*<-\s*(\w+)$/);
      if (boundMatch) {
        return { name: boundMatch[1], boundFromAttribute: boundMatch[2] };
      }
      return { name: p };
    });
}

/**
 * Parse le DSL apiflow. Tolérant : une ligne qui ne correspond à aucun
 * pattern connu est simplement ignorée (dégradation gracieuse) plutôt que de
 * faire échouer tout le bloc — cohérent avec le comportement du module
 * variants sur du contenu mal formé.
 */
export function parseApiFlowContent(rawContent: string): { objects: ApiObject[]; calls: ApiCall[] } {
  const objects: ApiObject[] = [];
  const calls: ApiCall[] = [];

  const lines = rawContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  for (const line of lines) {
    const objectMatch = line.match(OBJECT_LINE_RE);
    if (objectMatch) {
      objects.push({
        name: objectMatch[1],
        attributes: objectMatch[2].split(',').map(a => a.trim()).filter(Boolean),
      });
      continue;
    }

    const callMatch = line.match(CALL_LINE_RE);
    if (callMatch) {
      calls.push({
        method: callMatch[1].toUpperCase(),
        path: callMatch[2],
        params: parseParams(callMatch[3]),
        returns: callMatch[4] || undefined,
        lane: callMatch[5]?.trim() || undefined,
      });
      continue;
    }

    logger.warn(`[ApiFlowModule] Ligne ignorée (format non reconnu): "${line}"`);
  }

  // Résolution des liaisons : pour chaque paramètre lié, cherche l'appel
  // précédent le plus proche dont le type de retour déclare cet attribut.
  const objectsByName = new Map(objects.map(o => [o.name, o]));
  calls.forEach((call, callIndex) => {
    call.params.forEach(param => {
      if (!param.boundFromAttribute) return;
      let sourceCallIndex: number | null = null;
      for (let i = callIndex - 1; i >= 0; i--) {
        const returnedObject = calls[i].returns ? objectsByName.get(calls[i].returns!) : undefined;
        if (returnedObject?.attributes.includes(param.boundFromAttribute)) {
          sourceCallIndex = i;
          break;
        }
      }
      param.sourceCallIndex = sourceCallIndex; // null = non résolu, rendu en gris pointillé plutôt que planter
    });
  });

  return { objects, calls };
}

function serializeApiFlow(data: { objects: ApiObject[]; calls: ApiCall[] }): string {
  const objectLines = data.objects.map(o => `object ${o.name}: ${o.attributes.join(', ')}`);
  const callLines = data.calls.map(c => {
    const params = c.params
      .map(p => (p.boundFromAttribute ? `${p.name} <- ${p.boundFromAttribute}` : p.name))
      .join(', ');
    const paramsPart = params ? `(${params})` : '';
    const returnsPart = c.returns ? ` -> ${c.returns}` : '';
    const lanePart = c.lane ? ` [lane: ${c.lane}]` : '';
    return `call ${c.method} ${c.path}${paramsPart}${returnsPart}${lanePart}`;
  });
  return [...objectLines, '', ...callLines].join('\n');
}

const ApiFlowModule: BlockModule<ApiFlowBlockData> = {
  type: 'apiFlowBlock',
  codeBlockLanguage: 'apiflow',
  menuIcon: Workflow,
  icon: Workflow,
  displayName: 'Flux API',
  paletteLabel: 'Flux API (séquence d\'endpoints)',
  paletteKeyword: 'api endpoint sequence appel flux conception rest',
  defaultRawContent: DEFAULT_RAW_CONTENT,

  parseContent: (rawContent: string, blockId: string): ApiFlowBlockData => {
    logger.debug(`[ApiFlowModule] Parsing content for block ${blockId}`);
    const { objects, calls } = parseApiFlowContent(rawContent);
    return { objects, calls, rawSource: rawContent };
  },

  RendererComponent: ApiFlowRenderer,

  serializeContent: (customData: ApiFlowBlockData): string => {
    return customData.rawSource ?? serializeApiFlow(customData);
  },

  serializeToHTML: (customData: ApiFlowBlockData, blockId: string): string => {
    if (!customData?.calls?.length) {
      return `<div class="nova-apiflow-block" data-block-id="${blockId}"><p>Flux API vide.</p></div>`;
    }
    // Export statique : liste séquentielle simple, pas de reconstruction du
    // rendu SVG interactif (pas de canvas d'export dépendant du navigateur).
    const items = customData.calls
      .map(c => `<li><code>${c.method} ${c.path}</code>${c.returns ? ` → ${c.returns}` : ''}${c.lane ? ` (${c.lane})` : ''}</li>`)
      .join('');
    return `<div class="nova-apiflow-block" data-block-id="${blockId}"><ol>${items}</ol></div>`;
  },

  createDefaultCustomData: (): ApiFlowBlockData => {
    const { objects, calls } = parseApiFlowContent(DEFAULT_RAW_CONTENT);
    return { objects, calls, rawSource: DEFAULT_RAW_CONTENT };
  },

  updateBlockFromSource: (currentBlock: Block, rawSource: string, blockId: string): Block => {
    const newCustomData = ApiFlowModule.parseContent!(rawSource, blockId);
    return {
      id: currentBlock.id,
      type: ApiFlowModule.type as 'apiFlowBlock',
      content: {
        language: ApiFlowModule.codeBlockLanguage as 'apiflow',
        code: rawSource,
        customBlockData: newCustomData,
      },
      metadata: { ...(currentBlock.metadata as UniversalBlockMetadata) },
      rawMarkdown: `\`\`\`${ApiFlowModule.codeBlockLanguage}\n${rawSource}\n\`\`\``,
    } as Block;
  },

  getAIASTNode: (block: any): Record<string, any> => {
    const data = block.content?.customBlockData as ApiFlowBlockData | undefined;
    return {
      type: 'apiFlowBlock',
      objects: (data?.objects || []).map(o => ({ name: o.name, attributes: o.attributes })),
      calls: (data?.calls || []).map(c => ({
        method: c.method,
        path: c.path,
        params: c.params.map(p => (p.boundFromAttribute ? `${p.name}<-${p.boundFromAttribute}` : p.name)),
        returns: c.returns,
        lane: c.lane,
      })),
    };
  },

  getAIPrompt: () =>
    `[apiflow] Diagramme de séquence d'appels API pour la conception, montrant ` +
    `les liaisons d'attributs entre appels (quel champ retourné par un appel ` +
    `devient le paramètre d'un appel suivant). Utilise ce bloc quand l'utilisateur ` +
    `conçoit ou documente un enchaînement d'endpoints, pas pour une simple ` +
    `spécification d'un seul endpoint isolé (dans ce cas, préfère le bloc openapi-endpoint). ` +
    `ATTENTION : Si le diagramme demandé dépasse 3 appels, il est STRICTEMENT OBLIGATOIRE ` +
    `de créer plusieurs blocs apiflow distincts (un pour chaque groupe de 2-3 appels) ` +
    `plutôt qu'un seul gros bloc surchargé. Syntaxe :\n` +
    '```apiflow\n' +
    'object User: id, name, email\n' +
    'object Order: id, userId, total\n\n' +
    'call GET /users/{id} -> User [lane: user-service]\n' +
    'call POST /orders(userId <- id, total) -> Order [lane: order-service]\n' +
    '```\n' +
    `Chaque "object" déclare un type et ses attributs. Chaque "call" est ` +
    `METHOD /path, des paramètres optionnels entre parenthèses (un paramètre ` +
    `"nom <- attribut" indique qu'il provient d'un attribut retourné par un appel ` +
    `précédent ; un paramètre sans "<-" est un paramètre local, non lié), un ` +
    `type de retour optionnel après "->", et un "[lane: nom-du-service]" optionnel ` +
    `pour indiquer quel service héberge cet endpoint. N'invente jamais un attribut ` +
    `"<- x" qui n'a pas été déclaré dans un "object" retourné par un appel antérieur.`,

  helpDescription: `
Le bloc **ApiFlow** permet de modéliser visuellement un enchaînement d'appels d'API (séquence).
Il est très utile pour concevoir des chorégraphies de micro-services et indiquer comment les données circulent d'un appel à l'autre.

### Syntaxe
Le bloc se divise en deux parties : la définition des objets (optionnel) et les appels (obligatoire).

\`\`\`apiflow
object User: id, name, email
object Order: id, userId, total

call GET /users/{id} -> User [lane: user-service]
call POST /orders(userId <- id, total) -> Order [lane: order-service]
\`\`\`

#### Objets
- Format : \`object NomObjet: propriete1, propriete2\`
- Permet de lister les données retournées par une entité.

#### Appels (calls)
- **Format basique** : \`call METHOD /path\`
- **Type de retour** : Ajoutez \`-> NomObjet\` pour indiquer ce que l'API renvoie.
- **Paramètres liés** : \`(param <- attribut)\` indique que "param" prend la valeur de "attribut" qui a été retourné par un appel précédent.
- **Paramètres locaux** : \`(param)\` indique un paramètre de l'appel sans liaison.
- **Lignes d'eau (Lanes)** : Ajoutez \`[lane: nom-du-service]\` pour indiquer quel micro-service traite cet appel.
`
};

export default ApiFlowModule;
