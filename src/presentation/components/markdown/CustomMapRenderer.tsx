import React, { useState, useEffect, useCallback } from 'react';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';
import type { MapBlockData, MapMarker } from '@/application/logic/modules/mapModule';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix pour les icônes par défaut de Leaflet qui ne chargent pas bien avec Webpack/Vite
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png?url';
import iconUrl from 'leaflet/dist/images/marker-icon.png?url';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png?url';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

import { useEditorCommands } from '@/application/context/EditorContext';

const MapEvents = ({ onMapClick }: { onMapClick: (e: L.LeafletMouseEvent) => void }) => {
  const handlerRef = React.useRef(onMapClick);
  React.useEffect(() => {
    handlerRef.current = onMapClick;
  }, [onMapClick]);

  useMapEvents({
    click(e) {
      handlerRef.current(e);
    },
  });
  return null;
};

const MapUpdater = ({ center, zoom, route, isEditing }: { center: [number, number], zoom: number, route?: [number, number][], isEditing: boolean }) => {
  const map = useMapEvents({});
  useEffect(() => {
    if (isEditing) return; // Ne pas bouger la caméra pendant l'édition interactive
    if (route && route.length > 1) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView(center, zoom);
    }
  }, [center, zoom, route, map, isEditing]);
  return null;
};

import { mapModule } from '@/application/logic/modules/mapModule';

export const CustomMapRenderer: React.FC<BlockRendererProps<MapBlockData>> = ({
  block,
  customData
}) => {
  const { updateBlock, activeBlockId, setActiveBlockId } = useEditorCommands();
  const [data, setData] = useState<MapBlockData>(customData || { center: [48.85, 2.35], zoom: 13, markers: [] });
  
  // Le mode d'édition interactif (placement de marqueurs)
  const isEditing = activeBlockId === block.id;

  console.log(`[CustomMapRenderer RENDER] block.id=${block.id} isEditing=${isEditing}`);
  console.log(`[CustomMapRenderer RENDER] block.content.code=`, (block.content as any)?.code);
  console.log(`[CustomMapRenderer RENDER] customData=`, customData);
  console.log(`[CustomMapRenderer RENDER] data (local state)=`, data);

  useEffect(() => {
    if (customData) {
      console.log(`[CustomMapRenderer EFFECT] Updating local data with customData`, customData);
      setData(customData);
    }
  }, [customData]);

  const triggerSave = useCallback((newData: MapBlockData) => {
    updateBlock(block.id, block, {
      type: 'UPDATE_SOURCE_FOR_MODULE',
      newRawSource: mapModule.serializeContent!(newData),
      moduleType: 'map'
    });
  }, [block.id, updateBlock, block]);

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (!isEditing) return;
    const newMarker: MapMarker = {
      id: `marker-${data.markers ? data.markers.length : 0}`,
      position: [e.latlng.lat, e.latlng.lng],
      popupText: `Étape ${(data.markers?.length || 0) + 1}`
    };
    
    let newRoute = data.route;
    if (data.route && data.route.length > 0) {
      newRoute = [...data.route, [e.latlng.lat, e.latlng.lng]];
    } else if (data.markers && data.markers.length > 0) {
      newRoute = [...data.markers.map(m => m.position), [e.latlng.lat, e.latlng.lng]];
    }

    const newData = { ...data, markers: [...(data.markers || []), newMarker], route: newRoute };
    setData(newData);
    triggerSave(newData);
  };

  const handleDeleteMarker = (markerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const markerToDelete = data.markers?.find(m => m.id === markerId);
      const newData = { ...data, markers: (data.markers || []).filter(m => m.id !== markerId) };
      
      if (markerToDelete && newData.route) {
        newData.route = newData.route.filter(pos => pos[0] !== markerToDelete.position[0] && pos[1] !== markerToDelete.position[1]);
      }
      
      setData(newData);
      triggerSave(newData);
  };

  const handlePopupEdit = (markerId: string, newText: string) => {
      const newData = {
          ...data,
          markers: (data.markers || []).map(m => m.id === markerId ? { ...m, popupText: newText } : m)
      };
      setData(newData);
      triggerSave(newData);
  };

  return (
    <div className="w-full h-[400px] my-4 rounded overflow-hidden relative border border-gray-200 dark:border-zinc-700 nova-map-block group">
      <div className="absolute top-2 right-2 z-[1000] bg-white dark:bg-zinc-800 rounded shadow p-1">
          <label className="flex items-center gap-2 text-sm px-2 cursor-pointer text-gray-800 dark:text-gray-200">
              <input type="checkbox" checked={isEditing} onChange={(e) => setActiveBlockId(e.target.checked ? block.id : null)} />
              Mode Édition (Cliquez pour ajouter un marqueur/étape)
          </label>
      </div>
      <MapContainer 
        center={data.center} 
        zoom={data.zoom} 
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <MapUpdater center={data.center} zoom={data.zoom} route={data.route} isEditing={isEditing} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapEvents onMapClick={handleMapClick} />
        {data.route && data.route.length > 1 && (
          <Polyline positions={data.route} color="#3b82f6" weight={4} opacity={0.8} />
        )}
        {(data.markers || []).map(marker => (
          <Marker key={marker.id} position={marker.position}>
            <Popup>
                {isEditing ? (
                    <div className="flex flex-col gap-2">
                        <input 
                            className="border border-gray-300 rounded p-1 text-sm text-black"
                            defaultValue={marker.popupText}
                            onBlur={e => handlePopupEdit(marker.id, e.target.value)}
                        />
                        <button 
                            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                            onClick={(e) => handleDeleteMarker(marker.id, e)}
                        >
                            Supprimer le marqueur
                        </button>
                    </div>
                ) : (
                    <div className="text-black">{marker.popupText}</div>
                )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
