import { publicChatSupabase } from './supabase';

const MATTIZ_PUBLIC_UID = 'c3fcfff7-b081-49b6-b936-350ef808629a';
const MATTIZ_PUBLIC_EMAIL = 'mattizhoornaert@hotmail.com';
const MATTIZ_PUBLIC_NAMES = new Set([
  'mattiz',
  'mattizhoornaert',
  'mattizhoornaert96',
  'mattiz hoornaert'
]);
const YOSHI_PUBLIC_EMAIL = 'bastiaenssens.yoshi@gmail.com';
const YOSHI_PUBLIC_NAMES = new Set([
  'yoshi',
  'bastiaenssens yoshi',
  'yoshi bastiaenssens'
]);

export const DEFAULT_PUBLIC_USERS = [
  {
    id: MATTIZ_PUBLIC_UID,
    auth_user_id: MATTIZ_PUBLIC_UID,
    username: 'Mattiz',
    displayName: 'Mattiz',
    email: 'mattizhoornaert@hotmail.com',
    birth_date: '',
    email_mfa_enabled: true,
    stay_logged_in: true,
    accent: '#ff6b9c',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system',
    gender: 'zeg ik liever niet'
  },
  {
    id: '',
    auth_user_id: '',
    username: 'Lukas',
    displayName: 'Lukas',
    email: 'lukas.stevens@student.tsaam.be',
    birth_date: '',
    email_mfa_enabled: true,
    stay_logged_in: true,
    accent: '#72d4ff',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system',
    gender: 'zeg ik liever niet'
  },
  {
    id: '',
    auth_user_id: '',
    username: 'Yoshi',
    displayName: 'Yoshi',
    email: 'bastiaenssens.yoshi@gmail.com',
    birth_date: '',
    email_mfa_enabled: true,
    stay_logged_in: true,
    accent: '#a6ff7c',
    avatar_url: '',
    updated_at: '',
    last_online_at: '',
    bio: '',
    status_message: '',
    theme_mode: 'system',
    gender: 'zeg ik liever niet'
  }
];

export const PUBLIC_PRESENCE_STALE_MS = 180000;

export function normalizePublicUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function matchesMattizPublicIdentity(value = '') {
  const normalized = normalizePublicUsername(value);
  if (!normalized) {
    return false;
  }

  const exactCandidates = new Set([
    normalizePublicUsername(MATTIZ_PUBLIC_UID),
    normalizePublicUsername(MATTIZ_PUBLIC_EMAIL)
  ]);

  if (exactCandidates.has(normalized)) {
    return true;
  }

  if (MATTIZ_PUBLIC_NAMES.has(normalized)) {
    return true;
  }

  return normalized.includes('mattiz') && normalized.includes('hoornaert');
}

export function isMattizPublicUser(user) {
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

  return candidateValues.some((value) => matchesMattizPublicIdentity(value));
}

function matchesYoshiPublicIdentity(value = '') {
  const normalized = normalizePublicUsername(value);
  if (!normalized) {
    return false;
  }

  if (normalized === normalizePublicUsername(YOSHI_PUBLIC_EMAIL)) {
    return true;
  }

  if (YOSHI_PUBLIC_NAMES.has(normalized)) {
    return true;
  }

  return normalized.includes('yoshi');
}

export function isYoshiPublicUser(user) {
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

  return candidateValues.some((value) => matchesYoshiPublicIdentity(value));
}

export function canManagePublicAlerts(user) {
  return isMattizPublicUser(user) || isYoshiPublicUser(user);
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
  const normalizedCandidate = normalizePublicUsername(candidate);
  const normalizedEmail = normalizePublicUsername(email);

  if (!normalizedCandidate || !normalizedEmail.includes('@')) {
    return false;
  }

  const localPart = normalizedEmail.split('@')[0];
  const compactCandidate = normalizedCandidate.replace(/[^a-z0-9]+/g, '');
  const compactLocalPart = localPart.replace(/[^a-z0-9]+/g, '');

  return Boolean(compactCandidate && compactLocalPart && compactCandidate === compactLocalPart);
}

