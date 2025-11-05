import React, { useState, useEffect, useCallback, MouseEvent } from "react";
import { Campaign, Character, DiceRoll, RollRequest, Skill } from "../types";
import { useCampaign } from "../hooks/useCampaign";
import { useCombatSystem } from "../hooks/useCombatSystem";
import { useExplorationSystem } from "../hooks/useExplorationSystem";

// Import modular components
import { MobileNavBar, MobileTab } from "./game/MobileNavBar"; // BARU: Impor MobileTab
import { BattleMapRenderer } from "./game/BattleMapRenderer"; // BARU
import { ChoiceButtons } from "./game/ChoiceButtons";
import { CharacterPanel } from "./game/CharacterPanel";
import { CombatTracker } from "./game/CombatTracker";
import { InfoPanel } from "./game/InfoPanel";
import { ChatLog } from "./game/ChatLog";
import { ActionBar } from "./game/ActionBar";
import { RollModal } from "./game/RollModal";
// (Poin 7) Impor untuk Modal Level Up
import { ModalWrapper } from "./ModalWrapper";
import { Die } from "./Die";
import { xpToNextLevel, rollHitDice, getAbilityModifier } from "../utils";
import { findClass } from "../data/registry";

// REFAKTOR G-4: GameScreen sekarang mengambil SSoT updater dari store
import { useDataStore } from "../store/dataStore";

// REFAKTOR G-4-R1: GameScreen sekarang harus mempropagasi perubahan
// state runtime (campaign, character) kembali ke appStore.

import { useAppStore } from "../store/appStore"; // G-4-R1

