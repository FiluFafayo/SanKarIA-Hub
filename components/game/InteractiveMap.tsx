import React, { useState } from 'react';
import { MapMarker } from '../../types';

interface InteractiveMapProps {
    imageUrl: string;
    markers: MapMarker[];
    playerLocationId?: string;
    onMarkerAction?: (action: 'inspect' | 'move' | 'interact', marker: MapMarker) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ imageUrl, markers, playerLocationId, onMarkerAction }) => {
    const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

    const handleAction = (action: 'inspect' | 'move' | 'interact', marker: MapMarker) => {
        onMarkerAction?.(action, marker);
        // Tutup sheet kecil setelah aksi
        setSelectedMarkerId(null);
    };

    return (
        <div className="relative w-full aspect-video bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600" onClick={() => setSelectedMarkerId(null)}>
            <img src={imageUrl} alt="Peta Kampanye" className="w-full h-full object-cover" decoding="async" />
            {markers.map(marker => {
                const isPlayerLocation = marker.id === playerLocationId;
                const isSelected = marker.id === selectedMarkerId;
                return (
                    <div
                        key={marker.id}
                        className="absolute group"
                        style={{ left: `${marker.x}%`, top: `${marker.y}%`, transform: 'translate(-50%, -50%)' }}
                        onClick={(e) => { e.stopPropagation(); setSelectedMarkerId(marker.id); }}
                    >
                        <div className={`
                            w-4 h-4 rounded-full border-2 bg-red-600 border-white shadow-lg cursor-pointer
                            flex items-center justify-center
                            ${isPlayerLocation ? 'animate-pulse' : ''}
                        `}>
                           {isPlayerLocation && <div className="w-2 h-2 bg-yellow-300 rounded-full"></div>}
                        </div>
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
                            bg-black/80 text-white text-xs font-bold px-2 py-1 rounded
                            opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                            {marker.name}
                        </div>
                        {isSelected && (
                            <div className="absolute left-1/2 translate-x-2 top-1/2 -translate-y-1/2 bg-gray-900/90 border border-gray-700 rounded-lg shadow-xl p-2 z-20">
                                <div className="flex flex-col gap-1">
                                    <button className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-100 hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleAction('inspect', marker); }}>Inspect</button>
                                    <button className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-100 hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleAction('move', marker); }}>Move</button>
                                    <button className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-100 hover:bg-gray-700" onClick={(e) => { e.stopPropagation(); handleAction('interact', marker); }}>Interact</button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
