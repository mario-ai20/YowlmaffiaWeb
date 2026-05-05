export async function exportYowlFile(payload) {
  if (!window.desktop?.exportYowl) {
    throw new Error('Exporteren naar .yowl werkt alleen in de desktop-app.');
  }

  return window.desktop.exportYowl(payload);
}

export async function importYowlFile() {
  if (!window.desktop?.importYowl) {
    throw new Error('Importeren van .yowl werkt alleen in de desktop-app.');
  }

  return window.desktop.importYowl();
}

export async function openExternalUrl(url) {
  const nextUrl = String(url || '').trim();
  if (!nextUrl) {
    return null;
  }

  if (window.desktop?.openExternal) {
    return window.desktop.openExternal(nextUrl);
  }

  if (typeof window !== 'undefined') {
    window.open(nextUrl, '_blank', 'noopener,noreferrer');
    return true;
  }

  return null;
}

export async function getAppVersion() {
  if (!window.desktop?.getVersion) {
    return 'dev';
  }

  return window.desktop.getVersion();
}
