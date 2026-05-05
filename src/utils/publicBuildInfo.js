import { getAppVersion } from './yowl';
import { publicChatSupabase } from './supabase';

let buildState = {
  status: 'idle',
  buildNumber: '',
  publishedAt: '',
  updatedAt: '',
  message: ''
};

const listeners = new Set();
let buildSubscription = null;
let buildTableMissing = false;
let localBuildNumberPromise = null;

function emitBuildState() {
  for (const callback of listeners) {
    try {
      callback(buildState);
    } catch {
      // Ignore broken subscribers so one listener does not block the rest.
    }
  }
}

function setBuildState(patch) {
  buildState = { ...buildState, ...patch };
  emitBuildState();
  return buildState;
}

function isMissingBuildTableError(error) {
  const message = String(error?.message || error?.error_description || error?.details || '').toLowerCase();
  return (
    message.includes("could not find the table 'public.app_build_state' in the schema cache") ||
    message.includes('schema cache') ||
    message.includes('relation "public.app_build_state" does not exist') ||
    message.includes('table "app_build_state" does not exist') ||
    message.includes('could not find relation')
  );
}

async function getFallbackBuildNumber() {
  if (!localBuildNumberPromise) {
    localBuildNumberPromise = getAppVersion().catch(() => 'dev');
  }

  return localBuildNumberPromise;
}

function normalizeBuildState(row = null, fallbackBuildNumber = 'dev') {
  const buildNumber = String(row?.build_number || fallbackBuildNumber || 'dev').trim();
  const publishedAt = String(row?.published_at || row?.created_at || '').trim();
  const updatedAt = String(row?.updated_at || row?.published_at || row?.created_at || '').trim();

  return setBuildState({
    status: buildNumber ? 'available' : 'idle',
    buildNumber,
    publishedAt,
    updatedAt,
    message: ''
  });
}

async function ensureBuildSubscription() {
  if (!publicChatSupabase || buildSubscription || buildTableMissing) {
    return;
  }

  buildSubscription = publicChatSupabase
    .channel('public-app-build-state-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_build_state' }, () => {
      void refreshBuildState().catch((error) => {
        setBuildState({
          status: 'idle',
          message: error instanceof Error ? error.message : ''
        });
      });
    })
    .subscribe();
}

async function refreshBuildState() {
  const fallbackBuildNumber = await getFallbackBuildNumber();

  if (!publicChatSupabase) {
    return setBuildState({
      status: 'fallback',
      buildNumber: fallbackBuildNumber,
      publishedAt: '',
      updatedAt: '',
      message: ''
    });
  }

  const { data, error } = await publicChatSupabase
    .from('app_build_state')
    .select('id, build_number, published_at, created_at, updated_at')
    .eq('id', 'current')
    .maybeSingle();

  if (error) {
    if (isMissingBuildTableError(error)) {
      buildTableMissing = true;
      return setBuildState({
        status: 'fallback',
        buildNumber: fallbackBuildNumber,
        publishedAt: '',
        updatedAt: '',
        message: ''
      });
    }

    throw new Error(error.message || 'Buildnummer ophalen mislukt.');
  }

  buildTableMissing = false;

  if (!data) {
    await ensureBuildSubscription();
    return setBuildState({
      status: 'fallback',
      buildNumber: fallbackBuildNumber,
      publishedAt: '',
      updatedAt: '',
      message: ''
    });
  }

  const normalized = normalizeBuildState(data, fallbackBuildNumber);
  await ensureBuildSubscription();
  return normalized;
}

export async function getPublicBuildState() {
  if (buildState.status !== 'idle') {
    return buildState;
  }

  try {
    return await refreshBuildState();
  } catch (error) {
    const fallbackBuildNumber = await getFallbackBuildNumber();
    return setBuildState({
      status: 'fallback',
      buildNumber: fallbackBuildNumber,
      publishedAt: '',
      updatedAt: '',
      message: error instanceof Error ? error.message : ''
    });
  }
}

export function subscribeToPublicBuildState(callback) {
  if (typeof callback !== 'function') {
    return () => {};
  }

  listeners.add(callback);
  callback(buildState);

  return () => {
    listeners.delete(callback);
  };
}
