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
    markers: []
  }),

  parseContent: (rawContent: string): MapBlockData => {
    try {
      if (!rawContent.trim()) return mapModule.createDefaultCustomData!();
      const parsed = JSON.parse(rawContent);
      
      // Adaptation pour le LLM qui génère {"lat": X, "lng": Y, "zoom": Z}
      if (parsed.lat !== undefined && parsed.lng !== undefined) {
         return {
           center: [parsed.lat, parsed.lng],
           zoom: parsed.zoom || 13,
           markers: parsed.markers || []
         };
      }
      
      return {
        center: parsed.center || [48.8566, 2.3522],
        zoom: parsed.zoom || 13,
        markers: parsed.markers || []
      };
    } catch (e) {
      console.warn("Failed to parse Map data", e);
      return mapModule.createDefaultCustomData!();
    }
  },

  serializeContent: (data: MapBlockData): string => {
    return JSON.stringify(data, null, 2);
  },

  RendererComponent: CustomMapRenderer,

  getAIASTNode: (block: any): Record<string, any> => {
    const data = block.content?.customBlockData as MapBlockData | undefined;
    return {
      type: 'mapBlock',
      center: data?.center || [0, 0],
      markersCount: data?.markers?.length || 0,
      contentSummary: "[MAP_DATA_OMITTED_FOR_TOKENS]",
    };
  },
  getAIPrompt: () => `[map] Carte interactive Leaflet. Syntaxe: \`\`\`map\n{"lat":48.8566,"lng":2.3522,"zoom":13}\n\`\`\` Les clés 'lat', 'lng' (coordonnées GPS) et 'zoom' (1=monde, 18=rue) sont obligatoires. Utilise ce bloc quand l'utilisateur mentionne un lieu géographique.`.trim()
};
