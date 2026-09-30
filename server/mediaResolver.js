import axios from 'axios';

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
 * Checks if URL is a Spotify track, episode, or album
 */
export function isSpotifyUrl(url) {
  if (!url) return false;
  return /open\.spotify\.com\/(track|episode|album|playlist)\/([a-zA-Z0-9]+)/.test(url);
}

/**
 * Checks if URL is a direct audio stream (MP3, M4A, etc.)
 */
export function isAudioUrl(url) {
  if (!url) return false;
  return /\.(mp3|m4a|aac|wav|ogg|flac)(\?.*)?$/i.test(url) || url.includes('/audio/') || url.includes('podcast');
}

/**
 * Resolves any media link into a standardized Track object
 */
export async function resolveMediaUrl(rawUrl, addedBy = 'Anonymous') {
  const url = (rawUrl || '').trim();
  if (!url) {
    throw new Error('Please provide a valid media URL');
  }

  // 1. YouTube Link
  const ytId = extractYouTubeId(url);
  if (ytId) {
    try {
      const oembedRes = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
        { timeout: 5000 }
      );
      const data = oembedRes.data;
      return {
        id: `yt_${ytId}_${Date.now()}`,
        type: 'youtube',
        videoId: ytId,
        url,
        title: data.title || 'YouTube Audio',
        artist: data.author_name || 'YouTube Creator',
        cover: data.thumbnail_url || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        duration: 0, // YouTube player will dynamically report exact duration
        addedBy,
        addedAt: Date.now(),
      };
    } catch (err) {
      // Fallback if oEmbed fails
      return {
        id: `yt_${ytId}_${Date.now()}`,
        type: 'youtube',
        videoId: ytId,
        url,
        title: `YouTube Track (${ytId})`,
        artist: 'YouTube',
        cover: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        duration: 0,
        addedBy,
        addedAt: Date.now(),
      };
    }
  }

  // 2. Spotify Link
  if (isSpotifyUrl(url)) {
    try {
      const oembedRes = await axios.get(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
        { timeout: 6000 }
      );
      const data = oembedRes.data;
      const title = data.title || 'Spotify Track';
      const artist = data.author_name || 'Spotify Artist';
      const cover = data.thumbnail_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';

      // For 100% custom UI control without Spotify Premium OAuth,
      // search for the corresponding YouTube video so our custom player runs it
      let resolvedVideoId = null;
      try {
        const query = encodeURIComponent(`${title} ${artist} audio`);
        const searchRes = await axios.get(`https://www.youtube.com/results?search_query=${query}`, {
          timeout: 4000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });
        const match = searchRes.data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          resolvedVideoId = match[1];
        }
      } catch (searchErr) {
        console.warn('[MediaResolver] YouTube auto-match fallback skipped:', searchErr.message);
      }

      return {
        id: `sp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        type: resolvedVideoId ? 'youtube' : 'spotify',
        videoId: resolvedVideoId, // If resolved, plays seamlessly via YouTube engine with Spotify visuals!
        originalType: 'spotify',
        url,
        title,
        artist,
        cover,
        duration: 0,
        addedBy,
        addedAt: Date.now(),
      };
    } catch (err) {
      throw new Error(`Could not resolve Spotify URL: ${err.message}`);
    }
  }

  // 3. Direct Audio File or Podcast Stream
  if (isAudioUrl(url)) {
    const filename = url.split('/').pop().split('?')[0];
    const cleanTitle = decodeURIComponent(filename).replace(/\.[^/.]+$/, "");
    return {
      id: `audio_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'audio',
      audioSrc: url,
      url,
      title: cleanTitle || 'Podcast / Audio Stream',
      artist: 'Audio Stream',
      cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
      duration: 0,
      addedBy,
      addedAt: Date.now(),
    };
  }

  // 4. Default: Try searching YouTube if user pasted a song title instead of a link
  try {
    const query = encodeURIComponent(url);
    const searchRes = await axios.get(`https://www.youtube.com/results?search_query=${query}`, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    const match = searchRes.data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match && match[1]) {
      const ytId = match[1];
      const oembedRes = await axios.get(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
        { timeout: 5000 }
      );
      return {
        id: `yt_${ytId}_${Date.now()}`,
        type: 'youtube',
        videoId: ytId,
        url: `https://www.youtube.com/watch?v=${ytId}`,
        title: oembedRes.data.title || url,
        artist: oembedRes.data.author_name || 'YouTube Creator',
        cover: oembedRes.data.thumbnail_url || `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        duration: 0,
        addedBy,
        addedAt: Date.now(),
      };
    }
  } catch (searchErr) {
    // ignore
  }

  throw new Error('Unsupported URL format. Please paste a YouTube link, Spotify track/podcast, or direct audio link.');
}
