const AUTH_PROTOCOL = 'yowlmaffia';

function isDesktopRuntime() {
  return typeof window !== 'undefined' && window.location?.protocol === 'file:';
}

export function getAuthRedirectUrl(scope = 'internal', mode = 'verify') {
  const normalizedScope = scope === 'public' ? 'public' : 'internal';
  const normalizedMode = mode === 'recovery' ? 'recovery' : 'verify';

  if (typeof window === 'undefined') {
    return undefined;
  }

  if (isDesktopRuntime()) {
    return `${AUTH_PROTOCOL}://auth/${normalizedScope}?mode=${normalizedMode}`;
  }

  const { protocol, origin } = window.location;
  if (!/^https?:$/i.test(protocol) || !origin || origin === 'null') {
    return undefined;
  }

  return `${origin}/#/auth/${normalizedScope}?mode=${normalizedMode}`;
}
