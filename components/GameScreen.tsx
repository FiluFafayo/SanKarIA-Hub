import React, { useState, useEffect, useCallback, MouseEvent } from "react";
import { Campaign, Character, DiceRoll, RollRequest, Skill } from "../types";
import { useCampaign } from "../hooks/useCampaign";
import { useCombatSystem } from "../hooks/useCombatSystem";
import { useExplorationSystem } from "../hooks/useExplorationSystem";

// Import modular components
import { MobileNavBar } from "./game/MobileNavBar";
import { ChoiceButtons } from "./game/ChoiceButtons";
import { CharacterPanel } from "./game/CharacterPanel";
import { CombatTracker } from "./game/CombatTracker";
import { InfoPanel } from "./game/InfoPanel";
import { ChatLog } from "./game/ChatLog";
import { ActionBar } from "./game/ActionBar";
import { RollModal } from "./game/RollModal";

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
	const { _setRuntimeCampaignState, _setRuntimeCharacterState } = useAppStore(
		(s) => s.actions
	);

	// Inisialisasi useCampaign dengan state SSoT
	const { campaign, campaignActions } = useCampaign(initialCampaign, players);

	// Ambil SSoT updater dari dataStore
	const { updateCharacter } = useDataStore((s) => s.actions);

	// REFAKTOR G-4-R1: Sync state internal useCampaign -> ke state runtime global (appStore)
	// Ini penting agar saat 'exitGame' dipanggil, state terbaru-lah yang disimpan.
	useEffect(() => {
		_setRuntimeCampaignState(campaign);
	}, [campaign, _setRuntimeCampaignState]);

	const [activeMobileTab, setActiveMobileTab] = useState<
		"chat" | "character" | "info"
	>("chat");
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

	const ChatPanel = () => (
		<main className="flex-grow flex flex-col h-full overflow-hidden">
			{/* REFAKTOR G-4-R1: Pastikan komponen ini mengambil 'players' dari state 'campaign' */}
			<ChatLog
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
					className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded flex-shrink-0"
				>
					Keluar
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

				{/* Mobile Layout (unchanged) */}
				<div className="md:hidden w-full h-full pb-16">
					{activeMobileTab === "chat" && <ChatPanel />}
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
			/>

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
