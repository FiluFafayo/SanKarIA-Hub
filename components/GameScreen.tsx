// FASE 0: ROMBAK TOTAL.
// Menghapus arsitektur 3-kolom/tab-mobile/SidePanel yang dipaksakan.
// Mengganti dengan layout flex-col (Mobile-First Murni) yang ergonomis.
// ActionBar/Pilihan/Tab menempel di bawah.
// Panel Info/Karakter sekarang menjadi "halaman" tab, bukan overlay.
// Layout 3-kolom desktop (lg:) dicapai secara responsif.

import React, { useState, useEffect, useCallback, MouseEvent, useRef } from "react";
import {
	Campaign,
	Character,
	DiceRoll,
	RollRequest,
	Skill,
	CampaignState,
} from "../types";
import { useCampaign } from "../hooks/useCampaign";
import { useCombatSystem } from "../hooks/useCombatSystem";
import { useExplorationSystem } from "../hooks/useExplorationSystem";

// FASE 0: Impor komponen UI BARU (Header disederhanakan, Tab baru)
import { GameHeader } from "./game/GameHeader";
import { GameTabs, GameTab } from "./game/GameTabs";
// (SidePanel DIHAPUS)

// FASE 0: Impor KONTEN Panel Modular (tidak berubah)
import { GameChatPanel } from "./game/panels/GameChatPanel";
import { GameCharacterPanel } from "./game/panels/GameCharacterPanel";
import { GameInfoPanel } from "./game/panels/GameInfoPanel";

// Import komponen UI (tidak berubah)
import { ChoiceButtons } from "./game/ChoiceButtons";
import { ActionBar } from "./game/ActionBar";
import { RollModal } from "./game/RollModal";
import { ModalWrapper } from "./ModalWrapper";
import { Die } from "./Die";
import { xpToNextLevel, rollHitDice, getAbilityModifier } from "../utils";
import { findClass } from "../data/registry";

// Import store (tidak berubah)
import { useDataStore } from "../store/dataStore";
import { useAppStore } from "../store/appStore";
import { useGameStore } from "../store/gameStore";

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

// FASE 0: CSS Grid layout hack (gridLayoutStyle) DIHAPUS TOTAL.

