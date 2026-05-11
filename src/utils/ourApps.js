function normalizeText(value, fallback = '') {
  return String(value || '').trim() || fallback;
}

export function normalizeOurAppUrl(value = '') {
  const nextValue = String(value || '').trim();

  if (!nextValue) {
    return '';
  }

  if (/^https?:\/\//i.test(nextValue)) {
    return nextValue;
  }

  return `https://${nextValue.replace(/^\/+/, '')}`;
}

export function normalizeOurApp(record = {}) {
  return {
    id: normalizeText(record.id),
    name: normalizeText(record.name, 'YOWLMAFFIA app'),
    description: normalizeText(record.description),
    url: normalizeOurAppUrl(record.url),
    sortOrder: Number(record.sort_order ?? record.sortOrder ?? 0),
    createdAt: record.created_at || record.createdAt || '',
    updatedAt: record.updated_at || record.updatedAt || record.created_at || record.createdAt || ''
  };
}

export function normalizeOurAppPayload(app = {}, fallbackSortOrder = 0) {
  return {
    id: normalizeText(app.id) || undefined,
    name: normalizeText(app.name, 'YOWLMAFFIA app'),
    description: normalizeText(app.description),
    url: normalizeOurAppUrl(app.url),
    sort_order: Number(app.sortOrder ?? app.sort_order ?? fallbackSortOrder ?? 0),
    updated_at: new Date().toISOString()
  };
}

export async function loadOurApps(supabase) {
  if (!supabase) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('app_our_apps')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((item) => normalizeOurApp(item));
  } catch (error) {
    console.error(error);
    return [];
  }
}
