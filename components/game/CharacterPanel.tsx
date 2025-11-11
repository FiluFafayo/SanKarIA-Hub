import React, { useState } from 'react';
import { Character, MonsterInstance, CharacterInventoryItem, SpellDefinition, Skill, SKILL_ABILITY_MAP, Ability } from '../../types';
import { useCombatSystem } from '../../hooks/useCombatSystem';
import { DeathSaveTracker } from './DeathSaveTracker';
import { getAbilityModifier, getProficiencyBonus, xpToNextLevel } from '../../utils';

// (Poin 7) XP Bar Component
const XPBar: React.FC<{ currentXp: number, level: number }> = ({ currentXp, level }) => {
    const xpForLastLevel = xpToNextLevel(level - 1);
    const xpForNextLevel = xpToNextLevel(level);
    
    if (xpForNextLevel === 0) return null; // Max level

    const xpInCurrentLevel = currentXp - xpForLastLevel;
    const xpNeededForLevel = xpForNextLevel - xpForLastLevel;
    const percentage = xpNeededForLevel > 0 ? (xpInCurrentLevel / xpNeededForLevel) * 100 : 0;

    return (
        <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                <span>XP: {currentXp} / {xpForNextLevel}</span>
                <span>Lvl {level}</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div 
                    className="bg-purple-500 h-full rounded-full transition-all duration-500 ease-out" 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        </div>
    );
};


interface CharacterPanelProps {
  character: Character;
  monsters: MonsterInstance[]; // REFAKTOR: MonsterInstance
  isMyTurn: boolean;
  combatSystem: ReturnType<typeof useCombatSystem>;
  // updateCharacter: (character: Character) => Promise<void>; // FASE 1: Prop ini dihapus total
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
    const [targetId, setTargetId] = useState<string | null>(null); // Ini akan menjadi monster.instanceId

    // REFAKTOR: Cari item dari inventory baru
    const equippedWeapon = character.inventory.find(i => i.item.type === 'weapon' && i.isEquipped) || character.inventory.find(i => i.item.type === 'weapon');

