/** Creates a shareable web URL for joining a room, or null when no public URL is available. */
export function createRoomInviteUrl(roomCode: string, appUrl: string | undefined, currentUrl: string): string | null {
  try {
    const base = appUrl?.trim() || currentUrl;
    const url = new URL(base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.search = '';
    url.hash = '';
    url.searchParams.set('join', roomCode);
    return url.toString();
  } catch {
    return null;
  }
}
