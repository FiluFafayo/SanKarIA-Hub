import React from 'react';
import { MapMarker } from '../../types';

interface InteractiveMapProps {
    imageUrl: string;
    markers: MapMarker[];
    playerLocationId?: string;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ imageUrl, markers, playerLocationId }) => {
    return (
        <div className="relative w-full aspect-video bg-gray-700 rounded-lg overflow-hidden border-2 border-gray-600">
            <img src={imageUrl} alt="Peta Kampanye" className="w-full h-full object-cover" />
            {markers.map(marker => {
                const isPlayerLocation = marker.id === playerLocationId;
                return (
                    <div
                        key={marker.id}
                        className="absolute group"
                        style={{ left: `${marker.x}%`, top: `${marker.y}%`, transform: 'translate(-50%, -50%)' }}
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
                    </div>
                )
            })}
        </div>
    )
}
