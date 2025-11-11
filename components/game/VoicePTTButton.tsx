import React, { useEffect, useState } from 'react';
import { SttLanguage, useVoiceService } from '../../services/voiceService';
import { useGameStore } from '../../store/gameStore';

interface VoicePTTButtonProps {
  lang?: SttLanguage;
  onFinal?: (text: string) => void;
}

export const VoicePTTButton: React.FC<VoicePTTButtonProps> = ({ lang = 'id-ID', onFinal }) => {
  const { status, partial, start, stop, setLanguage } = useVoiceService(lang);
  const [pressed, setPressed] = useState(false);
  const voiceActions = useGameStore((s) => s.actions);

  useEffect(() => setLanguage(lang), [lang, setLanguage]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { text: string };
      if (detail?.text) {
        voiceActions.setVoiceFinal(detail.text);
        voiceActions.enqueueVoiceAction(detail.text);
        if (onFinal) onFinal(detail.text);
      }
      setPressed(false);
    };
    window.addEventListener('voice:final', handler);
    return () => window.removeEventListener('voice:final', handler);
  }, [onFinal]);

  useEffect(() => {
    // Sinkronisasikan status mic dan partial ke store
    voiceActions.setMicRecording(status.sttStatus === 'recording');
    voiceActions.setVoicePartial(partial || '');
    if (status.sttStatus === 'error') voiceActions.setVoiceError(status.lastError);
    else voiceActions.setVoiceError(undefined);
  }, [status.sttStatus, status.lastError, partial]);

  const isRecording = status.sttStatus === 'recording';
  const isError = status.sttStatus === 'error';

  const handlePress = () => {
    if (isRecording) {
      stop();
      setPressed(false);
    } else {
      voiceActions.setVoiceFinal(null);
      voiceActions.setVoicePartial('');
      voiceActions.setVoiceError(undefined);
      start();
      setPressed(true);
    }
  };

  const base = 'rounded-lg px-3 py-2 font-bold text-white';
  const active = 'bg-rose-700 hover:bg-rose-600';
  const idle = 'bg-indigo-700 hover:bg-indigo-600';
  const error = 'bg-red-700 hover:bg-red-600';

  return (
    <button
      type="button"
      onClick={handlePress}
      className={`${base} ${isError ? error : isRecording ? active : idle}`}
      title={isError ? (status.lastError || 'Kesalahan suara') : isRecording ? 'Berhenti' : 'Push-to-Talk'}
    >
      {isError ? 'Suara Error' : isRecording ? 'Rekam...' : 'PTT'}
      {partial && !isRecording && (
        <span className="ml-2 text-xs opacity-80">{partial.slice(0, 24)}...</span>
      )}
    </button>
  );
};