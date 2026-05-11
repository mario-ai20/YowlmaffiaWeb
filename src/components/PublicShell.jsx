import { AlertTriangle, AppWindow, Bell, LayoutDashboard, LogOut, MessagesSquare, Share2, ShieldEllipsis, X } from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import BrandMark from './BrandMark';
import UserAvatar from './UserAvatar';
import { getPublicBuildState, subscribeToPublicBuildState } from '../utils/publicBuildInfo';
import { canManagePublicAlerts, ensurePublicAllowedUserRow, getPublicUserDisplayLabel, isMattizPublicUser, updatePublicAllowedUserRow } from '../utils/publicUsers';
import { publicChatSupabase } from '../utils/supabase';

function resolveThemeMode(mode) {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }

  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }

  return 'dark';
}

function normalizeIdentity(value) {
  return String(value || '').trim().toLowerCase();
}

export default function PublicShell({
  user,
  onSignOut,
  statusText = 'Alles bijgewerkt',
  children
}) {
  const [buildNumber, setBuildNumber] = useState('dev');
  const [themeMode, setThemeMode] = useState(user?.theme_mode || 'system');
  const [privateUnreadCount, setPrivateUnreadCount] = useState(0);
  const [privatePopup, setPrivatePopup] = useState(null);
  const [targetedWarning, setTargetedWarning] = useState(null);
  const [warningBusy, setWarningBusy] = useState(false);
  const mainRef = useRef(null);
  const popupTimerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isMattiz = isMattizPublicUser(user);
  const canManageAlerts = canManagePublicAlerts(user);
  const isWebApp = typeof window !== 'undefined' && !window.desktop;

  const headerDateTime = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('nl-BE', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date());
    } catch {
      return new Date().toLocaleString('nl-BE');
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrapBuildState() {
      const initial = await getPublicBuildState();
      if (mounted && initial) {
        setBuildNumber(initial.buildNumber || 'dev');
      }
    }

    bootstrapBuildState();

    const unsubscribe = subscribeToPublicBuildState((nextState) => {
      if (mounted && nextState) {
        setBuildNumber(nextState.buildNumber || 'dev');
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setThemeMode(user?.theme_mode || 'system');
  }, [user?.theme_mode, user?.username]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const resolvedTheme = resolveThemeMode(themeMode);
    root.dataset.theme = resolvedTheme;
    root.dataset.themeMode = themeMode;
    root.style.colorScheme = resolvedTheme;

    if (typeof window === 'undefined' || themeMode !== 'system') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = () => {
      const nextTheme = resolveThemeMode('system');
      root.dataset.theme = nextTheme;
      root.style.colorScheme = nextTheme;
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [themeMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }

    mainRef.current?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    if (!publicChatSupabase || !user) {
      return undefined;
    }

    let cancelled = false;

    async function touchPresence() {
      const nextOnlineAt = new Date().toISOString();
      try {
        await ensurePublicAllowedUserRow().catch(() => null);
        await updatePublicAllowedUserRow(user, { last_online_at: nextOnlineAt });
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    }

    touchPresence();
    const handleWake = () => {
      void touchPresence();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void touchPresence();
      }
    };

    const timer = window.setInterval(() => {
      void touchPresence();
    }, 1800000);

    window.addEventListener('focus', handleWake);
    window.addEventListener('online', handleWake);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', handleWake);
      window.removeEventListener('online', handleWake);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, user?.username]);

  useEffect(() => {
    if (!publicChatSupabase || (!user?.email && !user?.username)) {
      setPrivateUnreadCount(0);
      setTargetedWarning(null);
      return undefined;
    }

    let cancelled = false;
    const normalizedEmail = normalizeIdentity(user?.email);
    const normalizedUsername = normalizeIdentity(user?.username);

    async function loadNotificationState() {
      const { data, error } = await publicChatSupabase
        .from('notifications')
        .select('id, kind, title, body, actor_username, recipient_email, recipient_username, is_read, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!cancelled) {
        const rows = (error ? [] : (data || [])).filter((notification) => {
          const notificationEmail = normalizeIdentity(notification?.recipient_email);
          const notificationUsername = normalizeIdentity(notification?.recipient_username);
          return (
            (normalizedEmail && notificationEmail === normalizedEmail) ||
            (normalizedUsername && notificationUsername === normalizedUsername)
          );
        });
        setPrivateUnreadCount(rows.filter((notification) => notification.kind === 'private_message' && notification.is_read === false).length);
        setTargetedWarning(rows.find((notification) => notification.kind === 'targeted_warning' && notification.is_read === false) || null);
      }
    }

    loadNotificationState();

    const channel = publicChatSupabase
      .channel(`public-private-notifications-${user.email || user.username || 'unknown'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          const nextRecipientEmail = normalizeIdentity(payload?.new?.recipient_email);
          const nextRecipientUsername = normalizeIdentity(payload?.new?.recipient_username);
          const previousRecipientEmail = normalizeIdentity(payload?.old?.recipient_email);
          const previousRecipientUsername = normalizeIdentity(payload?.old?.recipient_username);
          const affectsCurrentUser = (
            (normalizedEmail && (nextRecipientEmail === normalizedEmail || previousRecipientEmail === normalizedEmail)) ||
            (normalizedUsername && (nextRecipientUsername === normalizedUsername || previousRecipientUsername === normalizedUsername))
          );

          if (!affectsCurrentUser) {
            return;
          }

          loadNotificationState();

          if (
            payload?.eventType === 'INSERT'
            && payload?.new?.kind === 'private_message'
            && payload?.new?.is_read === false
          ) {
            const actorUsername = String(payload.new.actor_username || '').trim();
            const nextPopup = {
              id: payload.new.id || `${Date.now()}`,
              title: payload.new.title || 'Nieuw privébericht',
              body: payload.new.body || 'Je hebt een nieuw privébericht ontvangen.',
              actorUsername
            };

            if (popupTimerRef.current) {
              window.clearTimeout(popupTimerRef.current);
            }

            setPrivatePopup(nextPopup);
            popupTimerRef.current = window.setTimeout(() => {
              setPrivatePopup(null);
              popupTimerRef.current = null;
            }, 7000);
          }

          if (
            payload?.eventType === 'INSERT'
            && payload?.new?.kind === 'targeted_warning'
            && payload?.new?.is_read === false
          ) {
            setTargetedWarning({
              id: payload.new.id,
              kind: payload.new.kind,
              title: payload.new.title,
              body: payload.new.body,
              actor_username: payload.new.actor_username,
              metadata: payload.new.metadata || {}
            });
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (popupTimerRef.current) {
        window.clearTimeout(popupTimerRef.current);
        popupTimerRef.current = null;
      }
      publicChatSupabase.removeChannel(channel);
    };
  }, [user?.email, user?.username]);

  useEffect(() => {
    if (!targetedWarning) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void handleDismissTargetedWarning();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [targetedWarning]);

  async function handleDismissTargetedWarning() {
    if (!publicChatSupabase || !targetedWarning?.id || warningBusy) {
      return;
    }

    setWarningBusy(true);

    try {
      const recipientColumn = user?.email ? 'recipient_email' : 'recipient_username';
      const recipientValue = user?.email || user?.username || '';

      await publicChatSupabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', targetedWarning.id)
        .eq(recipientColumn, recipientValue);
      const { data } = await publicChatSupabase
        .from('notifications')
        .select('id, kind, title, body, actor_username, is_read, metadata, created_at')
        .eq(recipientColumn, recipientValue)
        .eq('kind', 'targeted_warning')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1);

      setTargetedWarning(data?.[0] || null);
    } finally {
      setWarningBusy(false);
    }
  }

  return (
    <div className={`public-shell ${isWebApp ? 'public-shell--web' : ''}`.trim()}>
      <header className="public-shell__header">
        <BrandMark subtitle="" />

        <nav className="public-shell__nav">
          <NavLink end to="/public/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
          <NavLink end to="/public/chat" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            <MessagesSquare size={16} />
            Public chat
          </NavLink>
          <NavLink end to="/public/private" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            <MessagesSquare size={16} />
            Privé chats
            {privateUnreadCount > 0 ? <span className="public-shell__nav-badge" aria-label={`${privateUnreadCount} ongelezen privéberichten`} /> : null}
          </NavLink>
          <NavLink end to="/public/social" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            <Share2 size={16} />
            Social
          </NavLink>
          <NavLink end to="/public/apps" className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}>
            <AppWindow size={16} />
            Onze apps
          </NavLink>
          {canManageAlerts ? (
            <NavLink end to="/public/beheren" className={({ isActive }) => `nav-link nav-link--ghost ${isActive ? 'is-active' : ''}`.trim()}>
              <ShieldEllipsis size={16} />
              Beheren
            </NavLink>
          ) : null}
        </nav>

        <div className="public-shell__user">
          <div className="public-shell__header-row">
            <div className="app-shell__version" aria-label={`Huidige buildversie: ${buildNumber}`}>
              Build {buildNumber}
            </div>

            <div className="public-shell__notifications" aria-live="polite">
              <Bell size={15} />
              <span>{statusText}</span>
            </div>

            <div className="public-shell__clock" aria-label={`Huidige datum en tijd: ${headerDateTime}`}>
              <span>{headerDateTime}</span>
            </div>
          </div>

          <div className="public-shell__user-row">
            <div className="public-shell__status">
              <div className="user-chip">
                <UserAvatar user={user} size={42} showDot />
                <div>
                  <strong>{getPublicUserDisplayLabel(user) || 'Bezoeker'}</strong>
                  <span>{user?.status_message || user?.bio || 'Beschikbaar'}</span>
                </div>
              </div>
            </div>

            <div className="public-shell__actions">
              <NavLink className="icon-text-button" to="/public/settings">
                <ShieldEllipsis size={16} />
                Instellingen
              </NavLink>

              <button className="icon-text-button" type="button" onClick={onSignOut}>
                <LogOut size={16} />
                Uitloggen
              </button>
            </div>
          </div>
        </div>
      </header>

      {privatePopup ? (
        <div className="public-shell__popup" role="status" aria-live="polite">
          <div className="public-shell__popup-copy">
            <strong>{privatePopup.title}</strong>
            <p>{privatePopup.body}</p>
          </div>
          <div className="public-shell__popup-actions">
            <button
              className="button button--primary button--small"
              type="button"
              onClick={() => {
                const target = privatePopup.actorUsername
                  ? `/public/private?peer=${encodeURIComponent(privatePopup.actorUsername)}`
                  : '/public/private';
                setPrivatePopup(null);
                navigate(target);
              }}
            >
              Open chat
            </button>
            <button
              className="icon-button icon-button--small"
              type="button"
              aria-label="Sluit melding"
              onClick={() => {
                setPrivatePopup(null);
                if (popupTimerRef.current) {
                  window.clearTimeout(popupTimerRef.current);
                  popupTimerRef.current = null;
                }
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {targetedWarning ? (
        <div className="public-shell__warning-overlay" role="dialog" aria-modal="true" aria-live="assertive">
          <div className="public-shell__warning-card">
            <div className="public-shell__warning-badge">
              <AlertTriangle size={18} />
              YOWLMAFFIA WARNING
            </div>
            <h2>{targetedWarning.title || 'Waarschuwing van YOWLMAFFIA'}</h2>
            <p>{targetedWarning.body || 'Er is een belangrijke waarschuwing voor jou.'}</p>
            <small>
              Deze melding is persoonlijk naar jouw account gestuurd. Druk op <strong>Ik heb dit gelezen</strong> om verder te gaan.
            </small>
            <button className="button button--danger" type="button" onClick={() => void handleDismissTargetedWarning()} disabled={warningBusy}>
              {warningBusy ? 'Bevestigen...' : 'Ik heb dit gelezen'}
            </button>
          </div>
        </div>
      ) : null}

      <main className="public-shell__main" ref={mainRef}>{children}</main>
    </div>
  );
}
