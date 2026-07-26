// src/application/modules/apiErrors/apiErrorsModule.ts
//
// Bloc "erreurs fonctionnelles" : pour chaque endpoint, la liste des erreurs
// métier qu'il peut retourner — erreurs "récupérables" (l'appelant peut
// corriger et réessayer), erreurs "bloquantes" (dépendent d'un état qu'il ne
// contrôle pas), et un cas particulier : les transitions d'état invalides
// (ex: "shipped -> cancelled"), rendues avec l'état de départ et l'état visé
// plutôt qu'un simple libellé, pour que la transition interdite soit lisible
// d'un coup d'œil.
//
// Rendu volontairement plus léger qu'un diagramme (type apiflow) : pas de
// topologie, pas de layout SVG calculé — juste des badges neutres (comme du
// code inline) avec un point de couleur en indicateur de sévérité, pour ne
// pas donner une impression d'alerte permanente sur un document qui ne fait
// que documenter des cas d'erreur.

import type { BlockModule } from '@/application/interfaces/blockModule';
import type { Block, UniversalBlockMetadata } from '@/application/logic/markdownParser';
import { ApiErrorsRenderer } from './ApiErrorsRenderer';
import { ShieldAlert } from 'lucide-react';
import { PinoLogger } from '@/infrastructure/logging/PinoLogger';

const logger = new PinoLogger();

export type ErrorSeverity = 'blocking' | 'recoverable';

export interface FunctionalError {
  code?: string; // code HTTP optionnel (ex: "402", "409")
  isTransition: boolean;
  key: string; // libellé de l'erreur (ex: "insufficient_funds"), vide si transition
  fromState?: string; // pour une transition : état de départ
  toState?: string; // pour une transition : état visé
  description: string;
  severity: ErrorSeverity;
}

export interface ApiEndpointErrors {
  method: string;
  path: string;
  errors: FunctionalError[];
}

export interface ApiErrorsBlockData {
  endpoints: ApiEndpointErrors[];
  rawSource: string;
}

const DEFAULT_RAW_CONTENT =
  'POST /orders/{id}/pay\n' +
  '402 insufficient_funds: Le solde du compte est insuffisant pour couvrir le montant\n' +
  '! paid -> paid: Impossible de payer une commande déjà réglée\n';

const ENDPOINT_LINE_RE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)$/i;
// [marqueur de sévérité optionnel] [code HTTP optionnel] clé-ou-transition: description
const ERROR_LINE_RE = /^(?:([!~])\s*)?(?:(\d{3})\s+)?(.+?):\s*(.+)$/;

/**
 * Parse le DSL du bloc api-errors. Comme pour apiflow : une ligne non
 * reconnue est simplement ignorée (dégradation gracieuse) plutôt que de
 * faire échouer tout le bloc.
 */
export function parseApiErrorsContent(rawContent: string): ApiEndpointErrors[] {
  const endpoints: ApiEndpointErrors[] = [];
  let current: ApiEndpointErrors | null = null;

  const lines = rawContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  for (const line of lines) {
    const endpointMatch = line.match(ENDPOINT_LINE_RE);
    if (endpointMatch) {
      current = { method: endpointMatch[1].toUpperCase(), path: endpointMatch[2], errors: [] };
      endpoints.push(current);
      continue;
    }

    if (!current) {
      logger.warn(`[ApiErrorsModule] Ligne d'erreur ignorée (aucun endpoint courant): "${line}"`);
      continue;
    }

    const errorMatch = line.match(ERROR_LINE_RE);
    if (errorMatch) {
      const [, marker, code, keyPart, description] = errorMatch;
      const isTransition = keyPart.includes('->');

      let fromState: string | undefined;
      let toState: string | undefined;
      if (isTransition) {
        const [from, to] = keyPart.split('->').map(s => s.trim());
        fromState = from;
        toState = to;
      }

      const severity: ErrorSeverity = marker
        ? (marker === '!' ? 'blocking' : 'recoverable')
        : (isTransition ? 'blocking' : 'recoverable');

      current.errors.push({
        code: code || undefined,
        isTransition,
        key: isTransition ? '' : keyPart.trim(),
        fromState,
        toState,
        description: description.trim(),
        severity,
      });
      continue;
    }

    logger.warn(`[ApiErrorsModule] Ligne ignorée (format non reconnu): "${line}"`);
  }

  return endpoints;
}

