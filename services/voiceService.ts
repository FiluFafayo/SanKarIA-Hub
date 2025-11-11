// Stage 1: Voice Service (PTT async, STT fallback, TTS)
// Non-cloud preferred; for now we use browser SpeechRecognition if available,
// and SpeechSynthesis for TTS. The STT provider is pluggable for Vosk WASM later.

export type SttLanguage = 'id-ID' | 'en-US';

export interface VoiceTranscript {
  text: string;
  lang: SttLanguage;
  confidence?: number;
}

type SttStatus = 'idle' | 'recording' | 'transcribing' | 'error';

export interface VoiceServiceState {
  sttStatus: SttStatus;
  lastError?: string;
  currentLang: SttLanguage;
  isTtsEnabled: boolean;
}

export interface SttProvider {
  start(
    lang: SttLanguage,
    onResult: (partial: string) => void,
    onFinal: (text: string) => void,
    onError: (err: string) => void
  ): void;
  stop(): void;
}

// Browser SpeechRecognition provider (cloud-backed in many browsers). Used as fallback.
function createWebSpeechProvider(): SttProvider | null {
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  let rec: any = null;

  return {
    start(lang, onResult, onFinal, onError) {
      try {
        rec = new SR();
        rec.lang = lang;
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.onresult = (e: any) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const res = e.results[i];
            const text = res[0].transcript || '';
            if (!text) continue;
            if (res.isFinal) onFinal(text.trim());
            else onResult(text);
          }
        };
        rec.onerror = (e: any) => onError(e?.error || 'speech_error');
        rec.onend = () => {};
        rec.start();
      } catch (err: any) {
        onError(err?.message || 'failed_to_start_speech_recognition');
      }
    },
    stop() {
      try { rec && rec.stop && rec.stop(); } catch {}
    },
  };
}

// Offline Vosk WASM provider using MediaRecorder for PTT lifecycle.
// Expects a global `window.Vosk` with APIs to load model and create recognizer.
function createVoskWasmProvider(): SttProvider | null {
  const w: any = window as any;
  if (!w.Vosk) return null;
  let mediaStream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let currentLang: SttLanguage = 'id-ID';
  let recognizer: any = null;

  async function initRecognizer(lang: SttLanguage) {
    try {
      const sampleRate = 16000;
      const modelName = lang === 'id-ID' ? 'vosk-model-small-id' : 'vosk-model-small-en-us';
      if (!w.__voskModel || w.__voskModelName !== modelName) {
        w.__voskModel = await w.Vosk.createModel(`/vendor/vosk/${modelName}`);
        w.__voskModelName = modelName;
      }
      recognizer = new w.__voskModel.Recognizer({ sampleRate });
    } catch (e) {
      throw new Error('Gagal inisialisasi Vosk WASM/model');
    }
  }

  async function transcribeBlob(blob: Blob, onFinal: (text: string) => void, onError: (err: string) => void) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      const channel = decoded.getChannelData(0);
      const pcm16 = new Int16Array(channel.length);
      for (let i = 0; i < channel.length; i++) {
        const s = Math.max(-1, Math.min(1, channel[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      recognizer.acceptWaveform(pcm16);
      const result = recognizer.result();
      const text = result?.text || '';
      if (text && text.trim().length > 0) onFinal(text.trim());
      else onError('Tidak ada hasil transkripsi');
      audioCtx.close();
    } catch (err: any) {
      onError(err?.message || 'Gagal mentranskripsi audio');
    }
  }

  return {
    async start(lang, onResult, onFinal, onError) {
      try {
        currentLang = lang;
        await initRecognizer(lang);
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
        mediaRecorder = new MediaRecorder(mediaStream!, { mimeType: mime });
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunks, { type: mediaRecorder?.mimeType || 'audio/webm' });
          await transcribeBlob(blob, onFinal, onError);
          mediaStream?.getTracks().forEach((t) => t.stop());
          mediaStream = null;
          mediaRecorder = null;
          chunks = [];
        };
        mediaRecorder.start();
        onResult('');
      } catch (err: any) {
        onError(err?.message || 'Gagal memulai rekaman');
      }
    },
    stop() {
      try {
        mediaRecorder && mediaRecorder.state !== 'inactive' && mediaRecorder.stop();
      } catch {}
    },
  };
}

// Simple SpeechSynthesis TTS
export function speak(text: string, lang: SttLanguage = 'id-ID') {
  try {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 1.0; // comfortable pace
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
  } catch {}
}

// VoiceService: manages STT lifecycle
export class VoiceService {
  state: VoiceServiceState;
  private provider: SttProvider | null;
  private onPartial?: (text: string) => void;
  private onFinal?: (t: VoiceTranscript) => void;
  private onStatus?: (s: VoiceServiceState) => void;

  constructor(initialLang: SttLanguage = 'id-ID', ttsEnabled = true) {
    this.state = {
      sttStatus: 'idle',
      currentLang: initialLang,
      isTtsEnabled: ttsEnabled,
    };
    this.provider = createVoskWasmProvider() || createWebSpeechProvider();
  }

  setCallbacks({ onPartial, onFinal, onStatus }: { onPartial?: (text: string) => void; onFinal?: (t: VoiceTranscript) => void; onStatus?: (s: VoiceServiceState) => void; }) {
    this.onPartial = onPartial;
    this.onFinal = onFinal;
    this.onStatus = onStatus;
  }

  setLanguage(lang: SttLanguage) {
    this.state.currentLang = lang;
    this.emit();
  }

  enableTts(enabled: boolean) {
    this.state.isTtsEnabled = enabled;
    this.emit();
  }

  async startPtt() {
    if (!this.provider) {
      this.state = { ...this.state, sttStatus: 'error', lastError: 'STT tidak tersedia (butuh Vosk WASM atau Web Speech)' };
      this.emit();
      return;
    }
    this.state = { ...this.state, sttStatus: 'recording', lastError: undefined };
    this.emit();
    this.provider.start(this.state.currentLang,
      (partial) => this.onPartial && this.onPartial(partial),
      (text) => {
        this.state = { ...this.state, sttStatus: 'idle' };
        this.emit();
        this.onFinal && this.onFinal({ text, lang: this.state.currentLang });
      },
      (err) => {
        this.state = { ...this.state, sttStatus: 'error', lastError: err };
        this.emit();
      }
    );
  }

  stopPtt() {
    if (!this.provider) return;
    this.provider.stop();
    this.state = { ...this.state, sttStatus: 'idle' };
    this.emit();
  }

  private emit() {
    this.onStatus && this.onStatus({ ...this.state });
  }
}

// Lightweight hook wrapper for convenience
import { useEffect, useMemo, useState } from 'react';

export function useVoiceService(initialLang: SttLanguage = 'id-ID') {
  const service = useMemo(() => new VoiceService(initialLang, true), [initialLang]);
  const [status, setStatus] = useState<VoiceServiceState>(service.state);
  const [partial, setPartial] = useState<string>('');

  useEffect(() => {
    service.setCallbacks({
      onPartial: setPartial,
      onFinal: (t) => {
        setPartial('');
        // fire a custom event so parent can listen if needed
        window.dispatchEvent(new CustomEvent('voice:final', { detail: t }));
      },
      onStatus: (s) => setStatus(s),
    });
  }, [service]);

  return {
    service,
    status,
    partial,
    start: () => service.startPtt(),
    stop: () => service.stopPtt(),
    speak,
    setLanguage: (lang: SttLanguage) => service.setLanguage(lang),
    enableTts: (enabled: boolean) => service.enableTts(enabled),
  } as const;
}