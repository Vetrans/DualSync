import React, { useEffect, useRef } from 'react';

// Tiny 1-second silent WAV audio data URI to keep the browser audio context and background tab alive
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export default function MediaEngine({
  currentTrack,
  isPlaying,
  currentTime,
  volume,
  onTimeUpdate,
  onDurationChange,
  onTrackEnded,
  onPlayPause,
  onSeek,
  onPrevTrack,
}) {
  const ytPlayerRef = useRef(null);
  const audioRef = useRef(null);
  const silentAudioRef = useRef(null);
  const isSyncingRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  const currentTrackRef = useRef(currentTrack);
  const currentTimeRef = useRef(currentTime);
  const ytContainerId = 'dualsync-yt-hidden-player';

  isPlayingRef.current = isPlaying;
  currentTrackRef.current = currentTrack;
  currentTimeRef.current = currentTime;

  // 1. YouTube Iframe Initialization
  useEffect(() => {
    let checkInterval = null;

    const initYouTube = () => {
      if (!window.YT || !window.YT.Player) {
        return false;
      }

      if (ytPlayerRef.current) {
        return true;
      }

      try {
        ytPlayerRef.current = new window.YT.Player(ytContainerId, {
          height: '180',
          width: '240',
          videoId: currentTrack?.videoId || '',
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              console.log('[MediaEngine] YouTube Player ready');
              event.target.setVolume(volume);
              const dur = event.target.getDuration();
              if (dur && onDurationChange) onDurationChange(dur);
            },
            onStateChange: (event) => {
              // YT.PlayerState: -1: unstarted, 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
              if (event.data === 0) {
                console.log('[MediaEngine] YouTube Track ended, advancing queue...');
                if (onTrackEnded) onTrackEnded();
              } else if (event.data === 2) {
                // If YouTube paused itself while our room is in PLAYING state (e.g., background tab or another window maximized)
                if (isPlayingRef.current) {
                  console.log('[MediaEngine] Background occlusion pause intercepted, re-asserting playback...');
                  setTimeout(() => {
                    if (isPlayingRef.current && ytPlayerRef.current?.playVideo) {
                      ytPlayerRef.current.playVideo();
                    }
                  }, 150);
                }
              }
            },
            onError: (err) => {
              console.warn('[MediaEngine] YouTube Player error:', err.data);
            },
          },
        });
        return true;
      } catch (err) {
        console.warn('[MediaEngine] Failed to initialize YT player:', err);
        return false;
      }
    };

    if (!initYouTube()) {
      checkInterval = setInterval(() => {
        if (initYouTube()) {
          clearInterval(checkInterval);
        }
      }, 500);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  // 2. Background Wake & Visibility / Blur Guard
  // Keeps playback alive when user maximizes Antigravity, switches tabs, or minimizes browser
  useEffect(() => {
    const handleVisibilityOrFocusChange = () => {
      if (isPlayingRef.current) {
        // Ensure YouTube is still playing
        if (currentTrackRef.current?.videoId && ytPlayerRef.current?.playVideo) {
          setTimeout(() => {
            if (isPlayingRef.current && ytPlayerRef.current?.playVideo) {
              ytPlayerRef.current.playVideo();
            }
          }, 100);
        }
        // Ensure HTML5 audio is still playing
        if (audioRef.current && audioRef.current.paused && currentTrackRef.current?.audioSrc) {
          audioRef.current.play().catch(() => {});
        }
        // Ensure silent keep-alive audio is still playing
        if (silentAudioRef.current && silentAudioRef.current.paused) {
          silentAudioRef.current.play().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocusChange);
    window.addEventListener('blur', handleVisibilityOrFocusChange);
    window.addEventListener('focus', handleVisibilityOrFocusChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrFocusChange);
      window.removeEventListener('blur', handleVisibilityOrFocusChange);
      window.removeEventListener('focus', handleVisibilityOrFocusChange);
    };
  }, []);

  // 3. Keep-Alive Silent Audio Engine
  // By maintaining an active HTML5 audio stream, Chrome marks the tab with the "Audible" flag and NEVER suspends or freezes it
  useEffect(() => {
    if (isPlaying) {
      if (silentAudioRef.current) {
        silentAudioRef.current.play().catch(() => {});
      }
    } else {
      if (silentAudioRef.current) {
        silentAudioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // 4. Handle Track Changes
  useEffect(() => {
    if (!currentTrack) {
      if (ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    if (currentTrack.type === 'spotify') {
      // Pause YouTube and HTML5 audio so only authentic Spotify podcast plays
      if (ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
      if (audioRef.current) audioRef.current.pause();
      return;
    }

    if (currentTrack.videoId && ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
      if (audioRef.current) audioRef.current.pause();
      try {
        ytPlayerRef.current.loadVideoById({
          videoId: currentTrack.videoId,
          startSeconds: Math.floor(currentTime || 0),
        });
        if (!isPlaying) {
          setTimeout(() => {
            if (ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
          }, 300);
        }
      } catch (e) {
        console.warn('[MediaEngine] Error loading video ID:', e);
      }
    } else if (currentTrack.audioSrc && audioRef.current) {
      if (ytPlayerRef.current?.pauseVideo) ytPlayerRef.current.pauseVideo();
      audioRef.current.src = currentTrack.audioSrc;
      audioRef.current.currentTime = currentTime || 0;
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [currentTrack?.id, currentTrack?.videoId, currentTrack?.type]);

  // 5. Handle Play / Pause Sync
  useEffect(() => {
    if (currentTrack?.videoId && ytPlayerRef.current) {
      try {
        if (isPlaying) {
          if (ytPlayerRef.current.playVideo) ytPlayerRef.current.playVideo();
        } else {
          if (ytPlayerRef.current.pauseVideo) ytPlayerRef.current.pauseVideo();
        }
      } catch (e) {}
    } else if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  // 6. Handle External Seek & Drift Correction (Tightened for high sync fidelity)
  useEffect(() => {
    if (isSyncingRef.current) return;

    if (currentTrack?.videoId && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
      try {
        const localTime = ytPlayerRef.current.getCurrentTime() || 0;
        const drift = Math.abs(localTime - currentTime);
        // Tightened drift threshold to 0.75s for tighter co-listening sync
        if (drift > 0.75) {
          isSyncingRef.current = true;
          ytPlayerRef.current.seekTo(currentTime, true);
          setTimeout(() => {
            isSyncingRef.current = false;
          }, 350);
        }
      } catch (e) {}
    } else if (audioRef.current) {
      const localTime = audioRef.current.currentTime || 0;
      const drift = Math.abs(localTime - currentTime);
      // Tightened drift threshold to 0.35s for audio streams
      if (drift > 0.35) {
        audioRef.current.currentTime = currentTime;
      }
    }
  }, [currentTime]);

  // 7. Volume Control
  useEffect(() => {
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      try {
        ytPlayerRef.current.setVolume(volume);
      } catch (e) {}
    }
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // 8. Polling Local Current Time for Smooth UI Progress Bar
  const lastReportedTimeRef = useRef(0);
  useEffect(() => {
    const timePollInterval = setInterval(() => {
      if (!isPlaying) return;

      if (currentTrack?.videoId && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        try {
          const curTime = ytPlayerRef.current.getCurrentTime();
          const dur = ytPlayerRef.current.getDuration();
          if (
            typeof curTime === 'number' &&
            !isNaN(curTime) &&
            Math.abs(curTime - lastReportedTimeRef.current) >= 0.4 &&
            onTimeUpdate
          ) {
            lastReportedTimeRef.current = curTime;
            onTimeUpdate(curTime);
          }
          if (typeof dur === 'number' && dur > 0 && onDurationChange) {
            onDurationChange(dur);
          }
        } catch (e) {}
      } else if (audioRef.current) {
        const curTime = audioRef.current.currentTime || 0;
        if (Math.abs(curTime - lastReportedTimeRef.current) >= 0.4 && onTimeUpdate) {
          lastReportedTimeRef.current = curTime;
          onTimeUpdate(curTime);
        }
        if (audioRef.current.duration && onDurationChange) {
          onDurationChange(audioRef.current.duration);
        }
      }
    }, 250);

    return () => clearInterval(timePollInterval);
  }, [isPlaying, currentTrack?.videoId]);

  // 9. OS-Level MediaSession API Integration (Windows Media Overlay, Phone Lock Screen, Headphone Controls)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (!currentTrack) {
      navigator.mediaSession.playbackState = 'none';
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'DualSync Track',
        artist: currentTrack.artist || 'DualSync',
        album: 'DualSync Synchronized Sanctuary',
        artwork: [
          {
            src: currentTrack.cover || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%231DB954"><circle cx="12" cy="12" r="10"/></svg>',
            sizes: '512x512',
            type: 'image/jpeg',
          },
        ],
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      const safeSetHandler = (action, handler) => {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (e) {}
      };

      safeSetHandler('play', () => {
        if (onPlayPause && !isPlayingRef.current) onPlayPause();
      });
      safeSetHandler('pause', () => {
        if (onPlayPause && isPlayingRef.current) onPlayPause();
      });
      safeSetHandler('nexttrack', () => {
        if (onTrackEnded) onTrackEnded();
      });
      safeSetHandler('previoustrack', () => {
        if (onPrevTrack) onPrevTrack();
      });
      safeSetHandler('seekbackward', () => {
        if (onSeek) onSeek(Math.max(0, (currentTimeRef.current || 0) - 10));
      });
      safeSetHandler('seekforward', () => {
        if (onSeek) onSeek((currentTimeRef.current || 0) + 10);
      });
      safeSetHandler('seekto', (details) => {
        if (typeof details.seekTime === 'number' && onSeek) {
          onSeek(details.seekTime);
        }
      });
    } catch (err) {
      console.warn('[MediaEngine] MediaSession configuration warning:', err);
    }
  }, [currentTrack?.id, isPlaying]);

  return (
    <>
      {/*
        Kept in the viewport at bottom-0 right-0 with 0.01 opacity so Chrome/Edge compositor
        treats it as active rendered DOM rather than discarding it as an off-screen iframe
      */}
      <div
        className="fixed bottom-0 right-0 w-[2px] h-[2px] opacity-[0.01] pointer-events-none z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div id={ytContainerId} />
      </div>

      {/* HTML5 Audio Player for Direct Streams */}
      <audio
        ref={audioRef}
        playsInline
        onEnded={() => {
          console.log('[MediaEngine] Audio stream ended');
          if (onTrackEnded) onTrackEnded();
        }}
      />

      {/* Keep-Alive Looping Silent Audio: Guarantees browser never freezes background tab */}
      <audio
        ref={silentAudioRef}
        src={SILENT_AUDIO_URI}
        loop
        playsInline
        preload="auto"
      />
    </>
  );
}
