import React, { useState, useMemo } from 'react';
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
    const [rollValues, setRollValues] = useState<number[]>([]);
    const [finalRoll, setFinalRoll] = useState<DiceRoll | null>(null);

    const { diceNotation, modifier, title, dc, modifierBreakdown, relevantAbility } = useMemo(() => {
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
                 const strMod = getAbilityModifier(character.abilityScores.strength);
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
            // Fallback DC if AI fails to provide one
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
        return { 
            diceNotation, 
            modifier: mod, 
            title, 
            dc: localDc, 
            modifierBreakdown: { ability: abilityMod, proficiency: profBonus },
            relevantAbility: relAbility
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
            setRollValues(Array(numDice).fill(0).map(() => Math.ceil(Math.random() * dieType)));
        }, 80);

        setTimeout(() => {
            clearInterval(rollInterval);
            const result = rollDice(diceNotation);
            const total = result.total + modifier;
            const success = dc ? total >= dc : true;
            const totalModifier = result.modifier + modifier;
            
            const finalRollResult: DiceRoll = {
                notation: diceNotation,
                rolls: result.rolls,
                modifier: totalModifier,
                total,
                success,
                type: request.type,
                details: request.skill || request.ability || '',
            };

            setRollValues(result.rolls);
            setFinalRoll(finalRollResult);
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
                
                <div className="flex justify-center flex-wrap items-center gap-4 my-8 min-h-[160px]">
                    {phase !== 'finished' && Array(numDice).fill(0).map((_, i) => (
                        // FIX: The `status` prop was causing a type error because `phase` can never be 'finished' in this block.
                        <Die key={i} sides={dieType as 20} value={phase !== 'waiting' ? rollValues[i] || '?' : '?'} size={numDice > 2 ? 'md' : 'lg'} isRolling={phase === 'rolling'} status={'neutral'} />
                    ))}
                     {phase === 'finished' && finalRoll && (
                        <div className="animate-fade-in-fast flex flex-col items-center">
                            <h3 className="font-bold text-7xl mb-4" style={{color: finalRoll.success ? '#48bb78' : '#f56565', textShadow: `0 0 15px ${finalRoll.success ? 'rgba(72,187,120,0.7)' : 'rgba(245,101,101,0.7)'}`}}>{finalRoll.total}</h3>
                            
                            {isAttackOrCheck ? (
                                <div className="text-gray-200 text-sm bg-gray-900/50 p-3 rounded-lg w-full max-w-xs space-y-1">
                                    <div className="flex justify-between">
                                        <span>Hasil Dadu (1d20):</span>
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