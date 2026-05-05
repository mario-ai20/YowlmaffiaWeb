import { supabase } from './supabase';

const MATTIZ_INTERNAL_UID = '1cf45d1c-b3ba-432e-a9de-33928369392b';
const MATTIZ_INTERNAL_EMAIL = 'mattizhoornaert@hotmail.com';
const MATTIZ_INTERNAL_NAMES = new Set([
  'mattiz',
  'mattizhoornaert',
  'mattizhoornaert96',
  'mattiz hoornaert'
]);

export const DEFAULT_ALLOWED_USERS = [
  {
    id: MATTIZ_INTERNAL_UID,
    auth_user_id: MATTIZ_INTERNAL_UID,
    username: 'Mattiz',
    displayName: 'Mattiz',
    email: 'mattizhoornaert@hotmail.com',
    email_mfa_enabled: true,
    stay_logged_in: true,
    accent: '#ff6b9c',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system'
  },
  {
    username: 'Lukas',
    displayName: 'Lukas',
    email: 'lukas.stevens@student.tsaam.be',
    email_mfa_enabled: true,
    stay_logged_in: true,
    accent: '#72d4ff',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system'
  },
  {
    username: 'Yoshi',
    displayName: 'Yoshi',
    email: 'bastiaenssens.yoshi@gmail.com',
    email_mfa_enabled: true,
    stay_logged_in: true,
    accent: '#a6ff7c',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system'
  }
];

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function matchesMattizInternalIdentity(value = '') {
  const normalized = normalizeUsername(value);
  if (!normalized) {
    return false;
  }

  const exactCandidates = new Set([
    normalizeUsername(MATTIZ_INTERNAL_UID),
    normalizeUsername(MATTIZ_INTERNAL_EMAIL)
  ]);

  if (exactCandidates.has(normalized)) {
    return true;
  }

  if (MATTIZ_INTERNAL_NAMES.has(normalized)) {
    return true;
  }

  return normalized.includes('mattiz') && normalized.includes('hoornaert');
}

export function isMattizAllowedUser(user) {
  const candidateValues = [
    user?.auth_user_id,
    user?.id,
    user?.user_id,
    user?.email,
    user?.username,
    user?.displayName,
    user?.display_name,
    user?.name
  ];

  return candidateValues.some((value) => matchesMattizInternalIdentity(value));
}

function normalizeThemeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  return mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system';
}

function normalizeBoolean(value, fallback = true) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  return fallback;
}

function isEmailDerivedDisplayName(candidate = '', email = '') {
  const normalizedCandidate = normalizeUsername(candidate);
  const normalizedEmail = normalizeUsername(email);

  if (!normalizedCandidate || !normalizedEmail.includes('@')) {
    return false;
  }

  const localPart = normalizedEmail.split('@')[0];
  const compactCandidate = normalizedCandidate.replace(/[^a-z0-9]+/g, '');
  const compactLocalPart = localPart.replace(/[^a-z0-9]+/g, '');

  return Boolean(compactCandidate && compactLocalPart && compactCandidate === compactLocalPart);
}

export function normalizeAllowedUser(user) {
  return {
    id: String(user?.id || user?.user_id || user?.auth_user_id || user?.authUserId || '').trim(),
    username: String(user?.username || '').trim(),
    displayName: String(user?.display_name || user?.displayName || user?.name || '').trim(),
    email: String(user?.email || '').trim(),
    email_mfa_enabled: normalizeBoolean(user?.email_mfa_enabled, true),
    stay_logged_in: true,
    accent: user?.accent || '#72d4ff',
    avatar_url: String(user?.avatar_url || user?.avatarUrl || '').trim(),
    updated_at: String(user?.updated_at || user?.updatedAt || '').trim(),
    last_online_at: String(user?.last_online_at || user?.lastOnlineAt || '').trim(),
    bio: String(user?.bio || '').trim(),
    status_message: String(user?.status_message || user?.statusMessage || '').trim(),
    theme_mode: normalizeThemeMode(user?.theme_mode || user?.themeMode || 'system')
  };
}

