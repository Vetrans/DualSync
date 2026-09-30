import React from 'react';
import { Clock, LogIn } from 'lucide-react';

export default function InactivityModal({ isOpen, onReLogin }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-[#1e1e1e] border border-amber-500/30 rounded-2xl p-6 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-white mb-2">
          Session Expired
        </h3>
        <p className="text-sm text-neutral-300 leading-relaxed mb-6">
          You have been logged out after <strong>2 hours of inactivity</strong> to safeguard your account and room privacy.
        </p>

        <button
          onClick={onReLogin}
          className="w-full py-3 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] font-bold text-black text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#1DB954]/25"
        >
          <LogIn className="w-4 h-4" />
          <span>Log In Again</span>
        </button>
      </div>
    </div>
  );
}
