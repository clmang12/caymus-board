// A post-sign-in destination is only followed if it's a path on this site:
// "/x" but not "//evil.com", "/\evil.com", "https://..." or "javascript:...".
export function safeNext(next, fallback = '/') {
  return typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : fallback;
}
