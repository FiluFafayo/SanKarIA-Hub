// FASE 1: File di-REPLACE TOTAL.
// Arsitektur 3-kolom/tab-mobile DIHAPUS.
// Diganti dengan layout flex-col (Mobile-First) yang ergonomis.
// ActionBar/Choices menempel di bawah.
// Info/Character menjadi SidePanel (overlay).

import React, { useState, useEffect, useCallback, MouseEvent } from "react";
import { Campaign, Character, DiceRoll, RollRequest, Skill, CampaignState } from "../types";
import { useCampaign } from "../hooks/useCampaign";
import { useCombatSystem } from "../hooks/useCombatSystem";
import { useExplorationSystem } from "../hooks/useExplorationSystem";

// FASE 1: Impor komponen UI BARU
import { GameHeader } from "./game/GameHeader";
import { SidePanel } from "./game/SidePanel";

// FASE 1: Impor KONTEN Panel Modular
import { GameChatPanel } from "./game/panels/GameChatPanel";
import { GameCharacterPanel } from "./game/panels/GameCharacterPanel";
import { GameInfoPanel } from "./game/panels/GameInfoPanel";

// Import komponen UI (tidak berubah)
import { ChoiceButtons } from "./game/ChoiceButtons"; // FASE 1: Diimpor di sini
import { ActionBar } from "./game/ActionBar";       // FASE 1: Diimpor di sini
import { RollModal } from "./game/RollModal";
import { ModalWrapper } from "./ModalWrapper";
import { Die } from "./Die";
import { xpToNextLevel, rollHitDice, getAbilityModifier } from "../utils";
import { findClass } from "../data/registry";

// Import store (tidak berubah)
import { useDataStore } from "../store/dataStore";
import { useAppStore } from "../store/appStore";

interface GameScreenProps {
	initialCampaign: CampaignState; 
	character: Character;
	players: Character[];
	onExit: (finalCampaignState: CampaignState) => void;
	userId: string;
}

interface ContextMenuState {
	x: number;
	y: number;
	objectName: string;
	objectId: string;
}

// FASE 4: CSS Grid Adaptif (Memperbaiki Regresi Desktop)
// Mobile-first (default): grid 2 baris (chat + actionbar)
// Desktop (lg+): grid 3 kolom (info | chat+actionbar | character)
const gridLayoutStyle = `
    /* Mobile (Default) - 2 Baris */
    #gamescreen-layout {
        display: grid;
        grid-template-rows: 1fr auto;
        grid-template-columns: 100%;
        grid-template-areas: 
            "chat"
            "actions";
        height: 100%; /* Pastikan mengisi flex-grow */
    }
    /* Sembunyikan panel desktop di mobile */
    #gamescreen-layout > [data-panel="info"],
    #gamescreen-layout > [data-panel="character"] {
        display: none;
    }
    #gamescreen-layout > [data-panel="chat-container-mobile"] {
        grid-area: chat;
        overflow: hidden; /* Area chat bisa di-scroll internal */
        display: flex; /* Pastikan flex-col berfungsi */
        flex-direction: column;
    }
    #gamescreen-layout > [data-panel="actions-mobile"] {
        grid-area: actions;
        flex-shrink: 0;
    }


    /* Desktop (lg+) - 3 Kolom */
    @media (min-width: 1024px) {
        #gamescreen-layout {
            grid-template-rows: 1fr; /* 1 baris */
            grid-template-columns: 320px 1fr 384px; /* w-80, 1fr, w-96 */
            grid-template-areas: 
                "info chat character";
            height: 100%;
        }
        
        /* Sembunyikan wrapper mobile */
        #gamescreen-layout > [data-panel="chat-container-mobile"],
        #gamescreen-layout > [data-panel="actions-mobile"] {
            display: none;
        }

        /* Tampilkan panel desktop */
        #gamescreen-layout > [data-panel="info"],
        #gamescreen-layout > [data-panel="character"] {
            display: flex; /* Tampilkan panel statis di desktop */
            flex-direction: column;
            overflow-y: auto;
            height: 100%; /* Pastikan panel mengisi grid area */
            border: 0; /* Hapus border jika ada */
        }
        #gamescreen-layout > [data-panel="info"] {
            border-right: 2px solid #374151; /* gray-700 */
        }
         #gamescreen-layout > [data-panel="character"] {
            border-left: 2px solid #374151; /* gray-700 */
        }
        
        #gamescreen-layout > [data-panel="chat-container-desktop"] {
            grid-area: chat;
            display: flex;
            flex-direction: column;
            overflow: hidden; /* Kontainer chat desktop */
        }
    }
`;


