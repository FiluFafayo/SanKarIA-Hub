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
    
    // State baru untuk menangani 1 atau 2 dadu
    const [displayValues, setDisplayValues] = useState<(number | string)[]>(['?']);
    const [finalRolls, setFinalRolls] = useState<number[]>([]);
    const [discardedValue, setDiscardedValue] = useState<number | null>(null);
    
    const [finalResult, setFinalResult] = useState<DiceRoll | null>(null);

    // Ekstrak data (termasuk flag adv/disadv baru)
    const { 
        diceNotation, modifier, title, dc, modifierBreakdown, relevantAbility,
        isAdvantage, isDisadvantage
    } = useMemo(() => {
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
            if (request.item?.toHitBonus) {
                mod = request.item.toHitBonus;
            } else {
                 // Fallback jika item tidak ada
                 const strMod = getAbilityModifier(character.ability_scores.strength);
                 const prof = getProficiencyBonus(character.level);
                 mod = strMod + prof;
                 abilityMod = strMod;
                 profBonus = prof;
                 relAbility = Ability.Strength;
            }
        } else if (request.stage === 'damage') {
            title = "Lemparan Kerusakan";
            diceNotation = request.damageDice || '1d4';
            mod = 0;
        } else {
            title = `Lemparan ${request.type === 'skill' ? 'Keterampilan' : 'Penyelamatan'}`;
            if ((request.type === 'skill' || request.type === 'savingThrow') && (request.dc === undefined || request.dc === null)) {
                localDc = 12;
            }
            if (request.ability) {
                abilityMod = getAbilityModifier(character.ability_scores[request.ability]);
            }
            if ((request.type === 'skill' && request.skill && character.proficient_skills.includes(request.skill)) ||
                (request.type === 'savingThrow' && request.ability && character.proficient_saving_throws.includes(request.ability))) {
                profBonus = getProficiencyBonus(character.level);
            }
             mod = abilityMod + profBonus;
        }
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
        // Ini HANYA untuk lemparan non-d20 (seperti damage)
        // Lemparan d20 akan kita tangani secara khusus
        const match = diceNotation.match(/(\d+)d(\d+)/);
        if (request.type === 'attack' || request.type === 'skill' || request.type === 'savingThrow' || request.type === 'deathSave') {
            return { numDice: (isAdvantage || isDisadvantage) ? 2 : 1, dieType: 20 };
        }
        // Logika damage roll
        return {
            numDice: match ? parseInt(match[1], 10) : 1,
            dieType: match ? parseInt(match[2], 10) as 20|6|8|10|12 : 20
        };
    }, [diceNotation, request.type, isAdvantage, isDisadvantage]);

    // Set display dadu saat mode berubah
    useEffect(() => {
        setDisplayValues(Array(numDice).fill('?'));
    }, [numDice]);

    const handleRoll = () => {
        setPhase('rolling');
        const rollInterval = setInterval(() => {
            setDisplayValues(Array(numDice).fill(0).map(() => Math.ceil(Math.random() * dieType)));
        }, 80);

        setTimeout(() => {
            clearInterval(rollInterval);
            
            let finalRollResult: DiceRoll;
            
            // --- Logika Baru untuk (Dis)Advantage ---
            if (request.type === 'attack' || request.type === 'skill' || request.type === 'savingThrow' || request.type === 'deathSave') {
                const roll1 = rollDice('1d20').total;
                const roll2 = (isAdvantage || isDisadvantage) ? rollDice('1d20').total : roll1;
                
                const usedRoll = isAdvantage ? Math.max(roll1, roll2) : (isDisadvantage ? Math.min(roll1, roll2) : roll1);
                const discardedRoll = (isAdvantage || isDisadvantage) ? (usedRoll === roll1 ? roll2 : roll1) : null;
                
                const total = usedRoll + modifier;
                const success = dc ? total >= dc : true;

                finalRollResult = {
                    notation: `1d20${modifier >= 0 ? '+' : ''}${modifier}`,
                    rolls: [usedRoll], // Hanya simpan roll yang digunakan di hasil akhir
                    modifier: modifier,
                    total,
                    success,
                    type: request.type,
                    details: request.skill || request.ability || '',
                };
                
                // Simpan KEDUA lemparan untuk ditampilkan
                setFinalRolls(discardedRoll !== null ? [usedRoll, discardedRoll] : [usedRoll]);
                setDiscardedValue(discardedRoll);

            } else {
                // --- Logika Lama (untuk Damage roll, dll) ---
                const result = rollDice(diceNotation);
                const total = result.total + modifier;
                const success = dc ? total >= dc : true;
                
                finalRollResult = {
                    notation: diceNotation,
                    rolls: result.rolls,
                    modifier: modifier,
                    total,
                    success,
                    type: request.type,
                    details: request.skill || request.ability || '',
                };
                setFinalRolls(result.rolls);
                setDiscardedValue(null);
            }
            
            setFinalResult(finalRollResult);
            setPhase('finished');
            
            setTimeout(() => {
                onComplete(finalRollResult, request);
            }, 3500);

        }, 1800);
    };

    const isAttackOrCheck = request.type === 'skill' || request.type === 'savingThrow' || request.type === 'attack' || request.type === 'deathSave';

    return (
        <ModalWrapper onClose={() => {}} title={title}>
            <div className="bg-gray-800/80 backdrop-blur-sm border border-purple-500/30 rounded-xl p-8 shadow-2xl text-white w-full max-w-lg text-center">
                <h2 className="font-cinzel text-3xl text-purple-200">{title}</h2>
                <p className="text-lg my-2">{request.reason}</p>
                {dc && <p className="text-gray-400">Target Kesulitan (DC): {dc}</p>}
                
                {/* --- Tampilan (Dis)Advantage BARU --- */}
                {isAdvantage && !isDisadvantage && <p className="text-green-400 font-bold">Melempar dengan Keuntungan (Advantage)!</p>}
                {isDisadvantage && !isAdvantage && <p className="text-red-400 font-bold">Melempar dengan Kerugian (Disadvantage)!</p>}

                <div className="flex justify-center flex-wrap items-center gap-4 my-8 min-h-[160px]">
                    {/* Tampilkan dadu yang berputar */}
                    {phase === 'rolling' && displayValues.map((v, i) => (
                        <Die key={i} sides={dieType as 20} value={v} size={numDice > 2 ? 'md' : 'lg'} isRolling={true} status={'neutral'} />
                    ))}

                    {/* Tampilkan dadu hasil akhir */}
                    {phase === 'finished' && finalResult && (
                        <div className="animate-fade-in-fast flex flex-col items-center">
                            <h3 className="font-bold text-7xl mb-4" style={{color: finalResult.success ? '#48bb78' : '#f56565', textShadow: `0 0 15px ${finalResult.success ? 'rgba(72,187,120,0.7)' : 'rgba(245,101,101,0.7)'}`}}>{finalResult.total}</h3>
                            
                            {/* Tampilkan KEDUA dadu jika (dis)advantage */}
                            {isAttackOrCheck && (
                                <div className="flex justify-center gap-4 mb-4">
                                    {finalRolls.map((v, i) => (
                                        <Die 
                                            key={i} 
                                            sides={20} 
                                            value={v} 
                                            size="md" 
                                            isDiscarded={v === discardedValue}
                                            status={v === discardedValue ? 'neutral' : (finalResult.success ? 'success' : 'failure')}
                                        />
                                    ))}
                                </div>
                            )}

                            {isAttackOrCheck ? (
                                <div className="text-gray-200 text-sm bg-gray-900/50 p-3 rounded-lg w-full max-w-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span>Hasil Dadu (Digunakan):</span>
                                        <span className="font-mono font-bold">{finalResult.rolls[0]}</span>
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
                                        <span className="font-mono">{finalResult.total}</span>
                                    </div>
                                </div>
                            ) : (
                                // Tampilan untuk damage (bisa banyak dadu)
                                <div className="flex flex-col items-center">
                                    <div className="flex justify-center gap-2 flex-wrap max-w-xs">
                                        {finalRolls.map((v, i) => (
                                            <Die 
                                                key={i} 
                                                sides={dieType as 6} 
                                                value={v} 
                                                size="sm" 
                                                status={finalResult.success ? 'success' : 'failure'}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-gray-300 mt-2 text-sm">
                                        Kerusakan yang Diberikan: {finalResult.total}
                                    </p>
                                </div>
                            )}
                            
                             <p className="text-2xl font-bold mt-4" style={{color: finalResult.success ? '#48bb78' : '#f56565'}}>{finalResult.success ? 'BERHASIL!' : 'GAGAL!'}</p>
                        </div>
                    )}

                    {/* Tampilkan dadu '?' saat menunggu */}
                    {phase === 'waiting' && displayValues.map((v, i) => (
                        <Die key={i} sides={dieType as 20} value={v} size={numDice > 2 ? 'md' : 'lg'} isRolling={false} status={'neutral'} />
                    ))}
                </div>
                
                {phase === 'waiting' && <button onClick={handleRoll} className="font-cinzel text-2xl bg-purple-600 hover:bg-purple-500 px-8 py-4 rounded-lg shadow-lg transition-transform hover:scale-105">Lemparkan!</button>}
            </div>
        </ModalWrapper>
    );
};