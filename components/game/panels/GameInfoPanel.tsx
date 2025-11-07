// FASE 3: Memoized. Props di-slice.

import React from 'react';
// FASE 3: Impor tipe-tipe slice
import { 
    Character, Quest, NPC, WorldWeather, 
    MapMarker 
} from '../../../types';
import { InfoPanel } from '../InfoPanel';

// FASE 3: Definisikan tipe props yang di-slice
// (Ini diekspor agar InfoPanel.tsx bisa menggunakannya)
export interface InfoPanelPropsSlice {
    title: string;
    description: string;
    joinCode: string;
    mapImageUrl?: string;
    explorationGrid: number[][];
    fogOfWar: boolean[][];
    playerGridPosition: { x: number; y: number };
    currentTime: number;
    currentWeather: WorldWeather;
    quests: Quest[];
    npcs: NPC[];
}

interface GameInfoPanelProps {
    campaignSlice: InfoPanelPropsSlice;
    players: Character[];
}

export const GameInfoPanel: React.FC<GameInfoPanelProps> = React.memo(({ 
    campaignSlice, 
    players 
}) => {
    return (
        <InfoPanel 
            campaign={campaignSlice} // InfoPanel sekarang menerima slice
            players={players} 
        />
    );
});