interface GameScreenProps {
	initialCampaign: CampaignState; // G-4-R1: Tipe dikoreksi
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

export const GameScreen: React.FC<GameScreenProps> = ({
	initialCampaign,
	character,
	players,
	onExit,
	userId,
}) => {
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
	// Mendengarkan SSoT (dataStore) dan memaksa update ke state runtime (useCampaign)
	// Ini penting jika HP/Inventaris pemain lain berubah (misal: multiplayer)
	useEffect(() => {
		// Ambil ID pemain yang ada di state runtime (useCampaign)
		const runtimePlayerIds = new Set(campaign.players.map((p) => p.id));

		// Filter SSoT global hanya untuk karakter yang relevan dengan campaign ini
		const relevantSsotChars = ssotCharacters.filter((c) =>
			runtimePlayerIds.has(c.id)
		);

		relevantSsotChars.forEach((ssotChar) => {
			const runtimeChar = campaign.players.find((p) => p.id === ssotChar.id);

			// Jika SSoT (dataStore) berbeda dari runtime (useCampaign)
			// (Kita gunakan perbandingan JSON string untuk deteksi perubahan apa pun)
			if (runtimeChar && JSON.stringify(runtimeChar) !== JSON.stringify(ssotChar)) {
				// Update state runtime lokal (useCampaign)
				// Ini akan me-refresh UI (CombatTracker, InfoPanel)
				campaignActions.updateCharacterInCampaign(ssotChar);
			}
		});
		// Kita hanya peduli jika SSoT (dari luar) berubah.
	}, [ssotCharacters, campaignActions, campaign.players]);

    // (Poin 7) Deteksi Level Up
    const xpForNextLevel = xpToNextLevel(character.level);
    useEffect(() => {
        if (xpForNextLevel > 0 && character.xp >= xpForNextLevel) {
            // Cek SSoT (dataStore) untuk memastikan kita belum memproses level up ini
            // Ini mencegah modal muncul berulang kali jika SSoT belum disinkronkan
            const ssotCharacter = dataStore.state.characters.find(c => c.id === character.id);
            
            // Jika SSoT level-nya MASIH SAMA dengan level runtime kita (yang akan naik), picu modal.
            if (ssotCharacter && ssotCharacter.level === character.level) {
                 triggerLevelUp(character);
            }
        }
    }, [character.xp, character.level, xpForNextLevel, triggerLevelUp, character, dataStore.state.characters]);

	// REFAKTOR G-4-R1: Sync state internal useCampaign -> ke state runtime global (appStore)
	// Ini penting agar saat 'exitGame' dipanggil, state terbaru-lah yang disimpan.
	useEffect(() => {
		_setRuntimeCampaignState(campaign);
	}, [campaign, _setRuntimeCampaignState]);

	const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>("chat");
	const [pendingSkill, setPendingSkill] = useState<Skill | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

	const isMyTurn = campaign.currentPlayerId === character.id;

	useEffect(() => {
		const isReadyForPlayerAction =
			campaign.gameState === "combat" &&
			isMyTurn &&
			campaign.thinkingState === "idle" &&
			!campaign.activeRollRequest;

		if (isReadyForPlayerAction) {
			setActiveMobileTab("character");
		} else {
			setActiveMobileTab("chat");
		}
	}, [
		campaign.gameState,
		isMyTurn,
		campaign.thinkingState,
		campaign.activeRollRequest,
	]);

	const memoizedUpdateCharacter = useCallback(
		async (updatedChar: Character) => {
			// 1. Update SSoT DB (via store)
			await updateCharacter(updatedChar);
			// 2. Update state runtime campaign internal (useCampaign)
			campaignActions.updateCharacterInCampaign(updatedChar);
			// 3. Update state runtime global (appStore) G-4-R1
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

	// PERBAIKAN KRITIS: Logika `isDisabled` diubah total
	// GANTI DENGAN LOGIKA BARU:
	const isCombat = campaign.gameState === "combat";
	// Giliran kombat kita adalah saat: mode kombat, giliran kita, DAN ada turnId aktif
	const isMyCombatTurn = isCombat && isMyTurn && !!campaign.turnId;
	// Mode eksplorasi adalah saat: BUKAN kombat, DAN TIDAK ada turnId aktif (game sedang menunggu input)
	const isExploration = !isCombat && !campaign.turnId;

	// Tombol Aksi di-disable JIKA:
	// 1. AI sedang berpikir (selalu)
	// 2. Ada RollModal aktif (selalu)
	// 3. Kita lagi kombat, TAPI BUKAN giliran kita (isMyCombatTurn false)
	// 4. Kita lagi eksplorasi, TAPI AI sedang memproses aksi (isExploration false)
	// Jadi, kita aktif HANYA jika (AI tidak berpikir) DAN (tidak ada modal) DAN (ini giliran kombat kita ATAU ini mode eksplorasi)
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

	const handleSkillSelect = (skill: Skill) => {
		setPendingSkill(skill);
		setActiveMobileTab("chat");
	};

	const handleRollComplete = (roll: DiceRoll, request: RollRequest) => {
		const currentTurnId = campaign.turnId; // Ambil turnId yang sedang aktif
		if (!currentTurnId) {
			// Ini seharusnya tidak pernah terjadi jika modalnya muncul
			console.error("RollModal selesai tetapi tidak ada turnId aktif!");
			return;
		}

		if (campaign.gameState === "combat") {
			combatSystem.handleRollComplete(roll, request, currentTurnId); // Lewatkan ID-nya
		} else {
			explorationSystem.handleRollComplete(roll, request, currentTurnId); // Lewatkan ID-nya
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

	const hasChoices = campaign.choices && campaign.choices.length > 0;
	const shouldShowChoices =
		hasChoices &&
		(campaign.gameState === "exploration" ||
			(isMyTurn && character.currentHp > 0));

	// BARU: Panel untuk BattleMap
    const BattleMapPanel = () => (
        <main className="flex-grow flex flex-col h-full overflow-hidden">
            {campaign.battleState ? (
                <BattleMapRenderer 
                    battleState={campaign.battleState} 
                    campaignActions={campaignActions}
                    currentUserId={character.id}
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-black">
                    <p>Menunggu Battle State...</p>
                </div>
            )}
        </main>
    );

	const ChatPanel = () => (
		<main className="flex-grow flex flex-col h-full overflow-hidden">
            {/* BARU: Render Map jika kombat, Chat jika eksplorasi */}
            {campaign.gameState === 'combat' && campaign.battleState ? (
                <BattleMapRenderer 
                    battleState={campaign.battleState} 
                    campaignActions={campaignActions}
                    currentUserId={character.id}
                />
            ) : (
                <ChatLog
                    events={campaign.eventLog}
                    players={campaign.players}
                    characterId={character.id}
                    thinkingState={campaign.thinkingState}
                    onObjectClick={handleObjectClick}
                />
            )}
            {/* BARU: Jangan render input/pilihan jika sedang di peta tempur (desktop) */}
			{(campaign.gameState !== 'combat') && (
                <div className="flex-shrink-0">
                    {shouldShowChoices && (
                        <ChoiceButtons
                            choices={campaign.choices}
                            onChoiceSelect={handleActionSubmit}
                        />
                    )}
                    <ActionBar
                        disabled={isDisabled}
                        onActionSubmit={handleActionSubmit}
                        pendingSkill={pendingSkill}
                    />
                </div>
            )}
		</main>
	);
				events={campaign.eventLog}
				players={campaign.players}
				characterId={character.id}
				thinkingState={campaign.thinkingState}
				onObjectClick={handleObjectClick}
			/>
			<div className="flex-shrink-0">
				{shouldShowChoices && (
					<ChoiceButtons
						choices={campaign.choices}
						onChoiceSelect={handleActionSubmit}
					/>
				)}
				<ActionBar
					disabled={isDisabled}
					onActionSubmit={handleActionSubmit}
					pendingSkill={pendingSkill}
				/>
			</div>
		</main>
	);

	const RightPanel = () => (
		<aside className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-gray-800 md:border-l-2 border-gray-700 p-4 overflow-y-auto flex flex-col gap-4">
			<CombatTracker
				players={campaign.players} // G-4-R1: Gunakan players dari state campaign
				monsters={campaign.monsters}
				initiativeOrder={campaign.initiativeOrder}
				currentPlayerId={campaign.currentPlayerId}
			/>
			<CharacterPanel
				character={character} // 'character' di sini adalah SSoT yang di-pass, ini OK
				monsters={campaign.monsters}
				isMyTurn={isMyTurn}
				combatSystem={combatSystem}
				// updateCharacter prop dihapus
				gameState={campaign.gameState}
				onSkillSelect={handleSkillSelect}
			/>
		</aside>
	);

	return (
		<div
			className="w-screen h-screen bg-gray-900 text-gray-200 flex flex-col font-sans"
			onClick={() => setContextMenu(null)}
		>
			<header className="flex-shrink-0 bg-gray-800 p-3 flex items-center justify-between border-b-2 border-gray-700 z-20">
				<h1 className="font-cinzel text-xl text-purple-300 truncate pr-4">
					{campaign.title}
				</h1>
				<button
					onClick={() => onExit(campaign)}
					className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded flex-shrink-0 transition-colors
                               disabled:bg-gray-600 disabled:cursor-not-allowed"
					// F1.1: Mencegah race condition saat keluar
					disabled={
						campaign.thinkingState !== "idle" || !!campaign.activeRollRequest
					}
				>
					{campaign.thinkingState !== "idle" ? "Menunggu..." : "Keluar"}
				</button>
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

				{/* Mobile Layout (BARU) */}
				<div className="md:hidden w-full h-full pb-16">
					{activeMobileTab === "chat" && <ChatPanel />}
                    {activeMobileTab === "battle" && <BattleMapPanel />}
					{activeMobileTab === "character" && <RightPanel />}
					{/* REFAKTOR G-4-R1: InfoPanel harus menggunakan 'campaign' (state) bukan 'initialCampaign' */}
					{activeMobileTab === "info" && (
						<InfoPanel campaign={campaign} players={campaign.players} />
					)}
				</div>
			</div>

			<MobileNavBar
				activeTab={activeMobileTab}
				setActiveTab={setActiveMobileTab}
                gameState={campaign.gameState}
			/>

			{/* (Poin 7) Render Modal Level Up jika terpicu */}
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
						character={character} // Ini OK, 'character' adalah SSoT kita
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

// (Poin 7) Komponen Level Up Modal
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
