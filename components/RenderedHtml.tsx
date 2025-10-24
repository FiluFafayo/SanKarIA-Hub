import React, { MouseEvent } from 'react';

interface RenderedHtmlProps {
    text: string;
    onObjectClick: (objectName: string, objectId: string, event: MouseEvent<HTMLButtonElement>) => void;
}

export const RenderedHtml: React.FC<RenderedHtmlProps> = ({ text, onObjectClick }) => {
    const objectRegex = /\[OBJECT:([^|]+)\|([^\]]+)\]/g;
    const parts = text.split(objectRegex);

    const handleClick = (e: MouseEvent<HTMLButtonElement>, name: string, id: string) => {
        e.stopPropagation(); // Prevent closing context menu if it's already open
        onObjectClick(name, id, e);
    }
    
    // The split results in an array where every 3 items are [text, objectName, objectId]
    const elements = [];
    for (let i = 0; i < parts.length; i++) {
        if (i % 3 === 0) {
            elements.push(<span key={`text-${i}`}>{parts[i]}</span>);
        } else if (i % 3 === 1) {
            const objectName = parts[i];
            const objectId = parts[i + 1];
            elements.push(
                <button 
                    key={`object-${objectId}-${i}`}
                    onClick={(e) => handleClick(e, objectName, objectId)}
                    className="text-purple-300 underline hover:text-purple-200 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 rounded"
                >
                    {objectName}
                </button>
            );
            i++; // Skip the next part (objectId)
        }
    }

    return <>{elements}</>;
};
