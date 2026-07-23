import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';
import type { ApiFlowBlockData, ApiCall } from './apiFlowModule';
import ApiFlowModule from './apiFlowModule';
import { CoreBlockEditor } from '@/presentation/components/editor/CoreBlockEditor';
import { useEditorCommands } from '@/application/context/EditorContext';
import { Pencil } from 'lucide-react';

interface ApiFlowRendererSpecificProps extends BlockRendererProps<ApiFlowBlockData> {}

// --- Constantes de layout ---
const NODE_HEIGHT = 56;

const BADGE_HEIGHT = 26;
const BADGE_GAP = 8;
const LANE_TAG_HEIGHT = 18;
const LEFT_MARGIN = 20;
const TOP_MARGIN = 20;
const ROW_STEP = 145; // hauteur allouée par rangée (nœud + badges + connecteurs espacés)
const CONNECTOR_DROP = 24; // distance verticale sous les badges pour le connecteur en L

// Estimation de largeur de texte sans mesure DOM (approximation suffisante
// pour un diagramme dense, avec padding généreux en compensation).
function estimateWidth(text: string, fontSize: 12 | 14): number {
  const charWidth = fontSize === 14 ? 7.5 : 6.5;
  return Math.ceil(text.length * charWidth);
}

interface LaidOutBadge {
  x: number;
  width: number;
  label: string;
  title: string;
  state: 'bound' | 'local' | 'unresolved' | 'bound_source';
}

interface LaidOutCall {
  call: ApiCall;
  row: number;
  x: number;
  y: number;
  width: number;
  badgesY: number;
  badges: LaidOutBadge[];
}

interface Connector {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dropY: number;
  label: string;
}

function computeLayout(calls: ApiCall[], objects: import('./apiFlowModule').ApiObject[]) {
  const laidOut: LaidOutCall[] = [];
  let maxRowWidth = 0;

  const ROW_MAX_CALLS = 3;
  const GAP_X = 60;

  const boundSources = new Set<string>();
  calls.forEach(c => c.params.forEach(p => {
    if (p.boundFromAttribute && p.sourceCallIndex != null) {
      boundSources.add(`${p.sourceCallIndex}-${p.boundFromAttribute}`);
    }
  }));

  let currentRow = 0;
  let currentX = LEFT_MARGIN;
  let currentY = TOP_MARGIN;

  calls.forEach((call, index) => {
    const row = Math.floor(index / ROW_MAX_CALLS);
    if (row > currentRow) {
      currentRow = row;
      currentX = LEFT_MARGIN;
      currentY += ROW_STEP;
    }
    
    const rowBaseY = currentY + (call.lane ? LANE_TAG_HEIGHT : 0);

    const title = `${call.method} ${call.path}`;
    const subtitle = call.returns ? `→ ${call.returns}` : '';
    const nodeWidth = Math.max(140, estimateWidth(title, 14) + 32, estimateWidth(subtitle, 12) + 32);

    let badgesData = call.params.map(p => ({ ...p, isParam: true }));
    if (badgesData.length === 0 && call.returns) {
      const obj = objects.find(o => o.name === call.returns);
      if (obj) {
        badgesData = obj.attributes.map(a => ({ name: a, isParam: false, boundFromAttribute: undefined, sourceCallIndex: undefined }));
      }
    }

    const badges: LaidOutBadge[] = badgesData.map(p => {
      const width = estimateWidth(p.name, 12) + 24;
      let state: LaidOutBadge['state'] = 'local';
      let title = '';
      
      if (p.isParam) {
        if (p.boundFromAttribute) {
          state = p.sourceCallIndex != null ? 'bound' : 'unresolved';
          title = state === 'bound'
            ? `Provient de l'attribut "${p.boundFromAttribute}"`
            : `Attribut "${p.boundFromAttribute}" non trouvé dans un appel précédent`;
        } else {
          title = 'Paramètre local';
        }
      } else {
        if (boundSources.has(`${index}-${p.name}`)) {
          state = 'bound_source';
          title = 'Attribut source lié à un appel suivant';
        } else {
          title = 'Attribut retourné';
        }
      }
      
      return { x: 0, width, label: p.name, title, state };
    });
    const badgesTotalWidth = badges.reduce((sum, b) => sum + b.width, 0) + Math.max(0, badges.length - 1) * BADGE_GAP;
    const finalNodeWidth = Math.max(nodeWidth, badgesTotalWidth);
    const badgesStartOffset = Math.max(0, (finalNodeWidth - badgesTotalWidth) / 2);
    let cursor = badgesStartOffset;
    badges.forEach(b => {
      b.x = cursor;
      cursor += b.width + BADGE_GAP;
    });

    // x est maintenant simplement l'accumulateur horizontal
    const x = currentX;

    laidOut.push({
      call,
      row,
      x,
      y: rowBaseY,
      width: finalNodeWidth,
      badgesY: rowBaseY + NODE_HEIGHT + 16,
      badges,
    });
    
    currentX += finalNodeWidth + GAP_X;
    maxRowWidth = Math.max(maxRowWidth, currentX - GAP_X + LEFT_MARGIN);
  });

  // Connecteurs : uniquement entre appels de la même rangée (sinon,
  // référence textuelle sur le badge plutôt qu'un tracé complexe multi-lignes).
  const connectors: Connector[] = [];
  const rowDropYOffset: Record<number, number> = {};
  laidOut.forEach((entry) => {
    entry.badges.forEach((badge, badgeIndex) => {
      const param = entry.call.params[badgeIndex];
      if (badge.state !== 'bound' || param.sourceCallIndex == null) return;
      const source = laidOut[param.sourceCallIndex];
      if (!source || source.row !== entry.row) return;
      const sourceBadge = source.badges.find(b => b.label === param.boundFromAttribute);
      // Même sans sourceBadge (si par ex. il n'a pas été rendu), on peut tracer depuis le centre du noeud
      const sourceX = sourceBadge ? source.x + sourceBadge.x + sourceBadge.width / 2 : source.x + source.width / 2;
      const sourceY = sourceBadge ? source.badgesY + BADGE_HEIGHT : source.y + NODE_HEIGHT;
      
      let currentOffset = rowDropYOffset[entry.row] || 0;
      const dropY = Math.max(entry.badgesY, source.badgesY) + BADGE_HEIGHT + CONNECTOR_DROP + currentOffset;
      rowDropYOffset[entry.row] = currentOffset + 18; // Décale le prochain connecteur de la même rangée vers le bas
      
      connectors.push({
        x1: sourceX,
        y1: sourceY,
        x2: entry.x + badge.x + badge.width / 2,
        y2: entry.badgesY + BADGE_HEIGHT,
        dropY,
        label: `${param.boundFromAttribute} → ${param.name}`,
      });
    });
  });

  let maxY = 0;
  laidOut.forEach(e => { maxY = Math.max(maxY, e.badgesY + BADGE_HEIGHT); });
  connectors.forEach(c => { maxY = Math.max(maxY, c.dropY + 30); }); // +30 pour le label du connecteur
  
  const rowCount = Math.max(1, Math.ceil(calls.length / ROW_MAX_CALLS));
  const defaultHeight = TOP_MARGIN + rowCount * ROW_STEP;
  const totalHeight = Math.max(defaultHeight, maxY + TOP_MARGIN);

  return { laidOut, connectors, viewBoxWidth: maxRowWidth, viewBoxHeight: totalHeight };
}

