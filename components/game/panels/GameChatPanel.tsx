// FASE 3: Memoized. Props di-slice.

import React, { MouseEvent } from 'react';
// FASE 3: Impor tipe-tipe slice
import { 
    GameEvent, ThinkingState, GameState, BattleState, 
    Character, CampaignActions 
} from '../../../types';
import { BattleMapRenderer } from '../BattleMapRenderer';
import { ChatLog } from '../ChatLog';

interface GameChatPanelProps {
    // FASE 3: Props di-slice untuk memoization
    eventLog: GameEvent[];
    thinkingState: ThinkingState;
    gameState: GameState;
    battleState: BattleState | null;
    // Props lain
    players: Character[];
    characterId: string;
    onObjectClick: (objectName: string, objectId: string, event: MouseEvent<HTMLButtonElement>) => void;
    campaignActions: CampaignActions; // Untuk BattleMap
    onMoveUnit?: (unitId: string, path: { x: number; y: number }[], cost: number) => void;
}

export const GameChatPanel: React.FC<GameChatPanelProps> = React.memo(({
    eventLog,
    thinkingState,
    gameState,
    battleState,
    players,
    characterId,
    onObjectClick,
    campaignActions,
    onMoveUnit,
}) => {

    // Tentukan apakah kita harus merender Peta Tempur
    // FASE FINAL FIX: Cek boolean (!!) battleState, bukan hanya 'truthy'
    const showBattleMap = gameState === 'combat' && !!battleState;

    return (
        <main className="flex-grow flex flex-col h-full overflow-hidden">
            {showBattleMap ? (
                <BattleMapRenderer
                    battleState={battleState!}
                    campaignActions={campaignActions}
                    currentUserId={characterId}
                    onMoveUnit={onMoveUnit}
                />
            ) : (
                <ChatLog
                    events={eventLog}
                    players={players}
                    characterId={characterId}
                    thinkingState={thinkingState}
                    onObjectClick={onObjectClick}
                />
            )}
        </main>
    );
});