export function normalizePublicAllowedUser(user) {
  const rawUsername = String(user?.username || '').trim();
  const rawDisplayName = String(user?.display_name || user?.displayName || user?.name || '').trim();
  const rawEmail = String(user?.email || '').trim();
  const isMattiz = isMattizPublicUser({ username: rawUsername, displayName: rawDisplayName, email: rawEmail });

  return {
    id: String(user?.id || user?.user_id || '').trim(),
    auth_user_id: String(user?.auth_user_id || user?.authUserId || '').trim(),
    username: rawUsername,
    displayName: isMattiz ? 'Mattiz' : rawDisplayName,
    name: isMattiz ? 'Mattiz' : String(user?.name || user?.display_name || user?.displayName || '').trim(),
    email: rawEmail,
    birth_date: String(user?.birth_date || user?.birthDate || '').trim(),
    email_mfa_enabled: normalizeBoolean(user?.email_mfa_enabled, true),
    stay_logged_in: true,
    accent: user?.accent || '#72d4ff',
    avatar_url: String(user?.avatar_url || user?.avatarUrl || '').trim(),
    updated_at: String(user?.updated_at || user?.updatedAt || '').trim(),
    last_online_at: String(user?.last_online_at || user?.lastOnlineAt || '').trim(),
    bio: String(user?.bio || '').trim(),
    status_message: String(user?.status_message || user?.statusMessage || '').trim(),
    theme_mode: normalizeThemeMode(user?.theme_mode || user?.themeMode || 'system'),
    gender: String(user?.gender || '').trim() || 'zeg ik liever niet'
  };
}

function getPublicUserIdentityKeys(user) {
  return [
    String(user?.auth_user_id || '').trim(),
    String(user?.id || '').trim(),
    String(user?.username || '').trim(),
    String(user?.displayName || '').trim(),
    String(user?.email || '').trim()
  ]
    .map(normalizePublicUsername)
    .filter(Boolean);
}

