import React, { useEffect, useRef } from 'react';

export default function MediaEngine({
  currentTrack,
  isPlaying,
  currentTime,
  volume,
  onTimeUpdate,
  onDurationChange,
  onTrackEnded,
}) {
  const ytPlayerRef = useRef(null);
  const audioRef = useRef(null);
  const isSyncingRef = useRef(false);
  const ytContainerId = 'dualsync-yt-hidden-player';

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
          height: '240',
          width: '320',
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
              // YT.PlayerState.ENDED = 0
              if (event.data === 0) {
                console.log('[MediaEngine] YouTube Track ended, advancing queue...');
                if (onTrackEnded) onTrackEnded();
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

  // 2. Handle Track Changes
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

  // 3. Handle Play / Pause Sync
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

  // 4. Handle External Seek & Drift Correction (Tightened for high sync fidelity)
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

  // 5. Volume Control
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

  // 6. Polling Local Current Time for Smooth UI Progress Bar
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

  return (
    <div className="fixed -bottom-[9999px] -left-[9999px] opacity-0 pointer-events-none" aria-hidden="true">
      {/* Hidden YouTube Iframe Player */}
      <div id={ytContainerId} />

      {/* HTML5 Audio Player */}
      <audio
        ref={audioRef}
        onEnded={() => {
          console.log('[MediaEngine] Audio stream ended');
          if (onTrackEnded) onTrackEnded();
        }}
      />
    </div>
  );
}
