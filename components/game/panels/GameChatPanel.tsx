// FASE 1: Direfaktor.
// Komponen ini SEKARANG HANYA bertanggung jawab untuk merender ChatLog atau BattleMap.
// ActionBar/ChoiceButtons telah DIPINDAHKAN ke GameScreen untuk anchoring ergonomis.

import React, { MouseEvent } from 'react';
import { CampaignState, Character, CampaignActions } from '../../../types'; // Hapus Skill, MobileTab, dll.
import { BattleMapRenderer } from '../BattleMapRenderer';
import { ChatLog } from '../ChatLog';
// Hapus ChoiceButtons dan ActionBar

interface GameChatPanelProps {
    campaign: CampaignState;
    players: Character[];
    characterId: string;
    onObjectClick: (objectName: string, objectId: string, event: MouseEvent<HTMLButtonElement>) => void;
    campaignActions: CampaignActions; // Untuk BattleMap
}

export const GameChatPanel: React.FC<GameChatPanelProps> = ({
    campaign,
    players,
    characterId,
    onObjectClick,
    campaignActions,
}) => {

    const { gameState, battleState, eventLog, thinkingState } = campaign;

    // Tentukan apakah kita harus merender Peta Tempur
    const showBattleMap = gameState === 'combat' && battleState;

    return (
        <main className="flex-grow flex flex-col h-full overflow-hidden">
            {showBattleMap ? (
                <BattleMapRenderer
                    battleState={battleState!}
                    campaignActions={campaignActions}
                    currentUserId={characterId}
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
           
            {/* FASE 1: Wrapper Input (ActionBar/ChoiceButtons) DIHAPUS DARI SINI.
                Mereka sekarang hidup langsung di GameScreen.tsx. */}
        </main>
    );
};