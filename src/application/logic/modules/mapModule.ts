import type { BlockModule } from '../../interfaces/blockModule';
import { CustomMapRenderer } from '@/presentation/components/markdown/CustomMapRenderer';
import { Map as MapIcon } from 'lucide-react';

export interface MapMarker {
  id: string;
  position: [number, number]; // [lat, lng]
  popupText: string;
}

export interface MapBlockData {
  center: [number, number];
  zoom: number;
  markers: MapMarker[];
  route?: [number, number][];
}

export const mapModule: BlockModule<MapBlockData> = {
  type: 'mapBlock',
  codeBlockLanguage: 'map',
  displayName: 'Carte Interactive',
  menuIcon: MapIcon,
  paletteLabel: 'Carte Interactive (Leaflet)',
  paletteKeyword: 'carte map leaflet lieu',

  createDefaultCustomData: (): MapBlockData => ({
    center: [48.8566, 2.3522], // Paris by default
    zoom: 13,
    markers: [{ id: 'default', position: [48.8566, 2.3522], popupText: 'Cible' }]
  }),

  parseContent: (rawContent: string): MapBlockData => {
    try {
      if (!rawContent.trim()) return mapModule.createDefaultCustomData!();
      
      const content = rawContent.trim();
      const points = content.split('->').map(p => p.trim());
      
      const parsedPoints: [number, number][] = [];
      const parsedPopups: string[] = [];
      for (const point of points) {
        const match = point.match(/([0-9.-]+)\s*,\s*([0-9.-]+)(?:\s*\((.*?)\))?/);
        if (match) {
          const lat = parseFloat(match[1]);
          const lng = parseFloat(match[2]);
          if (!isNaN(lat) && !isNaN(lng)) {
            parsedPoints.push([lat, lng]);
            parsedPopups.push(match[3] || '');
          }
        }
      }

      if (parsedPoints.length === 0) {
        return mapModule.createDefaultCustomData!();
      }

      const isRoute = parsedPoints.length > 1;
      const markers = parsedPoints.map((pos, idx) => ({
        id: `marker-${idx}`,
        position: pos,
        popupText: parsedPopups[idx] || (isRoute ? `Étape ${idx + 1}` : 'Cible')
      }));

      return {
        center: parsedPoints[0],
        zoom: isRoute ? 6 : 13,
        markers,
        route: isRoute ? parsedPoints : undefined
      };
    } catch (e) {
      console.warn("Failed to parse Map data", e);
      return mapModule.createDefaultCustomData!();
    }
  },

  serializeContent: (data: MapBlockData): string => {
    const serializeMarker = (m: MapMarker, idx: number) => {
       const isDefaultText = m.popupText === 'Cible' || m.popupText === `Étape ${idx + 1}`;
       return isDefaultText ? `${m.position[0]}, ${m.position[1]}` : `${m.position[0]}, ${m.position[1]} (${m.popupText})`;
    };

    if (data.route && data.route.length > 1) {
      return data.markers.map((m, i) => serializeMarker(m, i)).join(' -> ');
    } else if (data.markers && data.markers.length > 0) {
      return data.markers.map((m, i) => serializeMarker(m, i)).join('\n');
    }
    return `${data.center[0]}, ${data.center[1]}`;
  },

  updateBlockFromSource: (currentBlock: any, rawSource: string, blockId: string): any => {
    const newCustomData = mapModule.parseContent!(rawSource, blockId);
    return {
      ...currentBlock,
      content: {
        ...(currentBlock.content || {}),
        language: mapModule.codeBlockLanguage,
        code: rawSource,
        customBlockData: newCustomData,
      },
      rawMarkdown: `\`\`\`${mapModule.codeBlockLanguage}\n${rawSource}\n\`\`\``
    };
  },

  RendererComponent: CustomMapRenderer,

  getAIASTNode: (block: any): Record<string, any> => {
    const data = block.content?.customBlockData as MapBlockData | undefined;
    return {
      type: 'mapBlock',
      center: data?.center || [0, 0],
      markersCount: data?.markers?.length || 0,
      hasRoute: !!data?.route,
      contentSummary: "[MAP_DATA_OMITTED_FOR_TOKENS]",
    };
  },
  getAIPrompt: () => `[map] Carte interactive Leaflet. Syntaxe: \`\`\`map\n48.8566, 2.3522\n\`\`\` (point unique) ou \`\`\`map\n48.8566, 2.3522 -> 45.7640, 4.8357\n\`\`\` (itinéraire). Utilise ce bloc quand l'utilisateur mentionne un lieu géographique ou un trajet.`.trim(),
  
  helpDescription: `
Ce bloc permet d'intégrer une **carte géographique interactive** (via Leaflet) centrée sur un lieu spécifique ou affichant un itinéraire.

### Syntaxe
Le format utilise de simples coordonnées GPS (Latitude, Longitude).

**1. Point unique :**
Affiche une carte centrée sur la coordonnée avec un marqueur.
\`\`\`map
48.8566, 2.3522
\`\`\`

**2. Itinéraire (plusieurs points) :**
Affiche une carte avec un trajet reliant plusieurs coordonnées, séparées par une flèche \`->\`.
\`\`\`map
48.8566, 2.3522 -> 45.7640, 4.8357 -> 43.2965, 5.3698
\`\`\`

**Paramètres :**
- Les coordonnées sont formatées en décimal (ex: 48.8566).
- Le premier nombre est la latitude, le second la longitude.
`
};
