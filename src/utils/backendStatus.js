import { useEffect, useState } from 'react';

const DEFAULT_READY_TEXT = 'Alles bijgewerkt';

const statusStore = {
  internal: { text: DEFAULT_READY_TEXT },
  public: { text: DEFAULT_READY_TEXT }
};

const listeners = {
  internal: new Set(),
  public: new Set()
};

const inflightWakeups = new Map();

function emit(scope) {
  const nextText = statusStore[scope]?.text || DEFAULT_READY_TEXT;
  listeners[scope]?.forEach((listener) => listener(nextText));
}

function setBackendStatus(scope, text) {
  if (!statusStore[scope]) {
    return;
  }

  statusStore[scope].text = text || DEFAULT_READY_TEXT;
  emit(scope);
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function getBackendStatusText(scope, fallbackText = DEFAULT_READY_TEXT) {
  return statusStore[scope]?.text || fallbackText;
}

export function subscribeBackendStatus(scope, listener) {
  if (!listeners[scope]) {
    return () => {};
  }

  listeners[scope].add(listener);
  return () => listeners[scope].delete(listener);
}

export function useBackendStatus(scope, fallbackText = DEFAULT_READY_TEXT) {
  const [text, setText] = useState(() => getBackendStatusText(scope, fallbackText));

  useEffect(() => {
    setText(getBackendStatusText(scope, fallbackText));
    return subscribeBackendStatus(scope, setText);
  }, [scope, fallbackText]);

  return text;
}

export function isWakeableBackendError(error) {
  const message = String(error?.message || error?.details || error?.hint || error || '').toLowerCase();
  return [
    'failed to fetch',
    'fetch failed',
    'network',
    'timeout',
    'timed out',
    'load failed',
    '503',
    '502',
    'gateway',
    'temporarily unavailable',
    'connection'
  ].some((fragment) => message.includes(fragment));
}

async function probeMessagesTable(client) {
  const { error } = await client.from('messages').select('id').limit(1);
  if (error) {
    throw error;
  }
}

export async function wakeBackendScope(scope, client, options = {}) {
  if (!scope || !client) {
    return true;
  }

  if (inflightWakeups.has(scope)) {
    return inflightWakeups.get(scope);
  }

  const {
    probe = probeMessagesTable,
    readyText = DEFAULT_READY_TEXT
  } = options;

  const run = (async () => {
    try {
      setBackendStatus(scope, 'Serverstatus controleren...');
      await probe(client);
      setBackendStatus(scope, readyText);
      return true;
    } catch (error) {
      if (!isWakeableBackendError(error)) {
        setBackendStatus(scope, 'Server tijdelijk onbereikbaar');
        return false;
      }

      setBackendStatus(scope, 'Server wordt gewekt...');

      for (const waitMs of [2000, 4500, 8000]) {
        await delay(waitMs);

        try {
          await probe(client);
          setBackendStatus(scope, readyText);
          return true;
        } catch (retryError) {
          if (!isWakeableBackendError(retryError)) {
            setBackendStatus(scope, 'Server tijdelijk onbereikbaar');
            return false;
          }
        }
      }

      setBackendStatus(scope, 'Server tijdelijk traag');
      return false;
    } finally {
      inflightWakeups.delete(scope);
    }
  })();

  inflightWakeups.set(scope, run);
  return run;
}
