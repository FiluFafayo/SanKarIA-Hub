// FASE 0: File BARU
// Komponen ini diekstrak dari GameScreen.tsx (sebelumnya BattleMapPanel)

import React from 'react';
import { CampaignState, CampaignActions } from '../../../types';
import { BattleMapRenderer } from '../BattleMapRenderer';

interface GameBattleMapPanelProps {
    campaign: CampaignState;
    campaignActions: CampaignActions;
    characterId: string;
}

export const GameBattleMapPanel: React.FC<GameBattleMapPanelProps> = ({
    campaign,
    campaignActions,
    characterId
}) => {
    return (
        <main className="flex-grow flex flex-col h-full overflow-hidden">
            {campaign.battleState ? (
                <BattleMapRenderer 
                    battleState={campaign.battleState} 
                    campaignActions={campaignActions}
                    currentUserId={characterId}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-black">
                    <p>Menunggu Battle State...</p>
                </div>
            )}
        </main>
    );
};