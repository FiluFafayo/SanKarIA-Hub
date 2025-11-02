// =================================================================
// 
//       FILE: GameScreen.tsx (VERSI BARU - POST-REFAKTOR DB)
// 
// =================================================================
import React, { useState, useEffect, useCallback, MouseEvent, useMemo } from 'react';
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
    initialCharacter: Character;      // Karakter GLOBAL milik user ini
    allPlayersInCampaign: Character[]; // Daftar SEMUA karakter global di sesi ini
    onExitGame: (finalCampaignState: Campaign) => void;
    onSaveCampaign: (campaign: Campaign) => Promise<void>;
    onSaveCharacter: (character: Character) => Promise<void>; // (MANDAT "KARAKTER GLOBAL")
    userId: string;
}

interface ContextMenuState {
    x: number;
    y: number;
    objectName: string;
    objectId: string;
}

export const GameScreen: React.FC<GameScreenProps> = ({ 
    initialCampaign, 
    initialCharacter, 
    allPlayersInCampaign, 
    onExitGame, 
    onSaveCampaign, 
    onSaveCharacter, 
    userId 
}) => {
    
    // --- STATE MANAJEMEN BARU ---
    // 'useCampaign' HANYA mengelola state Sesi (Kampanye)
    const { campaign, campaignActions } = useCampaign(initialCampaign);
    
    // Kita butuh state LOKAL untuk melacak state karakter SELAMA SESI INI
    // Ini adalah implementasi mandat "Karakter Global (SSOT)"
    const [activeCharacter, setActiveCharacter] = useState<Character>(initialCharacter);
    const [playerList, setPlayerList] = useState<Character[]>(allPlayersInCampaign);
    // ---
    
    const [activeMobileTab, setActiveMobileTab] = useState<'chat' | 'character' | 'info'>('chat');
    const [pendingSkill, setPendingSkill] = useState<Skill | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    const isMyTurn = campaign.currentPlayerId === activeCharacter.id;

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

    /**
     * (MANDAT "KARAKTER GLOBAL")
     * Fungsi callback ini akan dipanggil oleh combat/exploration system.
     * Ini akan meng-update state LOKAL (di GameScreen) DAN
     * memanggil handler SSOT di App.tsx (onSaveCharacter).
     */
    const handleCharacterUpdate = useCallback(async (updatedChar: Character) => {
        // 1. Update state lokal untuk UI responsif
        if (updatedChar.id === activeCharacter.id) {
            setActiveCharacter(updatedChar);
        }
        setPlayerList(prev => prev.map(p => p.id === updatedChar.id ? updatedChar : p));
        
        // 2. Panggil handler SSOT untuk menyimpan ke DB
        // Kita tidak 'await' agar UI tidak ter-block
        onSaveCharacter(updatedChar);
    }, [activeCharacter.id, onSaveCharacter]);

    
    // Memo-kan daftar pemain untuk sistem kombat/eksplorasi
    const memoizedPlayerList = useMemo(() => playerList, [playerList]);

    const combatSystem = useCombatSystem({
        campaign,
        character: activeCharacter, // Selalu gunakan karakter aktif
        players: memoizedPlayerList, // Gunakan daftar pemain sesi
        campaignActions,
        updateCharacter: handleCharacterUpdate // Gunakan handler SSOT
    });

    const explorationSystem = useExplorationSystem({
        campaign,
        character: activeCharacter,
        players: memoizedPlayerList,
        campaignActions
    });

    // Logika isDisabled tidak berubah, tapi sekarang lebih akurat
    const isCombat = campaign.gameState === 'combat';
    const isMyCombatTurn = isCombat && isMyTurn && !!campaign.turnId;
    const isExploration = !isCombat && !campaign.turnId;
    
    const isDisabled = campaign.thinkingState !== 'idle'
                     || !!campaign.activeRollRequest
                     || (!isMyCombatTurn && !isExploration);

    const handleActionSubmit = (actionText: string) => {
        campaignActions.clearChoices();
        if (campaign.gameState === 'exploration') {
            // TODO: explorationSystem perlu di-refaktor untuk mengembalikan
            // ToolCall yang butuh update karakter.
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
        const currentTurnId = campaign.turnId; 
        if (!currentTurnId) {
            console.error("RollModal selesai tetapi tidak ada turnId aktif!");
            return;
        }

        if (campaign.gameState === 'combat') {
            combatSystem.handleRollComplete(roll, request, currentTurnId); 
        } else {
            explorationSystem.handleRollComplete(roll, request, currentTurnId);
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

    // Auto-save state kampanye setiap 30 detik jika ada perubahan
    // (Ini adalah PENGGANTI untuk "save on exit" yang lebih aman)
    useEffect(() => {
        const interval = setInterval(() => {
            // Cek apakah state 'campaign' berbeda dari 'initialCampaign'
            // (Perbandingan JSON sederhana, tidak sempurna tapi cukup baik)
            if (JSON.stringify(campaign) !== JSON.stringify(initialCampaign)) {
                console.log("Auto-saving campaign state...");
                onSaveCampaign(campaign);
            }
        }, 30000); // Simpan setiap 30 detik

        return () => clearInterval(interval);
    }, [campaign, initialCampaign, onSaveCampaign]);

    const hasChoices = campaign.choices && campaign.choices.length > 0;
    const shouldShowChoices = hasChoices && (campaign.gameState === 'exploration' || (isMyTurn && activeCharacter.currentHp > 0));

    const ChatPanel = () => (
        <main className="flex-grow flex flex-col h-full overflow-hidden">
            <ChatLog events={campaign.eventLog} players={playerList} characterId={activeCharacter.id} thinkingState={campaign.thinkingState} onObjectClick={handleObjectClick} />
            <div className="flex-shrink-0">
                {shouldShowChoices && <ChoiceButtons choices={campaign.choices} onChoiceSelect={handleActionSubmit} />}
                <ActionBar disabled={isDisabled} onActionSubmit={handleActionSubmit} pendingSkill={pendingSkill} />
            </div>
        </main>
    );

    const RightPanel = () => (
        <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-gray-800 md:border-l-2 border-gray-700 p-4 overflow-y-auto flex flex-col gap-4">
            <CombatTracker
                players={playerList}
                monsters={campaign.monsters}
                initiativeOrder={campaign.initiativeOrder}
                currentPlayerId={campaign.currentPlayerId}
            />
            <CharacterPanel
                character={activeCharacter}
                monsters={campaign.monsters}
                isMyTurn={isMyTurn}
                combatSystem={combatSystem}
                updateCharacter={handleCharacterUpdate} // Pass-through handler SSOT
                gameState={campaign.gameState}
                onSkillSelect={handleSkillSelect}
            />
        </aside>
    );
    
    const InfoPanelComponent = () => (
         <aside className="hidden lg:block w-80 xl:w-96 flex-shrink-0 bg-gray-800 border-r-2 border-gray-700">
            <div className="h-full overflow-y-auto">
                <InfoPanel campaign={campaign} players={playerList} />
            </div>
        </aside>
    );

    return (
        <div className="w-screen h-screen bg-gray-900 text-gray-200 flex flex-col font-sans" onClick={() => setContextMenu(null)}>
            <header className="flex-shrink-0 bg-gray-800 p-3 flex items-center justify-between border-b-2 border-gray-700 z-20">
                <h1 className="font-cinzel text-xl text-purple-300 truncate pr-4">{campaign.title}</h1>
                {/* Tombol Exit sekarang HANYA memanggil onExitGame */}
                <button onClick={() => onExitGame(campaign)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded flex-shrink-0">Keluar</button>
            </header>

            <div className="flex flex-grow overflow-hidden relative">
                {/* Desktop Layout */}
                <div className="hidden md:flex flex-grow h-full">
                    {/* Left Panel (Info) */}
                    <InfoPanelComponent />

                    {/* Center Panel (Chat) */}
                    <ChatPanel />

                    {/* Right Panel (Character/Combat) */}
                    <RightPanel />
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden w-full h-full pb-16">
                    {activeMobileTab === 'chat' && <ChatPanel />}
                    {activeMobileTab === 'character' && <RightPanel />}
                    {activeMobileTab === 'info' && <InfoPanel campaign={campaign} players={playerList} />}
                </div>
            </div>

            <MobileNavBar activeTab={activeMobileTab} setActiveTab={setActiveMobileTab} />

            {/* Roll Modal sekarang merujuk ke activeCharacter.id */}
            {campaign.activeRollRequest && campaign.activeRollRequest.characterId === activeCharacter.id && (
                <RollModal
                    key={`${campaign.activeRollRequest.type}-${campaign.activeRollRequest.reason}`}
                    request={campaign.activeRollRequest}
                    character={activeCharacter}
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