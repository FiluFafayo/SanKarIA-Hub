import React from 'react';
import { ThinkingState } from '../../types';

interface TypingIndicatorProps {
    state: ThinkingState;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ state }) => {
    const renderContent = () => {
        if (state === 'retrying') {
            return (
                <p className="text-gray-300 text-sm italic">Masih berpikir...</p>
            );
        }
        // Default 'thinking' state
        return (
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse-fast"></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse-fast" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse-fast" style={{ animationDelay: '0.4s' }}></div>
                <style>{`
                    .animate-pulse-fast {
                        animation: pulse-fast 1.4s infinite ease-in-out both;
                    }
                    @keyframes pulse-fast {
                        0%, 80%, 100% {
                            transform: scale(0);
                        }
                        40% {
                            transform: scale(1.0);
                        }
                    }
                `}</style>
            </div>
        );
    };

    return (
        <div className="flex flex-col items-start">
            <div className="text-xs text-gray-400 px-2">Dungeon Master</div>
            <div className="p-3 rounded-lg bg-indigo-900/50">
                {renderContent()}
            </div>
        </div>
    );
};