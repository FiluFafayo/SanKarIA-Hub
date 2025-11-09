import React, { useState, useMemo, useEffect } from 'react';
import { Character, DiceRoll, RollRequest, Ability } from '../../types';
import { ModalWrapper } from '../ModalWrapper';
import { Die } from '../Die';
import { getAbilityModifier, getProficiencyBonus, rollDice } from '../../utils';

interface RollModalProps {
    request: RollRequest;
    character: Character;
    onComplete: (roll: DiceRoll, request: RollRequest) => void;
}

export const RollModal: React.FC<RollModalProps> = ({ request, character, onComplete }) => {
    const [phase, setPhase] = useState<'waiting' | 'rolling' | 'finished'>('waiting');
    // State untuk menyimpan SEMUA lemparan dadu (untuk adv/disadv)
    const [allRolls, setAllRolls] = useState<number[][]>([]);
    const [finalRoll, setFinalRoll] = useState<DiceRoll | null>(null);

    // Ambil status adv/disadv dari request
const { diceNotation, modifier, title, dc, modifierBreakdown, relevantAbility, isAdvantage, isDisadvantage } = useMemo(() => {
    let diceNotation = '1d20';
    let mod = 0;
    let title = "Permintaan Lemparan";
    let localDc = request.dc;
    let abilityMod = 0;
    let profBonus = 0;
    let relAbility: Ability | undefined = request.ability;

    if (request.type === 'deathSave') {
        title = "Penyelamatan Kematian";
        diceNotation = '1d20';
        mod = 0;
        localDc = 10;
    } else if (request.stage === 'attack') {
        title = "Lemparan Serangan";
        localDc = request.target?.ac;

        // REFAKTOR FASE 3: Logika Finesse (DEX) vs STR
        const strMod = getAbilityModifier(character.abilityScores.strength);
        const dexMod = getAbilityModifier(character.abilityScores.dexterity);
        const prof = getProficiencyBonus(character.level);
        profBonus = prof;

        // Cek apakah item adalah 'finesse' (misal: Rapier, Dagger, Shortsword)
        // (Idealnya, 'isFinesse' ada di ItemDefinition, tapi ini perbaikan cepat)
        const itemName = request.item?.item.name.toLowerCase() || '';
        const isFinesseWeapon = itemName.includes('rapier') || itemName.includes('dagger') || itemName.includes('shortsword');

        if (isFinesseWeapon && dexMod > strMod) {
            // Gunakan DEX
            abilityMod = dexMod;
            relAbility = Ability.Dexterity;
        } else {
            // Gunakan STR (default)
            abilityMod = strMod;
            relAbility = Ability.Strength;
        }

        // Ambil bonus spesifik item JIKA ADA (misal: +1 Magic Weapon)
        const itemAttackBonus = request.item?.item.bonuses?.attack || 0;

        // Mod = (STR atau DEX) + Proficiency + Bonus Item
        mod = abilityMod + profBonus + itemAttackBonus;

    } else if (request.stage === 'damage') {
            title = "Lemparan Kerusakan";
            if (request.isCritical) {
                title += " — KRITIS";
            }
            diceNotation = request.damageDice || '1d4';
            mod = 0;
        } else {
            title = `Lemparan ${request.type === 'skill' ? 'Keterampilan' : 'Penyelamatan'}`;
            if ((request.type === 'skill' || request.type === 'savingThrow') && (request.dc === undefined || request.dc === null)) {
                console.warn(`DC tidak ada untuk '${request.reason}', menggunakan fallback 12.`);
                localDc = 12;
            }
            if (request.ability) {
                abilityMod = getAbilityModifier(character.abilityScores[request.ability]);
            }
            if ((request.type === 'skill' && request.skill && character.proficientSkills.includes(request.skill)) ||
                (request.type === 'savingThrow' && request.ability && character.proficientSavingThrows.includes(request.ability))) {
                profBonus = getProficiencyBonus(character.level);
            }
             mod = abilityMod + profBonus;
        }
        
        // Tentukan Judul berdasarkan Adv/Disadv
        if (isAdvantage) title += " (Advantage)";
        if (isDisadvantage) title += " (Disadvantage)";

        return { 
            diceNotation, 
            modifier: mod, 
            title, 
            dc: localDc, 
            modifierBreakdown: { ability: abilityMod, proficiency: profBonus },
            relevantAbility: relAbility,
            isAdvantage: request.isAdvantage,
            isDisadvantage: request.isDisadvantage
        };
    }, [request, character]);

    const { numDice, dieType } = useMemo(() => {
        const match = diceNotation.match(/(\d+)d(\d+)/);
        return {
            numDice: match ? parseInt(match[1], 10) : 1,
            dieType: match ? parseInt(match[2], 10) as 20|6|8|10|12 : 20
        };
    }, [diceNotation]);

    const handleRoll = () => {
        setPhase('rolling');
        const rollInterval = setInterval(() => {
            if (isAdvantage || isDisadvantage) {
                setAllRolls([
                    Array(numDice).fill(0).map(() => Math.ceil(Math.random() * dieType)),
                    Array(numDice).fill(0).map(() => Math.ceil(Math.random() * dieType))
                ]);
            } else {
                setAllRolls([Array(numDice).fill(0).map(() => Math.ceil(Math.random() * dieType))]);
            }
        }, 80);

        setTimeout(() => {
            clearInterval(rollInterval);
            
            const result1 = rollDice(diceNotation);
            let finalResult = result1;
            let rollsToShow = [result1.rolls];
            let winningRollIndex = 0; // 0 untuk result1, 1 untuk result2

            if (isAdvantage || isDisadvantage) {
                const result2 = rollDice(diceNotation);
                rollsToShow = [result1.rolls, result2.rolls];
                
                const total1 = result1.total;
                const total2 = result2.total;

                if (isAdvantage && total2 > total1) {
                    finalResult = result2;
                    winningRollIndex = 1;
                } else if (isAdvantage) {
                    finalResult = result1;
                    winningRollIndex = 0;
                } else if (isDisadvantage && total2 < total1) {
                    finalResult = result2;
                    winningRollIndex = 1;
                } else if (isDisadvantage) {
                    finalResult = result1;
                    winningRollIndex = 0;
                }
                
                // Set state untuk UI dadu mana yang "terbuang"
                // (Kita akan gunakan `winningRollIndex` di UI nanti)
            }

            const total = finalResult.total + modifier;
            const success = dc ? total >= dc : true;
            const totalModifier = finalResult.modifier + modifier;
            
            const finalRollResult: DiceRoll = {
                notation: diceNotation,
                rolls: finalResult.rolls, // Hanya roll yang menang
                modifier: totalModifier,
                total,
                success,
                type: request.type,
                details: request.skill || request.ability || '',
            };

            setAllRolls(rollsToShow); // Simpan kedua hasil roll untuk ditampilkan
            setFinalRoll(finalRollResult); // Simpan hasil akhir
            setPhase('finished');
            
            setTimeout(() => {
                onComplete(finalRollResult, request);
            }, 3500);

        }, 1800);
    };

    const isAttackOrCheck = request.type === 'skill' || request.type === 'savingThrow' || request.type === 'attack' || request.type === 'deathSave';

    // Helper untuk menentukan dadu mana yang kalah (untuk UI)
    const getWinnerLoserIndices = () => {
        if (!isAdvantage && !isDisadvantage) return { winner: 0, loser: -1 };
        if (allRolls.length < 2) return { winner: 0, loser: -1 };

        const total1 = allRolls[0].reduce((a, b) => a + b, 0);
        const total2 = allRolls[1].reduce((a, b) => a + b, 0);

        if (isAdvantage) {
            return total1 >= total2 ? { winner: 0, loser: 1 } : { winner: 1, loser: 0 };
        } else { // isDisadvantage
            return total1 <= total2 ? { winner: 0, loser: 1 } : { winner: 1, loser: 0 };
        }
    };

    return (
        <ModalWrapper onClose={() => {}} title={title}>
            <div className="bg-gray-800/80 backdrop-blur-sm border border-purple-500/30 rounded-xl p-8 shadow-2xl text-white w-full max-w-lg text-center">
                <h2 className="font-cinzel text-3xl text-purple-200">{title}</h2>
                <p className="text-lg my-2">{request.reason}</p>
                {dc && <p className="text-gray-400">Target Kesulitan (DC): {dc}</p>}
                
                <div className="flex justify-center flex-wrap items-center gap-4 my-8 min-h-[160px]">
                    {/* --- LOGIKA RENDER BARU --- */}
                    {phase !== 'finished' && allRolls.length === 0 && Array(numDice).fill(0).map((_, i) => (
                        <Die key={i} sides={dieType as 20} value={'?'} size="lg" isRolling={false} status={'neutral'} />
                    ))}
                    {phase !== 'finished' && allRolls.length > 0 && (
                         <div className="flex justify-center flex-wrap items-center gap-4">
                            {allRolls.map((rollSet, setIndex) => (
                                <div key={setIndex} className="flex gap-2">
                                    {rollSet.map((val, i) => (
                                        <Die key={i} sides={dieType as 20} value={val || '?'} size="lg" isRolling={phase === 'rolling'} status={'neutral'} />
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                    {/* --- LOGIKA RENDER HASIL (BARU) --- */}
                     {phase === 'finished' && finalRoll && (
                        <div className="animate-fade-in-fast flex flex-col items-center">
                            
                            {/* Tampilkan Kedua Dadu jika Adv/Disadv */}
                            {(isAdvantage || isDisadvantage) && allRolls.length > 1 && (
                                <div className="flex gap-4 mb-4">
                                    {(() => {
                                        const { winner, loser } = getWinnerLoserIndices();
                                        return (
                                            <>
                                                <Die sides={dieType as 20} value={allRolls[winner][0]} size="md" status={finalRoll.success ? 'success' : 'failure'} />
                                                <Die sides={dieType as 20} value={allRolls[loser][0]} size="md" isLowest={true} />
                                            </>
                                        )
                                    })()}
                                </div>
                            )}

                            <h3 className="font-bold text-7xl mb-4" style={{color: finalRoll.success ? '#48bb78' : '#f56565', textShadow: `0 0 15px ${finalRoll.success ? 'rgba(72,187,120,0.7)' : 'rgba(245,101,101,0.7)'}`}}>{finalRoll.total}</h3>
                            
                            {isAttackOrCheck ? (
                                <div className="text-gray-200 text-sm bg-gray-900/50 p-3 rounded-lg w-full max-w-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span>Hasil Dadu (d20):</span>
                                        <span className="font-mono font-bold">{finalRoll.rolls[0]}</span>
                                    </div>
                                    {request.type !== 'deathSave' && (
                                    <>
                                     <div className="flex justify-between">
                                        <span>
                                            Pengubah Kemampuan {relevantAbility && <span className="text-gray-400 capitalize">({relevantAbility.slice(0,3)})</span>}:
                                        </span>
                                        <span className="font-mono font-bold">{modifierBreakdown.ability >= 0 ? '+' : ''}{modifierBreakdown.ability}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Bonus Kecakapan:</span>
                                        <span className="font-mono font-bold">+{modifierBreakdown.proficiency}</span>
                                    </div>
                                    </>
                                    )}
                                    <hr className="border-gray-600 my-1" />
                                    <div className="flex justify-between font-bold text-base">
                                        <span>Total:</span>
                                        <span className="font-mono">{finalRoll.total}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-gray-300 mt-2 text-sm">
                                    <p>Kerusakan yang Diberikan: {finalRoll.total}</p>
                                </div>
                            )}
                            
                             <p className="text-2xl font-bold mt-4" style={{color: finalRoll.success ? '#48bb78' : '#f56565'}}>{finalRoll.success ? 'BERHASIL!' : 'GAGAL!'}</p>
                        </div>
                    )}
                </div>
                
                {phase === 'waiting' && <button onClick={handleRoll} className="font-cinzel text-2xl bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-lg shadow-lg transition-transform hover:scale-105">Lemparkan!</button>}
            </div>
        </ModalWrapper>
    );
};