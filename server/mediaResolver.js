import axios from 'axios';

// In-memory resolution cache: key (lowercase URL/query) -> { track, cachedAt }
const mediaResolutionCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour TTL
const MAX_CACHE_ENTRIES = 500;

function getCachedMedia(key) {
  const entry = mediaResolutionCache.get(key.toLowerCase());
  if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) {
    return { ...entry.track };
  }
  return null;
}

function setCachedMedia(key, track) {
  if (mediaResolutionCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = mediaResolutionCache.keys().next().value;
    mediaResolutionCache.delete(firstKey);
  }
  mediaResolutionCache.set(key.toLowerCase(), {
    track: { ...track },
    cachedAt: Date.now(),
  });
}

/**
 * Extracts YouTube Video ID from various URL formats
 */
export function extractYouTubeId(url) {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * Checks if URL is a Spotify track, episode, show, album, or playlist
 */
export function isSpotifyUrl(url) {
  if (!url) return false;
  return /open\.spotify\.com\/(track|episode|show|album|playlist)\/([a-zA-Z0-9]+)/i.test(url);
}

/**
 * Checks if URL is a direct audio stream (MP3, M4A, etc.)
 * Strictly requires an http/https URL ending with an audio file extension.
 */
export function isAudioUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  return /\.(mp3|m4a|aac|wav|ogg|flac)(\?.*)?$/i.test(trimmed);
}

/**
 * Safely searches YouTube using parsed ytInitialData to find genuine, full-length audio/video.
 * Filters out YouTube shorts, advertisements, and ultra-short promotional teasers (< 60s).
 */
