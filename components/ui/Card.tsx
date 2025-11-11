import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, children, className }) => {
  return (
    <div className={`bg-bg-secondary border border-border-primary rounded-token-lg shadow-elevation-2 p-space-md text-text-primary ${className ?? ''}`}>
      {(title || subtitle) && (
        <div className="mb-3">
          {title && <h3 className="font-cinzel text-xl">{title}</h3>}
          {subtitle && <p className="text-text-secondary text-sm">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;