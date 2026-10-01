import React, { useState } from 'react';
import { X, Plus, Trash2, Play, Music, Disc } from 'lucide-react';

export default function QueueDrawer({
  isOpen,
  onClose,
  currentTrack,
  queue,
  onAddMedia,
  onRemoveTrack,
  onPlayTrackNow,
}) {
  const [urlInput, setUrlInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!urlInput.trim()) return;

    setLoading(true);
    setError('');

    try {
      await onAddMedia(urlInput.trim());
      setUrlInput('');
    } catch (err) {
      setError(err.message || 'Failed to resolve media URL');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-[#181818]/95 backdrop-blur-2xl border-l border-white/10 z-50 flex flex-col shadow-2xl transition-transform duration-300">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Disc className="w-5 h-5 text-[#1DB954]" />
          <h2 className="text-lg font-bold text-white">Queue & Playlist</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-semibold">
            {queue.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Add Media Input */}
      <div className="p-4 border-b border-white/10">
        <form onSubmit={handleSubmit} className="space-y-2">
          <label className="block text-xs font-semibold text-neutral-300">
            Paste YouTube, Spotify, or Podcast Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://youtube.com/watch... or open.spotify.com/..."
              className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#1DB954]"
            />
            <button
              type="submit"
              disabled={loading || !urlInput.trim()}
              className="px-3 py-2 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] font-bold text-black text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add</span>
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div className="mt-2 text-xs text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
            {error}
          </div>
        )}
      </div>

      {/* Queue List Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Currently Playing Card */}
        {currentTrack && (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#1DB954] mb-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-ping" />
              Now Playing
            </div>
            <div className="p-3 rounded-xl bg-white/10 border border-white/10 flex items-center gap-3">
              <img
                src={currentTrack.cover}
                alt="Cover"
                className="w-12 h-12 rounded-lg object-cover shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{currentTrack.title}</div>
                <div className="text-[11px] text-neutral-400 truncate">{currentTrack.artist}</div>
                <div className="text-[9px] text-neutral-400 mt-1">
                  Added by: {currentTrack.addedBy}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Tracks */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mb-2">
            Next in Queue ({queue.length})
          </div>

          {queue.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.02]">
              <Music className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
              <p className="text-xs text-neutral-400">Queue is empty</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Paste any YouTube or Spotify link above to start listening together!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((track, index) => (
                <div
                  key={track.id}
                  className="group p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-xs font-bold text-neutral-400 w-4 text-center">
                      {index + 1}
                    </span>
                    <img
                      src={track.cover}
                      alt="Cover"
                      className="w-10 h-10 rounded-md object-cover shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate group-hover:text-[#1DB954] transition">
                        {track.title}
                      </div>
                      <div className="text-[10px] text-neutral-400 truncate">{track.artist}</div>
                      <div className="text-[9px] text-neutral-400">Added by {track.addedBy}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onPlayTrackNow(track)}
                      className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition cursor-pointer"
                      title="Play Now"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      onClick={() => onRemoveTrack(track.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/20 text-neutral-400 hover:text-red-400 transition cursor-pointer"
                      title="Remove from Queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
