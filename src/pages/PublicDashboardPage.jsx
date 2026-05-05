import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import BrandMark from '../components/BrandMark';
import MusicReleaseCard from '../components/MusicReleaseCard';
import PublicShell from '../components/PublicShell';
import RichTextContent from '../components/RichTextContent';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import { ensurePublicAllowedUserRow, loadPublicAllowedUsers, resolvePublicUserFromSession } from '../utils/publicUsers';
import { loadMusicReleases as loadMusicReleasesFromDatabase, normalizeMusicRelease } from '../utils/musicReleases';

function InfoBlock({ eyebrow, title, body, textColor }) {
  const style = textColor ? { color: textColor } : undefined;
  return (
    <article className="panel public-block" style={style}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <RichTextContent text={body} />
    </article>
  );
}

function UpdateCard({ update }) {
  if (!update) {
    return (
      <article className="panel public-block">
        <span className="eyebrow">Updates</span>
        <h2>Nog geen release</h2>
        <p>Mattiz kan later hier nieuwe app-updates publiceren.</p>
      </article>
    );
  }

  return (
    <article className="panel public-block">
      <span className="eyebrow">Updates</span>
      <h2>Versie {update.version}</h2>
      <p>{update.notes || 'Geen notities toegevoegd.'}</p>
      <div className="public-dashboard__meta">
        <span>Geplaatst: {update.published_at ? new Date(update.published_at).toLocaleString('nl-BE') : 'onbekend'}</span>
      </div>
      {update.download_url ? (
        <a className="button button--secondary button--compact" href={update.download_url} target="_blank" rel="noreferrer">
          <ArrowRight size={16} />
          Release openen
        </a>
      ) : null}
    </article>
  );
}

export default function PublicDashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [infoBlock, setInfoBlock] = useState({ title: 'YOWLMAFFIA', body: 'Welkom op de publieke dashboardpagina.', textColor: '' });
  const [rulesBlock, setRulesBlock] = useState({ title: 'Regels', body: 'Wees vriendelijk, respectvol en hou het proper.', textColor: '' });
  const [musicReleases, setMusicReleases] = useState([]);
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);

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
    if (!publicChatSupabase || !currentUser) {
      return undefined;
    }

    void ensurePublicAllowedUserRow().catch(() => null);
    return undefined;
  }, [currentUser?.id, currentUser?.email]);

  useEffect(() => {
    if (!publicChatSupabase || !currentUser) {
      setLoadingPage(false);
      return undefined;
    }

    let cancelled = false;

    async function bootstrapDashboard() {
      setLoadingPage(true);

      const [infoResult, rulesResult, musicResult, updateResult] = await Promise.all([
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'current').maybeSingle(),
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'rules').maybeSingle(),
        loadMusicReleasesFromDatabase(publicChatSupabase).catch(() => []),
        publicChatSupabase
          .from('app_update_releases')
          .select('version, download_url, notes, is_required, published_at, created_at')
          .order('published_at', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)
      ]);

      if (cancelled) {
        return;
      }

      if (infoResult?.data) {
        setInfoBlock({
          title: String(infoResult.data.title || 'YOWLMAFFIA').trim() || 'YOWLMAFFIA',
          body: String(infoResult.data.body || '').trim() || 'Welkom op de publieke dashboardpagina.',
          textColor: String(infoResult.data.text_color || '').trim()
        });
      }

      if (rulesResult?.data) {
        setRulesBlock({
          title: String(rulesResult.data.title || 'Regels').trim() || 'Regels',
          body: String(rulesResult.data.body || '').trim() || 'Wees vriendelijk, respectvol en hou het proper.',
          textColor: String(rulesResult.data.text_color || '').trim()
        });
      }

      setMusicReleases(Array.isArray(musicResult) ? musicResult.map(normalizeMusicRelease) : []);
      setLatestUpdate(Array.isArray(updateResult?.data) ? updateResult.data[0] || null : null);
      setLoadingPage(false);
    }

    bootstrapDashboard();

    const infoChannel = publicChatSupabase
      .channel('public-dashboard-info-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_info_blocks' }, bootstrapDashboard)
      .subscribe();

    const releaseChannel = publicChatSupabase
      .channel('public-dashboard-music-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music_releases' }, bootstrapDashboard)
      .subscribe();

    const updateChannel = publicChatSupabase
      .channel('public-dashboard-updates-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_update_releases' }, bootstrapDashboard)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(infoChannel);
      publicChatSupabase.removeChannel(releaseChannel);
      publicChatSupabase.removeChannel(updateChannel);
    };
  }, [currentUser]);

  const statusText = useMemo(() => (latestUpdate ? 'Nieuwe update beschikbaar' : 'Alles bijgewerkt'), [latestUpdate]);

  async function handleSignOut() {
    if (!publicChatSupabase) {
      navigate('/');
      return;
    }

    await publicChatSupabase.auth.signOut();
    navigate('/');
  }

  if (loadingAuth) {
    return (
      <section className="public-page">
        <div className="public-page__shell">
          <div className="empty-state empty-state--compact">
            <strong>Dashboard laden...</strong>
            <p>We openen de publieke omgeving veilig.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <PublicShell user={currentUser} onSignOut={handleSignOut} statusText={statusText}>
      <section className="public-dashboard">
        <header className="public-dashboard__hero panel">
          <div className="public-dashboard__hero-brand">
            <BrandMark stacked subtitle="" />
            <div>
              <span className="eyebrow">Open community</span>
              <h1>YOWLMAFFIA publiek dashboard</h1>
              <p>Hier zie je de info, regels, releases en updates van de publieke kant.</p>
            </div>
          </div>

        </header>

        <div className="public-dashboard__grid">
          <InfoBlock eyebrow="Info" title={infoBlock.title} body={infoBlock.body} textColor={infoBlock.textColor} />
          <InfoBlock eyebrow="Regels" title={rulesBlock.title} body={rulesBlock.body} textColor={rulesBlock.textColor} />
          <UpdateCard update={latestUpdate} />
        </div>

        <section className="panel public-dashboard__releases">
          <div className="panel__header panel__header--compact public-dashboard__releases-header">
            <h2>Songs</h2>
          </div>

          {!isPublicChatSupabaseConfigured ? (
            <div className="empty-state empty-state--compact">
              <strong>Public Supabase is nog niet gekoppeld.</strong>
              <p>Koppel eerst de public database om songs te tonen.</p>
            </div>
          ) : loadingPage ? (
            <div className="empty-state empty-state--compact">
              <strong>Releases laden...</strong>
              <p>We laden de publieke muziekkaarten.</p>
            </div>
          ) : musicReleases.length ? (
            <div className="music-release-grid music-release-grid--compact">
              {musicReleases.map((release) => (
                <MusicReleaseCard key={release.id} release={release} canManage={false} />
              ))}
            </div>
          ) : (
            <div className="empty-state empty-state--compact">
              <strong>Nog geen releases</strong>
              <p>Mattiz kan hier later songs toevoegen.</p>
            </div>
          )}
        </section>
      </section>
    </PublicShell>
  );
}