export const GameScreen: React.FC<GameScreenProps> = ({
	initialCampaign,
	character,
	players,
	onExit,
	userId,
}) => {
	// (Logika hook (useAppStore, useDataStore, useCampaign) tidak berubah)
    // ... (kode hook identik dari Search) ...
    const { 
        _setRuntimeCampaignState, _setRuntimeCharacterState,
        characterToLevel, triggerLevelUp, closeLevelUp
    } = useAppStore(s => ({
        _setRuntimeCampaignState: s.actions._setRuntimeCampaignState,
        _setRuntimeCharacterState: s.actions._setRuntimeCharacterState,
        characterToLevel: s.levelUp.characterToLevel,
        triggerLevelUp: s.actions.triggerLevelUp,
        closeLevelUp: s.actions.closeLevelUp,
    }));
	const { updateCharacter } = useDataStore((s) => s.actions);
	const ssotCharacters = useDataStore((s) => s.state.characters);
    const dataStore = useDataStore.getState();
	const { campaign, campaignActions } = useCampaign(initialCampaign, players);
	useEffect(() => {
		const runtimePlayerIds = new Set(campaign.players.map((p) => p.id));
		const relevantSsotChars = ssotCharacters.filter((c) =>
			runtimePlayerIds.has(c.id)
		);
		relevantSsotChars.forEach((ssotChar) => {
			const runtimeChar = campaign.players.find((p) => p.id === ssotChar.id);
			if (runtimeChar && JSON.stringify(runtimeChar) !== JSON.stringify(ssotChar)) {
				campaignActions.updateCharacterInCampaign(ssotChar);
			}
		});
	}, [ssotCharacters, campaignActions, campaign.players]);
    const xpForNextLevel = xpToNextLevel(character.level);
    useEffect(() => {
        if (xpForNextLevel > 0 && character.xp >= xpForNextLevel) {
            const ssotCharacter = dataStore.state.characters.find(c => c.id === character.id);
            if (ssotCharacter && ssotCharacter.level === character.level) {
                 triggerLevelUp(character);
            }
        }
    }, [character.xp, character.level, xpForNextLevel, triggerLevelUp, character, dataStore.state.characters]);
	useEffect(() => {
		_setRuntimeCampaignState(campaign);
	}, [campaign, _setRuntimeCampaignState]);

	// FASE 1: Hapus state 'activeMobileTab'. Ganti dengan state panel overlay.
	const [activePanel, setActivePanel] = useState<'info' | 'character' | null>(null);
	
    const [pendingSkill, setPendingSkill] = useState<Skill | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const isMyTurn = campaign.currentPlayerId === character.id;

    // FASE 1: Hapus useEffect yang mengatur activeMobileTab

	const memoizedUpdateCharacter = useCallback(
		async (updatedChar: Character) => {
			await updateCharacter(updatedChar);
			campaignActions.updateCharacterInCampaign(updatedChar);
			_setRuntimeCharacterState(updatedChar);
		},
		[updateCharacter, campaignActions, _setRuntimeCharacterState]
	);

	const combatSystem = useCombatSystem({
		campaign,
		character,
		players,
		campaignActions,
		updateCharacter: memoizedUpdateCharacter,
	});

	const explorationSystem = useExplorationSystem({
		campaign,
		character,
		players,
		campaignActions,
	});

	const isCombat = campaign.gameState === "combat";
	const isMyCombatTurn = isCombat && isMyTurn && !!campaign.turnId;
	const isExploration = !isCombat && !campaign.turnId;
	const isDisabled =
		campaign.thinkingState !== "idle" ||
		!!campaign.activeRollRequest ||
		(!isMyCombatTurn && !isExploration);

	const handleActionSubmit = (actionText: string) => {
		campaignActions.clearChoices();
		if (campaign.gameState === "exploration") {
			explorationSystem.handlePlayerAction(actionText, pendingSkill);
		}
		setPendingSkill(null);
		setContextMenu(null);
	};

	// FASE 1: handleSkillSelect sekarang menutup panel
	const handleSkillSelect = (skill: Skill) => {
		setPendingSkill(skill);
		setActivePanel(null); // Tutup panel karakter
	};

	const handleRollComplete = (roll: DiceRoll, request: RollRequest) => {
		const currentTurnId = campaign.turnId; 
		if (!currentTurnId) {
			console.error("RollModal selesai tetapi tidak ada turnId aktif!");
			return;
		}
		if (campaign.gameState === "combat") {
			combatSystem.handleRollComplete(roll, request, currentTurnId); 
		} else {
			explorationSystem.handleRollComplete(roll, request, currentTurnId); 
		}
	};

	const handleObjectClick = (
		objectName: string,
		objectId: string,
		event: MouseEvent<HTMLButtonElement>
	) => {
		setContextMenu({
			x: event.clientX,
			y: event.clientY,
			objectName,
			objectId,
		});
	};
    // ... (Akhir dari logika hook yang tidak berubah) ...

	const hasChoices = campaign.choices && campaign.choices.length > 0;
	const shouldShowChoices =
		hasChoices &&
		(campaign.gameState === "exploration" ||
			(isMyTurn && character.currentHp > 0));

	return (
        // FASE 4: Layout flex-col diubah menjadi h-screen penuh
		<div
			className="w-screen h-screen bg-gray-900 text-gray-200 flex flex-col font-sans"
			onClick={() => setContextMenu(null)}
		>
            <style>{gridLayoutStyle}</style> {/* FASE 4: Tambahkan CSS Grid */}
            
            {/* FASE 1: Header Baru dengan Pemicu Panel */}
            <GameHeader
                title={campaign.title}
                thinkingState={campaign.thinkingState}
                hasActiveRoll={!!campaign.activeRollRequest}
                onExit={() => onExit(campaign)}
                onToggleInfo={() => setActivePanel(activePanel === 'info' ? null : 'info')}
                onToggleCharacter={() => setActivePanel(activePanel === 'character' ? null : 'character')}
            />

            {/* FASE 4: Layout Grid Adaptif BARU */}
			<div 
                id="gamescreen-layout"
                className="flex-grow overflow-hidden relative"
            >
                {/* FASE 4: Panel Chat Container (Mobile) */}
                <div data-panel="chat-container-mobile" className="lg:hidden">
                    <GameChatPanel
                        campaign={campaign}
                        players={campaign.players}
                        characterId={character.id}
                        onObjectClick={handleObjectClick}
                        campaignActions={campaignActions}
                    />
                </div>
                
                {/* FASE 4: Area Aksi (Mobile) */}
                <div data-panel="actions-mobile" className="flex-shrink-0 z-10 lg:hidden">
                    {shouldShowChoices && (
                        <ChoiceButtons
                            choices={campaign.choices}
                            onChoiceSelect={handleActionSubmit}
                        />
                    )}
                    {!shouldShowChoices && (
                        <ActionBar
                            disabled={isDisabled}
                            onActionSubmit={handleActionSubmit}
                            pendingSkill={pendingSkill}
                        />
                    )}
                </div>

                {/* FASE 4: Panel Info (Desktop) */}
                <div data-panel="info" className="hidden lg:flex bg-gray-800">
                    <GameInfoPanel
                        campaign={campaign}
                        players={campaign.players}
                    />
                </div>

                {/* FASE 4: Panel Chat Container (Desktop) */}
                <div data-panel="chat-container-desktop" className="hidden lg:flex">
                    <GameChatPanel
                        campaign={campaign}
                        players={campaign.players}
                        characterId={character.id}
                        onObjectClick={handleObjectClick}
                        campaignActions={campaignActions}
                    />
                    {/* Area Aksi untuk Desktop */}
                    <div className="flex-shrink-0 z-10">
                        {shouldShowChoices && (
                            <ChoiceButtons
                                choices={campaign.choices}
                                onChoiceSelect={handleActionSubmit}
                            />
                        )}
                        {!shouldShowChoices && (
                            <ActionBar
                                disabled={isDisabled}
                                onActionSubmit={handleActionSubmit}
                                pendingSkill={pendingSkill}
                            />
                        )}
                    </div>
                </div>

                {/* FASE 4: Panel Karakter (Desktop) */}
                <div data-panel="character" className="hidden lg:flex bg-gray-800">
                     <GameCharacterPanel
                        character={character}
                        campaign={campaign}
                        combatSystem={combatSystem}
                        onSkillSelect={handleSkillSelect}
                        isMyTurn={isMyTurn}
                    />
                </div>
			</div>
            {/* FASE 4: Akhir layout ergonomis */}


            {/* FASE 1: Panel Overlay (Kiri/Info) */}
            <SidePanel
                isOpen={activePanel === 'info'}
                onClose={() => setActivePanel(null)}
                position="left"
            >
                <GameInfoPanel
                    campaign={campaign}
                    players={campaign.players}
                />
            </SidePanel>

            {/* FASE 1: Panel Overlay (Kanan/Karakter) */}
             <SidePanel
                isOpen={activePanel === 'character'}
                onClose={() => setActivePanel(null)}
                position="right"
            >
                <GameCharacterPanel
                    character={character}
                    campaign={campaign}
                    combatSystem={combatSystem}
                    onSkillSelect={handleSkillSelect}
                    isMyTurn={isMyTurn}
                />
            </SidePanel>
            

			{/* (Render Modal tidak berubah) */}
            {characterToLevel && characterToLevel.id === character.id && (
                <LevelUpModal
                    key={characterToLevel.id}
                    char={characterToLevel}
                    onComplete={closeLevelUp}
                    onSave={memoizedUpdateCharacter}
                />
            )}

			{campaign.activeRollRequest &&
				campaign.activeRollRequest.characterId === character.id && (
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
					<div className="px-2 py-1 border-b border-gray-600 text-sm text-purple-300 capitalize">
						{contextMenu.objectName}
					</div>
					<button
						onClick={() =>
							handleActionSubmit(`Aku memeriksa ${contextMenu.objectName}.`)
						}
						className="text-left px-2 py-1 hover:bg-purple-700 rounded text-sm"
					>
						Periksa
					</button>
					<button
						onClick={() =>
							handleActionSubmit(
								`Aku mencoba membuka ${contextMenu.objectName}.`
							)
						}
						className="text-left px-2 py-1 hover:bg-purple-700 rounded text-sm"
					>
						Buka
					</button>
					<button
						onClick={() =>
							handleActionSubmit(`Aku mengambil ${contextMenu.objectName}.`)
						}
						className="text-left px-2 py-1 hover:bg-purple-700 rounded text-sm"
					>
						Ambil
					</button>
				</div>
			)}
		</div>
	);
};

