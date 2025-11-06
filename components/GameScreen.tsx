import React, { useState, useEffect, useCallback, MouseEvent } from "react";
import { Campaign, Character, DiceRoll, RollRequest, Skill, CampaignState } from "../types"; // FASE 0: Impor CampaignState
import { useCampaign } from "../hooks/useCampaign";
import { useCombatSystem } from "../hooks/useCombatSystem";
import { useExplorationSystem } from "../hooks/useExplorationSystem";

// FASE 0: Impor Panel Modular BARU
import { MobileNavBar, MobileTab } from "./game/MobileNavBar";
import { GameChatPanel } from "./game/panels/GameChatPanel";
import { GameCharacterPanel } from "./game/panels/GameCharacterPanel";
import { GameInfoPanel } from "./game/panels/GameInfoPanel";
import { GameBattleMapPanel } from "./game/panels/GameBattleMapPanel";

// Import komponen UI (tidak berubah)
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

// FASE 0: CSS untuk layout grid baru
const gridLayoutStyle = `
    @media (min-width: 768px) { /* md */
        #gamescreen-layout {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr;
            grid-template-areas: 
                "chat character";
        }
        #gamescreen-layout > [data-area="info"] { display: none; }
        #gamescreen-layout > [data-area="nav"] { display: none; }
    }
    @media (min-width: 1024px) { /* lg */
        #gamescreen-layout {
            grid-template-columns: 320px 1fr 384px; /* 80rem (w-80) + 1fr + 96rem (w-96) */
            grid-template-areas: 
                "info chat character";
        }
        #gamescreen-layout > [data-area="info"] { display: flex; }
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
    // REFAKTOR G-4-R1: Ambil aksi updater state runtime dari appStore
    // (Poin 7) Ambil state & aksi Level Up
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

	// Ambil SSoT updater dari dataStore
	const { updateCharacter } = useDataStore((s) => s.actions);
	// F3.1: Ambil SSoT characters (untuk mendeteksi data basi)
	const ssotCharacters = useDataStore((s) => s.state.characters);
    const dataStore = useDataStore.getState(); // (Poin 7)

	// Inisialisasi useCampaign dengan state SSoT
	const { campaign, campaignActions } = useCampaign(initialCampaign, players);

	// F3.2: Sinkronisasi Stale State (SSoT -> Runtime)
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

    // (Poin 7) Deteksi Level Up
    const xpForNextLevel = xpToNextLevel(character.level);
    useEffect(() => {
        if (xpForNextLevel > 0 && character.xp >= xpForNextLevel) {
            const ssotCharacter = dataStore.state.characters.find(c => c.id === character.id);
            if (ssotCharacter && ssotCharacter.level === character.level) {
                 triggerLevelUp(character);
            }
        }
    }, [character.xp, character.level, xpForNextLevel, triggerLevelUp, character, dataStore.state.characters]);

	// REFAKTOR G-4-R1: Sync state internal useCampaign -> ke state runtime global (appStore)
	useEffect(() => {
		_setRuntimeCampaignState(campaign);
	}, [campaign, _setRuntimeCampaignState]);

	const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("chat");
	const [pendingSkill, setPendingSkill] = useState<Skill | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

	const isMyTurn = campaign.currentPlayerId === character.id;

    // (Logika useEffect untuk activeMobileTab tidak berubah)
	useEffect(() => {
		const isReadyForPlayerAction =
			campaign.gameState === "combat" &&
			isMyTurn &&
			campaign.thinkingState === "idle" &&
			!campaign.activeRollRequest;

		if (isReadyForPlayerAction) {
			setActiveMobileTab("character");
		} else {
            // FASE 0: Default ke 'chat' atau 'battle' tergantung state
			setActiveMobileTab(campaign.gameState === 'combat' ? 'battle' : 'chat');
		}
	}, [
		campaign.gameState,
		isMyTurn,
		campaign.thinkingState,
		campaign.activeRollRequest,
	]);

    // (Logika memoizedUpdateCharacter tidak berubah)
	const memoizedUpdateCharacter = useCallback(
		async (updatedChar: Character) => {
			await updateCharacter(updatedChar);
			campaignActions.updateCharacterInCampaign(updatedChar);
			_setRuntimeCharacterState(updatedChar);
		},
		[updateCharacter, campaignActions, _setRuntimeCharacterState]
	);

    // (Logika combatSystem dan explorationSystem tidak berubah)
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

    // (Logika isDisabled tidak berubah)
	const isCombat = campaign.gameState === "combat";
	const isMyCombatTurn = isCombat && isMyTurn && !!campaign.turnId;
	const isExploration = !isCombat && !campaign.turnId;
	const isDisabled =
		campaign.thinkingState !== "idle" ||
		!!campaign.activeRollRequest ||
		(!isMyCombatTurn && !isExploration);

    // (Logika handleActionSubmit, handleSkillSelect, handleRollComplete, handleObjectClick tidak berubah)
	const handleActionSubmit = (actionText: string) => {
		campaignActions.clearChoices();
		if (campaign.gameState === "exploration") {
			explorationSystem.handlePlayerAction(actionText, pendingSkill);
		}
		setPendingSkill(null);
		setContextMenu(null);
	};

	const handleSkillSelect = (skill: Skill) => {
		setPendingSkill(skill);
		setActiveMobileTab("chat");
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

	// FASE 0: HAPUS fungsi render lokal (BattleMapPanel, ChatPanel, RightPanel)
    // ... (Fungsi BattleMapPanel, ChatPanel, RightPanel dihapus) ...

	return (
		<div
			className="w-screen h-screen bg-gray-900 text-gray-200 flex flex-col font-sans"
			onClick={() => setContextMenu(null)}
		>
            <style>{gridLayoutStyle}</style> {/* FASE 0: Tambahkan CSS Grid */}
			<header className="flex-shrink-0 bg-gray-800 p-3 flex items-center justify-between border-b-2 border-gray-700 z-20">
				<h1 className="font-cinzel text-xl text-purple-300 truncate pr-4">
					{campaign.title}
				</h1>
				<button
					onClick={() => onExit(campaign)}
					className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded flex-shrink-0 transition-colors
                               disabled:bg-gray-600 disabled:cursor-not-allowed"
					disabled={
						campaign.thinkingState !== "idle" || !!campaign.activeRollRequest
					}
				>
					{campaign.thinkingState !== "idle" ? "Menunggu..." : "Keluar"}
				</button>
			</header>

            {/* FASE 0: Ganti seluruh layout bercabang dengan CSS Grid tunggal */}
			<div 
                id="gamescreen-layout"
                className="flex-grow overflow-hidden relative grid"
                style={{
                    gridTemplateRows: '1fr auto',
                    gridTemplateAreas: `
                        "chat"
                        "nav"
                    `
                }}
            >
                {/* Panel Info (Area: info) */}
                <div data-area="info" className="hidden lg:flex flex-col bg-gray-800 border-r-2 border-gray-700 overflow-hidden">
                    <GameInfoPanel
                        campaign={campaign}
                        players={campaign.players}
                    />
                </div>

                {/* Panel Utama (Chat/Battle) (Area: chat) */}
                <div 
                    data-area="chat" 
                    className="flex-grow overflow-hidden h-full"
                    style={{
                        display: activeMobileTab === 'chat' || activeMobileTab === 'battle' ? 'flex' : 'none'
                    }}
                >
                    <GameChatPanel
                        campaign={campaign}
                        players={campaign.players}
                        characterId={character.id}
                        onObjectClick={handleObjectClick}
                        shouldShowChoices={shouldShowChoices}
                        onChoiceSelect={handleActionSubmit}
                        isDisabled={isDisabled}
                        pendingSkill={pendingSkill}
                        onActionSubmit={handleActionSubmit}
                        campaignActions={campaignActions}
                        activeMobileTab={activeMobileTab}
                        setActiveMobileTab={setActiveMobileTab}
                    />
                </div>
                
                {/* Panel Karakter (Area: character) */}
                 <div 
                    data-area="character" 
                    className="flex-grow overflow-hidden h-full"
                    style={{
                        display: activeMobileTab === 'character' ? 'flex' : 'none'
                    }}
                 >
                    <GameCharacterPanel
                        character={character}
                        campaign={campaign}
                        combatSystem={combatSystem}
                        onSkillSelect={handleSkillSelect}
                        isMyTurn={isMyTurn}
                    />
                </div>
                
                {/* Panel Info (Mobile) */}
                <div 
                    data-area="info" 
                    className="flex-grow overflow-hidden h-full"
                    style={{
                        display: activeMobileTab === 'info' ? 'flex' : 'none'
                    }}
                >
                    <GameInfoPanel
                        campaign={campaign}
                        players={campaign.players}
                    />
                </div>

                {/* Mobile Nav Bar (Area: nav) */}
                <div data-area="nav" className="flex-shrink-0 md:hidden">
                    <MobileNavBar
                        activeTab={activeMobileTab}
                        setActiveTab={setActiveMobileTab}
                        gameState={campaign.gameState}
                    />
                </div>
			</div>
            {/* FASE 0: Akhir dari layout grid baru */}


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
// ... (kode LevelUpModal identik dari Search) ...
const LevelUpModal: React.FC<{
    char: Character;
    onComplete: () => void;
    onSave: (updatedChar: Character) => Promise<void>;
}> = ({ char, onComplete, onSave }) => {
    const [step, setStep] = useState(0); // 0 = intro, 1 = rolling, 2 = result
    const [hpRoll, setHpRoll] = useState(0);
    const [newMaxHp, setNewMaxHp] = useState(0);

    const conMod = getAbilityModifier(char.abilityScores.constitution);
    // Ambil Tipe Hit Dice (e.g., 'd10') dari registry
    const classHitDice = findClass(char.class)?.hitDice || 'd8'; 
    const dieTypeNum = parseInt(classHitDice.replace('d','')) as 20 | 12 | 10 | 8 | 6;

    const handleRollHp = () => {
        setStep(1); // Show rolling
        // (Hotfix G-Fix v3) Panggil util baru dengan object, bukan string
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
            // TODO (Poin 7 Gap): Tawarkan ability/spell baru.
            // Untuk sekarang, kita hanya implementasikan HP roll & Lvl.
            // Kita juga perlu update SSoT Hit Dice (tambah 1 max)
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
