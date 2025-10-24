import React from 'react';
import { dataService } from '../services/dataService';

export const LoginView: React.FC = () => {
    const handleLogin = async () => {
        await dataService.signInWithGoogle();
    };

    return (
        <div className="w-screen h-screen bg-bg-primary flex flex-col items-center justify-center text-text-primary p-4">
            <div
                className="absolute inset-0 bg-cover bg-center opacity-20"
                style={{ backgroundImage: 'url(https://picsum.photos/seed/login-bg/1920/1080)' }}
            />
            <div className="relative z-10 text-center bg-bg-secondary/50 backdrop-blur-sm p-8 md:p-12 rounded-xl shadow-2xl border border-border-primary">
                <h1 className="font-cinzel text-5xl md:text-7xl font-bold text-white text-shadow-lg tracking-widest" style={{textShadow: '0 0 15px rgba(255,223,186,0.8)'}}>
                    SanKarIA Hub
                </h1>
                <p className="text-amber-100 text-sm md:text-lg opacity-80 font-light tracking-wider mt-2 mb-8">Gerbang menuju Petualangan Tanpa Batas</p>
                <button
                    onClick={handleLogin}
                    className="bg-accent-primary hover:bg-accent-secondary text-bg-primary font-bold font-cinzel text-lg py-3 px-8 rounded-lg shadow-lg transition-transform transform hover:scale-105 flex items-center justify-center mx-auto"
                >
                    <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48">
                        <path fill="#4285F4" d="M24 9.5c3.23 0 6.13 1.11 8.4 3.29l6.31-6.31C34.91 2.89 29.83 1 24 1 14.7 1 6.94 6.63 3.86 14.59l7.75 6.01C13.22 14.47 18.27 9.5 24 9.5z"></path>
                        <path fill="#34A853" d="M46.14 24.73c0-1.63-.15-3.2-.42-4.73H24v9.09h12.43c-.54 2.92-2.17 5.4-4.68 7.09l7.75 6.01c4.54-4.18 7.09-10.36 7.09-17.46z"></path>
                        <path fill="#FBBC05" d="M11.61 20.6C11.23 19.44 11 18.22 11 17c0-1.22.23-2.44.61-3.6L3.86 7.41C2.17 10.79 1.25 14.75 1.25 19c0 4.25.92 8.21 2.61 11.59l7.75-6.01z" transform="translate(0 11)"></path>
                        <path fill="#EA4335" d="M24 47c5.83 0 10.91-1.89 14.59-5.14l-7.75-6.01c-1.93 1.3-4.4 2.09-7.14 2.09-5.73 0-10.78-4.97-12.39-11.58L3.86 32.59C6.94 40.37 14.7 46 24 46z" transform="translate(0 1)"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    Masuk dengan Google
                </button>
                <p className="text-xs text-text-secondary mt-8 max-w-sm mx-auto">Dengan masuk, progres petualangan dan karakter Anda akan disimpan dengan aman di akun Anda, dapat diakses dari perangkat mana pun.</p>
            </div>
        </div>
    );
};
