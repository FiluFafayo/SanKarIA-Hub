import React, { useState } from 'react';
import { Character, Monster, InventoryItem, Spell, Skill, SKILL_ABILITY_MAP } from '../../types';
import { useCombatSystem } from '../../hooks/useCombatSystem';
import { DeathSaveTracker } from './DeathSaveTracker';
import { getAbilityModifier, getProficiencyBonus } from '../../utils';

interface CharacterPanelProps {
  character: Character;
  monsters: Monster[];
  isMyTurn: boolean;
  combatSystem: ReturnType<typeof useCombatSystem>;
  updateCharacter: (character: Character) => Promise<void>;
  gameState: 'exploration' | 'combat';
  onSkillSelect: (skill: Skill) => void;
}

const TabButton: React.FC<{ label: string, isActive: boolean, onClick: () => void }> = ({ label, isActive, onClick }) => (
    <button onClick={onClick} className={`flex-1 py-2 text-sm font-cinzel transition-colors ${isActive ? 'bg-gray-700/50 text-white' : 'bg-gray-900/50 text-gray-400 hover:bg-gray-700/30'}`}>
        {label}
    </button>
);

export const CharacterPanel: React.FC<CharacterPanelProps> = ({ character, monsters, isMyTurn, combatSystem, gameState, onSkillSelect }) => {
    const [activeTab, setActiveTab] = useState<'actions' | 'skills' | 'inventory' | 'spells'>('actions');
    const [targetId, setTargetId] = useState<string | null>(null);

    const equippedWeapon = character.inventory.find(i => i.type === 'weapon' && i.isEquipped) || character.inventory.find(i => i.type === 'weapon');

    const handleAttack = () => {
        if (targetId && equippedWeapon) {
            combatSystem.handlePlayerAttack(targetId, equippedWeapon);
            setTargetId(null);
        }
    }

    const calculateSkillModifier = (skill: Skill) => {
        const ability = SKILL_ABILITY_MAP[skill];
        const abilityMod = getAbilityModifier(character.abilityScores[ability]);
        const profBonus = character.proficientSkills.includes(skill) ? getProficiencyBonus(character.level) : 0;
        return abilityMod + profBonus;
    };


    return (
        <div className="bg-gray-900/50 p-3 rounded-lg flex flex-col gap-4 flex-grow">
            {/* Character Info */}
            <div>
                <h3 className="font-bold text-purple-300 text-lg">{character.name}</h3>
                <div className="flex justify-between text-sm">
                    <span>HP: {character.currentHp} / {character.maxHp}</span>
                    <span>AC: {character.armorClass}</span>
                    <span>Speed: {character.speed}ft</span>
                </div>
                {character.currentHp <= 0 && <DeathSaveTracker successes={character.deathSaves.successes} failures={character.deathSaves.failures} />}
            </div>
            
            {/* Tabs */}
            <div className="flex bg-black/30 rounded-lg overflow-hidden">
                <TabButton label="Aksi" isActive={activeTab === 'actions'} onClick={() => setActiveTab('actions')} />
                <TabButton label="Keterampilan" isActive={activeTab === 'skills'} onClick={() => setActiveTab('skills')} />
                <TabButton label="Inventaris" isActive={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
                <TabButton label="Sihir" isActive={activeTab === 'spells'} onClick={() => setActiveTab('spells')} />
            </div>

            {/* Tab Content */}
            <div className="flex-grow overflow-y-auto pr-1">
                {activeTab === 'actions' && (
                    <div className="space-y-2">
                        {gameState === 'combat' ? (
                            <>
                                <h4 className="font-cinzel text-center">Aksi Tempur</h4>
                                <select 
                                    value={targetId || ''}
                                    onChange={(e) => setTargetId(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white"
                                    disabled={!isMyTurn || monsters.length === 0}
                                >
                                    <option value="">-- Pilih Target --</option>
                                    {monsters.map(m => <option key={m.id} value={m.id}>{m.name} (HP: {m.currentHp})</option>)}
                                </select>
                                <button 
                                    onClick={handleAttack} 
                                    disabled={!isMyTurn || !targetId || !equippedWeapon}
                                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold p-2 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
                                >
                                   Serang dengan {equippedWeapon?.name || 'Senjata'}
                                </button>
                            </>
                        ) : (
                            <div className="text-center text-gray-400 italic p-4 rounded-lg bg-gray-800/50">
                                <p>Gunakan tab 'Keterampilan' untuk berinteraksi dengan dunia.</p>
                                <p className="text-xs mt-1">Aksi tempur akan tersedia saat pertarungan dimulai.</p>
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'skills' && (
                    <div className="space-y-1 text-sm">
                        {Object.values(Skill).map((skill) => {
                            const modifier = calculateSkillModifier(skill);
                            return (
                                <button key={skill} onClick={() => onSkillSelect(skill)} disabled={gameState === 'combat' && !isMyTurn} className="w-full flex justify-between items-center bg-gray-800/50 p-2 rounded text-left hover:bg-gray-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span>{skill}</span>
                                    <span className="font-bold">{modifier >= 0 ? '+' : ''}{modifier}</span>
                                </button>
                            )
                        })}
                    </div>
                )}
                {activeTab === 'inventory' && (
                    <div className="space-y-1 text-sm">
                        {character.inventory.map((item, i) => (
                             <div key={i} className="flex justify-between items-center bg-gray-800/50 p-2 rounded">
                                 <span>{item.name} (x{item.quantity})</span>
                                 {item.type === 'consumable' && (
                                     <button 
                                        onClick={() => combatSystem.handleItemUse(item)} 
                                        disabled={gameState !== 'combat' || !isMyTurn}
                                        className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        Gunakan
                                    </button>
                                 )}
                            </div>
                        ))}
                    </div>
                )}
                 {activeTab === 'spells' && (
                    <div className="space-y-1 text-sm">
                         {character.spellSlots.map(slot => (
                            <p key={slot.level} className="text-xs text-gray-400">Slot Lvl {slot.level}: {slot.max - slot.used}/{slot.max}</p>
                        ))}
                        {character.knownSpells.map((spell, i) => {
                             const relevantSlot = character.spellSlots.find(s => s.level === spell.level);
                             // Cantrips (level 0) are always castable. Others need a slot.
                             const hasSlots = spell.level === 0 || (relevantSlot ? relevantSlot.used < relevantSlot.max : false);
                             const isDisabled = (gameState !== 'combat' || !isMyTurn) || !hasSlots;

                             return (
                                <div key={i} className="flex justify-between items-center bg-gray-800/50 p-2 rounded">
                                     <span>{spell.name} (Lvl {spell.level})</span>
                                     <button 
                                        onClick={() => combatSystem.handleSpellCast(spell)}
                                        disabled={isDisabled}
                                        className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        Lontar
                                     </button>
                                </div>
                             );
                        })}
                    </div>
                )}
            </div>
        </div>
    )
};