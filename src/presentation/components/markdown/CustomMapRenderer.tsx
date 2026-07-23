import React, { useState, useEffect, useCallback } from 'react';
import type { BlockRendererProps } from '@/application/interfaces/blockModule';
import type { MapBlockData, MapMarker } from '@/application/logic/modules/mapModule';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { v4 as uuidv4 } from 'uuid';

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
  useMapEvents({
    click(e) {
      onMapClick(e);
    },
  });
  return null;
};

export const CustomMapRenderer: React.FC<BlockRendererProps<MapBlockData>> = ({
  block,
  customData
}) => {
  const { updateBlock, activeBlockId, setActiveBlockId } = useEditorCommands();
  const [data, setData] = useState<MapBlockData>(customData || { center: [48.85, 2.35], zoom: 13, markers: [] });
  const isEditing = activeBlockId === block.id;

  useEffect(() => {
    if (customData) setData(customData);
  }, [customData]);

  const triggerSave = useCallback((newData: MapBlockData) => {
    updateBlock(block.id, block, {
      type: 'UPDATE_SOURCE_FOR_MODULE',
      newRawSource: JSON.stringify(newData, null, 2),
      moduleType: 'map'
    });
  }, [block.id, updateBlock, block]);

  const handleMapClick = (e: L.LeafletMouseEvent) => {
    if (!isEditing) return;
    const newMarker: MapMarker = {
      id: uuidv4(),
      position: [e.latlng.lat, e.latlng.lng],
      popupText: "Nouveau marqueur"
    };
    const newData = { ...data, markers: [...data.markers, newMarker] };
    setData(newData);
    triggerSave(newData);
  };

  const handleDeleteMarker = (markerId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newData = { ...data, markers: data.markers.filter(m => m.id !== markerId) };
      setData(newData);
      triggerSave(newData);
  };

  const handlePopupEdit = (markerId: string, newText: string) => {
      const newData = {
          ...data,
          markers: data.markers.map(m => m.id === markerId ? { ...m, popupText: newText } : m)
      };
      setData(newData);
      triggerSave(newData);
  };

  return (
    <div className="w-full h-[400px] my-4 rounded overflow-hidden relative border border-gray-200 dark:border-zinc-700 nova-map-block" onClick={e => e.stopPropagation()}>
      <div className="absolute top-2 right-2 z-[1000] bg-white dark:bg-zinc-800 rounded shadow p-1">
          <label className="flex items-center gap-2 text-sm px-2 cursor-pointer text-gray-800 dark:text-gray-200">
              <input type="checkbox" checked={isEditing} onChange={(e) => setActiveBlockId(e.target.checked ? block.id : null)} />
              Mode Édition (Cliquez pour ajouter un marqueur)
          </label>
      </div>
      <MapContainer 
        center={data.center} 
        zoom={data.zoom} 
        style={{ height: '100%', width: '100%', zIndex: 1 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapEvents onMapClick={handleMapClick} />
        {(data.markers || []).map(marker => (
          <Marker key={marker.id} position={marker.position}>
            <Popup>
                {isEditing ? (
                    <div className="flex flex-col gap-2">
                        <input 
                            className="border border-gray-300 rounded p-1 text-sm text-black"
                            value={marker.popupText}
                            onChange={e => handlePopupEdit(marker.id, e.target.value)}
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
