import { Check, RefreshCw, Save, Sparkles, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import MusicReleaseCard from '../components/MusicReleaseCard';
import PublicShell from '../components/PublicShell';
import RichTextContent from '../components/RichTextContent';
import { formatRelativeTime } from '../utils/dates';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import {
  canManagePublicAlerts,
  isMattizPublicUser,
  loadPublicAllowedUsers,
  resolvePublicUserFromSession
} from '../utils/publicUsers';
import {
  createDefaultSocialLinks,
  getSocialPlatformMeta,
  loadSocialLinks,
  normalizeSocialLinkPayload
} from '../utils/socialLinks';
import {
  loadOurApps,
  normalizeOurApp,
  normalizeOurAppPayload
} from '../utils/ourApps';
import {
  createSpotifySearchUrl,
  loadMusicReleases as loadMusicReleasesFromDatabase,
  normalizeMusicRelease
} from '../utils/musicReleases';
import SocialPlatformIcon from '../components/SocialPlatformIcon';

function blankInfo(title, body) {
  return {
    title,
    body,
    textColor: ''
  };
}

function slugifyStorageSegment(value, fallback = 'release') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || fallback;
}

export default function PublicManagePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingPage, setLoadingPage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [buildNumber, setBuildNumber] = useState('');
  const [buildState, setBuildState] = useState(null);
  const [buildBusy, setBuildBusy] = useState(false);
  const [buildMessage, setBuildMessage] = useState('');
  const [infoCurrent, setInfoCurrent] = useState(blankInfo('YOWLMAFFIA', 'Welkom op de publieke dashboardpagina.'));
  const [infoRules, setInfoRules] = useState(blankInfo('Regels', 'Wees vriendelijk, respectvol en hou het proper.'));
  const [updateVersion, setUpdateVersion] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateDownloadUrl, setUpdateDownloadUrl] = useState('');
  const [updateRequired, setUpdateRequired] = useState(false);
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [musicTitle, setMusicTitle] = useState('');
  const [musicArtistName, setMusicArtistName] = useState('YOWLMAFFIA');
  const [musicSpotifyUrl, setMusicSpotifyUrl] = useState('');
  const [musicCoverFile, setMusicCoverFile] = useState(null);
  const [musicCoverPreview, setMusicCoverPreview] = useState('');
  const [musicReleases, setMusicReleases] = useState([]);
  const [socialLinks, setSocialLinks] = useState(createDefaultSocialLinks());
  const [ourApps, setOurApps] = useState([]);
  const [ourAppName, setOurAppName] = useState('');
  const [ourAppDescription, setOurAppDescription] = useState('');
  const [ourAppUrl, setOurAppUrl] = useState('');
  const [alertBody, setAlertBody] = useState('');
  const [warningRecipientEmail, setWarningRecipientEmail] = useState('');
  const [warningBody, setWarningBody] = useState('');
  const [warningLog, setWarningLog] = useState([]);

  const isMattiz = isMattizPublicUser(currentUser);
  const canSendAlerts = canManagePublicAlerts(currentUser);
  const alertOnlyManager = canSendAlerts && !isMattiz;
  const warningRecipients = useMemo(
    () => allowedUsers.filter((user) => String(user?.email || '').trim() && String(user?.email || '').trim() !== String(currentUser?.email || '').trim()),
    [allowedUsers, currentUser?.email]
  );
  const groupedWarningLog = useMemo(() => {
    const groups = new Map();

    for (const entry of warningLog) {
      const key = String(entry?.recipient_email || entry?.recipient_username || 'onbekend').trim().toLowerCase();
      const label = entry?.recipient_username || entry?.recipient_email || 'Onbekende gebruiker';

      if (!groups.has(key)) {
        groups.set(key, { key, label, items: [] });
      }

      groups.get(key).items.push(entry);
    }

    return Array.from(groups.values());
  }, [warningLog]);

  useEffect(() => {
    if (!warningRecipients.length) {
      setWarningRecipientEmail('');
      return;
    }

    if (!warningRecipientEmail || !warningRecipients.some((user) => user.email === warningRecipientEmail)) {
      setWarningRecipientEmail(warningRecipients[0].email);
    }
  }, [warningRecipientEmail, warningRecipients]);

  function normalizeBuildState(row = null) {
    return {
      buildNumber: String(row?.build_number || '').trim(),
      publishedAt: String(row?.published_at || row?.created_at || '').trim(),
      updatedAt: String(row?.updated_at || row?.published_at || row?.created_at || '').trim()
    };
  }

  useEffect(() => {
    if (!publicChatSupabase) {
      setLoadingAuth(false);
      return undefined;
    }

    let cancelled = false;

    async function bootstrapAuth() {
      const [{ data: sessionData }, users] = await Promise.all([
        publicChatSupabase.auth.getSession(),
        loadPublicAllowedUsers().catch(() => [])
      ]);

      if (cancelled) {
        return;
      }

      const initialSession = sessionData.session || null;
      const nextUsers = Array.isArray(users) ? users : [];
      const resolvedUser = resolvePublicUserFromSession(initialSession, nextUsers);

      if (initialSession && resolvedUser && resolvedUser.stay_logged_in === false) {
        await publicChatSupabase.auth.signOut();
        if (cancelled) {
          return;
        }

        setSession(null);
        setAllowedUsers(nextUsers);
        setLoadingAuth(false);
        return;
      }

      setSession(initialSession);
      setAllowedUsers(nextUsers);
      setLoadingAuth(false);
    }

    bootstrapAuth();

    const {
      data: { subscription }
    } = publicChatSupabase.auth.onAuthStateChange((_, nextSession) => {
      if (!cancelled) {
        setSession(nextSession || null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setCurrentUser(resolvePublicUserFromSession(session, allowedUsers));
  }, [session, allowedUsers]);

  useEffect(() => {
    if (!musicCoverFile) {
      setMusicCoverPreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(musicCoverFile);
    setMusicCoverPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [musicCoverFile]);

  useEffect(() => {
    if (!currentUser || (!isMattiz && !canSendAlerts) || !isPublicChatSupabaseConfigured || !publicChatSupabase) {
      setLoadingPage(false);
      return undefined;
    }

    let cancelled = false;

    async function bootstrapManage() {
      setLoadingPage(true);

      const [buildResult, infoResult, rulesResult, musicResult, socialResult, ourAppsResult, updateResult, warningResult] = await Promise.all([
        publicChatSupabase.from('app_build_state').select('build_number, published_at, created_at, updated_at').eq('id', 'current').maybeSingle(),
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'current').maybeSingle(),
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'rules').maybeSingle(),
        loadMusicReleasesFromDatabase(publicChatSupabase).catch(() => []),
        loadSocialLinks(publicChatSupabase).catch(() => createDefaultSocialLinks()),
        loadOurApps(publicChatSupabase).catch(() => []),
        publicChatSupabase
          .from('app_update_releases')
          .select('version, download_url, notes, is_required, published_at, created_at')
          .order('published_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1),
        publicChatSupabase
          .from('notifications')
          .select('id, recipient_email, recipient_username, actor_username, title, body, metadata, is_read, created_at, read_at')
          .eq('kind', 'targeted_warning')
          .order('created_at', { ascending: false })
          .limit(30)
      ]);

      if (cancelled) {
        return;
      }

      if (buildResult?.data) {
        const nextBuildState = normalizeBuildState(buildResult.data);
        setBuildState(nextBuildState);
        setBuildNumber(nextBuildState.buildNumber);
      }

      if (infoResult?.data) {
        setInfoCurrent(
          {
            title: String(infoResult.data.title || 'YOWLMAFFIA').trim() || 'YOWLMAFFIA',
            body: String(infoResult.data.body || '').trim() || 'Welkom op de publieke dashboardpagina.',
            textColor: String(infoResult.data.text_color || '').trim()
          }
        );
      }

      if (rulesResult?.data) {
        setInfoRules(
          {
            title: String(rulesResult.data.title || 'Regels').trim() || 'Regels',
            body: String(rulesResult.data.body || '').trim() || 'Wees vriendelijk, respectvol en hou het proper.',
            textColor: String(rulesResult.data.text_color || '').trim()
          }
        );
      }

      setMusicReleases(Array.isArray(musicResult) ? musicResult.map(normalizeMusicRelease) : []);
      setSocialLinks(Array.isArray(socialResult) && socialResult.length ? socialResult : createDefaultSocialLinks());
      setOurApps(Array.isArray(ourAppsResult) ? ourAppsResult.map(normalizeOurApp) : []);
      setLatestUpdate(Array.isArray(updateResult?.data) ? updateResult.data[0] || null : null);
      setWarningLog(Array.isArray(warningResult?.data) ? warningResult.data : []);
      setLoadingPage(false);
    }

    bootstrapManage();

    const infoChannel = publicChatSupabase
      .channel('public-manage-info-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_info_blocks' }, bootstrapManage)
      .subscribe();

    const buildChannel = publicChatSupabase
      .channel('public-manage-build-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_build_state' }, bootstrapManage)
      .subscribe();

    const updateChannel = publicChatSupabase
      .channel('public-manage-updates-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_update_releases' }, bootstrapManage)
      .subscribe();

    const musicChannel = publicChatSupabase
      .channel('public-manage-music-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_releases' }, bootstrapManage)
      .subscribe();

    const socialChannel = publicChatSupabase
      .channel('public-manage-social-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_social_links' }, bootstrapManage)
      .subscribe();

    const ourAppsChannel = publicChatSupabase
      .channel('public-manage-our-apps-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_our_apps' }, bootstrapManage)
      .subscribe();

    const warningChannel = publicChatSupabase
      .channel('public-manage-warning-log-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, bootstrapManage)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(infoChannel);
      publicChatSupabase.removeChannel(buildChannel);
      publicChatSupabase.removeChannel(updateChannel);
      publicChatSupabase.removeChannel(musicChannel);
      publicChatSupabase.removeChannel(socialChannel);
      publicChatSupabase.removeChannel(ourAppsChannel);
      publicChatSupabase.removeChannel(warningChannel);
    };
  }, [currentUser, isMattiz, canSendAlerts]);

  const statusText = useMemo(() => (latestUpdate ? 'Nieuwe update beschikbaar' : 'Alles bijgewerkt'), [latestUpdate]);

  async function handleSignOut() {
    if (!publicChatSupabase) {
      navigate('/');
      return;
    }

    await publicChatSupabase.auth.signOut();
    navigate('/');
  }

  async function handleSaveInfo(event) {
    event.preventDefault();

    if (!publicChatSupabase || !isMattiz) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const nextUpdatedAt = new Date().toISOString();

      const payloads = [
        {
          id: 'current',
          title: infoCurrent.title.trim() || 'YOWLMAFFIA',
          body: infoCurrent.body.trim() || 'Welkom op de publieke dashboardpagina.',
          text_color: String(infoCurrent.textColor || '').trim(),
          updated_at: nextUpdatedAt
        },
        {
          id: 'rules',
          title: infoRules.title.trim() || 'Regels',
          body: infoRules.body.trim() || 'Wees vriendelijk, respectvol en hou het proper.',
          text_color: String(infoRules.textColor || '').trim(),
          updated_at: nextUpdatedAt
        }
      ];

      const results = await Promise.all(
        payloads.map((payload) => publicChatSupabase.from('app_info_blocks').upsert(payload, { onConflict: 'id' }))
      );

      const firstError = results.find((result) => result.error)?.error || null;
      if (firstError) {
        throw firstError;
      }

      setMessage('Publieke info opgeslagen.');
    } catch (saveError) {
      setError(saveError?.message || 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveBuild(event) {
    event.preventDefault();

    if (!publicChatSupabase || !isMattiz) {
      return;
    }

    setBuildBusy(true);
    setBuildMessage('');
    setError('');

    try {
      const nextBuildNumber = String(buildNumber || '').trim();
      if (!nextBuildNumber) {
        throw new Error('Vul een buildnummer in.');
      }

      const now = new Date().toISOString();
      const { error: saveError } = await publicChatSupabase.from('app_build_state').upsert(
        {
          id: 'current',
          build_number: nextBuildNumber,
          published_at: now,
          updated_at: now
        },
        { onConflict: 'id' }
      );

      if (saveError) {
        throw saveError;
      }

      setBuildState({
        buildNumber: nextBuildNumber,
        publishedAt: now,
        updatedAt: now
      });
      setBuildMessage('Buildnummer opgeslagen.');
    } catch (buildError) {
      setBuildMessage('');
      setError(buildError?.message || 'Buildnummer opslaan mislukt.');
    } finally {
      setBuildBusy(false);
    }
  }

  async function handlePublishUpdate(event) {
    event.preventDefault();

    if (!publicChatSupabase || !isMattiz) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      if (!updateVersion.trim()) {
        throw new Error('Vul een versienummer in.');
      }

      const now = new Date().toISOString();
      const { error: insertError } = await publicChatSupabase.from('app_update_releases').insert({
        version: updateVersion.trim(),
        notes: updateNotes.trim(),
        download_url: updateDownloadUrl.trim(),
        is_required: Boolean(updateRequired),
        published_at: now,
        created_at: now
      });

      if (insertError) {
        throw insertError;
      }

      setUpdateVersion('');
      setUpdateNotes('');
      setUpdateDownloadUrl('');
      setUpdateRequired(false);
      setMessage('Nieuwe update gepubliceerd.');
    } catch (publishError) {
      setError(publishError?.message || 'Update publiceren mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWarningEntry(entryId) {
    if (!publicChatSupabase || !canSendAlerts || !entryId) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const { error: deleteError } = await publicChatSupabase
        .from('notifications')
        .delete()
        .eq('id', entryId)
        .eq('kind', 'targeted_warning');

      if (deleteError) {
        throw deleteError;
      }

      setWarningLog((previous) => previous.filter((entry) => entry.id !== entryId));
      setMessage('Warning verwijderd uit het logboek.');
    } catch (deleteError) {
      setError(deleteError?.message || 'Warning verwijderen mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveMusicRelease(event) {
    event.preventDefault();

    if (!publicChatSupabase || !isMattiz) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
        if (!musicTitle.trim()) {
          throw new Error('Geef een titel op.');
        }

        let coverUrl = '';
        let coverStoragePath = '';

      if (musicCoverFile) {
        const titleSegment = slugifyStorageSegment(musicTitle, 'release');
        const artistSegment = slugifyStorageSegment(musicArtistName, 'artist');
        const extensionSource = String(musicCoverFile.name || '').trim();
        const nextExtension = (extensionSource.includes('.') ? extensionSource.split('.').pop() : musicCoverFile.type.split('/').pop()) || 'png';
        const safeExtension = String(nextExtension || 'png')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') || 'png';
        const uploadPath = `releases/${titleSegment}-${artistSegment}-${Date.now()}.${safeExtension}`;

        const { error: uploadError } = await publicChatSupabase.storage.from('covers').upload(uploadPath, musicCoverFile, {
          upsert: true,
          contentType: musicCoverFile.type || 'image/png'
        });

        if (uploadError) {
          throw uploadError;
        }

          coverStoragePath = uploadPath;
          coverUrl = publicChatSupabase.storage.from('covers').getPublicUrl(uploadPath).data.publicUrl;
        }

        const spotifyUrl = musicSpotifyUrl.trim() || createSpotifySearchUrl(musicTitle.trim(), musicArtistName.trim() || 'YOWLMAFFIA');
        const nextSortOrder = musicReleases.reduce((highest, item) => {
          const parsedSortOrder = Number.parseInt(String(item?.sortOrder ?? item?.sort_order ?? 0), 10);
          return Number.isFinite(parsedSortOrder) ? Math.max(highest, parsedSortOrder) : highest;
        }, -1) + 1;
        const { data: savedMusicRelease, error: insertError } = await publicChatSupabase.rpc('upsert_music_release', {
          p_id: null,
          p_title: musicTitle.trim(),
          p_artist_name: musicArtistName.trim() || 'YOWLMAFFIA',
          p_spotify_url: spotifyUrl,
          p_cover_url: coverUrl,
          p_cover_storage_path: coverStoragePath,
          p_sort_order: nextSortOrder
        });

        if (insertError) {
          throw insertError;
        }

        if (savedMusicRelease) {
          const normalizedRelease = normalizeMusicRelease(savedMusicRelease);
          setMusicReleases((previous) => {
            const nextReleases = [normalizedRelease, ...previous.filter((item) => item.id !== normalizedRelease.id)];
            return nextReleases.sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
          });
        }

      setMusicTitle('');
      setMusicArtistName('YOWLMAFFIA');
      setMusicSpotifyUrl('');
      setMusicCoverFile(null);
      setMessage('Spotify-banner toegevoegd.');
    } catch (musicError) {
      setError(musicError?.message || 'Banner toevoegen mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSocialLinks(event) {
    event.preventDefault();

    if (!publicChatSupabase) {
      setError('Public Supabase is niet gekoppeld.');
      return;
    }

    if (!isMattiz) {
      setError('Alleen Mattiz kan sociale links beheren.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = socialLinks.map((link, index) => normalizeSocialLinkPayload(link, index + 1));
      const { error: upsertError } = await publicChatSupabase.from('app_social_links').upsert(payload, { onConflict: 'platform' });

      if (upsertError) {
        throw upsertError;
      }

      setMessage('Social media links opgeslagen.');
    } catch (saveError) {
      setError(saveError.message || 'Social media links opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOurApp(event) {
    event.preventDefault();

    if (!publicChatSupabase) {
      setError('Public Supabase is niet gekoppeld.');
      return;
    }

    if (!isMattiz) {
      setError('Alleen Mattiz kan onze apps beheren.');
      return;
    }

    const nextName = String(ourAppName || '').trim();
    const nextUrl = String(ourAppUrl || '').trim();

    if (!nextName || !nextUrl) {
      setError('Vul minstens een naam en link in.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = normalizeOurAppPayload(
        {
          name: nextName,
          description: ourAppDescription,
          url: nextUrl,
          sortOrder: ourApps.length + 1
        },
        ourApps.length + 1
      );
      const { error: upsertError } = await publicChatSupabase.from('app_our_apps').insert(payload).select('*').single();

      if (upsertError) {
        throw upsertError;
      }

      setOurAppName('');
      setOurAppDescription('');
      setOurAppUrl('');
      setMessage('Nieuwe YOWLMAFFIA app-link opgeslagen.');
    } catch (saveError) {
      setError(saveError?.message || 'App-link opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteOurApp(appId) {
    if (!publicChatSupabase || !isMattiz || !appId) {
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const { error: deleteError } = await publicChatSupabase.from('app_our_apps').delete().eq('id', appId);

      if (deleteError) {
        throw deleteError;
      }

      setOurApps((previous) => previous.filter((item) => item.id !== appId));
      setMessage('App-link verwijderd.');
    } catch (deleteError) {
      setError(deleteError?.message || 'App-link verwijderen mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMusicRelease(release) {
    if (!publicChatSupabase || !isMattiz || !release?.id) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

      try {
        const { error: deleteError } = await publicChatSupabase.rpc('delete_music_release', { p_id: release.id });
        if (deleteError) {
          throw deleteError;
        }

      const coverPath = String(release.coverStoragePath || '').trim();
      if (coverPath) {
        try {
          await publicChatSupabase.storage.from('covers').remove([coverPath]);
        } catch {
          // Leave the banner removal successful even if storage cleanup fails.
        }
      }

      setMusicReleases((previous) => previous.filter((item) => item.id !== release.id));
      setMessage(`Banner "${release.title}" verwijderd.`);
    } catch (deleteError) {
      setError(deleteError?.message || 'Verwijderen mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendStaffAlert(event) {
    event.preventDefault();

    if (!publicChatSupabase || !canSendAlerts || !currentUser) {
      return;
    }

    const nextAlertBody = String(alertBody || '').trim();
    if (!nextAlertBody) {
      setError('Typ eerst een alertbericht.');
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const ownerUsername =
        String(currentUser.username || currentUser.displayName || currentUser.name || currentUser.email || '').trim() || 'staff';

      const payload = {
        scope: 'public',
        room_key: 'public',
        sender: 'YOWLMAFFIA',
        recipient: ownerUsername,
        body: nextAlertBody,
        attachment_url: null,
        attachment_type: 'application/x-yowlmaffia-alert',
        reply_to_message_id: null,
        reply_to_sender: null,
        reply_to_body: null,
        reply_to_created_at: null
      };

      const { error: insertError } = await publicChatSupabase.from('messages').insert(payload);
      if (insertError) {
        throw insertError;
      }

      setAlertBody('');
      setMessage('Staff alert verzonden als YOWLMAFFIA.');
    } catch (alertError) {
      setError(alertError?.message || 'Alert versturen mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSendTargetedWarning(event) {
    event.preventDefault();

    if (!publicChatSupabase || !canSendAlerts || !currentUser) {
      return;
    }

    const recipient = warningRecipients.find((user) => user.email === warningRecipientEmail);
    const nextWarningBody = String(warningBody || '').trim();

    if (!recipient) {
      setError('Kies eerst een ontvanger voor de waarschuwing.');
      return;
    }

    if (!nextWarningBody) {
      setError('Typ eerst een waarschuwing.');
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      const { error: insertError } = await publicChatSupabase.from('notifications').insert({
        recipient_username: String(recipient.username || recipient.displayName || recipient.email || '').trim() || recipient.email,
        recipient_email: recipient.email,
        actor_username: 'YOWLMAFFIA',
        kind: 'targeted_warning',
        title: 'Waarschuwing van YOWLMAFFIA',
        body: nextWarningBody,
        link: '/public/chat',
        metadata: {
          style: 'staff_warning',
          sent_by_manager: String(currentUser.username || currentUser.displayName || currentUser.email || '').trim()
        }
      });

      if (insertError) {
        throw insertError;
      }

      setWarningBody('');
      setWarningLog((previous) => [
        {
          id: crypto.randomUUID?.() || `${Date.now()}`,
          recipient_email: recipient.email,
          recipient_username: String(recipient.username || recipient.displayName || recipient.email || '').trim() || recipient.email,
          actor_username: 'YOWLMAFFIA',
          title: 'Waarschuwing van YOWLMAFFIA',
          body: nextWarningBody,
          metadata: {
            style: 'staff_warning',
            sent_by_manager: String(currentUser.username || currentUser.displayName || currentUser.email || '').trim()
          },
          is_read: false,
          created_at: new Date().toISOString(),
          read_at: null
        },
        ...previous
      ].slice(0, 30));
      setMessage(`Waarschuwing verzonden naar ${recipient.displayName || recipient.username || recipient.email}.`);
    } catch (warningError) {
      setError(warningError?.message || 'Waarschuwing versturen mislukt.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingAuth) {
    return (
      <section className="public-page">
        <div className="public-page__shell">
          <div className="empty-state empty-state--compact">
            <strong>Beheer laden...</strong>
            <p>We openen de publieke beheeromgeving veilig.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (!isMattiz && !canSendAlerts) {
    return <Navigate to="/public/dashboard" replace />;
  }

  return (
    <PublicShell user={currentUser} onSignOut={handleSignOut} statusText={statusText}>
      <section className="public-manage">
        <header className="public-dashboard__hero panel">
          <div className="public-dashboard__hero-brand">
            <div>
              <span className="eyebrow">Beheren</span>
              <h1>Publieke content beheren</h1>
              <p>
                {isMattiz
                  ? 'Hier beheer je alleen de publieke kant: info, regels, updates, staff alerts, gerichte waarschuwingen en Spotify-banners.'
                  : 'Hier kan je alleen staff alerts en gerichte waarschuwingen sturen als YOWLMAFFIA.'}
              </p>
            </div>
          </div>

          <div className="public-dashboard__hero-actions">
            <button className="button button--secondary" type="button" onClick={() => setMessage('Alles blijft publiek en gescheiden van de interne app.')}>
              <Sparkles size={16} />
              Alleen publiek
            </button>
          </div>
        </header>

        <div className="public-manage__grid">
          {canSendAlerts ? (
            <form
              className={`panel public-manage__card public-manage__card--alert ${alertOnlyManager ? 'public-manage__card--alert-only' : ''}`.trim()}
              onSubmit={handleSendStaffAlert}
            >
              <div className="panel__header panel__header--compact">
                <span className="eyebrow">Staff alert</span>
                <h2>{alertOnlyManager ? 'Alert versturen als staff' : 'Rode melding als YOWLMAFFIA'}</h2>
              </div>

              <div className="public-manage__staff-banner">
                <div className="public-manage__staff-badge">YOWLMAFFIA STAFF</div>
                <p className="public-manage__staff-note">
                  {alertOnlyManager
                    ? 'Jij kan hier staff alerts en gerichte waarschuwingen sturen. De rest van de publieke beheeropties blijft verborgen.'
                    : 'Deze melding verschijnt opvallend rood in de public chat en wordt verzonden als YOWLMAFFIA.'}
                </p>
              </div>

              <label className="field">
                <span>Alertbericht</span>
                <textarea
                  className="lyrics-editor__textarea"
                  value={alertBody}
                  onChange={(event) => setAlertBody(event.target.value)}
                  placeholder="Typ hier een belangrijke staffmelding voor de public chat."
                />
                <small className="settings-menu__hint">
                  Gebruik dit alleen voor belangrijke staffmeldingen die meteen goed zichtbaar moeten zijn.
                </small>
              </label>

              <div className="public-manage__actions">
                <button className="button button--primary" type="submit" disabled={saving}>
                  <Save size={16} />
                  {saving ? 'Versturen...' : 'Alert versturen'}
                </button>
              </div>
            </form>
          ) : null}

          {canSendAlerts ? (
            <form
              className={`panel public-manage__card public-manage__card--warning ${alertOnlyManager ? 'public-manage__card--alert-only' : ''}`.trim()}
              onSubmit={handleSendTargetedWarning}
            >
              <div className="panel__header panel__header--compact">
                <span className="eyebrow">Gerichte waarschuwing</span>
                <h2>Waarschuwing voor één persoon</h2>
              </div>

              <div className="public-manage__staff-banner public-manage__staff-banner--warning">
                <div className="public-manage__staff-badge">YOWLMAFFIA WARNING</div>
                <p className="public-manage__staff-note">
                  Deze waarschuwing verschijnt full-screen bij de gekozen gebruiker en blijft duidelijk zichtbaar tot die persoon bevestigt.
                </p>
              </div>

              <label className="field">
                <span>Ontvanger</span>
                <select className="input" value={warningRecipientEmail} onChange={(event) => setWarningRecipientEmail(event.target.value)}>
                  {warningRecipients.map((user) => (
                    <option key={user.email} value={user.email}>
                      {user.displayName || user.username || user.email}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Waarschuwing</span>
                <textarea
                  className="lyrics-editor__textarea"
                  value={warningBody}
                  onChange={(event) => setWarningBody(event.target.value)}
                  placeholder="Typ hier de waarschuwing voor deze gebruiker."
                />
                <small className="settings-menu__hint">
                  Dit opent een grote wit-rode waarschuwing op het scherm van de gekozen gebruiker.
                </small>
              </label>

              <div className="public-manage__actions">
                <button className="button button--primary" type="submit" disabled={saving || !warningRecipients.length}>
                  <Save size={16} />
                  {saving ? 'Versturen...' : 'Waarschuwing sturen'}
                </button>
              </div>
            </form>
          ) : null}

          {canSendAlerts ? (
            <section className={`panel public-manage__card public-manage__card--warning-log ${alertOnlyManager ? 'public-manage__card--alert-only' : ''}`.trim()}>
              <div className="panel__header panel__header--compact">
                <span className="eyebrow">Warnings logboek</span>
                <h2>Bijgehouden waarschuwingen</h2>
              </div>

              {groupedWarningLog.length ? (
                <div className="public-manage__warning-log">
                  {groupedWarningLog.map((group) => (
                    <section key={group.key} className="public-manage__warning-group">
                      <div className="public-manage__warning-group-head">
                        <strong>{group.label}</strong>
                        <span>{group.items.length} waarschuwing{group.items.length === 1 ? '' : 'en'}</span>
                      </div>

                      {group.items.map((entry) => {
                        const sentBy = String(entry?.metadata?.sent_by_manager || '').trim();

                        return (
                          <article key={entry.id} className="public-manage__warning-log-item">
                            <div className="public-manage__warning-log-head">
                              <strong>{formatRelativeTime(entry.created_at)}</strong>
                              <button
                                className="button button--ghost button--compact"
                                type="button"
                                onClick={() => void handleDeleteWarningEntry(entry.id)}
                                disabled={saving}
                              >
                                <Trash2 size={15} />
                                Verwijder
                              </button>
                            </div>
                            <p>{entry.body || entry.title}</p>
                            <div className="public-manage__warning-log-meta">
                              <span>Verzonden als YOWLMAFFIA</span>
                              {sentBy ? <span>Door {sentBy}</span> : null}
                              <span>{entry.is_read ? 'Gelezen' : 'Nog niet gelezen'}</span>
                            </div>
                          </article>
                        );
                      })}
                    </section>
                  ))}
                </div>
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>Nog geen warnings</strong>
                  <p>Hier zie je straks alle gerichte waarschuwingen terug.</p>
                </div>
              )}
            </section>
          ) : null}

          {isMattiz ? (
          <>
          <form className="panel public-manage__card public-manage__card--build" onSubmit={handleSaveBuild}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Build</span>
              <h2>Buildnummer beheren</h2>
            </div>

            <label className="field">
              <span>Buildnummer</span>
              <input
                className="input"
                value={buildNumber}
                onChange={(event) => setBuildNumber(event.target.value)}
                placeholder="Bijvoorbeeld 2.2.0"
              />
              <small className="settings-menu__hint">
                Huidig online buildnummer: {buildState?.buildNumber || 'nog niet ingesteld'}
              </small>
            </label>

            <button className="button button--primary" type="submit" disabled={buildBusy}>
              <Save size={16} />
              {buildBusy ? 'Opslaan...' : 'Buildnummer opslaan'}
            </button>

            {buildMessage ? <p className="settings-menu__message">{buildMessage}</p> : null}
          </form>

          <form className="panel public-manage__card public-manage__card--info" onSubmit={handleSaveInfo}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Info</span>
              <h2>Login en dashboard tekst</h2>
            </div>

              <div className="public-settings__split">
                <label className="field">
                  <span>Hoofdtitel</span>
                <input
                  className="input"
                  value={infoCurrent.title}
                  onChange={(event) => setInfoCurrent((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="YOWLMAFFIA"
                />
              </label>

                <label className="field">
                  <span>Regel-titel</span>
                <input
                  className="input"
                  value={infoRules.title}
                  onChange={(event) => setInfoRules((previous) => ({ ...previous, title: event.target.value }))}
                  placeholder="Regels"
                />
                </label>
              </div>

              <div className="public-settings__split">
                <label className="field">
                  <span>Info tekstkleur</span>
                  <div className="public-manage__color-row">
                    <input
                      className="public-manage__color-input"
                      type="color"
                      value={infoCurrent.textColor || '#fff6db'}
                      onChange={(event) => setInfoCurrent((previous) => ({ ...previous, textColor: event.target.value }))}
                    />
                    <input
                      className="input"
                      value={infoCurrent.textColor}
                      onChange={(event) => setInfoCurrent((previous) => ({ ...previous, textColor: event.target.value }))}
                      placeholder="#fff6db"
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Regels tekstkleur</span>
                  <div className="public-manage__color-row">
                    <input
                      className="public-manage__color-input"
                      type="color"
                      value={infoRules.textColor || '#fff6db'}
                      onChange={(event) => setInfoRules((previous) => ({ ...previous, textColor: event.target.value }))}
                    />
                    <input
                      className="input"
                      value={infoRules.textColor}
                      onChange={(event) => setInfoRules((previous) => ({ ...previous, textColor: event.target.value }))}
                      placeholder="#fff6db"
                    />
                  </div>
                </label>
              </div>

              <label className="field">
                <span>Info tekst</span>
                <textarea
                  className="lyrics-editor__textarea"
                  value={infoCurrent.body}
                  onChange={(event) => setInfoCurrent((previous) => ({ ...previous, body: event.target.value }))}
                  placeholder="Welkom op de publieke dashboardpagina. Gebruik **vet**, *schuin*, __onderlijnd__ of [rood]kleur[/rood]."
                />
              </label>

              <label className="field">
                <span>Regels tekst</span>
                <textarea
                  className="lyrics-editor__textarea"
                  value={infoRules.body}
                  onChange={(event) => setInfoRules((previous) => ({ ...previous, body: event.target.value }))}
                  placeholder="Wees vriendelijk, respectvol en hou het proper. Gebruik **vet**, *schuin*, __onderlijnd__ of [goud]kleur[/goud]."
                />
              </label>

              <p className="public-manage__format-help">
                Opmaak: <strong>**vet**</strong>, <em>*schuin*</em>, <u>__onderlijnd__</u>, <strong>[rood]kleur[/rood]</strong> of
                <strong> [kleur=#ff4d5a]eigen kleur[/kleur]</strong> en lege regels tussen alinea&apos;s.
              </p>

              <div className="public-manage__format-legend">
                <strong>Snelle legenda</strong>
                <code>**vet**</code>
                <code>*schuin*</code>
                <code>__onderlijnd__</code>
                <code>[rood]tekst[/rood]</code>
                <code>[kleur=#ff4d5a]tekst[/kleur]</code>
              </div>

            <button className="button button--primary" type="submit" disabled={saving}>
              <Save size={16} />
              Info opslaan
            </button>
          </form>

          <form className="panel public-manage__card public-manage__card--updates" onSubmit={handlePublishUpdate}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Updates</span>
              <h2>Nieuwe release publiceren</h2>
            </div>

            <label className="field">
              <span>Versie</span>
              <input
                className="input"
                value={updateVersion}
                onChange={(event) => setUpdateVersion(event.target.value)}
                placeholder="2.2.0"
              />
            </label>

            <label className="field">
              <span>Opmerking</span>
              <textarea
                className="lyrics-editor__textarea"
                value={updateNotes}
                onChange={(event) => setUpdateNotes(event.target.value)}
                placeholder="Nieuwe publieke update..."
              />
            </label>

            <label className="field">
              <span>Downloadlink</span>
              <input
                className="input"
                value={updateDownloadUrl}
                onChange={(event) => setUpdateDownloadUrl(event.target.value)}
                placeholder="https://github.com/.../releases/download/..."
              />
            </label>

            <label className="button button--secondary settings-menu__toggle">
              <input
                type="checkbox"
                checked={updateRequired}
                onChange={(event) => setUpdateRequired(event.target.checked)}
              />
              Verplichte update
            </label>

            <button className="button button--primary" type="submit" disabled={saving}>
              <RefreshCw size={16} />
              Update publiceren
            </button>
          </form>

          <form className="panel public-manage__card public-manage__card--social" onSubmit={handleSaveSocialLinks}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Social</span>
              <h2>Social media links</h2>
            </div>

            <div className="public-manage__social-list">
              {socialLinks.map((link) => {
                const meta = getSocialPlatformMeta(link.platform);
                const socialColor = `#${meta.icon?.hex || '57b7ff'}`;

                return (
                  <div key={link.platform} className="public-manage__social-row" style={{ '--social-color': socialColor }}>
                    <div className="public-manage__social-platform">
                      <div className="public-manage__social-icon">
                        <SocialPlatformIcon platform={link.platform} size={20} />
                      </div>
                      <div>
                        <strong>{meta.label}</strong>
                        <span>{meta.description}</span>
                      </div>
                    </div>

                    <label className="field public-manage__social-field">
                      <span className="sr-only">{meta.label} link</span>
                      <input
                        className="input"
                        value={link.url}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          setSocialLinks((previous) =>
                            previous.map((item) => (item.platform === link.platform ? { ...item, url: nextValue } : item))
                          );
                        }}
                        placeholder={meta.placeholder}
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <button className="button button--primary" type="submit" disabled={saving}>
              <Save size={16} />
              Social links opslaan
            </button>
          </form>

          <form className="panel public-manage__card public-manage__card--social" onSubmit={handleSaveOurApp}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Onze apps</span>
              <h2>Links naar andere YOWLMAFFIA apps</h2>
            </div>

            <div className="public-manage__music-grid">
              <label className="field">
                <span>Naam van de app</span>
                <input
                  className="input"
                  value={ourAppName}
                  onChange={(event) => setOurAppName(event.target.value)}
                  placeholder="YOWL Player"
                />
              </label>

              <label className="field">
                <span>Link</span>
                <input
                  className="input"
                  value={ourAppUrl}
                  onChange={(event) => setOurAppUrl(event.target.value)}
                  placeholder="https://..."
                />
              </label>
            </div>

            <label className="field">
              <span>Korte beschrijving</span>
              <input
                className="input"
                value={ourAppDescription}
                onChange={(event) => setOurAppDescription(event.target.value)}
                placeholder="Korte uitleg over deze app"
              />
            </label>

            <button className="button button--primary" type="submit" disabled={saving}>
              <Save size={16} />
              App-link opslaan
            </button>

            {ourApps.length ? (
              <div className="public-manage__social-list">
                {ourApps.map((item) => (
                  <div key={item.id || item.name} className="public-manage__social-row public-manage__our-app-row">
                    <div className="public-manage__social-platform">
                      <div className="public-manage__social-icon">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.description || item.url}</span>
                      </div>
                    </div>

                    <div className="public-manage__our-app-actions">
                      <a className="button button--ghost button--compact" href={item.url} target="_blank" rel="noreferrer">
                        Open
                      </a>
                      <button
                        className="button button--ghost button--compact"
                        type="button"
                        onClick={() => void handleDeleteOurApp(item.id)}
                        disabled={saving}
                      >
                        <Trash2 size={15} />
                        Verwijder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </form>

          <form className="panel public-manage__card public-manage__card--music" onSubmit={handleSaveMusicRelease}>
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Songs</span>
              <h2>Spotify-banner toevoegen</h2>
            </div>

            <div className="public-manage__music-grid">
              <label className="field">
                <span>Titel</span>
                <input
                  className="input"
                  value={musicTitle}
                  onChange={(event) => setMusicTitle(event.target.value)}
                  placeholder="VIERA D"
                />
              </label>

              <label className="field">
                <span>Artiest</span>
                <input
                  className="input"
                  value={musicArtistName}
                  onChange={(event) => setMusicArtistName(event.target.value)}
                  placeholder="YOWLMAFFIA"
                />
              </label>
            </div>

            <label className="field">
              <span>Spotify-link</span>
              <input
                className="input"
                value={musicSpotifyUrl}
                onChange={(event) => setMusicSpotifyUrl(event.target.value)}
                placeholder="https://open.spotify.com/track/..."
              />
            </label>

            <div className="public-manage__cover-upload">
              <div className="public-manage__cover-preview">
                {musicCoverPreview ? (
                  <img src={musicCoverPreview} alt="Cover preview" />
                ) : (
                  <div className="public-manage__cover-placeholder">
                    <Sparkles size={18} />
                    <span>Geen foto gekozen</span>
                  </div>
                )}
              </div>

              <div className="public-manage__cover-copy">
                <span className="public-manage__cover-label">Bannerfoto</span>
                <p>Upload een afbeelding. Die wordt opgeslagen in Supabase Storage en direct gebruikt als bannercover.</p>

                <div className="public-manage__cover-actions">
                  <label className="button button--secondary button--compact">
                    <Upload size={16} />
                    Kies foto
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/*"
                      onChange={(event) => setMusicCoverFile(event.target.files?.[0] || null)}
                    />
                  </label>

                  {musicCoverFile ? (
                    <button className="button button--ghost button--compact" type="button" onClick={() => setMusicCoverFile(null)}>
                      Verwijder foto
                    </button>
                  ) : null}
                </div>

                <small className="settings-menu__hint">
                  {musicCoverFile ? musicCoverFile.name : 'Je hoeft geen URL meer te plakken. Een foto uploaden is genoeg.'}
                </small>
              </div>
            </div>

            <div className="public-manage__actions">
              <button className="button button--primary" type="submit" disabled={saving}>
                <Sparkles size={16} />
                Banner toevoegen
              </button>
            </div>
          </form>
          </>
          ) : null}
        </div>

        {isMattiz ? (
          <section className="public-manage__preview">
            <section className="panel public-dashboard__releases">
              <div className="panel__header panel__header--compact">
                <span className="eyebrow">Songs</span>
                <h2>Bestaande banners</h2>
                <button className="button button--ghost button--compact" type="button" onClick={() => setMessage('Banners staan online en worden live gesynchroniseerd.')}>
                  <Check size={16} />
                  Live
                </button>
              </div>

              {!isPublicChatSupabaseConfigured ? (
                <div className="empty-state empty-state--compact">
                  <strong>Public Supabase is nog niet gekoppeld.</strong>
                  <p>Koppel eerst de public database om banners te beheren.</p>
                </div>
              ) : loadingPage ? (
                <div className="empty-state empty-state--compact">
                  <strong>Publieke content laden...</strong>
                  <p>We halen info, releases en banners uit Supabase.</p>
                </div>
              ) : musicReleases.length ? (
                <div className="music-release-grid music-release-grid--compact">
                  {musicReleases.map((release) => (
                    <MusicReleaseCard key={release.id} release={release} canManage onDelete={handleDeleteMusicRelease} />
                  ))}
                </div>
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>Nog geen banners</strong>
                  <p>Maak hierboven de eerste publieke Spotify-banner aan.</p>
                </div>
              )}
            </section>

            <article className="panel public-block" style={infoCurrent.textColor ? { color: infoCurrent.textColor } : undefined}>
              <span className="eyebrow">Voorvertoning</span>
              <h2>{infoCurrent.title || 'YOWLMAFFIA'}</h2>
              <RichTextContent text={infoCurrent.body || 'Welkom op de publieke dashboardpagina.'} />
            </article>

            <article className="panel public-block" style={infoRules.textColor ? { color: infoRules.textColor } : undefined}>
              <span className="eyebrow">Voorvertoning</span>
              <h2>{infoRules.title || 'Regels'}</h2>
              <RichTextContent text={infoRules.body || 'Wees vriendelijk, respectvol en hou het proper.'} />
            </article>

          <article className="panel public-block">
            <span className="eyebrow">Updates</span>
            <h2>{latestUpdate ? `Versie ${latestUpdate.version}` : 'Nog geen release'}</h2>
            <p>{latestUpdate?.notes || 'Mattiz kan later hier nieuwe app-updates publiceren.'}</p>
          </article>
        </section>
        ) : null}

        {message ? <p className="settings-menu__message public-manage__message">{message}</p> : null}
        {error ? <p className="settings-menu__message public-manage__message public-manage__message--error">{error}</p> : null}
      </section>
    </PublicShell>
  );
}
