import { ExternalLink, LayoutDashboard, MessagesSquare } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import BrandMark from '../components/BrandMark';
import PublicShell from '../components/PublicShell';
import SocialPlatformIcon from '../components/SocialPlatformIcon';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import { ensurePublicAllowedUserRow, loadPublicAllowedUsers, resolvePublicUserFromSession } from '../utils/publicUsers';
import { createDefaultSocialLinks, loadSocialLinks } from '../utils/socialLinks';

function openExternalUrl(url) {
  const nextUrl = String(url || '').trim();
  if (!nextUrl) {
    return;
  }

  if (typeof window !== 'undefined' && window.desktop?.openExternal) {
    window.desktop.openExternal(nextUrl);
    return;
  }

  if (typeof window !== 'undefined') {
    window.open(nextUrl, '_blank', 'noopener,noreferrer');
  }
}

function SocialLinkCard({ item }) {
  const hasLink = Boolean(String(item.url || '').trim());
  const [copyState, setCopyState] = useState('idle');

  useEffect(() => {
    if (copyState !== 'copied') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setCopyState('idle');
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [copyState]);

  async function handleCopyLink() {
    const nextUrl = String(item.url || '').trim();
    if (!nextUrl) {
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(nextUrl);
      } else if (typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.value = nextUrl;
        input.setAttribute('readonly', 'true');
        input.style.position = 'absolute';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }

      setCopyState('copied');
    } catch (error) {
      console.error(error);
      setCopyState('error');
    }
  }

  return (
    <article className="panel public-social__card">
      <div className="public-social__card-head public-social__card-head--centered">
        <div className="public-social__icon">
          <SocialPlatformIcon platform={item.platform} size={24} />
        </div>
        <div className="public-social__card-copy">
          <span className="eyebrow">{item.label}</span>
          <h2>{item.label}</h2>
          <p>{item.description}</p>
        </div>
      </div>

      <div className="public-social__actions">
        {hasLink ? (
          <>
            <button className="button button--secondary button--compact" type="button" onClick={() => openExternalUrl(item.url)}>
              <ExternalLink size={16} />
              Open link
            </button>
            <button className="button button--ghost button--compact" type="button" onClick={handleCopyLink}>
              {copyState === 'copied' ? 'Gekopieerd' : 'Kopieer link'}
            </button>
          </>
        ) : (
          <button className="button button--secondary button--compact" type="button" disabled>
            <ExternalLink size={16} />
            Nog niet ingesteld
          </button>
        )}
      </div>
    </article>
  );
}

export default function PublicSocialPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingPage, setLoadingPage] = useState(true);
  const [socialLinks, setSocialLinks] = useState(createDefaultSocialLinks());

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

    async function bootstrapSocial() {
      setLoadingPage(true);
      const links = await loadSocialLinks(publicChatSupabase).catch(() => createDefaultSocialLinks());

      if (!cancelled) {
        setSocialLinks(Array.isArray(links) && links.length ? links : createDefaultSocialLinks());
        setLoadingPage(false);
      }
    }

    bootstrapSocial();

    const socialChannel = publicChatSupabase
      .channel('public-social-links-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_social_links' }, bootstrapSocial)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(socialChannel);
    };
  }, [currentUser]);

  const statusText = useMemo(() => 'Social media van YOWLMAFFIA', []);

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
            <strong>Socials laden...</strong>
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
      <section className="public-social">
        <header className="public-social__hero panel">
          <div className="public-social__hero-brand">
            <div className="public-social__hero-logo">
              <BrandMark stacked subtitle="" />
            </div>
            <div className="public-social__hero-copy">
              <span className="eyebrow">Social media</span>
              <h1>Volg YOWLMAFFIA online</h1>
              <p>Alle officiële kanalen staan hier netjes bij elkaar in een luxere, volle breedte opmaak.</p>
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
            <p>Koppel eerst de public database om social links te tonen.</p>
          </div>
        ) : loadingPage ? (
          <div className="empty-state empty-state--compact">
            <strong>Socials laden...</strong>
            <p>We halen de officiële YOWLMAFFIA-links uit Supabase.</p>
          </div>
        ) : (
          <div className="public-social__grid">
            {socialLinks.map((item) => (
              <SocialLinkCard key={item.platform} item={item} />
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
