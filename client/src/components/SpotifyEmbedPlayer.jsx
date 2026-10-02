import React, { useEffect, useRef, useState } from 'react';

/**
 * SpotifyEmbedPlayer
 * Embeds Spotify Podcasts & Tracks with bidirectional control synchronization:
 * 1. DualSync controls (Play, Pause, -10s, +10s, Seek bar) control the Spotify player.
 * 2. Spotify embed player controls update DualSync's timeline and broadcast to other devices.
 */
export default function SpotifyEmbedPlayer({
  track,
  isPlaying,
  currentTime,
  onTimeUpdate,
  onDurationChange,
  onPlaybackToggle,
  onSeekChange,
  onTrackEnded,
}) {
  const containerRef = useRef(null);
  const controllerRef = useRef(null);
  const lastCommandTimeRef = useRef(0);
  const lastReportedPosRef = useRef(0);
  const isPlayingRef = useRef(isPlaying);
  const [useFallbackIframe, setUseFallbackIframe] = useState(false);

  isPlayingRef.current = isPlaying;

  const spotifyUri =
    track?.spotifyUri ||
    (track?.spotifyType && track?.spotifyId
      ? `spotify:${track.spotifyType}:${track.spotifyId}`
      : track?.type === 'spotify' && track?.id
      ? `spotify:episode:${track.spotifyId || track.id.replace(/^sp_(episode|show)_/, '').split('_')[0]}`
      : '');

  // 1. Initialize Spotify Iframe Controller
  useEffect(() => {
    let isCancelled = false;
    let fallbackTimer = null;

    const setupController = (IFrameAPI) => {
      if (!containerRef.current || !IFrameAPI || isCancelled) return;

      // Clean existing children
      containerRef.current.innerHTML = '';
      const mountDiv = document.createElement('div');
      mountDiv.style.width = '100%';
      mountDiv.style.height = '100%';
      containerRef.current.appendChild(mountDiv);

      const options = {
        uri: spotifyUri || track?.embedUrl,
        width: '100%',
        height: '100%',
      };

      const callback = (EmbedController) => {
        if (isCancelled) {
          EmbedController?.destroy?.();
          return;
        }

        controllerRef.current = EmbedController;
        setUseFallbackIframe(false);

        // Listen for playback updates (position and duration in milliseconds)
        EmbedController.addListener('playback_update', (e) => {
          if (!e || !e.data) return;
          const { isPaused, position, duration } = e.data;

          const posSec = Math.floor((position || 0) / 1000);
          const durSec = Math.floor((duration || 0) / 1000);

          if (durSec > 0 && onDurationChange) {
            onDurationChange(durSec);
          }
          if (typeof posSec === 'number' && !isNaN(posSec) && onTimeUpdate) {
            onTimeUpdate(posSec);
          }

          const now = Date.now();
          const isEmbedPlaying = !isPaused;
          const isOurPlaying = isPlayingRef.current;

          // Check if user toggled play/pause directly inside Spotify embed
          if (isEmbedPlaying !== isOurPlaying && now - lastCommandTimeRef.current > 1200) {
            // Guard against background tab/window occlusion pauses:
            // When user switches tab or maximizes another app (e.g. Antigravity), browser pauses iframe.
            // If the document is hidden or window is not focused, and embed paused while room is playing,
            // do NOT broadcast a pause to the room! Re-assert playback in background instead.
            if ((document.hidden || !document.hasFocus()) && !isEmbedPlaying && isOurPlaying) {
              console.log('[SpotifyEmbedPlayer] Suppressing background occlusion pause, resuming...');
              setTimeout(() => {
                if (isPlayingRef.current && controllerRef.current) {
                  controllerRef.current.play();
                }
              }, 150);
              return;
            }

            lastCommandTimeRef.current = now;
            if (onPlaybackToggle) {
              onPlaybackToggle(isEmbedPlaying, posSec);
            }
          }

          // Check if user seeked/scrubbed directly inside Spotify embed
          const timeDiff = Math.abs(posSec - lastReportedPosRef.current);
          if (timeDiff > 3 && now - lastCommandTimeRef.current > 1200) {
            lastCommandTimeRef.current = now;
            if (onSeekChange) {
              onSeekChange(posSec);
            }
          }

          lastReportedPosRef.current = posSec;

          // Check track end
          if (durSec > 0 && posSec >= durSec - 1) {
            if (onTrackEnded) onTrackEnded();
          }
        });

        // If currently playing, trigger playback on load
        if (isPlayingRef.current) {
          setTimeout(() => {
            EmbedController.play();
          }, 400);
        }
      };

      try {
        IFrameAPI.createController(mountDiv, options, callback);
      } catch (err) {
        console.warn('[SpotifyEmbedPlayer] Controller creation error, using fallback:', err);
        setUseFallbackIframe(true);
      }
    };

    if (window.SpotifyIframeApi) {
      setupController(window.SpotifyIframeApi);
    } else {
      const handleApiReady = (e) => {
        setupController(e.detail || window.SpotifyIframeApi);
      };
      window.addEventListener('spotify-iframe-api-ready', handleApiReady);

      fallbackTimer = setTimeout(() => {
        if (!controllerRef.current) {
          setUseFallbackIframe(true);
        }
      }, 3000);

      return () => {
        isCancelled = true;
        if (fallbackTimer) clearTimeout(fallbackTimer);
        window.removeEventListener('spotify-iframe-api-ready', handleApiReady);
        controllerRef.current?.destroy?.();
        controllerRef.current = null;
      };
    }

    return () => {
      isCancelled = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      controllerRef.current?.destroy?.();
      controllerRef.current = null;
    };
  }, [spotifyUri]);

  // Keep playback alive when user switches tab or minimizes/maximizes windows (e.g. Antigravity)
  useEffect(() => {
    const handleBackgroundWake = () => {
      if (isPlayingRef.current && controllerRef.current) {
        setTimeout(() => {
          if (isPlayingRef.current && controllerRef.current) {
            controllerRef.current.play();
          }
        }, 120);
      }
    };

    document.addEventListener('visibilitychange', handleBackgroundWake);
    window.addEventListener('blur', handleBackgroundWake);
    window.addEventListener('focus', handleBackgroundWake);

    return () => {
      document.removeEventListener('visibilitychange', handleBackgroundWake);
      window.removeEventListener('blur', handleBackgroundWake);
      window.removeEventListener('focus', handleBackgroundWake);
    };
  }, []);

  // 2. Sync isPlaying -> Spotify Controller
  useEffect(() => {
    if (!controllerRef.current) {
      // Fallback postMessage to iframe if controller not ready
      sendIframeMessage(isPlaying ? 'play' : 'pause');
      return;
    }

    lastCommandTimeRef.current = Date.now();
    try {
      if (isPlaying) {
        controllerRef.current.play();
      } else {
        controllerRef.current.pause();
      }
    } catch (e) {
      console.warn('[SpotifyEmbedPlayer] Play/pause error:', e);
    }
  }, [isPlaying]);

  // 3. Sync currentTime -> Spotify Controller (Seek / Skip +/- 10s)
  useEffect(() => {
    if (!controllerRef.current) {
      sendIframeMessage('seek', { timestamp: Math.floor(currentTime) });
      return;
    }

    const drift = Math.abs((lastReportedPosRef.current || 0) - currentTime);
    if (drift > 2) {
      lastCommandTimeRef.current = Date.now();
      lastReportedPosRef.current = currentTime;
      try {
        controllerRef.current.seek(Math.floor(currentTime));
      } catch (e) {
        console.warn('[SpotifyEmbedPlayer] Seek error:', e);
      }
    }
  }, [currentTime]);

  // Helper to send fallback postMessage commands
  const sendIframeMessage = (cmd, payload = {}) => {
    const iframe = containerRef.current?.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      const message = { command: cmd, ...payload };
      try {
        iframe.contentWindow.postMessage(message, '*');
        iframe.contentWindow.postMessage(JSON.stringify(message), '*');
      } catch (e) {}
    }
  };

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden flex items-center justify-center">
      {/* Dynamic Spotify Iframe Mount Target */}
      <div
        ref={containerRef}
        className={`w-full h-full flex items-center justify-center ${
          useFallbackIframe ? 'hidden' : 'block'
        }`}
      />

      {/* Fallback Standard Iframe if IFrameAPI is blocked or delayed */}
      {useFallbackIframe && track?.embedUrl && (
        <iframe
          src={track.embedUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="rounded-xl w-full h-full shadow-lg"
          title={track.title}
        />
      )}
    </div>
  );
}