function getPublicUserUpdateFilter(user) {
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

export function getPublicUserDisplayLabel(user) {
  const normalized = normalizePublicAllowedUser(user);
  if (isMattizPublicUser(normalized)) {
    return 'Mattiz';
  }

  const displayName = normalized.displayName;
  if (displayName) {
    return displayName;
  }

  return 'Onbekend';
}

function isMissingStayLoggedInColumn(error) {
  const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  return (
    message.includes("could not find the 'stay_logged_in' column of 'allowed_users' in the schema cache") ||
    message.includes('column "stay_logged_in" does not exist') ||
    message.includes('column "stay_logged_in" of relation "allowed_users" does not exist') ||
    message.includes('schema cache')
  );
}

export function dedupePublicAllowedUsers(users = []) {
  const seen = new Set();
  const deduped = [];

  for (const rawUser of Array.isArray(users) ? users : []) {
    const user = normalizePublicAllowedUser(rawUser);
    const keys = getPublicUserIdentityKeys(user);
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

export function findPublicAllowedUser(value, allowedUsers = DEFAULT_PUBLIC_USERS) {
  const needle = normalizePublicUsername(value);
  if (!needle) {
    return null;
  }

  return (
    allowedUsers.find((user) => normalizePublicUsername(user.id) === needle) ||
    allowedUsers.find((user) => normalizePublicUsername(user.auth_user_id) === needle) ||
    allowedUsers.find((user) => normalizePublicUsername(user.username) === needle) ||
    allowedUsers.find((user) => normalizePublicUsername(user.displayName) === needle) ||
    allowedUsers.find((user) => normalizePublicUsername(user.name) === needle) ||
    allowedUsers.find((user) => normalizePublicUsername(user.email) === needle) ||
    null
  );
}

export function resolvePublicUserAvatar(value, allowedUsers = DEFAULT_PUBLIC_USERS) {
  return findPublicAllowedUser(value, allowedUsers)?.avatar_url || '';
}

export function resolvePublicUserDisplayName(value, allowedUsers = DEFAULT_PUBLIC_USERS) {
  return getPublicUserDisplayLabel(findPublicAllowedUser(value, allowedUsers));
}

export function resolvePublicPresenceLabel(user, nowTick = Date.now(), staleMs = PUBLIC_PRESENCE_STALE_MS, currentUsername = '') {
  const lastOnlineAt = String(user?.last_online_at || '').trim();
  const username = normalizePublicUsername(user?.username);
  const current = normalizePublicUsername(currentUsername);

  if (current && username && username === current) {
    return 'online';
  }

  if (!lastOnlineAt) {
    return 'offline';
  }

  const lastOnlineTime = new Date(lastOnlineAt).getTime();
  if (!Number.isFinite(lastOnlineTime)) {
    return 'offline';
  }

  return nowTick - lastOnlineTime <= staleMs ? 'online' : 'offline';
}

export function publicUsernameToEmail(username, allowedUsers = DEFAULT_PUBLIC_USERS) {
  return findPublicAllowedUser(username, allowedUsers)?.email || null;
}

export function resolvePublicUserMatchFilter(user) {
  if (!user) {
    return null;
  }

  const id = String(user.id || '').trim();
  const authUserId = String(user.auth_user_id || user.authUserId || '').trim();
  const email = String(user.email || '').trim();
  const username = String(user.username || '').trim();

  if (id) {
    return { column: 'id', value: id };
  }

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

export function getPublicUserMatchCandidates(user) {
  const candidates = [];
  const id = String(user?.id || '').trim();
  const authUserId = String(user?.auth_user_id || user?.authUserId || '').trim();
  const email = String(user?.email || '').trim();
  const username = String(user?.username || '').trim();

  if (id) {
    candidates.push({ column: 'id', value: id });
  }

  if (authUserId) {
    candidates.push({ column: 'auth_user_id', value: authUserId });
  }

  if (email) {
    candidates.push({ column: 'email', value: email });
  }

  if (username) {
    candidates.push({ column: 'username', value: username });
  }

  return candidates;
}

export async function updatePublicAllowedUserRow(user, payload, selectFields = '*') {
  if (!publicChatSupabase) {
    throw new Error('Public Supabase is niet verbonden.');
  }

  const message = (error) => String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  const isMissingEmailMfaColumn = (error) =>
    message(error).includes("could not find the 'email_mfa_enabled' column of 'allowed_users' in the schema cache")
    || message(error).includes('column "email_mfa_enabled" does not exist')
    || message(error).includes('column "email_mfa_enabled" of relation "allowed_users" does not exist')
    || message(error).includes('schema cache');

  const isMissingGenderColumn = (error) =>
    message(error).includes("could not find the 'gender' column of 'allowed_users' in the schema cache")
    || message(error).includes('column "gender" does not exist')
    || message(error).includes('column "gender" of relation "allowed_users" does not exist')
    || message(error).includes('schema cache');

  let lastError = null;
  const candidates = getPublicUserMatchCandidates(user);

  for (const candidate of candidates) {
    const doUpdate = async (nextPayload, nextSelectFields) =>
      publicChatSupabase
        .from('allowed_users')
        .update(nextPayload)
        .eq(candidate.column, candidate.value)
        .select(nextSelectFields)
        .maybeSingle();

    let result = await doUpdate(payload, selectFields);

    if (result.error && Object.prototype.hasOwnProperty.call(payload || {}, 'email_mfa_enabled') && isMissingEmailMfaColumn(result.error)) {
      const { email_mfa_enabled, ...safePayload } = payload || {};
      const safeSelectFields = String(selectFields || '')
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean)
        .filter((field) => field !== 'email_mfa_enabled')
        .join(', ') || '*';

      result = await doUpdate(safePayload, safeSelectFields);
    }

    if (result.error && Object.prototype.hasOwnProperty.call(payload || {}, 'stay_logged_in') && isMissingStayLoggedInColumn(result.error)) {
      const { stay_logged_in, ...safePayload } = payload || {};
      const safeSelectFields = String(selectFields || '')
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean)
        .filter((field) => field !== 'stay_logged_in')
        .join(', ') || '*';

      result = await doUpdate(safePayload, safeSelectFields);
    }

    if (result.error && Object.prototype.hasOwnProperty.call(payload || {}, 'gender') && isMissingGenderColumn(result.error)) {
      const { gender, ...safePayload } = payload || {};
      const safeSelectFields = String(selectFields || '')
        .split(',')
        .map((field) => field.trim())
        .filter(Boolean)
        .filter((field) => field !== 'gender')
        .join(', ') || '*';

      result = await doUpdate(safePayload, safeSelectFields);
    }

    const { data, error } = result;

    if (error) {
      lastError = error;
      continue;
    }

    if (data) {
      return data;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export function resolvePublicUserFromSession(session, allowedUsers = DEFAULT_PUBLIC_USERS) {
  const metadata = session?.user?.user_metadata || {};
  const userId = String(session?.user?.id || '').trim();
  const email = String(session?.user?.email || metadata.email || '').trim();
  const identity = String(
    metadata.username ||
      metadata.display_name ||
      metadata.displayName ||
      metadata.name ||
      metadata.user_name ||
      ''
  ).trim();

  const foundById = userId ? findPublicAllowedUser(userId, allowedUsers) : null;
  const foundByAuthUserId = metadata.auth_user_id ? findPublicAllowedUser(metadata.auth_user_id, allowedUsers) : null;
  const foundByEmail = email ? findPublicAllowedUser(email, allowedUsers) : null;
  const foundByIdentity = identity ? findPublicAllowedUser(identity, allowedUsers) : null;

  const found = foundById || foundByAuthUserId || foundByEmail || foundByIdentity;
  if (found) {
    const normalized = normalizePublicAllowedUser(found);
    if (normalizePublicUsername(userId) === normalizePublicUsername(MATTIZ_PUBLIC_UID)) {
      return {
        ...normalized,
        id: MATTIZ_PUBLIC_UID,
        auth_user_id: MATTIZ_PUBLIC_UID,
        username: normalized.username || 'Mattiz',
        displayName: 'Mattiz',
        name: 'Mattiz',
        email: normalized.email || email || 'mattizhoornaert@hotmail.com'
      };
    }

    return normalized;
  }

  if (!email && !identity) {
    return null;
  }

  return normalizePublicAllowedUser({
    id: userId,
    auth_user_id: userId,
    username: identity || 'Bezoeker',
    display_name: metadata.display_name || identity || 'Bezoeker',
    email,
    birth_date: metadata.birth_date || metadata.birthDate || '',
    accent: metadata.accent || '#72d4ff',
    avatar_url: metadata.avatar_url || metadata.avatarUrl || '',
    updated_at: session?.user?.updated_at || '',
    last_online_at: '',
    bio: metadata.bio || '',
    status_message: metadata.status_message || metadata.statusMessage || '',
    theme_mode: metadata.theme_mode || metadata.themeMode || 'system',
    gender: metadata.gender || 'zeg ik liever niet',
    stay_logged_in: true
  });
}

export async function loadPublicAllowedUsers() {
  if (!publicChatSupabase) {
    return [];
  }

  const selectAllowedUsers = async (fields) =>
    publicChatSupabase.from('allowed_users').select(fields).order('display_name', { ascending: true });

  const withIdResult = await selectAllowedUsers('auth_user_id, username, email, display_name, birth_date, email_mfa_enabled, stay_logged_in, accent, avatar_url, updated_at, last_online_at, bio, status_message, theme_mode, gender');

  let { data, error } = withIdResult;

  if (error) {
    const fallbackResult = await selectAllowedUsers('username, email, display_name, birth_date, avatar_url, updated_at, last_online_at, bio, status_message, gender');
    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    const minimalResult = await selectAllowedUsers('username, email, display_name, birth_date');
    data = minimalResult.data;
    error = minimalResult.error;
  }

  if (error || !Array.isArray(data) || !data.length) {
    return [];
  }

  return dedupePublicAllowedUsers(data);
}

export async function ensurePublicAllowedUserRow() {
  if (!publicChatSupabase) {
    return null;
  }

  const { data, error } = await publicChatSupabase.rpc('ensure_public_allowed_user');

  if (error) {
    throw error;
  }

  return data || null;
}

export async function savePublicAllowedUserProfileRow(user, payload) {
  if (!publicChatSupabase) {
    throw new Error('Public Supabase is niet verbonden.');
  }

  const matchFilter = getPublicUserUpdateFilter(user);

  if (!matchFilter) {
    throw new Error('Geen geldige public gebruiker gevonden om op te slaan.');
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
    gender: String(payload?.gender || user?.gender || '').trim() || 'zeg ik liever niet',
    accent: String(payload?.accent || user?.accent || '#72d4ff').trim() || '#72d4ff',
    birth_date: String(payload?.birth_date || user?.birth_date || '').trim(),
    email: String(payload?.email || user?.email || '').trim(),
    updated_at: String(payload?.updated_at || new Date().toISOString()).trim()
  };

  const rpcResult = await publicChatSupabase.rpc('save_current_allowed_user_profile', { p_payload: nextPayload });

  if (!rpcResult.error && rpcResult.data) {
    return normalizePublicAllowedUser(rpcResult.data);
  }

  const { data, error } = await publicChatSupabase
    .from('allowed_users')
    .update(nextPayload)
    .eq(matchFilter.column, matchFilter.value)
    .select('auth_user_id, username, email, display_name, birth_date, email_mfa_enabled, stay_logged_in, accent, avatar_url, updated_at, last_online_at, bio, status_message, theme_mode, gender')
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizePublicAllowedUser(data) : null;
}
