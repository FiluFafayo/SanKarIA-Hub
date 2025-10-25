import React, { useState, useEffect, useCallback, MouseEvent } from 'react';
import { Campaign, Character, DiceRoll, RollRequest, Skill } from '../types';
import { useCampaign } from '../hooks/useCampaign';
import { useCombatSystem } from '../hooks/useCombatSystem';
import { useExplorationSystem } from '../hooks/useExplorationSystem';

// Import modular components
import { MobileNavBar } from './game/MobileNavBar';
import { ChoiceButtons } from './game/ChoiceButtons';
import { CharacterPanel } from './game/CharacterPanel';
import { CombatTracker } from './game/CombatTracker';
import { InfoPanel } from './game/InfoPanel';
import { ChatLog } from './game/ChatLog';
import { ActionBar } from './game/ActionBar';
import { RollModal } from './game/RollModal';

interface GameScreenProps {
    initialCampaign: Campaign;
    character: Character;
    players: Character[];
    onExit: (finalCampaignState: Campaign) => void;
    updateCharacter: (character: Character) => Promise<void>;
    userId: string;
}

interface ContextMenuState {
    x: number;
    y: number;
    objectName: string;
    objectId: string;
}

export const GameScreen: React.FC<GameScreenProps> = ({ initialCampaign, character, players, onExit, updateCharacter, userId }) => {
    const { campaign, campaignActions } = useCampaign(initialCampaign, players);
    const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'character' | 'info'>('chat');
    const [pendingSkill, setPendingSkill] = useState<Skill | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    const isMyTurn = campaign.currentPlayerId === character.id;

    useEffect(() => {
        const isReadyForPlayerAction = campaign.gameState === 'combat'
            && isMyTurn
            && campaign.thinkingState === 'idle'
            && !campaign.activeRollRequest;

        if (isReadyForPlayerAction) {
            setActiveMobileTab('character');
        } else {
            setActiveMobileTab('chat');
        }
    }, [
        campaign.gameState,
        isMyTurn,
        campaign.thinkingState,
        campaign.activeRollRequest,
    ]);

    const memoizedUpdateCharacter = useCallback(async (updatedChar: Character) => {
        await updateCharacter(updatedChar);
        campaignActions.updateCharacterInCampaign(updatedChar);
    }, [updateCharacter, campaignActions]);

    const combatSystem = useCombatSystem({
        campaign,
        character,
        players,
        campaignActions,
        updateCharacter: memoizedUpdateCharacter
    });

    const explorationSystem = useExplorationSystem({
        campaign,
        character,
        players,
        campaignActions
    });

    const isDisabled = campaign.thinkingState !== 'idle' || !!campaign.turnId || (campaign.gameState === 'combat' && !isMyTurn) || !!campaign.activeRollRequest;

    const handleActionSubmit = (actionText: string) => {
        campaignActions.clearChoices();
        if (campaign.gameState === 'exploration') {
            explorationSystem.handlePlayerAction(actionText, pendingSkill);
        }
        setPendingSkill(null);
        setContextMenu(null);
    };

    const handleSkillSelect = (skill: Skill) => {
        setPendingSkill(skill);
        setActiveMobileTab('chat');
    };

    const handleRollComplete = (roll: DiceRoll, request: RollRequest) => {
        const currentTurnId = campaign.turnId; // Ambil turnId yang sedang aktif
        if (!currentTurnId) {
            // Ini seharusnya tidak pernah terjadi jika modalnya muncul
            console.error("RollModal selesai tetapi tidak ada turnId aktif!");
            return;
        }

        if (campaign.gameState === 'combat') {
            combatSystem.handleRollComplete(roll, request, currentTurnId); // Lewatkan ID-nya
        } else {
            explorationSystem.handleRollComplete(roll, request, currentTurnId); // Lewatkan ID-nya
        }
    };

    const handleObjectClick = (objectName: string, objectId: string, event: MouseEvent<HTMLButtonElement>) => {
        setContextMenu({
            x: event.clientX,
            y: event.clientY,
            objectName,
            objectId
        });
    };

    const hasChoices = campaign.choices && campaign.choices.length > 0;
    const shouldShowChoices = hasChoices && (campaign.gameState === 'exploration' || (isMyTurn && character.currentHp > 0));


    const ChatPanel = () => (
        <main className="flex-grow flex flex-col h-full overflow-hidden">
            <ChatLog events={campaign.eventLog} players={players} characterId={character.id} thinkingState={campaign.thinkingState} onObjectClick={handleObjectClick} />
            <div className="flex-shrink-0">
                {shouldShowChoices && <ChoiceButtons choices={campaign.choices} onChoiceSelect={handleActionSubmit} />}
                <ActionBar disabled={isDisabled} onActionSubmit={handleActionSubmit} pendingSkill={pendingSkill} />
            </div>
        </main>
    );

    const RightPanel = () => (
        <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-gray-800 md:border-l-2 border-gray-700 p-4 overflow-y-auto flex flex-col gap-4">
            <CombatTracker
                players={players}
                monsters={campaign.monsters}
                initiativeOrder={campaign.initiativeOrder}
                currentPlayerId={campaign.currentPlayerId}
            />
            <CharacterPanel
                character={character}
                monsters={campaign.monsters}
                isMyTurn={isMyTurn}
                combatSystem={combatSystem}
                updateCharacter={updateCharacter}
                gameState={campaign.gameState}
                onSkillSelect={handleSkillSelect}
            />
        </aside>
    );

    return (
        <div className="w-screen h-screen bg-gray-900 text-gray-200 flex flex-col font-sans" onClick={() => setContextMenu(null)}>
            <header className="flex-shrink-0 bg-gray-800 p-3 flex items-center justify-between border-b-2 border-gray-700 z-20">
                <h1 className="font-cinzel text-xl text-purple-300 truncate pr-4">{campaign.title}</h1>
                <button onClick={() => onExit(campaign)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded flex-shrink-0">Keluar</button>
            </header>

            <div className="flex flex-grow overflow-hidden relative">
                {/* Desktop Layout: Three columns for large screens, two for medium */}
                <div className="hidden md:flex flex-grow h-full">
                    {/* Left Panel (Info) - shows only on large screens */}
                    <aside className="hidden lg:block w-80 xl:w-96 flex-shrink-0 bg-gray-800 border-r-2 border-gray-700">
                        <div className="h-full overflow-y-auto">
                            <InfoPanel campaign={campaign} players={players} />
                        </div>
                    </aside>

                    {/* Center Panel (Chat) */}
                    <ChatPanel />

                    {/* Right Panel (Character/Combat) */}
                    <RightPanel />
                </div>

                {/* Mobile Layout (unchanged) */}
                <div className="md:hidden w-full h-full pb-16">
                    {activeMobileTab === 'chat' && <ChatPanel />}
                    {activeMobileTab === 'character' && <RightPanel />}
                    {activeMobileTab === 'info' && <InfoPanel campaign={campaign} players={players} />}
                </div>
            </div>

            <MobileNavBar activeTab={activeMobileTab} setActiveTab={setActiveMobileTab} />

            {campaign.activeRollRequest && campaign.activeRollRequest.characterId === character.id && (
                <RollModal
                    key={`${campaign.activeRollRequest.type}-${campaign.activeRollRequest.reason}`}
                    request={campaign.activeRollRequest}
                    character={character}
                    onComplete={handleRollComplete}
                />
            )}

            {contextMenu && (
                <div
                    style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
                    className="fixed z-50 bg-gray-800 border border-purple-500 rounded-md shadow-lg p-2 flex flex-col animate-fade-in-fast"
                >
                    <div className="px-2 py-1 border-b border-gray-600 text-sm text-purple-300 capitalize">{contextMenu.objectName}</div>
                    <button onClick={() => handleActionSubmit(`Aku memeriksa ${contextMenu.objectName}.`)} className="text-left px-2 py-1 hover:bg-purple-700 rounded text-sm">Periksa</button>
                    <button onClick={() => handleActionSubmit(`Aku mencoba membuka ${contextMenu.objectName}.`)} className="text-left px-2 py-1 hover:bg-purple-700 rounded text-sm">Buka</button>
                    <button onClick={() => handleActionSubmit(`Aku mengambil ${contextMenu.objectName}.`)} className="text-left px-2 py-1 hover:bg-purple-700 rounded text-sm">Ambil</button>
                </div>
            )}
        </div>
    );
};
