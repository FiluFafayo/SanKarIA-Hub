// FASE 1: Direfaktor.
// Komponen ini tidak lagi menjadi <aside> (panel layout).
// Sekarang ini HANYA KONTEN yang akan dimasukkan ke dalam SidePanel.

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
        // FASE 1: Hapus <aside> wrapper.
        // Tambahkan padding (p-4) yang hilang dan flex-col
        <div className="p-4 overflow-y-auto flex flex-col gap-4">
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
                // updateCharacter={() => {}} // FASE 1: Prop ini dihapus total
			/>
		</div>
    );
};