function getAllowedUserIdentityKeys(user) {
  return [
    String(user?.auth_user_id || '').trim(),
    String(user?.id || '').trim(),
    String(user?.username || '').trim(),
    String(user?.displayName || '').trim(),
    String(user?.email || '').trim()
  ]
    .map(normalizeUsername)
    .filter(Boolean);
}

function getAllowedUserUpdateFilter(user) {
  const authUserId = String(user?.auth_user_id || user?.authUserId || '').trim();
  const email = String(user?.email || '').trim();
  const username = String(user?.username || '').trim();

  if (authUserId) {
    return { column: 'auth_user_id', value: authUserId };
  }

  if (email) {
    return { column: 'email', value: email };
  }

  if (username) {
    return { column: 'username', value: username };
  }

  return null;
}

export function getAllowedUserDisplayLabel(user) {
  const normalized = normalizeAllowedUser(user);
  const displayName = normalized.displayName;

  if (displayName) {
    return displayName;
  }

  return 'Onbekend';
}

export function dedupeAllowedUsers(users = []) {
  const seen = new Set();
  const deduped = [];

  for (const rawUser of Array.isArray(users) ? users : []) {
    const user = normalizeAllowedUser(rawUser);
    const keys = getAllowedUserIdentityKeys(user);
    if (!keys.length) {
      continue;
    }

    if (keys.some((key) => seen.has(key))) {
      continue;
    }

    keys.forEach((key) => seen.add(key));
    deduped.push(user);
  }

  return deduped;
}

export function appendAvatarVersion(avatarUrl = '', updatedAt = '') {
  const url = String(avatarUrl || '').trim();
  if (!url) {
    return '';
  }

  const version = String(updatedAt || '').trim();
  if (!version) {
    return url;
  }

  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}

export function resolveAvatarUrl(user = null) {
  if (!user) {
    return '';
  }

  return appendAvatarVersion(user.avatar_url || user.avatarUrl || '', user.updated_at || user.updatedAt || user.avatar_updated_at || '');
}

export function findAllowedUser(value, allowedUsers = DEFAULT_ALLOWED_USERS) {
  const needle = normalizeUsername(value);
  if (!needle) {
    return null;
  }

  return (
    allowedUsers.find((user) => normalizeUsername(user.auth_user_id) === needle) ||
    allowedUsers.find((user) => normalizeUsername(user.username) === needle) ||
    allowedUsers.find((user) => normalizeUsername(user.displayName) === needle) ||
    allowedUsers.find((user) => normalizeUsername(user.email) === needle) ||
    null
  );
}

export function resolveAllowedUserAvatar(value, allowedUsers = DEFAULT_ALLOWED_USERS) {
  return findAllowedUser(value, allowedUsers)?.avatar_url || '';
}

export function resolveAllowedUserDisplayName(value, allowedUsers = DEFAULT_ALLOWED_USERS) {
  return getAllowedUserDisplayLabel(findAllowedUser(value, allowedUsers));
}

export function usernameToEmail(username, allowedUsers = DEFAULT_ALLOWED_USERS) {
  return findAllowedUser(username, allowedUsers)?.email || null;
}

export function getUsernameOptions(allowedUsers = DEFAULT_ALLOWED_USERS) {
  return allowedUsers.map((user) => user.username).filter(Boolean);
}

export async function loadAllowedUsers() {
  if (!supabase) {
    return [];
  }

  const selectAllowedUsers = async (fields) =>
    supabase.from('allowed_users').select(fields).order('display_name', { ascending: true });

  const primaryResult = await selectAllowedUsers('auth_user_id, username, email, display_name, email_mfa_enabled, stay_logged_in, accent, avatar_url, updated_at, last_online_at, bio, status_message, theme_mode');

  let { data, error } = primaryResult;

  if (error) {
    const fallbackResult = await selectAllowedUsers('username, email, display_name, avatar_url, updated_at, last_online_at, bio, status_message');
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    const minimalResult = await selectAllowedUsers('username, email, display_name');
    data = minimalResult.data;
    error = minimalResult.error;
  }

  if (error || !Array.isArray(data) || !data.length) {
    return [];
  }

  return dedupeAllowedUsers(data);
}