function serializeApiErrors(endpoints: ApiEndpointErrors[]): string {
  return endpoints
    .map(ep => {
      const header = `${ep.method} ${ep.path}`;
      const lines = ep.errors.map(e => {
        const marker = e.severity === 'blocking' && !e.isTransition ? '! ' : e.severity === 'recoverable' && e.isTransition ? '~ ' : '';
        const codePart = e.code ? `${e.code} ` : '';
        const keyPart = e.isTransition ? `${e.fromState} -> ${e.toState}` : e.key;
        return `${marker}${codePart}${keyPart}: ${e.description}`;
      });
      return [header, ...lines].join('\n');
    })
    .join('\n\n');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ApiErrorsModule: BlockModule<ApiErrorsBlockData> = {
  type: 'apiErrorsBlock',
  codeBlockLanguage: 'api-errors',
  menuIcon: ShieldAlert,
  icon: ShieldAlert,
  displayName: 'Erreurs fonctionnelles',
  paletteLabel: 'Erreurs fonctionnelles (endpoints)',
  paletteKeyword: 'erreur error endpoint api badge transition état',
  defaultRawContent: DEFAULT_RAW_CONTENT,

  parseContent: (rawContent: string, blockId: string): ApiErrorsBlockData => {
    logger.debug(`[ApiErrorsModule] Parsing content for block ${blockId}`);
    return { endpoints: parseApiErrorsContent(rawContent), rawSource: rawContent };
  },

  RendererComponent: ApiErrorsRenderer,

  serializeContent: (customData: ApiErrorsBlockData): string => {
    return customData.rawSource ?? serializeApiErrors(customData.endpoints);
  },

  // Export HTML statique (PDF / export navigateur) : la description est
  // toujours affichée en clair sous le badge (pas de tooltip au survol), car
  // le rendu imprimé/PDF n'a pas d'état ":hover". C'est délibérément
  // redondant avec l'attribut title du rendu écran plutôt qu'une dépendance
  // à celui-ci.
  serializeToHTML: (customData: ApiErrorsBlockData, blockId: string): string => {
    if (!customData?.endpoints?.length) {
      return `<div class="nova-apierrors-block" data-block-id="${blockId}"><p>Aucune erreur fonctionnelle définie.</p></div>`;
    }
    const endpointsHtml = customData.endpoints
      .map(ep => {
        const rows = ep.errors
          .map(e => {
            const label = e.isTransition
              ? `${escapeHtml(e.fromState || '')} → ${escapeHtml(e.toState || '')}`
              : `${e.code ? escapeHtml(e.code) + ' · ' : ''}${escapeHtml(e.key)}`;
            const dot = e.severity === 'blocking' ? '#a32d2d' : '#854f0b';
            return `<li style="margin-bottom:4px;"><code style="background:#f1efe8;border-radius:4px;padding:2px 6px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dot};margin-right:6px;"></span>${label}</code> — ${escapeHtml(e.description)}</li>`;
          })
          .join('');
        return `<div class="nova-apierrors-endpoint" style="margin-bottom:1em;"><strong><code>${escapeHtml(ep.method)} ${escapeHtml(ep.path)}</code></strong><ul style="list-style:none;padding-left:0;margin-top:6px;">${rows}</ul></div>`;
      })
      .join('');
    return `<div class="nova-apierrors-block" data-block-id="${blockId}">${endpointsHtml}</div>`;
  },

  createDefaultCustomData: (): ApiErrorsBlockData => {
    return { endpoints: parseApiErrorsContent(DEFAULT_RAW_CONTENT), rawSource: DEFAULT_RAW_CONTENT };
  },

  updateBlockFromSource: (currentBlock: Block, rawSource: string, blockId: string): Block => {
    const newCustomData = ApiErrorsModule.parseContent!(rawSource, blockId);
    return {
      id: currentBlock.id,
      type: ApiErrorsModule.type,
      content: {
        language: ApiErrorsModule.codeBlockLanguage,
        code: rawSource,
        customBlockData: newCustomData,
      },
      metadata: { ...(currentBlock.metadata as UniversalBlockMetadata) },
      rawMarkdown: `\`\`\`${ApiErrorsModule.codeBlockLanguage}\n${rawSource}\n\`\`\``,
    } as unknown as Block;
  },

  getAIASTNode: (block: any): Record<string, any> => {
    const data = block.content?.customBlockData as ApiErrorsBlockData | undefined;
    return {
      type: 'apiErrorsBlock',
      endpoints: (data?.endpoints || []).map(ep => ({
        method: ep.method,
        path: ep.path,
        errors: ep.errors.map(e => ({
          code: e.code,
          key: e.isTransition ? `${e.fromState} -> ${e.toState}` : e.key,
          severity: e.severity,
          description: e.description,
        })),
      })),
    };
  },

  getAIPrompt: () =>
    `[api-errors] Liste des erreurs fonctionnelles (métier) qu'un ou plusieurs endpoints ` +
    `peuvent retourner. Utilise ce bloc pour documenter les cas d'échec métier d'une API ` +
    `(pas pour un diagramme de séquence d'appels : dans ce cas, préfère le bloc apiflow). ` +
    `Syntaxe :\n` +
    '```api-errors\n' +
    'POST /orders/{id}/pay\n' +
    '402 insufficient_funds: Le solde du compte est insuffisant\n' +
    '! paid -> paid: Impossible de payer une commande déjà réglée\n' +
    '422 payment_method_expired: Le moyen de paiement a expiré\n' +
    '```\n' +
    `Chaque bloc d'erreurs commence par une ligne "METHODE /chemin", suivie de lignes ` +
    `d'erreurs indentées ou non. Une ligne d'erreur est soit "clé: description" (erreur ` +
    `simple, ex: "insufficient_funds"), soit "état_actuel -> état_visé: description" ` +
    `(transition d'état invalide, ex: "shipped -> cancelled"). Un code HTTP à 3 chiffres ` +
    `est optionnel avant la clé (ex: "402 insufficient_funds: ..."). Un marqueur de ` +
    `sévérité optionnel précède la ligne : "!" force le statut "bloquant" (l'appelant ne ` +
    `peut rien y faire), "~" force "récupérable" (l'appelant peut corriger et réessayer). ` +
    `Par défaut, une erreur simple est "récupérable" et une transition d'état est ` +
    `"bloquante" — ne pose le marqueur que pour inverser ce défaut.`,
    
  helpDescription: `
Ce bloc permet de documenter les erreurs métier qu'une ou plusieurs API peuvent retourner.

### Syntaxe
Chaque bloc commence par une ligne indiquant la **méthode** et le **chemin** de l'API. Ensuite, vous pouvez lister les erreurs associées.

\`\`\`api-errors
POST /orders/{id}/pay
402 insufficient_funds: Le solde du compte est insuffisant
! paid -> paid: Impossible de payer une commande déjà réglée
422 payment_method_expired: Le moyen de paiement a expiré
\`\`\`

#### Format des erreurs
Une ligne d'erreur peut avoir plusieurs formats :
- **Erreur simple** : \`clé: description\` (ex: \`insufficient_funds: ...\`)
- **Transition invalide** : \`état_actuel -> état_visé: description\` (ex: \`shipped -> cancelled: ...\`)

#### Options supplémentaires
- **Code HTTP** : Un code à 3 chiffres peut précéder la clé (ex: \`402 insufficient_funds:\`)
- **Sévérité** : Un marqueur peut précéder la ligne :
  - \`!\` force une erreur "bloquante" (impossible de réessayer)
  - \`~\` force une erreur "récupérable" (possibilité de corriger et réessayer)
`
};

export default ApiErrorsModule;
