import { AppWindow, ExternalLink, LayoutDashboard, MessagesSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import BrandMark from '../components/BrandMark';
import PublicShell from '../components/PublicShell';
import { openExternalUrl } from '../utils/yowl';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import { ensurePublicAllowedUserRow, loadPublicAllowedUsers, resolvePublicUserFromSession } from '../utils/publicUsers';
import { loadOurApps } from '../utils/ourApps';

function OurAppCard({ item }) {
  const hasLink = Boolean(String(item.url || '').trim());

  return (
    <article className="panel public-social__card">
      <div className="public-social__card-head public-social__card-head--centered">
        <div className="public-social__icon">
          <AppWindow size={24} />
        </div>
        <div className="public-social__card-copy">
          <span className="eyebrow">Onze app</span>
          <h2>{item.name}</h2>
          <p>{item.description || 'Officiële YOWLMAFFIA app-link.'}</p>
        </div>
      </div>

      <div className="public-social__actions">
        {hasLink ? (
          <button className="button button--secondary button--compact" type="button" onClick={() => void openExternalUrl(item.url)}>
            <ExternalLink size={16} />
            Open app
          </button>
        ) : (
          <button className="button button--secondary button--compact" type="button" disabled>
            <ExternalLink size={16} />
            Geen link
          </button>
        )}
      </div>
    </article>
  );
}

export default function PublicAppsPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingPage, setLoadingPage] = useState(true);
  const [ourApps, setOurApps] = useState([]);

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

    async function bootstrapApps() {
      setLoadingPage(true);
      const apps = await loadOurApps(publicChatSupabase).catch(() => []);

      if (!cancelled) {
        setOurApps(Array.isArray(apps) ? apps : []);
        setLoadingPage(false);
      }
    }

    bootstrapApps();

    const appsChannel = publicChatSupabase
      .channel('public-our-apps-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_our_apps' }, bootstrapApps)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(appsChannel);
    };
  }, [currentUser]);

  const statusText = useMemo(() => 'Officiële YOWLMAFFIA apps', []);

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
            <strong>Onze apps laden...</strong>
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
      <section className="public-social public-apps">
        <header className="public-social__hero panel">
          <div className="public-social__hero-brand">
            <div className="public-social__hero-logo">
              <BrandMark stacked subtitle="" />
            </div>
            <div className="public-social__hero-copy">
              <span className="eyebrow">Onze apps</span>
              <h1>Meer van YOWLMAFFIA</h1>
              <p>Hier vind je alle officiële apps en projecten die Mattiz voor YOWLMAFFIA heeft toegevoegd.</p>
            </div>
          </div>

          <div className="public-social__hero-actions">
            <Link className="button button--primary" to="/public/dashboard">
              <LayoutDashboard size={16} />
              Terug naar dashboard
            </Link>
            <Link className="button button--secondary" to="/public/chat">
              <MessagesSquare size={16} />
              Naar public chat
            </Link>
          </div>
        </header>

        {!isPublicChatSupabaseConfigured ? (
          <div className="empty-state empty-state--compact">
            <strong>Public Supabase is nog niet gekoppeld.</strong>
            <p>Koppel eerst de public database om onze apps te tonen.</p>
          </div>
        ) : loadingPage ? (
          <div className="empty-state empty-state--compact">
            <strong>Onze apps laden...</strong>
            <p>We halen de officiële app-links uit Supabase.</p>
          </div>
        ) : ourApps.length ? (
          <div className="public-social__grid">
            {ourApps.map((item) => (
              <OurAppCard key={item.id || item.name} item={item} />
            ))}
          </div>
        ) : (
          <div className="empty-state empty-state--compact">
            <strong>Nog geen apps ingesteld</strong>
            <p>Mattiz kan in Beheren straks links naar andere YOWLMAFFIA-apps toevoegen.</p>
          </div>
        )}
      </section>
    </PublicShell>
  );
}
