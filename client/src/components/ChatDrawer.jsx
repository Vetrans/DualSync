import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageSquare,
  Radio,
  Reply,
  Smile,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Music,
  Check,
  Download,
  CornerDownRight,
  Maximize2,
} from 'lucide-react';
import { playMentionSound, showMentionNotification } from '../utils/soundEffects';

const QUICK_EMOJIS = ['❤️', '🔥', '😂', '👏', '🎵', '🚀', '👍', '✨'];

export default function ChatDrawer({
  isOpen,
  onClose,
  messages = [],
  onSendMessage,
  onSendReaction,
  currentUser,
  activeUsers = [],
  token,
  roomId,
}) {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activePickerMsgId, setActivePickerMsgId] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null); // string or null
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [previewImage, setPreviewImage] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastSoundPlayedMsgId = useRef(null);

  const scrollToBottom = (behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom('auto');
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      scrollToBottom('smooth');

      // Check if latest message mentions current user
      const latestMsg = messages[messages.length - 1];
      if (
        latestMsg &&
        latestMsg.id !== lastSoundPlayedMsgId.current &&
        latestMsg.sender.toLowerCase() !== currentUser?.displayName?.toLowerCase() &&
        latestMsg.sender.toLowerCase() !== currentUser?.username?.toLowerCase()
      ) {
        const myName = (currentUser?.displayName || currentUser?.username || '').toLowerCase();
        const mentionsMe =
          latestMsg.text?.toLowerCase().includes(`@${myName}`) ||
          latestMsg.mentions?.some((m) => m.toLowerCase() === myName);

        if (mentionsMe) {
          lastSoundPlayedMsgId.current = latestMsg.id;
          playMentionSound();
          showMentionNotification(latestMsg.sender, latestMsg.text);
        }
      }
    }
  }, [messages, isOpen, currentUser]);

  if (!isOpen) return null;

  // Filter mentionable users from activeUsers list
  const getMentionSuggestions = () => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return activeUsers
      .filter((u) => {
        const name = (u.displayName || u.username || '').toLowerCase();
        return name.includes(q);
      })
      .slice(0, 5);
  };

  const mentionSuggestions = getMentionSuggestions();

  // Handle Input typing and mention detection
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtMatch = textBeforeCursor.match(/@([a-zA-Z0-9_\s]{0,15})$/);

    if (lastAtMatch) {
      setMentionQuery(lastAtMatch[1]);
      setSelectedMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  // Insert mention into input
  const insertMention = (user) => {
    const name = user.displayName || user.username;
    const cursorPos = inputRef.current?.selectionStart || inputText.length;
    const textBeforeCursor = inputText.slice(0, cursorPos);
    const textAfterCursor = inputText.slice(cursorPos);

    const newBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_\s]{0,15})$/, `@${name} `);
    setInputText(newBefore + textAfterCursor);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  // Keyboard navigation for mentions and send
  const handleKeyDown = (e) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionSuggestions[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Send message
  const handleSend = () => {
    if (!inputText.trim()) return;

    // Detect mentioned names in text
    const mentioned = [];
    const atMatches = inputText.matchAll(/@([a-zA-Z0-9_ -]+)/g);
    for (const match of atMatches) {
      mentioned.push(match[1].trim());
    }

    onSendMessage({
      text: inputText.trim(),
      replyTo: replyingTo,
      mentions: mentioned,
    });

    setInputText('');
    setReplyingTo(null);
    setMentionQuery(null);
  };

  // Handle File Upload via base64 API
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds the 5MB maximum limit');
      return;
    }

    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result.split(',')[1];
          const res = await fetch('/api/chat/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              filename: file.name,
              filetype: file.type,
              base64Data,
              roomId,
            }),
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to upload attachment');
          }

          // Send message with file attachment
          onSendMessage({
            text: inputText.trim() || `Sent an attachment: ${data.file.name}`,
            file: data.file,
            replyTo: replyingTo,
          });

          setInputText('');
          setReplyingTo(null);
        } catch (err) {
          alert(err.message || 'File upload failed');
        } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setUploading(false);
      alert('Could not read file');
    }
  };

  // Scroll to original message when clicking reply quote
  const handleScrollToMessage = (msgId) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-white/10');
      setTimeout(() => el.classList.remove('bg-white/10'), 1500);
    }
  };

  // Render message text with highlighted @mentions
  const renderMessageContent = (text, isMe) => {
    if (!text) return null;
    const parts = text.split(/(@[a-zA-Z0-9_ -]+)/g);

    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const mentionedName = part.substring(1).trim().toLowerCase();
        const myName = (currentUser?.displayName || currentUser?.username || '').toLowerCase();
        const isMentioningMe = mentionedName === myName;

        return (
          <span
            key={i}
            className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-bold text-[11px] mx-0.5 ${
              isMentioningMe
                ? 'bg-amber-400/25 text-amber-300 border border-amber-400/40 shadow-sm shadow-amber-400/20'
                : isMe
                ? 'bg-black/20 text-black font-extrabold'
                : 'bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/30'
            }`}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Drawer Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] md:w-[460px] bg-[#161616]/95 backdrop-blur-2xl border-l border-white/10 z-50 flex flex-col shadow-2xl transition-transform duration-300 safe-pb safe-pt">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                Room Chat
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  Live
                </span>
              </h2>
              <span className="text-[10px] text-neutral-400 block -mt-0.5">
                {activeUsers.length} online • Mentions & Reactions
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer active:scale-95"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3.5">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-[#1DB954]" />
              <p className="text-xs font-semibold text-neutral-400">No messages yet</p>
              <p className="text-[11px] text-neutral-500 mt-1 max-w-xs">
                Say hi, tag someone with @, share files, or react with emojis!
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe =
                msg.sender?.toLowerCase() === currentUser?.displayName?.toLowerCase() ||
                msg.sender?.toLowerCase() === currentUser?.username?.toLowerCase();
              const isSystem = msg.isSystem;

              if (isSystem) {
                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-center text-xs text-neutral-400 transition"
                  >
                    <div className="flex items-center justify-center gap-1 font-semibold text-neutral-300 mb-0.5">
                      <Radio className="w-3 h-3 text-[#1DB954]" />
                      <span>{msg.sender}</span>
                    </div>
                    <p>{msg.text}</p>
                    <span className="text-[9px] text-neutral-500 mt-1 block">{msg.timestamp}</span>
                  </div>
                );
              }

              // Check if message mentions current user
              const myName = (currentUser?.displayName || currentUser?.username || '').toLowerCase();
              const isMentioningMe =
                msg.text?.toLowerCase().includes(`@${myName}`) ||
                msg.mentions?.some((m) => m.toLowerCase() === myName);

              return (
                <div
                  key={msg.id}
                  id={`msg-${msg.id}`}
                  className={`group relative flex gap-2.5 transition rounded-xl p-1.5 ${
                    isMentioningMe ? 'bg-amber-500/10 border border-amber-500/20' : 'hover:bg-white/[0.02]'
                  } ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Sender Avatar */}
                  <img
                    src={msg.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                    alt={msg.sender}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0 border border-white/10 mt-1 shadow"
                  />

                  {/* Message Bubble + Meta */}
                  <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Header info */}
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-bold text-neutral-300">
                        {isMe ? 'You' : msg.sender}
                      </span>
                      <span className="text-[9px] text-neutral-500">{msg.timestamp}</span>
                      {isMentioningMe && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                          @mention
                        </span>
                      )}
                    </div>

                    {/* Quoted Reply Preview */}
                    {msg.replyTo && (
                      <div
                        onClick={() => handleScrollToMessage(msg.replyTo.id)}
                        className={`cursor-pointer mb-1 px-2.5 py-1 rounded-lg text-[10px] border flex items-center gap-1 max-w-full truncate ${
                          isMe
                            ? 'bg-black/30 border-white/10 text-neutral-300'
                            : 'bg-white/5 border-white/10 text-neutral-400'
                        } hover:border-[#1DB954]/50 transition`}
                        title="Click to jump to original message"
                      >
                        <CornerDownRight className="w-3 h-3 text-[#1DB954] shrink-0" />
                        <span className="font-semibold text-neutral-300 shrink-0">
                          @{msg.replyTo.sender}:
                        </span>
                        <span className="truncate italic">{msg.replyTo.text}</span>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`p-2.5 sm:p-3 rounded-2xl text-xs leading-relaxed break-words shadow-sm relative ${
                        isMe
                          ? 'bg-[#1DB954] text-black font-medium rounded-tr-xs shadow-[#1DB954]/10'
                          : 'bg-[#222222] text-white rounded-tl-xs border border-white/10'
                      }`}
                    >
                      {/* Attached File Preview */}
                      {msg.file && (
                        <div className="mb-2">
                          {msg.file.type?.startsWith('image/') ? (
                            <div className="relative group/img rounded-xl overflow-hidden max-w-xs border border-white/15">
                              <img
                                src={msg.file.url}
                                alt={msg.file.name}
                                className="w-full max-h-56 object-cover cursor-pointer hover:scale-105 transition duration-300"
                                onClick={() => setPreviewImage(msg.file.url)}
                              />
                              <div
                                onClick={() => setPreviewImage(msg.file.url)}
                                className="absolute top-2 right-2 p-1 rounded-md bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition cursor-pointer"
                              >
                                <Maximize2 className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          ) : msg.file.type?.startsWith('audio/') ? (
                            <div className="p-2 rounded-xl bg-black/40 border border-white/10 flex flex-col gap-1.5">
                              <div className="flex items-center gap-2 text-xs font-semibold text-white truncate">
                                <Music className="w-4 h-4 text-[#1DB954] shrink-0" />
                                <span className="truncate">{msg.file.name}</span>
                              </div>
                              <audio src={msg.file.url} controls className="w-full h-8" />
                            </div>
                          ) : (
                            <a
                              href={msg.file.url}
                              download={msg.file.name}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 text-xs font-semibold text-white hover:border-[#1DB954] transition"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                                <span className="truncate">{msg.file.name}</span>
                              </div>
                              <Download className="w-4 h-4 text-neutral-400 shrink-0" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Text with Mentions */}
                      <p className="whitespace-pre-wrap">{renderMessageContent(msg.text, isMe)}</p>
                    </div>

                    {/* Reactions Pill List */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(msg.reactions).map(([emoji, userList]) => {
                          const userReacted = userList.includes(currentUser?.displayName || currentUser?.username);
                          return (
                            <button
                              key={emoji}
                              onClick={() => onSendReaction?.(msg.id, emoji)}
                              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1 border transition cursor-pointer active:scale-95 ${
                                userReacted
                                  ? 'bg-[#1DB954]/20 border-[#1DB954] text-white shadow-sm'
                                  : 'bg-white/5 border-white/10 text-neutral-300 hover:bg-white/10'
                              }`}
                              title={userList.join(', ')}
                            >
                              <span>{emoji}</span>
                              <span className="text-[10px] text-neutral-400">{userList.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Floating Action Bar on Hover (Reply & Quick Reactions) */}
                  <div
                    className={`absolute -top-3.5 ${
                      isMe ? 'left-2' : 'right-2'
                    } flex items-center gap-0.5 p-1 rounded-xl bg-[#282828] border border-white/15 shadow-xl opacity-0 group-hover:opacity-100 transition duration-200 z-10`}
                  >
                    {/* Quick Reaction Emojis */}
                    {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => onSendReaction?.(msg.id, emoji)}
                        className="p-1 hover:bg-white/10 rounded-md text-xs transition cursor-pointer active:scale-125"
                      >
                        {emoji}
                      </button>
                    ))}

                    {/* Open Full Emoji Picker toggle */}
                    <button
                      type="button"
                      onClick={() =>
                        setActivePickerMsgId(activePickerMsgId === msg.id ? null : msg.id)
                      }
                      className="p-1 hover:bg-white/10 rounded-md text-neutral-400 hover:text-white transition cursor-pointer"
                      title="More reactions"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>

                    {/* Reply Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo({
                          id: msg.id,
                          sender: msg.sender,
                          text: msg.text,
                        });
                        inputRef.current?.focus();
                      }}
                      className="p-1 hover:bg-white/10 rounded-md text-neutral-400 hover:text-white transition cursor-pointer"
                      title="Reply"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>

                    {/* Extended Emoji Picker Popup */}
                    {activePickerMsgId === msg.id && (
                      <div className="absolute top-8 right-0 p-2 rounded-xl bg-[#1e1e1e] border border-white/20 shadow-2xl grid grid-cols-4 gap-1 z-30 animate-fade-in">
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              onSendReaction?.(msg.id, emoji);
                              setActivePickerMsgId(null);
                            }}
                            className="p-1.5 hover:bg-white/15 rounded-lg text-sm transition cursor-pointer active:scale-125"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Replying Banner */}
        {replyingTo && (
          <div className="px-4 py-2 bg-[#222222] border-t border-white/10 flex items-center justify-between text-xs animate-fade-in">
            <div className="flex items-center gap-2 truncate">
              <CornerDownRight className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />
              <span className="text-neutral-400">Replying to</span>
              <span className="font-bold text-white">@{replyingTo.sender}:</span>
              <span className="text-neutral-400 italic truncate max-w-[200px]">
                {replyingTo.text}
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Autocomplete Mention Suggestions Dropdown */}
        {mentionQuery !== null && mentionSuggestions.length > 0 && (
          <div className="mx-4 mb-2 p-1.5 rounded-xl bg-[#222222] border border-white/15 shadow-2xl space-y-1 animate-fade-in">
            <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
              Members to Mention
            </div>
            {mentionSuggestions.map((user, idx) => (
              <div
                key={user.username || idx}
                onClick={() => insertMention(user)}
                className={`p-2 rounded-lg flex items-center gap-2 cursor-pointer transition ${
                  idx === selectedMentionIndex ? 'bg-[#1DB954]/20 border border-[#1DB954]/30' : 'hover:bg-white/5'
                }`}
              >
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'}
                  alt={user.displayName || user.username}
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-xs font-semibold text-white">
                  {user.displayName || user.username}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Input & Action Bar */}
        <div className="p-3 sm:p-4 border-t border-white/10 bg-black/50">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            {/* Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,audio/*,.pdf,.txt"
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer disabled:opacity-50"
              title="Attach image or file (max 5MB)"
            >
              {uploading ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>

            {/* Input Field */}
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type message... (use @ to mention)"
              className="flex-1 px-3.5 py-2.5 bg-[#202020] border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954] transition"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#1DB954]/20"
              title="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Fullscreen Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-md z-60 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Fullscreen preview"
              className="w-full h-full object-contain rounded-2xl shadow-2xl border border-white/20"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/60 text-white hover:bg-black transition cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
