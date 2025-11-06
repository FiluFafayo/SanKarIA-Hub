// FASE 0: File BARU
// Komponen ini diekstrak dari GameScreen.tsx untuk modularitas.
// Ini mewakili panel "tengah" (Chat/Battle).

import React, { MouseEvent } from 'react';
import { CampaignState, Character, Skill, MobileTab, CampaignActions } from '../../../types';
import { BattleMapRenderer } from '../BattleMapRenderer';
import { ChatLog } from '../ChatLog';
import { ChoiceButtons } from '../ChoiceButtons';
import { ActionBar } from '../ActionBar';

interface GameChatPanelProps {
    campaign: CampaignState;
    players: Character[];
    characterId: string;
    onObjectClick: (objectName: string, objectId: string, event: MouseEvent<HTMLButtonElement>) => void;
    shouldShowChoices: boolean;
    onChoiceSelect: (choice: string) => void;
    isDisabled: boolean;
    pendingSkill: Skill | null;
    onActionSubmit: (text: string) => void;
    campaignActions: CampaignActions; // Untuk BattleMap
    // Prop mobile-only
    activeMobileTab: MobileTab;
    setActiveMobileTab: (tab: MobileTab) => void;
}

export const GameChatPanel: React.FC<GameChatPanelProps> = ({
    campaign,
    players,
    characterId,
    onObjectClick,
    shouldShowChoices,
    onChoiceSelect,
    isDisabled,
    pendingSkill,
    onActionSubmit,
    campaignActions,
    activeMobileTab,
    setActiveMobileTab
}) => {

    const { gameState, battleState, eventLog, thinkingState, choices } = campaign;

    // Tentukan apakah kita harus merender Peta Tempur
    const showBattleMap = gameState === 'combat' && battleState;

    // Tentukan apakah kita harus merender Input/Pilihan (ActionBar/ChoiceButtons)
    // FASE 0: Logika ini disederhanakan. Input selalu di-render.
    // Visibilitasnya dikontrol oleh GameScreen (CSS Grid Area).
    const showInput = true; 

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
           
            {/* FASE 0: Wrapper Input Tunggal (tidak lagi bercabang mobile/desktop) */}
            <div className="flex-shrink-0">
                {showInput && (
                    <>
                        {shouldShowChoices && (
                            <ChoiceButtons
                                choices={choices}
                                onChoiceSelect={onChoiceSelect}
                            />
                        )}
                        <ActionBar
                            disabled={isDisabled}
                            onActionSubmit={onActionSubmit}
                            pendingSkill={pendingSkill}
                        />
                    </>
                )}
            </div>
        </main>
    );
};