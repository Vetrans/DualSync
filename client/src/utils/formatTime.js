/**
 * Formats seconds into MM:SS or HH:MM:SS
 */
export function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const totalSeconds = Math.floor(seconds);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const paddedSecs = secs < 10 ? `0${secs}` : secs;

  if (hrs > 0) {
    const paddedMins = mins < 10 ? `0${mins}` : mins;
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${mins}:${paddedSecs}`;
}
