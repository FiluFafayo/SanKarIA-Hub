// FASE 3: Memoized. Props di-slice.

import React from 'react';
// FASE 3: Impor tipe-tipe slice
import { 
    Character, Skill, MonsterInstance, 
    GameState 
} from '../../../types';
import { useCombatSystem } from '../../../hooks/useCombatSystem';
import { CombatTracker } from '../CombatTracker';
import { CharacterPanel } from '../CharacterPanel';

interface GameCharacterPanelProps {
    character: Character;
    // FASE 3: Props di-slice
    players: Character[];
    monsters: MonsterInstance[];
    initiativeOrder: string[];
    currentPlayerId: string | null;
    gameState: GameState;
    // Props lain
    combatSystem: ReturnType<typeof useCombatSystem>;
    onSkillSelect: (skill: Skill) => void;
    isMyTurn: boolean;
}

export const GameCharacterPanel: React.FC<GameCharacterPanelProps> = React.memo(({
    character,
    players,
    monsters,
    initiativeOrder,
    currentPlayerId,
    gameState,
    combatSystem,
    onSkillSelect,
    isMyTurn
}) => {
    // (Slice campaign dihapus, props sudah di-slice)

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
});