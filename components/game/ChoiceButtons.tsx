import React from 'react';

interface ChoiceButtonsProps {
  choices: string[];
  onChoiceSelect: (choice: string) => void;
}

export const ChoiceButtons: React.FC<ChoiceButtonsProps> = ({ choices, onChoiceSelect }) => {
  if (!choices || choices.length === 0) {
    return null;
  }

  return (
    <div className="flex-shrink-0 p-2 md:p-4 bg-gray-800 border-t-2 border-gray-700">
      <div className="flex flex-col md:flex-row gap-2">
        {choices.map((choice, index) => (
          <button
            key={index}
            onClick={() => onChoiceSelect(choice)}
            className="flex-1 bg-purple-700 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg transition-colors text-sm"
          >
            {choice}
          </button>
        ))}
      </div>
    </div>
  );
};