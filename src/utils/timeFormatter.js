export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return "0s";
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const remainder = seconds % 3600;
  const minutes = Math.floor(remainder / 60);
  const secs = remainder % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

// Short form for dashboard cards: drops the smallest unit so values stay
// on one line. Pair with a title tooltip for full precision.
export function formatDurationCompact(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) return "0s";
  seconds = Math.floor(seconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function formatTimeOnly(date) {
  if (!date || isNaN(date.getTime())) return '-';
  return date.toTimeString().split(' ')[0];
}
