// src/components/LoginButton.tsx
import React from 'react';
import { GoogleAuthProvider, signInWithPopup, User } from 'firebase/auth';
import { auth } from '../firebase';

interface LoginButtonProps {
  user: User | null;
  onLogout: () => Promise<void>;
}

export const LoginButton: React.FC<LoginButtonProps> = ({ user, onLogout }) => {

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      console.log("Firebase Google sign-in successful.");
    } catch (error) {
      console.error("Firebase Google sign-in failed:", error);
      alert("Gagal login dengan Google. Coba lagi.");
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      {user ? (
        <div className="flex items-center gap-3 bg-gray-800 p-2 rounded-lg shadow-md">
          <img
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || user.email}&background=random`}
            alt={user.displayName || 'User'}
            className="w-8 h-8 rounded-full"
          />
          <span className="text-white text-sm hidden md:inline">{user.displayName || user.email}</span>
          <button
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-1 px-3 rounded"
          >
            Logout
          </button>
        </div>
      ) : (
        <button
          onClick={handleGoogleLogin}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded shadow-md flex items-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="M6.306 14.691c-1.285 3.016-2.029 6.31-2.029 9.809s.744 6.793 2.029 9.809l-5.657 5.657C.803 36.87 0 32.25 0 27.5s.803-9.37 2.649-12.466l5.657 5.657z"/><path fill="#4CAF50" d="M24 48c5.166 0 9.86-1.977 13.409-5.192l-5.657-5.657C30.07 39.678 27.223 41 24 41c-3.79 0-7.09-1.393-9.519-3.691l-5.657 5.657C12.016 45.922 17.556 48 24 48z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l5.657 5.657C40.06 36.31 44 31.026 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
          Login with Google
        </button>
      )}
    </div>
  );
};