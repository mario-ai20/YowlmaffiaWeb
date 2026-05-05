import { siInstagram, siSoundcloud, siSpotify, siTiktok, siYoutube } from 'simple-icons';

const SOCIAL_PLATFORM_META = [
  {
    platform: 'instagram',
    label: 'Instagram',
    description: 'Foto’s, reels en stories',
    placeholder: 'https://instagram.com/yowlmaffia',
    sortOrder: 1,
    icon: siInstagram
  },
  {
    platform: 'tiktok',
    label: 'TikTok',
    description: 'Korte clips en snippets',
    placeholder: 'https://tiktok.com/@yowlmaffia',
    sortOrder: 2,
    icon: siTiktok
  },
  {
    platform: 'youtube',
    label: 'YouTube',
    description: 'Video’s, uploads en shorts',
    placeholder: 'https://youtube.com/@yowlmaffia',
    sortOrder: 3,
    icon: siYoutube
  },
  {
    platform: 'spotify',
    label: 'Spotify',
    description: 'Muziek, playlists en releases',
    placeholder: 'https://open.spotify.com/artist/...',
    sortOrder: 4,
    icon: siSpotify
  },
  {
    platform: 'soundcloud',
    label: 'SoundCloud',
    description: 'Previews en uploads',
    placeholder: 'https://soundcloud.com/yowlmaffia',
    sortOrder: 5,
    icon: siSoundcloud
  }
];

function normalizeText(value, fallback = '') {
  return String(value || '').trim() || fallback;
}

export function normalizeSocialUrl(value = '') {
  const nextValue = String(value || '').trim();

  if (!nextValue) {
    return '';
  }

  if (/^https?:\/\//i.test(nextValue)) {
    return nextValue;
  }

  return `https://${nextValue.replace(/^\/+/, '')}`;
}

export function getSocialPlatformMeta(platform = '') {
  const normalizedPlatform = normalizeText(platform).toLowerCase();
  return SOCIAL_PLATFORM_META.find((item) => item.platform === normalizedPlatform) || SOCIAL_PLATFORM_META[0];
}

export function createDefaultSocialLinks() {
  return SOCIAL_PLATFORM_META.map((meta) => ({
    platform: meta.platform,
    label: meta.label,
    description: meta.description,
    placeholder: meta.placeholder,
    url: '',
    sortOrder: meta.sortOrder,
    createdAt: '',
    updatedAt: ''
  }));
}

export function normalizeSocialLink(record = {}) {
  const meta = getSocialPlatformMeta(record.platform);
  return {
    platform: normalizeText(record.platform, meta.platform).toLowerCase(),
    label: normalizeText(record.label, meta.label),
    description: meta.description,
    placeholder: meta.placeholder,
    url: normalizeSocialUrl(record.url),
    sortOrder: Number(record.sort_order ?? record.sortOrder ?? meta.sortOrder ?? 0),
    createdAt: record.created_at || record.createdAt || '',
    updatedAt: record.updated_at || record.updatedAt || record.created_at || record.createdAt || ''
  };
}

export function normalizeSocialLinkPayload(link = {}, fallbackSortOrder = 0) {
  const meta = getSocialPlatformMeta(link.platform);
  return {
    platform: normalizeText(link.platform, meta.platform).toLowerCase(),
    label: normalizeText(link.label, meta.label),
    url: normalizeSocialUrl(link.url),
    sort_order: Number(link.sortOrder ?? link.sort_order ?? fallbackSortOrder ?? meta.sortOrder ?? 0),
    updated_at: new Date().toISOString()
  };
}

export async function loadSocialLinks(supabase) {
  if (!supabase) {
    return createDefaultSocialLinks();
  }

  try {
    const { data, error } = await supabase
      .from('app_social_links')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = (data || []).map((item) => normalizeSocialLink(item));
    const byPlatform = new Map(rows.map((item) => [item.platform, item]));

    return SOCIAL_PLATFORM_META.map((meta) => byPlatform.get(meta.platform) || normalizeSocialLink({ platform: meta.platform, label: meta.label, sort_order: meta.sortOrder }));
  } catch (error) {
    console.error(error);
    return createDefaultSocialLinks();
  }
}

export const SOCIAL_PLATFORM_OPTIONS = SOCIAL_PLATFORM_META.map((meta) => ({
  platform: meta.platform,
  label: meta.label,
  description: meta.description,
  placeholder: meta.placeholder,
  sortOrder: meta.sortOrder,
  icon: meta.icon
}));