export function resolveUserFromSession(session, allowedUsers = DEFAULT_ALLOWED_USERS) {
  const userId = session?.user?.id || '';
  const username = session?.user?.user_metadata?.username || session?.user?.user_metadata?.name || '';
  const email = session?.user?.email || '';
  const displayName = session?.user?.user_metadata?.display_name || session?.user?.user_metadata?.displayName || '';

  const matched =
    allowedUsers.find((user) => normalizeUsername(user.id) === normalizeUsername(userId)) ||
    allowedUsers.find((user) => normalizeUsername(user.auth_user_id) === normalizeUsername(userId)) ||
    findAllowedUser(username, allowedUsers) ||
    findAllowedUser(displayName, allowedUsers) ||
    allowedUsers.find((user) => normalizeUsername(user.email) === normalizeUsername(email)) ||
    null;

  if (!matched) {
    return null;
  }

  const normalized = normalizeAllowedUser(matched);
  if (normalizeUsername(userId) === normalizeUsername(MATTIZ_INTERNAL_UID)) {
    return {
      ...normalized,
      id: MATTIZ_INTERNAL_UID,
      auth_user_id: MATTIZ_INTERNAL_UID,
      username: normalized.username || 'Mattiz',
      displayName: normalized.displayName || 'Mattiz',
      email: normalized.email || email || 'mattizhoornaert@hotmail.com'
    };
  }

  return normalized;
}

export async function ensureAllowedUserRow() {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.rpc('ensure_allowed_user');

  if (error) {
    throw error;
  }

  return data || null;
}

export async function saveAllowedUserProfileRow(user, payload) {
  if (!supabase) {
    throw new Error('Supabase is niet verbonden.');
  }

  const matchFilter = getAllowedUserUpdateFilter(user);

  if (!matchFilter) {
    throw new Error('Geen geldige gebruiker gevonden om op te slaan.');
  }

  const nextPayload = {
    username: String(payload?.username || payload?.name || user?.username || '').trim(),
    display_name: String(payload?.display_name || payload?.displayName || payload?.name || user?.displayName || '').trim(),
    bio: String(payload?.bio || '').trim(),
    status_message: String(payload?.status_message || '').trim(),
    avatar_url: String(payload?.avatar_url || '').trim(),
    theme_mode: String(payload?.theme_mode || user?.theme_mode || 'system').trim() || 'system',
    email_mfa_enabled:
      payload?.email_mfa_enabled === undefined ? user?.email_mfa_enabled !== false : Boolean(payload.email_mfa_enabled),
    stay_logged_in: true,
    gender: String(payload?.gender || user?.gender || '').trim(),
    updated_at: String(payload?.updated_at || new Date().toISOString()).trim()
  };

  const isMissingStayLoggedInColumn = (error) => {
    const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
    return (
      message.includes("could not find the 'stay_logged_in' column of 'allowed_users' in the schema cache") ||
      message.includes('column "stay_logged_in" does not exist') ||
      message.includes('column "stay_logged_in" of relation "allowed_users" does not exist') ||
      message.includes('schema cache')
    );
  };

  const rpcResult = await supabase.rpc('save_current_allowed_user_profile', { p_payload: nextPayload });

  if (!rpcResult.error && rpcResult.data) {
    return normalizeAllowedUser(rpcResult.data);
  }

  const useSafePayload = rpcResult.error && isMissingStayLoggedInColumn(rpcResult.error);
  const payloadToWrite = useSafePayload
    ? (({ stay_logged_in: _ignored, ...rest }) => rest)(nextPayload)
    : nextPayload;
  const selectFields = useSafePayload
    ? 'auth_user_id, username, email, display_name, email_mfa_enabled, accent, avatar_url, updated_at, last_online_at, bio, status_message, theme_mode'
    : 'auth_user_id, username, email, display_name, email_mfa_enabled, stay_logged_in, accent, avatar_url, updated_at, last_online_at, bio, status_message, theme_mode';

  const { data, error } = await supabase
    .from('allowed_users')
    .update(payloadToWrite)
    .eq(matchFilter.column, matchFilter.value)
    .select(selectFields)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeAllowedUser(data) : null;
}
