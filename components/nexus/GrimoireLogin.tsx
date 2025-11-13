import React, { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { RuneButton } from '../grimoire/RuneButton';

export const GrimoireLogin: React.FC = () => {
  const { login } = useAppStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login(); 
    } catch (err) {
      console.error("Login failed:", err);
      setError("Gagal membuka gerbang.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden font-retro animate-fade-in">
      {/* Background Effect */}
      <div className="absolute inset-0 bg-gradient-to-t from-red-900/20 via-black to-black pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center gap-6 p-8 border-4 border-wood bg-black/80 max-w-md w-full shadow-pixel-glow">
        
        {/* Header */}
        <div className="text-center space-y-2">
            <h1 className="text-4xl text-gold font-pixel drop-shadow-md">SANKARIA</h1>
            <div className="h-1 w-32 bg-wood mx-auto"></div>
            <p className="text-parchment text-sm tracking-widest uppercase">Grimoire Engine v0.9</p>
        </div>

        {/* Visual Gate/Fire */}
        <div className="w-32 h-32 border-2 border-wood/50 bg-black flex items-center justify-center relative group cursor-not-allowed">
            <div className="text-6xl animate-pulse filter drop-shadow-[0_0_10px_orange]">🔥</div>
            <div className="absolute bottom-2 text-[10px] text-faded group-hover:text-red-400 transition-colors">GATE SEALED</div>
        </div>

        {/* Error Message */}
        {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 p-2 text-xs text-center w-full font-pixel">
                {error}
            </div>
        )}

        {/* Login Button */}
        <div className="w-full flex flex-col gap-3">
            <p className="text-center text-faded text-[10px] italic">
                "Identifikasi jiwamu untuk melintasi Nexus."
            </p>
            <RuneButton 
                label={isLoading ? "MEMBUKA SEGEL..." : "MASUK (GOOGLE)"} 
                variant="primary" 
                fullWidth 
                onClick={handleLogin}
                disabled={isLoading}
            />
        </div>
      </div>
    </div>
  );
};