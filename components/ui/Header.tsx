import React from 'react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ title, subtitle, rightSlot }) => {
  return (
    <header className="w-full bg-bg-secondary border-b border-border-primary text-text-primary p-space-md flex items-center justify-between">
      <div>
        <h1 className="font-cinzel text-2xl">{title}</h1>
        {subtitle && <p className="text-text-secondary text-sm">{subtitle}</p>}
      </div>
      {rightSlot && (
        <div className="flex items-center gap-2">{rightSlot}</div>
      )}
    </header>
  );
};

export default Header;