import React from "react";
import { Ability } from "../../types";
import { Die } from "../Die";

export const AbilityRoller: React.FC<{
  ability: Ability;
  onRoll: (ability: Ability, score: number) => void;
  currentScore: number | null;
}> = ({ ability, onRoll, currentScore }) => {
  const roll4d6DropLowest = () => {
    const rolls = [
      Math.ceil(Math.random() * 6),
      Math.ceil(Math.random() * 6),
      Math.ceil(Math.random() * 6),
      Math.ceil(Math.random() * 6),
    ];
    rolls.sort((a, b) => a - b);
    return rolls[1] + rolls[2] + rolls[3];
  };

  const handleRoll = () => {
    const score = roll4d6DropLowest();
    onRoll(ability, score);
  };

  return (
    <div className="flex flex-col items-center animate-fade-in-fast">
      <h4 className="font-cinzel text-xl text-blue-200 mb-2">
        Lempar Dadu untuk {ability.toUpperCase()}
      </h4>
      <div className="flex gap-4 items-center">
        <Die sides={6} />
        <Die sides={6} />
        <Die sides={6} />
        <Die sides={6} />
      </div>
      <button
        onClick={handleRoll}
        className="mt-4 font-cinzel bg-blue-600 hover:bg-blue-500 px-4 py-1 rounded"
      >
        Lempar!
      </button>
      {currentScore !== null && (
        <p className="mt-2 text-amber-300">Skor saat ini: {currentScore}</p>
      )}
    </div>
  );
};