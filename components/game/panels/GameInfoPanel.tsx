// FASE 0: File BARU
// Komponen ini diekstrak dari GameScreen.tsx (sebelumnya LeftPanel)

import React from 'react';
import { CampaignState, Character } from '../../../types';
import { InfoPanel } from '../InfoPanel';

interface GameInfoPanelProps {
    campaign: CampaignState;
    players: Character[];
}

export const GameInfoPanel: React.FC<GameInfoPanelProps> = ({ campaign, players }) => {
    return (
		<aside className="w-full h-full bg-gray-800 md:border-r-2 border-gray-700">
            <div className="h-full overflow-y-auto">
                <InfoPanel campaign={campaign} players={players} />
            </div>
		</aside>
    );
};