export async function searchYouTubeVideo(query) {
  try {
    const encQuery = encodeURIComponent(query);
    const searchRes = await axios.get(`https://www.youtube.com/results?search_query=${encQuery}`, {
      timeout: 6000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = searchRes.data;
    const jsonMatch = html.match(/var ytInitialData = ({.*?});<\/script>/) || html.match(/ytInitialData = ({.*?});<\/script>/);
    if (!jsonMatch) {
      // Fallback: simple regex match
      const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
      return match ? { videoId: match[1], title: query, duration: 0 } : null;
    }

    const data = JSON.parse(jsonMatch[1]);
    const sections = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    for (const section of sections) {
      const items = section.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const v = item.videoRenderer;
        if (!v || !v.videoId) continue;

        // Duration calculation
        const durationText = v.lengthText?.simpleText || '';
        const parts = durationText.split(':').map(Number);
        let totalSecs = 0;
        if (parts.length === 2) {
          totalSecs = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          totalSecs = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        // Avoid ultra-short promotional teasers or YouTube shorts (< 60 seconds)
        if (totalSecs > 0 && totalSecs < 60) {
          continue;
        }

        const title = v.title?.runs?.map((r) => r.text).join('') || '';
        const channel = v.ownerText?.runs?.map((r) => r.text).join('') || 'YouTube Creator';
        const cover = v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`;

        return {
          videoId: v.videoId,
          title,
          artist: channel,
          duration: totalSecs,
          cover,
        };
      }
    }
  } catch (err) {
    console.warn('[searchYouTubeVideo] Search error:', err.message);
  }
  return null;
}

/**
 * Resolves a Spotify track, episode, or show.
 * Parses Spotify embed metadata directly via __NEXT_DATA__ (robust, no rate-limiting, handles shows & episodes).
 */
export async function resolveSpotifyUrl(rawUrl, addedBy = 'Anonymous') {
  const match = rawUrl.match(/open\.spotify\.com\/(track|episode|show|album|playlist)\/([a-zA-Z0-9]+)/i);
  if (!match) throw new Error('Invalid Spotify URL');

  const [, type, id] = match;
  const canonicalUrl = `https://open.spotify.com/${type}/${id}`;
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;

  let title = 'Spotify Media';
  let artist = 'Spotify';
  let cover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';
  let duration = 0;
  let spotifyUri = `spotify:${type}:${id}`;

  try {
    const embedRes = await axios.get(`https://open.spotify.com/embed/${type}/${id}`, {
      timeout: 7000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const nextDataMatch = embedRes.data.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      const parsedData = JSON.parse(nextDataMatch[1]);
      const entity = parsedData.props?.pageProps?.state?.data?.entity;
      if (entity) {
        if (type === 'show') {
          title = entity.subtitle || entity.title || entity.name || 'Spotify Podcast Show';
          artist = entity.subtitle ? `${entity.title || 'Podcast'} - Spotify Studios` : 'Spotify Podcast';
        } else {
          title = entity.title || entity.name || title;
          artist = entity.subtitle || artist;
        }

        if (entity.duration) {
          duration = Math.round(entity.duration / 1000);
        }

        if (entity.uri) {
          spotifyUri = entity.uri;
        }

        const coverSources = entity.visualIdentity?.image || entity.relatedEntityCoverArt || [];
        if (coverSources.length > 0) {
          cover = coverSources[0]?.url || cover;
        }
      }
    }
  } catch (err) {
    console.warn('[resolveSpotifyUrl] Embed scrape fallback:', err.message);
    // oEmbed fallback if embed scraping fails
    try {
      const oembedRes = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(canonicalUrl)}`, {
        timeout: 5000,
      });
      if (oembedRes.data) {
        title = oembedRes.data.title || title;
        artist = oembedRes.data.author_name || artist;
        cover = oembedRes.data.thumbnail_url || cover;
      }
    } catch (oembedErr) {
      // Continue with defaults
    }
  }

  // 1. Podcasts (Episodes and Shows)
  // CRITICAL: NEVER match Spotify Originals / podcast episodes to random YouTube teasers!
  // Return directly as native Spotify Player item so it plays authentically on both devices.
  if (type === 'episode' || type === 'show') {
    return {
      id: `sp_${type}_${id}_${Date.now()}`,
      type: 'spotify',
      spotifyType: type,
      spotifyId: id,
      spotifyUri,
      embedUrl,
      url: canonicalUrl,
      title: title || (type === 'show' ? 'I Hear You (Hindi Thriller Podcast)' : 'Podcast Episode'),
      artist: artist || 'Spotify Studios',
      cover,
      duration,
      addedBy,
      addedAt: Date.now(),
    };
  }

  // 2. Music Tracks
  // For standard songs on Spotify, find the verified matching YouTube audio track
  let resolvedVideoId = null;
  try {
    const ytMatch = await searchYouTubeVideo(`${title} ${artist} audio`);
    if (ytMatch && ytMatch.videoId) {
      resolvedVideoId = ytMatch.videoId;
      if (!duration && ytMatch.duration) {
        duration = ytMatch.duration;
      }
    }
  } catch (matchErr) {
    console.warn('[resolveSpotifyUrl] YouTube matching skipped:', matchErr.message);
  }

  return {
    id: `sp_track_${id}_${Date.now()}`,
    type: resolvedVideoId ? 'youtube' : 'spotify',
    videoId: resolvedVideoId,
    originalType: 'spotify',
    spotifyType: 'track',
    spotifyId: id,
    spotifyUri,
    embedUrl,
    url: canonicalUrl,
    title,
    artist,
    cover,
    duration,
    addedBy,
    addedAt: Date.now(),
  };
}

/**
 * Resolves any media link or search query into a standardized Track object
 */
export async function resolveMediaUrl(rawUrl, addedBy = 'Anonymous') {
  const input = (rawUrl || '').trim();
  if (!input) {
    throw new Error('Please provide a valid media URL or search title');
  }

  // Check cache for instant sub-millisecond retrieval
  const cached = getCachedMedia(input);
  if (cached) {
    return {
      ...cached,
      id: `${cached.type || 'track'}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      addedBy,
      addedAt: Date.now(),
    };
  }

  let resolvedTrack = null;

  // 1. YouTube Link (watch?v=, youtu.be, shorts)
  const ytId = extractYouTubeId(input);
  if (ytId) {
    const wideThumb = `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`;
    try {
      const oembedRes = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
        { timeout: 5000 }
      );
      const data = oembedRes.data;
      resolvedTrack = {
        id: `yt_${ytId}_${Date.now()}`,
        type: 'youtube',
        videoId: ytId,
        url: input,
        title: data.title || 'YouTube Audio',
        artist: data.author_name || 'YouTube Creator',
        cover: wideThumb,
        duration: 0,
        addedBy,
        addedAt: Date.now(),
      };
    } catch (err) {
      resolvedTrack = {
        id: `yt_${ytId}_${Date.now()}`,
        type: 'youtube',
        videoId: ytId,
        url: input,
        title: `YouTube Track (${ytId})`,
        artist: 'YouTube',
        cover: wideThumb,
        duration: 0,
        addedBy,
        addedAt: Date.now(),
      };
    }
  }

  // 2. Spotify Link (track, episode, show, album, playlist)
  if (!resolvedTrack && isSpotifyUrl(input)) {
    resolvedTrack = await resolveSpotifyUrl(input, addedBy);
  }

  // 3. Direct Audio File (MP3, M4A, AAC, etc.)
  if (!resolvedTrack && isAudioUrl(input)) {
    const filename = input.split('/').pop().split('?')[0];
    const cleanTitle = decodeURIComponent(filename).replace(/\.[^/.]+$/, '');
    resolvedTrack = {
      id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'audio',
      audioSrc: input,
      url: input,
      title: cleanTitle || 'Direct Audio Stream',
      artist: 'Audio File',
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
      duration: 0,
      addedBy,
      addedAt: Date.now(),
    };
  }

  // 4. Special Query Handling: "I Hear You" Podcast / Show
  if (!resolvedTrack && /i\s*hear\s*you/i.test(input)) {
    console.log('[MediaResolver] Detected search for "I Hear You" podcast, resolving official Spotify show...');
    resolvedTrack = await resolveSpotifyUrl('https://open.spotify.com/show/1uYUZxdR4sSTXJ6SmSRook', addedBy);
  }

  // 5. Default: Genuine YouTube Search for Song/Video Title
  if (!resolvedTrack) {
    try {
      const ytMatch = await searchYouTubeVideo(input);
      if (ytMatch && ytMatch.videoId) {
        resolvedTrack = {
          id: `yt_${ytMatch.videoId}_${Date.now()}`,
          type: 'youtube',
          videoId: ytMatch.videoId,
          url: `https://www.youtube.com/watch?v=${ytMatch.videoId}`,
          title: ytMatch.title,
          artist: ytMatch.artist,
          cover: ytMatch.cover || `https://i.ytimg.com/vi/${ytMatch.videoId}/mqdefault.jpg`,
          duration: ytMatch.duration || 0,
          addedBy,
          addedAt: Date.now(),
        };
      }
    } catch (searchErr) {
      console.warn('[MediaResolver] YouTube search fallback failed:', searchErr.message);
    }
  }

  if (resolvedTrack) {
    setCachedMedia(input, resolvedTrack);
    return resolvedTrack;
  }

  throw new Error('Could not find media for this link or title. Please paste a valid YouTube, Spotify, or audio link.');
}
