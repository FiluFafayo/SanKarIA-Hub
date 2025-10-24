import React from 'react';

interface SelectionCardProps {
  title: string;
  description?: string;
  imageUrl: string;
  isSelected: boolean;
  onClick: () => void;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({ title, description, imageUrl, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`relative rounded-lg p-2 cursor-pointer transition-all duration-200 transform-gpu border-2 text-center ${
        isSelected ? 'border-accent-primary scale-105 shadow-lg bg-bg-secondary' : 'border-transparent hover:border-accent-secondary/50 hover:scale-102'
      }`}
    >
      <img src={imageUrl} alt={title} className="w-full h-32 object-cover rounded-md" />
      <div className={`absolute inset-2 top-2 bottom-auto h-32 bg-black/50 transition-opacity duration-200 rounded-md ${isSelected ? 'opacity-0' : 'group-hover:opacity-20'}`}></div>
      <p className="font-cinzel mt-2 text-sm font-bold">{title}</p>
      {description && <p className="text-xs text-text-secondary">{description}</p>}
    </div>
  );
};
