import React, { useRef, useState } from 'react';
import { GameEvent, Character, ThinkingState, Skill } from '../../types';
import { ChatLog } from './ChatLog';
import { VoicePTTButton } from './VoicePTTButton';
import { useGameStore } from '../../store/gameStore';

interface ChatSheetProps {
  events: GameEvent[];
  players: Character[];
  characterId: string;
  thinkingState: ThinkingState;
  onObjectClick: (objectName: string, objectId: string, event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled: boolean;
  onActionSubmit: (text: string) => void;
  pendingSkill: Skill | null;
}

export const ChatSheet: React.FC<ChatSheetProps> = ({
  events,
  players,
  characterId,
  thinkingState,
  onObjectClick,
  disabled,
  onActionSubmit,
  pendingSkill,
}) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const runtimeSettings = useGameStore((s) => s.runtime.runtimeSettings);

  const handleVoiceFinal = (t: string) => {
    if (!text.trim()) setText(t.trim());
    else setText(prev => `${prev} ${t.trim()}`);
    if (!disabled) inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled && text.trim()) {
      onActionSubmit(text.trim());
      setText('');
    }
  };

  return (
    <div className="space-y-3">
      <ChatLog
        events={events}
        players={players}
        characterId={characterId}
        thinkingState={thinkingState}
        onObjectClick={onObjectClick}
      />
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={disabled ? 'Menunggu giliran atau respons DM...' : 'Ketik aksi Anda...'}
          disabled={disabled}
          className="flex-grow bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
        />
        {runtimeSettings.voicePttEnabled && (
          <VoicePTTButton lang={runtimeSettings.sttLang} onFinal={handleVoiceFinal} />
        )}
        <button type="submit" disabled={disabled || !text.trim()} className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed">
          {pendingSkill ? 'Skill' : 'Kirim'}
        </button>
      </form>
    </div>
  );
};