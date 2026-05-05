import { Camera, Check, Mail, Trash2, UserCircle2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import PublicShell from '../components/PublicShell';
import UserAvatar from '../components/UserAvatar';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import {
  ensurePublicAllowedUserRow,
  findPublicAllowedUser,
  loadPublicAllowedUsers,
  normalizePublicUsername,
  resolvePublicUserFromSession,
  savePublicAllowedUserProfileRow,
  updatePublicAllowedUserRow
} from '../utils/publicUsers';

function sanitizeSegment(value) {
  return String(value || '')
    .trim()
    .replaceAll('\\', '/')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._/-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-/]+|[-/]+$/g, '')
    .toLowerCase() || 'item';
}

function getAvatarFolder(username) {
  return `avatars/${sanitizeSegment(username || 'profile')}`;
}

function getPublicUserMatchFilter(user) {
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

export default function PublicSettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bio, setBio] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [themeMode, setThemeMode] = useState('system');
  const [email, setEmail] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirmPassword, setRecoveryConfirmPassword] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [emailVerificationPending, setEmailVerificationPending] = useState(false);
  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [emailVerificationBusy, setEmailVerificationBusy] = useState(false);
  const [emailVerificationMessage, setEmailVerificationMessage] = useState('');
  const [emailVerificationError, setEmailVerificationError] = useState('');
  const recoveryMode = new URLSearchParams(location.search).get('mode') === 'recovery';

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

  const currentUserSyncKey = currentUser?.id || currentUser?.auth_user_id || currentUser?.email || currentUser?.username || '';

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    setBio(currentUser.bio || '');
    setStatusMessage(currentUser.status_message || '');
    setThemeMode(currentUser.theme_mode || 'system');
    setEmail(currentUser.email || '');
    setAvatarPreview(currentUser.avatar_url || '');
  }, [currentUserSyncKey]);

  useEffect(() => {
    if (!avatarFile) {
      return undefined;
    }

    const nextPreview = URL.createObjectURL(avatarFile);
    setAvatarPreview(nextPreview);

    return () => {
      URL.revokeObjectURL(nextPreview);
    };
  }, [avatarFile]);

  const currentUserRecord = useMemo(
    () => currentUser || findPublicAllowedUser(currentUser?.id || currentUser?.username || currentUser?.email, allowedUsers),
    [allowedUsers, currentUser]
  );

  async function handleSignOut() {
    if (!publicChatSupabase) {
      navigate('/');
      return;
    }

    await publicChatSupabase.auth.signOut();
    navigate('/');
  }

  async function handleDeleteAvatar() {
    if (!publicChatSupabase || !currentUser) {
      return;
    }

    await ensurePublicAllowedUserRow().catch((error) => {
      console.error(error);
    });

    const matchFilter = getPublicUserMatchFilter(currentUser);
    const avatarFolder = getAvatarFolder(currentUser.username);
    const { data: existingItems = [], error: listError } = await publicChatSupabase.storage.from('media').list(avatarFolder, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    });

    if (listError) {
      throw listError;
    }

    const removePaths = (existingItems || [])
      .filter((item) => item?.name)
      .map((item) => `${avatarFolder}/${item.name}`);

    const { error: removeError } = await publicChatSupabase.storage.from('media').remove(removePaths);
    if (removeError) {
      throw removeError;
    }

    const nextUpdatedAt = new Date().toISOString();
    let data = null;

    try {
      data = await savePublicAllowedUserProfileRow(currentUser, { avatar_url: '', updated_at: nextUpdatedAt });
      if (!data) {
        throw new Error('RPC save returned no row.');
      }
    } catch (rpcError) {
      console.warn(rpcError);
      data = await updatePublicAllowedUserRow(currentUser, { avatar_url: '', updated_at: nextUpdatedAt });
    }

    if (!data) {
      throw new Error('Profielfoto verwijderen mislukt.');
    }

    setAvatarFile(null);
    setAvatarPreview('');
    setCurrentUser((previous) => (previous ? { ...previous, avatar_url: '', updated_at: nextUpdatedAt } : previous));
    setAllowedUsers((previous) =>
      previous.map((user) =>
        getPublicUserMatchFilter(user)?.value === matchFilter?.value && getPublicUserMatchFilter(user)?.column === matchFilter?.column
          ? { ...user, avatar_url: '', updated_at: nextUpdatedAt }
          : user
      )
    );
    setMessage('Profielfoto verwijderd.');
  }

  async function handleRecoveryPassword(event) {
    event.preventDefault();

    if (!publicChatSupabase || !currentUser) {
      return;
    }

    const nextPassword = String(recoveryPassword || '');
    const nextConfirmPassword = String(recoveryConfirmPassword || '');

    if (!nextPassword || !nextConfirmPassword) {
      setRecoveryError('Vul beide wachtwoordvelden in.');
      return;
    }

    if (nextPassword !== nextConfirmPassword) {
      setRecoveryError('Wachtwoorden komen niet overeen.');
      return;
    }

    setRecoveryBusy(true);
    setRecoveryError('');
    setRecoveryMessage('');

    try {
      const { error } = await publicChatSupabase.auth.updateUser({ password: nextPassword });
      if (error) {
        throw error;
      }

      setRecoveryMessage('Je wachtwoord is opgeslagen. Je kan nu verder met de app.');
      setRecoveryPassword('');
      setRecoveryConfirmPassword('');
      navigate('/public/dashboard', { replace: true });
    } catch (formError) {
      setRecoveryError(formError instanceof Error ? formError.message : 'Wachtwoord opslaan mislukt.');
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function handleVerifyEmailChange(event) {
    event.preventDefault();

    if (!publicChatSupabase || !currentUser) {
      return;
    }

    const nextCode = String(emailVerificationCode || '').trim();
    if (!nextCode) {
      setEmailVerificationError('Vul de code in uit je e-mail.');
      return;
    }

    const nextEmail = String(email || currentUser.email || '').trim().toLowerCase();
    if (!nextEmail) {
      setEmailVerificationError('We missen het nieuwe e-mailadres.');
      return;
    }

    setEmailVerificationBusy(true);
    setEmailVerificationError('');
    setEmailVerificationMessage('');

    try {
      const { error: authError } = await publicChatSupabase.auth.verifyOtp({
        email: nextEmail,
        token: nextCode,
        type: 'email_change'
      });

      if (authError) {
        throw authError;
      }

      const matchFilter = getPublicUserMatchFilter(currentUser);
      const nextUpdatedAt = new Date().toISOString();
      const nextProfile = {
        id: currentUser.id || undefined,
        username: currentUser.username,
        display_name: currentUser.displayName || 'Onbekend',
        email: nextEmail,
        bio,
        status_message: statusMessage,
        theme_mode: themeMode,
        avatar_url: currentUser.avatar_url || '',
        updated_at: nextUpdatedAt
      };

      let data = null;

      try {
        data = await savePublicAllowedUserProfileRow(currentUser, nextProfile);
        if (!data) {
          throw new Error('RPC save returned no row.');
        }
      } catch (rpcError) {
        console.warn(rpcError);

        data = await updatePublicAllowedUserRow(
          currentUser,
          nextProfile,
          'id, username, email, display_name, accent, avatar_url, updated_at, bio, status_message, theme_mode, stay_logged_in'
        );
      }

      const nextCurrentUser = {
        ...currentUser,
        id: data?.id || currentUser.id || '',
        ...nextProfile,
        avatar_url: data?.avatar_url || currentUser.avatar_url || '',
        updated_at: data?.updated_at || nextUpdatedAt
      };

      setCurrentUser(nextCurrentUser);
      setAllowedUsers((previous) =>
        previous.map((user) =>
          getPublicUserMatchFilter(user)?.value === matchFilter?.value
          && getPublicUserMatchFilter(user)?.column === matchFilter?.column
            ? {
                ...user,
                ...nextCurrentUser
              }
            : user
        )
      );

      setEmail(nextEmail);
      setEmailVerificationCode('');
      setEmailVerificationPending(false);
      setEmailVerificationMessage('Je e-mailadres is bevestigd en opgeslagen.');
    } catch (formError) {
      setEmailVerificationError(formError instanceof Error ? formError.message : 'E-mailadres bevestigen mislukt.');
    } finally {
      setEmailVerificationBusy(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!publicChatSupabase || !currentUser) {
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      await ensurePublicAllowedUserRow().catch((ensureError) => {
        console.error(ensureError);
      });

      const matchFilter = getPublicUserMatchFilter(currentUser);
      let avatarUrl = currentUser.avatar_url || '';
      const nextUpdatedAt = new Date().toISOString();
      const nextEmail = String(email || currentUser.email || '').trim().toLowerCase();
      const emailChanged = Boolean(nextEmail && nextEmail !== currentUser.email);

      if (avatarFile) {
        const avatarFolder = getAvatarFolder(currentUser.username);
        const { data: existingItems = [], error: listError } = await publicChatSupabase.storage.from('media').list(avatarFolder, {
          limit: 1000,
          offset: 0,
          sortBy: { column: 'name', order: 'asc' }
        });

        if (listError) {
          throw listError;
        }

        const removePaths = (existingItems || [])
          .filter((item) => item?.name)
          .map((item) => `${avatarFolder}/${item.name}`);

        if (removePaths.length) {
          const { error: removeError } = await publicChatSupabase.storage.from('media').remove(removePaths);
          if (removeError) {
            throw removeError;
          }
        }

        const nextExtension = avatarFile.name.includes('.') ? avatarFile.name.split('.').pop() : 'png';
        const uploadPath = `${avatarFolder}/avatar.${nextExtension}`;
        const { error: uploadError } = await publicChatSupabase.storage.from('media').upload(uploadPath, avatarFile, {
          upsert: true,
          contentType: avatarFile.type
        });

        if (uploadError) {
          throw uploadError;
        }

        avatarUrl = publicChatSupabase.storage.from('media').getPublicUrl(uploadPath).data.publicUrl;
      }

      if (email && email !== currentUser.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('Vul een geldig e-mailadres in.');
      }

      const payload = {
        id: currentUser.id || undefined,
        username: currentUser.username,
        display_name: currentUser.displayName || 'Onbekend',
        email: emailChanged ? currentUser.email : (nextEmail || currentUser.email),
        bio,
        status_message: statusMessage,
        theme_mode: themeMode,
        avatar_url: avatarUrl,
        updated_at: nextUpdatedAt
      };

      let data = null;

      try {
        data = await savePublicAllowedUserProfileRow(currentUser, payload);
        if (!data) {
          throw new Error('RPC save returned no row.');
        }
      } catch (rpcError) {
        console.warn(rpcError);
        data = await updatePublicAllowedUserRow(
          currentUser,
          payload,
          'id, username, email, display_name, accent, avatar_url, updated_at, bio, status_message, theme_mode, stay_logged_in'
        );
      }

      if (!data) {
        throw new Error('Je profiel kon niet worden opgeslagen. Controleer of je account online bestaat.');
      }

      if (emailChanged) {
        const { error: authError } = await publicChatSupabase.auth.updateUser({ email: nextEmail });
        if (authError) {
          throw authError;
        }

        setEmailVerificationPending(true);
        setEmailVerificationCode('');
        setEmailVerificationMessage(`We stuurden een code naar ${nextEmail}. Vul die code hieronder in om je e-mailadres te bevestigen.`);
        setEmailVerificationError('');
      }

      setAvatarFile(null);
      const nextCurrentUser = emailChanged
        ? {
          ...currentUser,
          id: data.id || currentUser.id || '',
          ...payload,
          email: currentUser.email,
          avatar_url: data.avatar_url || avatarUrl || '',
          updated_at: data.updated_at || nextUpdatedAt
        }
        : {
          ...currentUser,
          id: data.id || currentUser.id || '',
          ...payload,
          avatar_url: data.avatar_url || avatarUrl || '',
          updated_at: data.updated_at || nextUpdatedAt
        };

      setCurrentUser(nextCurrentUser);
      setAllowedUsers((previous) =>
        previous.map((user) =>
          getPublicUserMatchFilter(user)?.value === matchFilter?.value
          && getPublicUserMatchFilter(user)?.column === matchFilter?.column
            ? {
                ...user,
                ...nextCurrentUser
              }
            : user
        )
      );

      setMessage(emailChanged ? 'Wijziging opgeslagen. Check je e-mail voor bevestiging.' : 'Instellingen opgeslagen.');
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingAuth) {
    return (
      <section className="public-page">
        <div className="public-page__shell">
          <div className="empty-state empty-state--compact">
            <strong>Instellingen laden...</strong>
            <p>We openen je openbare profiel veilig.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <PublicShell user={currentUserRecord} onSignOut={handleSignOut} statusText="Publieke instellingen">
      <section className="public-settings">
        <header className="panel public-settings__hero">
          <div className="public-settings__hero-copy">
            <span className="eyebrow">Instellingen</span>
            <h1>Beheer je publieke profiel</h1>
            <p>Werk je bio, status, profielfoto, thema en e-mailadres bij voor de public chat.</p>
          </div>

          <div className="public-settings__preview">
            <UserAvatar user={currentUserRecord} size={72} showDot />
            <div>
                <strong>{currentUserRecord?.displayName || 'Onbekend'}</strong>
              <span>{currentUserRecord?.status_message || currentUserRecord?.bio || 'Beschikbaar'}</span>
            </div>
          </div>
        </header>

        {emailVerificationPending ? (
          <section className="panel public-settings__card">
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">E-mail bevestigen</span>
              <h2>Typ de code uit je e-mail</h2>
            </div>

            <form className="public-settings__form" onSubmit={handleVerifyEmailChange}>
              <div className="public-settings__split">
                <label className="field">
                  <span>Verificatiecode</span>
                  <input
                    className="input"
                    value={emailVerificationCode}
                    onChange={(event) => setEmailVerificationCode(event.target.value)}
                    placeholder="Typ de code uit je e-mail"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                  />
                </label>
              </div>

              <div className="public-settings__actions">
                <button className="button button--primary" type="submit" disabled={emailVerificationBusy}>
                  <Check size={16} />
                  {emailVerificationBusy ? 'Verifiëren...' : 'Code verifiëren'}
                </button>
              </div>

              {emailVerificationMessage ? <p className="form-hint">{emailVerificationMessage}</p> : null}
              {emailVerificationError ? <p className="form-error">{emailVerificationError}</p> : null}
            </form>
          </section>
        ) : null}

        {recoveryMode ? (
          <section className="panel public-settings__card">
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Herstel</span>
              <h2>Stel je nieuwe wachtwoord in</h2>
            </div>

            <form className="public-settings__form" onSubmit={handleRecoveryPassword}>
              <div className="public-settings__split">
                <label className="field">
                  <span>Nieuw wachtwoord</span>
                  <input
                    className="input input--password"
                    type="password"
                    value={recoveryPassword}
                    onChange={(event) => setRecoveryPassword(event.target.value)}
                    placeholder="Nieuw wachtwoord"
                    autoComplete="new-password"
                    required
                  />
                </label>

                <label className="field">
                  <span>Herhaal wachtwoord</span>
                  <input
                    className="input input--password"
                    type="password"
                    value={recoveryConfirmPassword}
                    onChange={(event) => setRecoveryConfirmPassword(event.target.value)}
                    placeholder="Herhaal wachtwoord"
                    autoComplete="new-password"
                    required
                  />
                </label>
              </div>

              <div className="public-settings__actions">
                <button className="button button--primary" type="submit" disabled={recoveryBusy}>
                  <Check size={16} />
                  {recoveryBusy ? 'Opslaan...' : 'Wachtwoord opslaan'}
                </button>
              </div>

              {recoveryMessage ? <p className="form-hint">{recoveryMessage}</p> : null}
              {recoveryError ? <p className="form-error">{recoveryError}</p> : null}
            </form>
          </section>
        ) : null}

        <section className="panel public-settings__card">
          <div className="panel__header panel__header--compact">
            <span className="eyebrow">Profiel</span>
            <h2>Persoonlijke gegevens</h2>
          </div>

          <form className="public-settings__form" onSubmit={handleSave}>
            <div className="public-settings__avatar">
              <img
                className="public-settings__avatar-image"
                src={avatarPreview || currentUserRecord?.avatar_url || ''}
                  alt={currentUserRecord?.displayName || 'Profielfoto'}
              />
              <div className="public-settings__avatar-actions">
                <label className="button button--secondary button--compact">
                  <Camera size={16} />
                  Wijzig foto
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/*"
                    onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
                  />
                </label>
                <button className="button button--ghost button--compact" type="button" onClick={() => void handleDeleteAvatar()}>
                  <Trash2 size={16} />
                  Verwijder foto
                </button>
              </div>
            </div>

            <div className="public-settings__split">
              <label className="field">
                <span>Bio</span>
                <textarea className="input public-settings__textarea" rows={4} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Vertel iets over jezelf" />
              </label>

              <label className="field">
                <span>Status</span>
                <input className="input" value={statusMessage} onChange={(event) => setStatusMessage(event.target.value)} placeholder="Bijvoorbeeld: aan het schrijven" />
              </label>
          </div>

            <div className="public-settings__split">
              <label className="field">
                <span>Thema</span>
                <select className="input" value={themeMode} onChange={(event) => setThemeMode(event.target.value)}>
                  <option value="system">Systeem</option>
                  <option value="dark">Zwart</option>
                  <option value="light">Wit</option>
                </select>
              </label>
            </div>

            <label className="field">
              <span>E-mailadres</span>
              <div className="public-settings__email">
                <Mail size={16} />
                <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
            </label>

            <div className="public-settings__actions">
              <button className="button button--primary" type="submit" disabled={saving}>
                <Check size={16} />
                {saving ? 'Opslaan...' : 'Opslaan en toepassen'}
              </button>
              <button className="button button--secondary" type="button" onClick={() => navigate('/public/chat')}>
                <UserCircle2 size={16} />
                Naar chat
              </button>
            </div>

            {message ? <p className="form-hint">{message}</p> : null}
            {error ? <p className="form-error">{error}</p> : null}
          </form>
        </section>

        <section className="panel public-settings__card">
          <div className="panel__header panel__header--compact">
            <span className="eyebrow">Account</span>
            <h2>Snelle status</h2>
          </div>

          <div className="public-settings__summary">
            <div>
                <strong>Welkom, {currentUserRecord?.displayName || 'Onbekend'}</strong>
            </div>
            <div>
              <span className="eyebrow">Laatste wijziging</span>
              <p>{currentUserRecord?.updated_at ? new Date(currentUserRecord.updated_at).toLocaleString('nl-BE') : 'Onbekend'}</p>
            </div>
          </div>
        </section>

        {!isPublicChatSupabaseConfigured ? (
          <div className="empty-state empty-state--compact">
            <strong>Public Supabase staat nog niet klaar.</strong>
            <p>Koppel eerst de public database zodat de instellingen online kunnen opslaan.</p>
          </div>
        ) : null}
      </section>
    </PublicShell>
  );
}