    const handleAttack = () => {
        // REFAKTOR: Kirim targetInstanceId dan CharacterInventoryItem
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
                {/* PATCH 3: Badge Inspiration dan info ringkas */}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full border ${character.inspiration ? 'border-amber-400 text-amber-300' : 'border-gray-600 text-gray-400'}`}>
                        {character.inspiration ? 'Inspirasi' : 'Tanpa Inspirasi'}
                    </span>
                    <span className="text-gray-300">
                        PP {character.passivePerception ?? (10 + getAbilityModifier(character.abilityScores[Ability.Wisdom]) + (character.proficientSkills.includes(Skill.Perception) ? getProficiencyBonus(character.level) : 0))}
                    </span>
                    <span className="text-gray-400">
                        Bahasa: {character.languages && character.languages.length > 0 ? character.languages.join(', ') : '—'}
                    </span>
                    <span className="text-gray-400">
                        {(() => {
                            const s = character.senses || {};
                            const parts: string[] = [];
                            if (s.darkvision) parts.push(`DV ${s.darkvision}ft`);
                            if (s.tremorsense) parts.push(`TS ${s.tremorsense}ft`);
                            if (s.truesight) parts.push(`TT ${s.truesight}ft`);
                            return parts.length > 0 ? parts.join(' • ') : 'Indra: —';
                        })()}
                    </span>
                </div>
                {character.currentHp <= 0 && <DeathSaveTracker successes={character.deathSaves.successes} failures={character.deathSaves.failures} />}
                {/* (Poin 7) Tampilkan XP Bar */}
                <XPBar currentXp={character.xp} level={character.level} />
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
                                    {/* REFAKTOR: Gunakan monster.instanceId dan monster.name */}
                                    {monsters.map(m => <option key={m.instanceId} value={m.instanceId}>{m.name} (HP: {m.currentHp})</option>)}
                                </select>
                                <button 
                                    onClick={handleAttack} 
                                    disabled={!isMyTurn || !targetId || !equippedWeapon || !!character.usedAction}
                                    className="w-full bg-red-600 hover:bg-red-500 text-white font-bold p-2 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
                                >
                                   {/* REFAKTOR: Akses nama dari item.item.name */}
                                   Serang dengan {equippedWeapon?.item.name || 'Senjata'} (Aksi)
                                </button>

                                {/* Aksi Umum 5e */}
                                <div className="grid grid-cols-2 gap-2 mt-2">
                                    <button
                                        onClick={combatSystem.handleDash}
                                        disabled={!isMyTurn || !!character.usedAction}
                                        className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold p-2 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        Dash (Aksi)
                                    </button>
                                    <button
                                        onClick={combatSystem.handleDisengage}
                                        disabled={!isMyTurn || !!character.usedAction}
                                        className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold p-2 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        Disengage (Aksi)
                                    </button>
                                    <button
                                        onClick={combatSystem.handleDodge}
                                        disabled={!isMyTurn || !!character.usedAction}
                                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold p-2 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        Dodge (Aksi)
                                    </button>
                                    <button
                                        onClick={combatSystem.handleHide}
                                        disabled={!isMyTurn || !!character.usedAction}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold p-2 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        Hide (Aksi)
                                    </button>
                                </div>

                                {/* FITUR KELAS: Fighter - Second Wind (Kesenjangan #4) */}
                                {character.class === 'Fighter' && (
                                    <button
                                        onClick={combatSystem.handleSecondWind}
                                        disabled={!isMyTurn || character.usedBonusAction || character.currentHp === character.maxHp}
                                        className="w-full bg-green-600 hover:bg-green-500 text-white font-bold p-2 rounded disabled:bg-gray-600 disabled:cursor-not-allowed"
                                    >
                                        Gunakan Second Wind (Bonus)
                                    </button>
                                )}
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
                        {/* REFAKTOR: Gunakan CharacterInventoryItem */}
                        {character.inventory.map((item) => (
                             <div key={item.instanceId} className="flex justify-between items-center bg-gray-800/50 p-2 rounded">
                                 <span>{item.item.name} (x{item.quantity})</span>
                                 {/* REFAKTOR: Cek tipe dari item.item.type */}
                                 {item.item.type === 'consumable' && (
                                     <button 
                                        onClick={() => combatSystem.handleItemUse(item)} 
                                        disabled={(gameState !== 'combat' && item.item.effect?.type === 'heal') || !isMyTurn} // (Logika disable disempurnakan)
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
                         {/* REFAKTOR: Gunakan CharacterSpellSlot */}
                         {character.spellSlots.map(slot => (
                            <p key={slot.level} className="text-xs text-gray-400">Slot Lvl {slot.level}: {slot.max - slot.spent}/{slot.max}</p>
                        ))}
                        {/* REFAKTOR: Gunakan SpellDefinition */}
                        {character.knownSpells.map((spell) => {
                             const relevantSlot = character.spellSlots.find(s => s.level === spell.level);
                             const hasSlots = spell.level === 0 || (relevantSlot ? relevantSlot.spent < relevantSlot.max : false);
                             
                             // Logika Disable BARU (Kesenjangan #7)
                             let isDisabled = !hasSlots || !isMyTurn; // Disable jika tidak ada slot atau bukan giliran
                             if (!isDisabled && gameState === 'combat') {
                                 if (spell.castingTime === 'bonus_action' && character.usedBonusAction) {
                                     isDisabled = true; // Disable jika bonus action sudah dipakai
                                 } else if (spell.castingTime === 'reaction') {
                                     isDisabled = true; // Reaksi tidak bisa di-cast dari panel
                                 }
                                 // Jika castingTime 'action', isDisabled tetap false (jika isMyTurn)
                             } else if (gameState !== 'combat') {
                                 // Izinkan spell utility non-kombat (jika bukan bonus/reaksi)
                                 isDisabled = spell.castingTime === 'bonus_action' || spell.castingTime === 'reaction';
                             }

                            return (
                                <div key={spell.id} className="flex justify-between items-center bg-gray-800/50 p-2 rounded">
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
                        {/* PATCH 3: Tampilkan Prepared Spells jika ada */}
                        {character.preparedSpells && character.preparedSpells.length > 0 && (
                            <div className="mt-2">
                                <p className="text-xs text-blue-200">Disiapkan:</p>
                                <ul className="text-xs list-disc list-inside">
                                    {character.preparedSpells.map((name) => (
                                        <li key={name}>{name}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
};