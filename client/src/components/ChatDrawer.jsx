import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare, Radio } from 'lucide-react';

export default function ChatDrawer({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  currentUser,
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[#181818]/95 backdrop-blur-2xl border-l border-white/10 z-50 flex flex-col shadow-2xl transition-transform duration-300">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold text-white">Room Chat</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
            Live
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender.toLowerCase() === currentUser?.username?.toLowerCase();
          const isSystem = msg.isSystem;

          if (isSystem) {
            return (
              <div
                key={msg.id}
                className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-neutral-400"
              >
                <div className="flex items-center justify-center gap-1 font-semibold text-neutral-300 mb-0.5">
                  <Radio className="w-3 h-3 text-[#1DB954]" />
                  <span>{msg.sender}</span>
                </div>
                <p>{msg.text}</p>
                <span className="text-[10px] text-neutral-400 mt-1 block">{msg.timestamp}</span>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[11px] font-bold text-neutral-300">
                    {isMe ? 'You' : msg.sender}
                  </span>
                  <span className="text-[10px] text-neutral-400">{msg.timestamp}</span>
                </div>
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed break-words ${
                    isMe
                      ? 'bg-[#1DB954] text-black font-semibold rounded-tr-sm shadow-md'
                      : 'bg-white/10 text-white rounded-tl-sm border border-white/5'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Field */}
      <div className="p-3 sm:p-4 border-t border-white/10 bg-black/40">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3.5 py-2.5 bg-[#242424] border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954]"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2.5 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold transition cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