export const GameScreen: React.FC<GameScreenProps> = ({
	initialCampaign,
	character,
	players,
	onExit,
	userId,
}) => {
	// (Logika hook (useAppStore, useDataStore, useCampaign) tidak berubah)
const { characterToLevel, triggerLevelUp, closeLevelUp } = useAppStore((s) => ({
    characterToLevel: s.levelUp.characterToLevel,
    triggerLevelUp: s.actions.triggerLevelUp,
    closeLevelUp: s.actions.closeLevelUp,
}));

// Ambil aksi runtime dari gameStore (bukan appStore)
const { _setRuntimeCampaignState, _setRuntimeCharacterState } = useGameStore((s) => s.actions);
	const { updateCharacter } = useDataStore((s) => s.actions);
	const ssotCharacters = useDataStore((s) => s.state.characters);
	const dataStore = useDataStore.getState();
	const { campaign, campaignActions } = useCampaign(initialCampaign, players);

	// FASE 0: Logika Cek Level Up (UI) dipindah ke sini dari hooks logika
	useEffect(() => {
		// Temukan state runtime terbaru dari karakter 'kita'
		const myCurrentRuntimeState = campaign.players.find(
			(p) => p.id === character.id
		);
		if (!myCurrentRuntimeState) return;

		// Cek apakah modal *sudah* terbuka untuk karakter ini
		if (characterToLevel && characterToLevel.id === myCurrentRuntimeState.id) {
			return;
		}

		// Cek apakah kita memenuhi syarat level up
		const xpForNextLevel = xpToNextLevel(myCurrentRuntimeState.level);
		if (xpForNextLevel > 0 && myCurrentRuntimeState.xp >= xpForNextLevel) {
			triggerLevelUp(myCurrentRuntimeState);
		}
	}, [
		campaign.players, // Dipantau setiap kali state pemain di reducer berubah
		character.id,
		characterToLevel,
		triggerLevelUp,
	]);

	// FASE 1: Hapus useEffect sinkronisasi SSoT (Tugas 1)
	// useEffect(() => { ... });

	// FASE 1: Hapus useEffect Level Up (Tugas 5)
	// const xpForNextLevel = xpToNextLevel(character.level);
	// useEffect(() => { ... });

	useEffect(() => {
		_setRuntimeCampaignState(campaign);
	}, [campaign, _setRuntimeCampaignState]);

	// FASE 0: State UI baru untuk tab ergonomis
	const [activeTab, setActiveTab] = useState<GameTab>("chat");

	const [pendingSkill, setPendingSkill] = useState<Skill | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const isMyTurn = campaign.currentPlayerId === character.id;

	const memoizedUpdateCharacter = useCallback(
		async (updatedChar: Character) => {
			// FASE 1 (Tugas 4): Handler ini HANYA update SSoT (dataStore)
			// dan state root GameScreen (gameStore).
			await updateCharacter(updatedChar);
			_setRuntimeCharacterState(updatedChar);
		},
		[updateCharacter, _setRuntimeCharacterState]
	);

	// FASE 1 (Tugas 4): Buat handler gabungan untuk di-pass ke hooks
	const handleRuntimeCharacterUpdate = (updatedChar: Character) => {
		// 1. Update state runtime (useCampaign)
		campaignActions.updateCharacterInCampaign(updatedChar);
		// 2. Update state SSoT (dataStore) + state root (gameStore)
		memoizedUpdateCharacter(updatedChar);
	};

	const combatSystem = useCombatSystem({
		campaign,
		character,
		players,
		campaignActions,
		onCharacterUpdate: handleRuntimeCharacterUpdate, // FASE 1 (Tugas 3)
	});

	const explorationSystem = useExplorationSystem({
		campaign,
		character,
		players,
		campaignActions,
		onCharacterUpdate: handleRuntimeCharacterUpdate, // FASE 2 FIX
	});

	// Inisialisasi otomatis opsi eksplorasi saat awal sesi
	const didInitChoicesRef = useRef(false);
	useEffect(() => {
		if (didInitChoicesRef.current) return;
		const hasOpeningNarration = campaign.eventLog.some(e => e.type === "dm_narration");
		const noTurnYet = campaign.turnId === null;
		const noChoices = !campaign.choices || campaign.choices.length === 0;

		if (campaign.gameState === "exploration" && hasOpeningNarration && noTurnYet && noChoices) {
			didInitChoicesRef.current = true;
			explorationSystem.handlePlayerAction("Lihat sekeliling lebih teliti.", null);
		}
	}, [campaign.gameState, campaign.eventLog, campaign.turnId, campaign.choices, explorationSystem]);

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
		setActiveTab("chat"); // FASE 0: Otomatis kembali ke chat setelah aksi
	};

	// FASE 0: handleSkillSelect sekarang mengganti tab
	const handleSkillSelect = (skill: Skill) => {
		setPendingSkill(skill);
		setActiveTab("chat"); // Kembali ke tab chat untuk mengetik
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

	// FASE 0: Helper untuk merender konten tab mobile
	const renderMobileTabContent = () => {
		switch (activeTab) {
			case "chat":
				return (
					<GameChatPanel
						// FASE 3: Kirim props yang di-slice
						eventLog={campaign.eventLog}
						thinkingState={campaign.thinkingState}
						gameState={campaign.gameState}
						battleState={campaign.battleState}
						// Props lain
						players={campaign.players}
						characterId={character.id}
						onObjectClick={handleObjectClick}
						campaignActions={campaignActions}
						onMoveUnit={combatSystem.handleMovementWithOA}
					/>
				);
			case "character":
				return (
					<GameCharacterPanel
						character={character}
						campaign={campaign}
						combatSystem={combatSystem}
						onSkillSelect={handleSkillSelect}
						isMyTurn={isMyTurn}
					/>
				);
			case "info":
				return (
					<GameInfoPanel
						// FASE 3: Kirim props yang di-slice
						campaignSlice={{
							title: campaign.title,
							description: campaign.description,
							joinCode: campaign.joinCode,
							mapImageUrl: campaign.mapImageUrl,
							explorationGrid: campaign.explorationGrid,
							fogOfWar: campaign.fogOfWar,
							playerGridPosition: campaign.playerGridPosition,
							currentTime: campaign.currentTime,
							currentWeather: campaign.currentWeather,
							quests: campaign.quests,
							npcs: campaign.npcs,
						}}
						players={campaign.players}
					/>
				);
			default:
				return null;
		}
	};

	return (
		// FASE 0: Layout flex-col murni (mobile-first)
		<div
			className="w-screen h-screen bg-gray-900 text-gray-200 flex flex-col font-sans"
			onClick={() => setContextMenu(null)}
		>
			{/* FASE 0: Header Baru (Sederhana) */}
			<GameHeader
				title={campaign.title}
				thinkingState={campaign.thinkingState}
				hasActiveRoll={!!campaign.activeRollRequest}
				onExit={() => onExit(campaign)}
				// (Tombol toggle panel dihapus)
			/>

			{/* FASE 0: Layout Grid Responsif (Desktop) / Flex (Mobile) */}
			<div className="flex-grow overflow-hidden flex lg:grid lg:grid-cols-[320px_1fr_384px]">
				{/* Kolom 1: Info (HANYA Desktop) */}
				<aside className="hidden lg:flex flex-col h-full bg-gray-800 border-r-2 border-gray-700 overflow-y-auto">
					<GameInfoPanel
						// FASE 3: Kirim props yang di-slice
						campaignSlice={{
							title: campaign.title,
							description: campaign.description,
							joinCode: campaign.joinCode,
							mapImageUrl: campaign.mapImageUrl,
							explorationGrid: campaign.explorationGrid,
							fogOfWar: campaign.fogOfWar,
							playerGridPosition: campaign.playerGridPosition,
							currentTime: campaign.currentTime,
							currentWeather: campaign.currentWeather,
							quests: campaign.quests,
							npcs: campaign.npcs,
						}}
						players={campaign.players}
					/>
				</aside>

				{/* Kolom 2: Main Content (Chat/Map) + Input */}
				<main className="flex-grow flex flex-col h-full overflow-hidden lg:border-r-2 lg:border-gray-700">
					{/* Area Konten Utama (Mobile: render tab, Desktop: render chat) */}
					<div className="flex-grow overflow-hidden lg:hidden">
						{renderMobileTabContent()}
					</div>
					<div className="flex-grow overflow-hidden hidden lg:flex">
						{/* Desktop selalu menampilkan chat/map */}
						<GameChatPanel
							// FASE 3: Kirim props yang di-slice
							eventLog={campaign.eventLog}
							thinkingState={campaign.thinkingState}
							gameState={campaign.gameState}
							battleState={campaign.battleState}
							// Props lain
							players={campaign.players}
							characterId={character.id}
							onObjectClick={handleObjectClick}
							campaignActions={campaignActions}
							onMoveUnit={combatSystem.handleMovementWithOA}
						/>
					</div>

					{/* Area Input (Selalu di atas tab mobile, atau di bawah chat desktop) */}
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
				</main>

				{/* Kolom 3: Karakter (HANYA Desktop) */}
				<aside className="hidden lg:flex flex-col h-full bg-gray-800 overflow-y-auto">
					<GameCharacterPanel
						character={character}
						// FASE 3: Kirim props yang di-slice
						players={campaign.players}
						monsters={campaign.monsters}
						initiativeOrder={campaign.initiativeOrder}
						currentPlayerId={campaign.currentPlayerId}
						gameState={campaign.gameState}
						// Props lain
						combatSystem={combatSystem}
						onSkillSelect={handleSkillSelect}
						isMyTurn={isMyTurn}
					/>
				</aside>
			</div>
			{/* FASE 0: Akhir layout flex/grid */}

			{/* FASE 0: Tab Ergonomis Baru (HANYA Mobile) */}
			<GameTabs activeTab={activeTab} onTabChange={setActiveTab} />

			{/* FASE 0: (SidePanel DIHAPUS) */}

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
	const classHitDice = findClass(char.class)?.hitDice || "d8";
	const dieTypeNum = parseInt(classHitDice.replace("d", "")) as
		| 20
		| 12
		| 10
		| 8
		| 6;

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
					spent: 0, // Reset spent HD
				},
			},
		};
		await onSave(updatedChar);
		onComplete();
	};

	return (
		<ModalWrapper onClose={() => {}} title="Naik Level!">
			<div className="bg-gray-800/80 backdrop-blur-sm border border-purple-500/30 rounded-xl p-8 shadow-2xl text-white w-full max-w-lg text-center">
				<h2 className="font-cinzel text-3xl text-purple-200">Selamat!</h2>
				<p className="text-lg my-2">
					{char.name} telah mencapai Level {char.level + 1}!
				</p>

				{step === 0 && (
					<button
						onClick={handleRollHp}
						className="font-cinzel text-2xl bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-lg shadow-lg transition-transform hover:scale-105 mt-4"
					>
						Lemparkan Hit Dice ({classHitDice})!
					</button>
				)}
				{step === 1 && (
					<div className="flex justify-center my-8">
						<Die
							sides={dieTypeNum}
							value={"?"}
							size="lg"
							isRolling={true}
							status={"neutral"}
						/>
					</div>
				)}
				{step === 2 && (
					<div className="animate-fade-in-fast flex flex-col items-center mt-6">
						<p>
							HP Bertambah ({classHitDice} + {conMod} CON):
						</p>
						<h3 className="font-bold text-7xl mb-4 text-green-400">{hpRoll}</h3>
						<p>
							Max HP Baru: {char.maxHp} &rarr; {newMaxHp}
						</p>
						<button
							onClick={handleConfirm}
							className="font-cinzel text-xl bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg shadow-lg transition-transform hover:scale-105 mt-6"
						>
							Luar Biasa!
						</button>
					</div>
				)}
			</div>
		</ModalWrapper>
	);
};
