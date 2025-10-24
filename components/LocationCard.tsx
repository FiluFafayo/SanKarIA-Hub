import React from 'react';

interface LocationCardProps {
  name: string;
  description: string;
  imageUrl: string;
  onClick: () => void;
}

export const LocationCard: React.FC<LocationCardProps> = ({ name, description, imageUrl, onClick }) => {
  return (
    <div
      className="group relative rounded-xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-300 transform-gpu hover:-translate-y-2 border-2 border-transparent hover:border-accent-primary/50 h-80"
      onClick={onClick}
    >
      <img src={imageUrl} alt={name} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent"></div>
      <div className="relative p-6 flex flex-col justify-end h-full text-white">
        <h3 className="font-cinzel text-2xl font-bold">{name}</h3>
        <p className="text-sm text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300 h-0 group-hover:h-auto mt-1">{description}</p>
      </div>
    </div>
  );
};
