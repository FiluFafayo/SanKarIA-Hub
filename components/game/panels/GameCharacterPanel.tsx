// FASE 0: File BARU
// Komponen ini diekstrak dari GameScreen.tsx (sebelumnya RightPanel)

import React from 'react';
import { Character, Skill, CampaignState } from '../../../types';
import { useCombatSystem } from '../../../hooks/useCombatSystem';
import { CombatTracker } from '../CombatTracker';
import { CharacterPanel } from '../CharacterPanel';

interface GameCharacterPanelProps {
    character: Character;
    campaign: CampaignState;
    combatSystem: ReturnType<typeof useCombatSystem>;
    onSkillSelect: (skill: Skill) => void;
    isMyTurn: boolean;
}

export const GameCharacterPanel: React.FC<GameCharacterPanelProps> = ({
    character,
    campaign,
    combatSystem,
    onSkillSelect,
    isMyTurn
}) => {
    const { players, monsters, initiativeOrder, currentPlayerId, gameState } = campaign;

    return (
		<aside className="w-full h-full bg-gray-800 md:border-l-2 border-gray-700 p-4 overflow-y-auto flex flex-col gap-4">
			<CombatTracker
				players={players}
				monsters={monsters}
				initiativeOrder={initiativeOrder}
				currentPlayerId={currentPlayerId}
			/>
			<CharacterPanel
				character={character} 
				monsters={monsters}
				isMyTurn={isMyTurn}
				combatSystem={combatSystem}
				gameState={gameState}
				onSkillSelect={onSkillSelect}
                updateCharacter={() => {}} // Prop ini tidak lagi digunakan oleh CharPanel, tapi hook membutuhkannya
			/>
		</aside>
    );
};