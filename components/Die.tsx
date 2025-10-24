import React from 'react';

interface DieProps {
  sides: 4 | 6 | 8 | 10 | 12 | 20;
  value: number | string;
  isRolling?: boolean;
  isLowest?: boolean;
  size?: 'sm' | 'md' | 'lg';
  status?: 'success' | 'failure' | 'neutral';
}

export const Die: React.FC<DieProps> = ({ sides, value, isRolling, isLowest, size = 'md', status = 'neutral' }) => {
    const sizeClasses = {
        sm: 'w-12 h-12 text-xl',
        md: 'w-16 h-16 text-2xl',
        lg: 'w-40 h-40 text-7xl',
    }[size];

    const baseClasses = `relative flex items-center justify-center font-bold font-mono transition-all duration-300 ${sizeClasses}`;
    const rollingClasses = isRolling ? 'animate-pulse' : '';
    const lowestClasses = isLowest ? 'opacity-40 grayscale-[50%]' : '';

    const statusStyles = {
        success: { color: '#48bb78', shadow: 'rgba(72, 187, 120, 0.9)' }, // green-400
        failure: { color: '#f56565', shadow: 'rgba(245, 101, 101, 0.9)' }, // red-400
        neutral: { color: '#f7fafc', shadow: 'rgba(255, 223, 186, 0.9)' }  // gray-100, amber shadow
    };
    const currentStatus = statusStyles[status];
    
    const valueElement = (
        <span 
            className="relative z-10 transition-colors duration-500" 
            style={{ 
                color: isLowest ? '#a0aec0' : currentStatus.color,
                textShadow: `0 0 8px ${isLowest ? 'rgba(255,100,100,0.6)' : currentStatus.shadow}` 
            }}
        >
            {value}
        </span>
    );
    
    const faceStyle: React.CSSProperties = {
        background: 'linear-gradient(145deg, #4a5568, #2d3748)', // gray-600 to gray-800
        border: '2px solid #718096', // gray-500
        color: '#f7fafc', // gray-100
        boxShadow: `
            inset 0 0 5px rgba(0,0,0,0.5), 
            0 0 10px rgba(0,0,0,0.5)
        `,
    };

    const lowestFaceStyle: React.CSSProperties = {
        ...faceStyle,
        background: 'linear-gradient(145deg, #2d3748, #1a202c)', // gray-800 to gray-900
        border: '2px solid #4a5568', // gray-600
        textDecoration: 'line-through',
    };

    const finalFaceStyle = isLowest ? lowestFaceStyle : faceStyle;

    const shapes = {
        4: { clipPath: 'polygon(50% 0%, 100% 87%, 0% 87%)' },
        6: { borderRadius: '15%' },
        8: { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' },
        10: { clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)' },
        12: { clipPath: 'polygon(50% 0%, 90% 25%, 100% 65%, 75% 100%, 25% 100%, 0% 65%, 10% 25%)' },
        20: { clipPath: 'polygon(50% 0%, 100% 30%, 100% 70%, 50% 100%, 0% 70%, 0% 30%)' }
    };

    const shapeStyle = shapes[sides];

    return (
        <div className={`${baseClasses} ${rollingClasses} ${lowestClasses}`}>
            <div className="absolute w-full h-full" style={{...finalFaceStyle, ...shapeStyle}}></div>
            {valueElement}
        </div>
    );
};
