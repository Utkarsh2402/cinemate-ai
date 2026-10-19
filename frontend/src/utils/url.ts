/**
 * CineMate AI URL & Room Code Helper Utilities
 */

export function getRoomCodeFromUrl(): string | null {
  try {
    // 1. Check standard URL query parameters (?room=4829, ?pin=4829, ?code=4829)
    const searchParams = new URLSearchParams(window.location.search);
    const fromSearch = searchParams.get('room') || searchParams.get('pin') || searchParams.get('code');
    if (fromSearch && fromSearch.trim()) {
      return fromSearch.trim();
    }

    // 2. Check Hash if hash-based routing is used (#room=4829, #/room/4829, #?room=4829)
    if (window.location.hash) {
      const hash = window.location.hash;
      const hashParamMatch = hash.match(/[?&#](?:room|pin|code)=([A-Za-z0-9-]+)/i);
      if (hashParamMatch && hashParamMatch[1]) {
        return hashParamMatch[1].trim();
      }

      const hashPathMatch = hash.match(/#\/?(?:room|planner)\/([A-Za-z0-9-]+)/i);
      if (hashPathMatch && hashPathMatch[1]) {
        return hashPathMatch[1].trim();
      }
    }

    // 3. Check pathname (/room/4829 or /planner/room/4829)
    const pathnameMatch = window.location.pathname.match(/\/(?:room|planner)(?:\/room)?\/([A-Za-z0-9-]+)/i);
    if (pathnameMatch && pathnameMatch[1]) {
      return pathnameMatch[1].trim();
    }
  } catch (err) {
    console.error('Failed to parse room code from URL:', err);
  }

  return null;
}

export function clearRoomCodeFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    let changed = false;

    for (const key of ['room', 'pin', 'code']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }

    // If pathname was /room/CODE, reset to /
    if (/\/(?:room|planner)/i.test(url.pathname)) {
      url.pathname = '/';
      changed = true;
    }

    if (changed) {
      window.history.replaceState({}, '', url.pathname + (url.search || '') + (url.hash || ''));
    }
  } catch {
    // Safe no-op in non-browser or restricted contexts
  }
}

export function buildInviteUrl(sessionCode: string): string {
  const origin = window.location.origin;
  return `${origin}/?room=${encodeURIComponent(sessionCode)}`;
}