const stateClasses: Record<LaidOutBadge['state'], { fill: string; stroke: string; text: string }> = {
  bound: {
    fill: 'fill-amber-100 dark:fill-[#784004]',
    stroke: 'stroke-amber-500 dark:stroke-[#ca8a04]',
    text: 'fill-amber-800 dark:fill-[#facc15]',
  },
  bound_source: {
    fill: 'fill-amber-100 dark:fill-[#784004]',
    stroke: 'stroke-amber-500 dark:stroke-[#ca8a04]',
    text: 'fill-amber-800 dark:fill-[#facc15]',
  },
  local: {
    fill: 'fill-gray-100 dark:fill-[#404040]',
    stroke: 'stroke-gray-300 dark:stroke-[#737373]',
    text: 'fill-gray-600 dark:fill-[#d4d4d4]',
  },
  unresolved: {
    fill: 'fill-gray-50 dark:fill-[#262626]',
    stroke: 'stroke-gray-300 dark:stroke-[#525252]',
    text: 'fill-gray-400 dark:fill-[#a3a3a3]',
  },
};

export const ApiFlowRenderer: React.FC<ApiFlowRendererSpecificProps> = ({ block, customData }) => {
  const { activeBlockId, updateBlock, setActiveBlockId } = useEditorCommands();
  const [isEditingSource, setIsEditingSource] = useState(activeBlockId === block.id);

  useEffect(() => {
    if (activeBlockId === block.id) setIsEditingSource(true);
  }, [activeBlockId, block.id]);

  const handleSaveSource = useCallback(
    (newRawSource: string) => {
      updateBlock(block.id, block, {
        type: 'UPDATE_SOURCE_FOR_MODULE',
        newRawSource,
        moduleType: ApiFlowModule.type,
      });
      setIsEditingSource(false);
      setActiveBlockId(null);
    },
    [block, updateBlock, setActiveBlockId]
  );

  const { laidOut, connectors, viewBoxWidth, viewBoxHeight } = useMemo(
    () => computeLayout(customData.calls || [], customData.objects || []),
    [customData.calls, customData.objects]
  );

  if (isEditingSource) {
    return (
      <div className="nova-apiflow-block-editing my-2" data-block-id={block.id}>
        <CoreBlockEditor
          blockId={block.id}
          initialContent={customData.rawSource || ApiFlowModule.defaultRawContent || ''}
          onSave={handleSaveSource}
          onCancel={() => {
            setIsEditingSource(false);
            setActiveBlockId(null);
          }}
        />
      </div>
    );
  }

  if (!customData.calls?.length) {
    return (
      <div
        className="p-3 my-2 border border-dashed text-gray-400 italic text-center rounded-lg cursor-pointer"
        data-block-id={block.id}
        onClick={() => setIsEditingSource(true)}
      >
        Aucun appel défini — cliquez pour éditer le flux API.
      </div>
    );
  }

  return (
    <div
      className="nova-apiflow-block my-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 relative group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      data-block-id={block.id}
      onClick={() => setIsEditingSource(true)}
      title="Cliquez pour éditer le flux API"
    >
      <button
        type="button"
        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => setIsEditingSource(true)}
        aria-label="Modifier le flux API"
        title="Modifier le flux API"
      >
        <Pencil size={14} />
      </button>

      <div className="w-full pb-2">
        <svg
          style={{ width: '100%', height: 'auto' }}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          role="img"
          aria-label={`Flux API de ${laidOut.length} appel(s) : ${laidOut.map(l => `${l.call.method} ${l.call.path}`).join(', ')}`}
        >
        <defs>
          <marker id={`arrow-${block.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" className="fill-none stroke-gray-400 dark:stroke-gray-500" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </marker>
          <marker id={`arrow-amber-${block.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" className="fill-none stroke-amber-500 dark:stroke-amber-400" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>

        {/* Flèches séquentielles entre appels consécutifs de la même rangée */}
        {laidOut.slice(1).map((entry, i) => {
          const prev = laidOut[i];
          if (prev.row !== entry.row) return null;
          const y = prev.y + NODE_HEIGHT / 2;
          return (
            <line
              key={`seq-${i}`}
              x1={prev.x + prev.width}
              y1={y}
              x2={entry.x}
              y2={y}
              className="stroke-gray-300 dark:stroke-gray-600"
              strokeWidth={1.5}
              markerEnd={`url(#arrow-${block.id})`}
            />
          );
        })}

        {/* Nœuds d'appel */}
        {laidOut.map((entry, i) => (
          <g key={i}>
            {entry.call.lane && (
              <text
                x={entry.x + entry.width / 2}
                y={entry.y - 6}
                textAnchor="middle"
                className="fill-gray-400 dark:fill-gray-500"
                style={{ fontSize: 11 }}
              >
                {entry.call.lane}
              </text>
            )}
            <rect
              x={entry.x}
              y={entry.y}
              width={entry.width}
              height={NODE_HEIGHT}
              rx={8}
              className="fill-blue-50 dark:fill-[#0d3b66] stroke-blue-400 dark:stroke-[#2563eb]"
              strokeWidth={1}
            />
            <text
              x={entry.x + entry.width / 2}
              y={entry.y + 22}
              textAnchor="middle"
              className="fill-blue-800 dark:fill-blue-50 font-medium"
              style={{ fontSize: 13 }}
            >
              {entry.call.method} {entry.call.path}
            </text>
            {entry.call.returns && (
              <text
                x={entry.x + entry.width / 2}
                y={entry.y + 40}
                textAnchor="middle"
                className="fill-blue-500 dark:fill-[#93c5fd]"
                style={{ fontSize: 11 }}
              >
                → {entry.call.returns}
              </text>
            )}

            {/* Badges de paramètres */}
            {entry.badges.map((badge, bi) => {
              const c = stateClasses[badge.state];
              return (
                <g key={bi}>
                  <rect
                    x={entry.x + badge.x}
                    y={entry.badgesY}
                    width={badge.width}
                    height={BADGE_HEIGHT}
                    rx={BADGE_HEIGHT / 2}
                    className={`${c.fill} ${c.stroke}`}
                    strokeWidth={0.75}
                    strokeDasharray={badge.state === 'unresolved' ? '3 2' : undefined}
                  >
                    <title>{badge.title}</title>
                  </rect>
                  <text
                    x={entry.x + badge.x + badge.width / 2}
                    y={entry.badgesY + BADGE_HEIGHT / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={c.text}
                    style={{ fontSize: 11 }}
                  >
                    {badge.label}
                  </text>
                </g>
              );
            })}
          </g>
        ))}

        {/* Connecteurs de liaison d'attributs */}
        {connectors.map((c, i) => (
          <g key={`conn-${i}`}>
            <path
              d={`M ${c.x1} ${c.y1} L ${c.x1} ${c.dropY} L ${c.x2} ${c.dropY} L ${c.x2} ${c.y2}`}
              className="fill-none stroke-amber-500 dark:stroke-[#eab308]"
              strokeWidth={1.25}
              markerEnd={`url(#arrow-amber-${block.id})`}
            />
            <text
              x={(c.x1 + c.x2) / 2}
              y={c.dropY - 6}
              textAnchor="middle"
              className="fill-amber-600 dark:fill-[#fde047]"
              style={{ fontSize: 11 }}
            >
              {c.label}
            </text>
          </g>
        ))}
        </svg>
      </div>
    </div>
  );
};
