import React, { useState, useEffect, useRef } from 'react';
import { Skill } from '../../types';

interface ActionBarProps {
    disabled: boolean;
    onActionSubmit: (text: string) => void;
    pendingSkill: Skill | null;
}

const SKILL_TO_VERB_MAP: Record<Skill, string> = {
    [Skill.Acrobatics]: 'berakrobatik',
    [Skill.AnimalHandling]: 'menangani hewan',
    [Skill.Arcana]: 'menggunakan Pengetahuan Arcana',
    [Skill.Athletics]: 'menggunakan kekuatan atletik',
    [Skill.Deception]: 'menipu',
    [Skill.History]: 'mengingat sejarah',
    [Skill.Insight]: 'menggunakan wawasan',
    [Skill.Intimidation]: 'mengintimidasi',
    [Skill.Investigation]: 'menginvestigasi',
    [Skill.Medicine]: 'mengobati',
    [Skill.Nature]: 'mengingat pengetahuan alam',
    [Skill.Perception]: 'mengamati dengan seksama',
    [Skill.Performance]: 'tampil',
    [Skill.Persuasion]: 'membujuk',
    [Skill.Religion]: 'mengingat pengetahuan agama',
    [Skill.SleightOfHand]: 'menggunakan kecepatan tangan',
    [Skill.Stealth]: 'mengendap-endap',
    [Skill.Survival]: 'bertahan hidup',
};


export const ActionBar: React.FC<ActionBarProps> = ({ disabled, onActionSubmit, pendingSkill }) => {
    const [text, setText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (pendingSkill) {
            const verb = SKILL_TO_VERB_MAP[pendingSkill] || `menggunakan ${pendingSkill}`;
            setText(`Aku mencoba ${verb} untuk `);
            inputRef.current?.focus();
        }
    }, [pendingSkill]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (text.trim() && !disabled) {
            onActionSubmit(text.trim());
            setText('');
        }
    };

    return (
        <div className="flex-shrink-0 p-2 md:p-4 bg-gray-800 border-t-2 border-gray-700">
            <form onSubmit={handleSubmit} className="flex gap-2 md:gap-4">
                <input
                    ref={inputRef}
                    type="text"
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={disabled ? "Menunggu giliran atau respons DM..." : "Apa yang Anda lakukan?"}
                    disabled={disabled}
                    className="flex-grow bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                />
                <button type="submit" disabled={disabled || !text.trim()} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
                    {pendingSkill ? 'Lakukan Skill Check' : 'Kirim'}
                </button>
            </form>
        </div>
    );
};