// (Komponen LevelUpModal tidak berubah)
const LevelUpModal: React.FC<{
    char: Character;
    onComplete: () => void;
    onSave: (updatedChar: Character) => Promise<void>;
}> = ({ char, onComplete, onSave }) => {
    const [step, setStep] = useState(0); // 0 = intro, 1 = rolling, 2 = result
    const [hpRoll, setHpRoll] = useState(0);
    const [newMaxHp, setNewMaxHp] = useState(0);

    const conMod = getAbilityModifier(char.abilityScores.constitution);
    const classHitDice = findClass(char.class)?.hitDice || 'd8'; 
    const dieTypeNum = parseInt(classHitDice.replace('d','')) as 20 | 12 | 10 | 8 | 6;

    const handleRollHp = () => {
        setStep(1); // Show rolling
        const roll = rollHitDice(char.hitDice, conMod, char.level + 1);
        const newHp = char.maxHp + roll;
        
        setTimeout(() => {
            setHpRoll(roll);
            setNewMaxHp(newHp);
            setStep(2); // Show result
        }, 1500);
    };

    const handleConfirm = async () => {
        const updatedChar: Character = {
            ...char,
            level: char.level + 1,
            maxHp: newMaxHp,
            currentHp: newMaxHp, // Full heal on level up
            hitDice: {
                [classHitDice]: {
                    max: (char.hitDice[classHitDice]?.max || 0) + 1,
                    spent: 0 // Reset spent HD
                }
            }
        };
        await onSave(updatedChar);
        onComplete();
    };

    return (
        <ModalWrapper onClose={() => {}} title="Naik Level!">
            <div className="bg-gray-800/80 backdrop-blur-sm border border-purple-500/30 rounded-xl p-8 shadow-2xl text-white w-full max-w-lg text-center">
                <h2 className="font-cinzel text-3xl text-purple-200">Selamat!</h2>
                <p className="text-lg my-2">{char.name} telah mencapai Level {char.level + 1}!</p>
                
                {step === 0 && (
                    <button onClick={handleRollHp} className="font-cinzel text-2xl bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-lg shadow-lg transition-transform hover:scale-105 mt-4">
                        Lemparkan Hit Dice ({classHitDice})!
                    </button>
                )}
                {step === 1 && (
                    <div className="flex justify-center my-8">
                        <Die sides={dieTypeNum} value={'?'} size="lg" isRolling={true} status={'neutral'} />
                    </div>
                )}
                {step === 2 && (
                     <div className="animate-fade-in-fast flex flex-col items-center mt-6">
                        <p>HP Bertambah ({classHitDice} + {conMod} CON):</p>
                        <h3 className="font-bold text-7xl mb-4 text-green-400">{hpRoll}</h3>
                        <p>Max HP Baru: {char.maxHp} &rarr; {newMaxHp}</p>
                        <button onClick={handleConfirm} className="font-cinzel text-xl bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg shadow-lg transition-transform hover:scale-105 mt-6">
                            Luar Biasa!
                        </button>
                    </div>
                )}
            </div>
        </ModalWrapper>
    );
};