import React, { useRef, useLayoutEffect, MouseEvent } from 'react';
import { GameEvent, Character, ThinkingState } from '../../types';
import { TypingIndicator } from './TypingIndicator';
import { RenderedHtml } from '../RenderedHtml';

interface ChatLogProps {
    events: GameEvent[];
    players: Character[];
    characterId: string;
    thinkingState: ThinkingState;
    onObjectClick: (objectName: string, objectId: string, event: MouseEvent<HTMLButtonElement>) => void;
}

export const ChatLog: React.FC<ChatLogProps> = ({ events, players, characterId, thinkingState, onObjectClick }) => {
    const endOfMessagesRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        endOfMessagesRef.current?.scrollIntoView({ behavior: 'auto' });
    }, [events, thinkingState]);

    return (
        <div className="flex-grow bg-black/30 p-4 overflow-y-auto flex flex-col gap-4">
            {events.map(event => {
                switch (event.type) {
                    case 'dm_narration':
                        return (
                            <div key={event.id} className="flex flex-col items-start">
                                <div className="text-xs text-gray-400 px-2">Dungeon Master</div>
                                <div className="max-w-xl p-3 rounded-lg bg-indigo-900/50">
                                    <p className="text-white whitespace-pre-wrap">
                                        <RenderedHtml text={event.text} onObjectClick={onObjectClick} />
                                    </p>
                                </div>
                            </div>
                        );
                    case 'dm_reaction':
                        return (
                             <div key={event.id} className="flex flex-col items-start">
                                <div className="text-xs text-gray-400 px-2">Dungeon Master</div>
                                <div className="max-w-xl p-3 rounded-lg bg-indigo-800/60">
                                    <p className="text-gray-200 whitespace-pre-wrap italic">
                                        <RenderedHtml text={event.text} onObjectClick={onObjectClick} />
                                    </p>
                                </div>
                            </div>
                        );
                    case 'player_action': {
                        const player = players.find(p => p.id === event.characterId);
                        const isMe = player?.id === characterId;
                        return (
                             <div key={event.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                <div className="text-xs text-gray-400 px-2">{player ? player.name : 'Pemain'}</div>
                                <div className={`max-w-xl p-3 rounded-lg ${isMe ? 'bg-green-900/50' : 'bg-gray-800/50'}`}>
                                    <p className="text-white whitespace-pre-wrap">{event.text}</p>
                                </div>
                            </div>
                        );
                    }
                    case 'system':
                    case 'roll_result':
                        return (
                             <div key={event.id} className="text-center text-sm text-gray-400 italic my-2">
                                --- {event.type === 'roll_result' 
                                    ? `${players.find(p => p.id === event.characterId)?.name || 'Seseorang'} melempar untuk ${event.reason}: ${event.roll.total} (${event.roll.success ? 'Berhasil' : 'Gagal'})` 
                                    : event.text} ---
                            </div>
                        );
                    default:
                        return null;
                }
            })}
            {thinkingState !== 'idle' && <TypingIndicator state={thinkingState} />}
            <div ref={endOfMessagesRef} />
        </div>
    );
};
