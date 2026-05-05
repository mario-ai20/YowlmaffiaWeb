import { ArrowRight, RefreshCw, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import BrandMark from '../components/BrandMark';
import RichTextContent from '../components/RichTextContent';
import { publicChatSupabase, isPublicChatSupabaseConfigured, supabase } from '../utils/supabase';
import {
  ensurePublicAllowedUserRow,
  loadPublicAllowedUsers,
  publicUsernameToEmail,
  resolvePublicUserFromSession,
  savePublicAllowedUserProfileRow
} from '../utils/publicUsers';
import { useNavigate } from 'react-router';

const PASSWORD_PLACEHOLDER = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

function InfoBlock({ eyebrow, title, body, textColor }) {
  return (
    <article className="panel public-block" style={textColor ? { color: textColor } : undefined}>
      <span className="eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <RichTextContent text={body} />
    </article>
  );
}

export default function PublicHomePage() {
  const navigate = useNavigate();
  const [view, setView] = useState('home');
  const [infoBlock, setInfoBlock] = useState({ title: 'YOWLMAFFIA', body: 'Welkom op het publieke deel van YOWLMAFFIA.', textColor: '' });
  const [rulesBlock, setRulesBlock] = useState({ title: 'Regels', body: 'Wees vriendelijk, respectvol en hou de chat proper.', textColor: '' });
  const [publicUsers, setPublicUsers] = useState([]);
  const [loginIdentity, setLoginIdentity] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginStage, setLoginStage] = useState('credentials');
  const [loginCodePurpose, setLoginCodePurpose] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginCode, setLoginCode] = useState('');
  const [loginHint, setLoginHint] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerBirthDate, setRegisterBirthDate] = useState('');
  const [registerGender, setRegisterGender] = useState('zeg ik liever niet');
  const [registerEmailMfaEnabled, setRegisterEmailMfaEnabled] = useState(true);
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [pendingSignupProfile, setPendingSignupProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loginFailedAttempts, setLoginFailedAttempts] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  useEffect(() => {
    if (!publicChatSupabase) {
      return undefined;
    }

    let cancelled = false;

    async function bootstrapPublicBlocks() {
      const [infoResult, rulesResult, allowedResult] = await Promise.all([
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'current').maybeSingle(),
        publicChatSupabase.from('app_info_blocks').select('*').eq('id', 'rules').maybeSingle(),
        loadPublicAllowedUsers().catch(() => [])
      ]);

      if (cancelled) {
        return;
      }

      if (infoResult?.data) {
        setInfoBlock({
          title: String(infoResult.data.title || 'YOWLMAFFIA').trim() || 'YOWLMAFFIA',
          body: String(infoResult.data.body || '').trim() || 'Welkom op het publieke deel van YOWLMAFFIA.',
          textColor: String(infoResult.data.text_color || '').trim()
        });
      }

      if (rulesResult?.data) {
        setRulesBlock({
          title: String(rulesResult.data.title || 'Regels').trim() || 'Regels',
          body: String(rulesResult.data.body || '').trim() || 'Wees vriendelijk, respectvol en hou de chat proper.',
          textColor: String(rulesResult.data.text_color || '').trim()
        });
      }

      setPublicUsers(Array.isArray(allowedResult) ? allowedResult : []);
    }

    bootstrapPublicBlocks();

    const infoChannel = publicChatSupabase
      .channel('public-home-info-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_info_blocks' }, bootstrapPublicBlocks)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(infoChannel);
    };
  }, []);

  useEffect(() => {
    if (!forgotOpen) {
      setForgotMessage('');
      setForgotError('');
    }
  }, [forgotOpen]);

  useEffect(() => {
    if (view !== 'login') {
      setLoginStage('credentials');
      setLoginCodePurpose('login');
      setLoginEmail('');
      setLoginCode('');
      setLoginHint('');
      setPendingSignupProfile(null);
    }
  }, [view]);

  function maskEmail(emailAddress = '') {
    const value = String(emailAddress || '').trim();
    if (!value.includes('@')) {
      return value;
    }

    const [local, domain] = value.split('@');
    const [host, ...rest] = domain.split('.');
    const maskedLocal = local.length <= 2 ? `${local.slice(0, 1)}*` : `${local.slice(0, 2)}***`;
    const maskedHost = host.length <= 1 ? `${host.slice(0, 1)}*` : `${host.slice(0, 1)}***`;

    return `${maskedLocal}@${maskedHost}${rest.length ? `.${rest.join('.')}` : ''}`;
  }

  function resetLoginFlow() {
    setLoginStage('credentials');
    setLoginCodePurpose('login');
    setLoginEmail('');
    setLoginCode('');
    setLoginHint('');
  }

  async function handleInternalAccess() {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (signOutError) {
      console.warn('Internal session sign-out before login failed.', signOutError);
    } finally {
      navigate('/login?force=1', { replace: true });
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();

    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const identity = loginIdentity.trim();
      const isEmail = identity.includes('@');
      const email = isEmail ? identity : publicUsernameToEmail(identity, publicUsers);

      if (!email) {
        throw new Error('We vinden dit account niet terug.');
      }

      const result = await publicChatSupabase.auth.signInWithPassword({
        email,
        password: loginPassword
      });

      if (result.error) {
        setLoginFailedAttempts((count) => count + 1);
        throw result.error;
      }

      const resolvedUser = resolvePublicUserFromSession(result.data?.session || null, publicUsers);
      const requiresEmailMfa = resolvedUser?.email_mfa_enabled !== false;

      setLoginFailedAttempts(0);

      if (!requiresEmailMfa) {
        await ensurePublicAllowedUserRow().catch(() => null);
        setMessage('Je bent ingelogd. De publieke chat opent nu.');
        setLoginPassword('');
        resetLoginFlow();
        navigate('/public/dashboard');
        return;
      }

      await publicChatSupabase.auth.signOut();

      const { error: otpError } = await publicChatSupabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false
        }
      });

      if (otpError) {
        throw otpError;
      }

      setLoginStage('otp');
      setLoginEmail(email);
      setLoginCode('');
      setLoginPassword('');
      setLoginHint(`We hebben een inlogcode gestuurd naar ${maskEmail(email)}.`);
      setMessage('');
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'Inloggen mislukt.');
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyLoginCode(event) {
    event.preventDefault();

    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    const nextCode = String(loginCode || '').trim();
    if (!nextCode) {
      setError('Vul de code in die je per mail kreeg.');
      return;
    }

    if (!loginEmail) {
      setError('We missen je e-mailadres. Log opnieuw in.');
      resetLoginFlow();
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const nextPurpose = loginCodePurpose;
      const { data, error } = await publicChatSupabase.auth.verifyOtp({
        email: loginEmail,
        token: nextCode,
        type: nextPurpose === 'signup'
          ? 'signup'
          : nextPurpose === 'recovery'
            ? 'recovery'
            : 'email'
      });

      if (error) {
        throw error;
      }

      await ensurePublicAllowedUserRow().catch(() => null);
      setLoginFailedAttempts(0);
      resetLoginFlow();
      if (nextPurpose === 'recovery') {
        navigate('/public/settings?mode=recovery', { replace: true });
        return;
      }

      if (nextPurpose === 'signup' && pendingSignupProfile) {
        await savePublicAllowedUserProfileRow(
          data.session?.user || {
            id: data.session?.user?.id || '',
            auth_user_id: data.session?.user?.id || '',
            username: pendingSignupProfile.username,
            displayName: pendingSignupProfile.display_name,
            name: pendingSignupProfile.display_name,
            email: pendingSignupProfile.email
          },
          pendingSignupProfile
        ).catch(() => null);
      }

      setPendingSignupProfile(null);
      navigate('/public/dashboard');
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'De code klopt niet of is verlopen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleResendLoginCode() {
    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    if (!loginEmail) {
      setError('Log eerst opnieuw in om een nieuwe code te sturen.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = loginCodePurpose === 'signup'
        ? await publicChatSupabase.auth.resend({
          type: 'signup',
          email: loginEmail
        })
        : loginCodePurpose === 'recovery'
          ? await publicChatSupabase.auth.resetPasswordForEmail(loginEmail)
        : await publicChatSupabase.auth.signInWithOtp({
          email: loginEmail,
          options: {
            shouldCreateUser: false
          }
        });

      const { error } = result;

      if (error) {
        throw error;
      }

      setLoginHint(`We stuurden een nieuwe code naar ${maskEmail(loginEmail)}.`);
    } catch (formError) {
      setError(formError instanceof Error ? formError.message : 'We konden geen nieuwe code sturen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();

    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (!registerUsername.trim() || !registerEmail.trim() || !registerBirthDate || !registerPassword || !registerConfirmPassword) {
        throw new Error('Vul alle verplichte velden in.');
      }

      if (registerPassword !== registerConfirmPassword) {
        throw new Error('Wachtwoorden komen niet overeen.');
      }

      const nextUsername = registerUsername.trim();
      const nextEmail = registerEmail.trim();
      const normalizedUsername = nextUsername.toLowerCase();
      const normalizedEmail = nextEmail.toLowerCase();

      if (publicUsers.some((user) => String(user.username || '').trim().toLowerCase() === normalizedUsername)) {
        throw new Error('Deze gebruikersnaam is al in gebruik.');
      }

      if (publicUsers.some((user) => String(user.email || '').trim().toLowerCase() === normalizedEmail)) {
        throw new Error('Dit e-mailadres is al gekoppeld aan een account.');
      }

      const nextGender = String(registerGender || '').trim() || 'zeg ik liever niet';

      const result = await publicChatSupabase.auth.signUp({
        email: nextEmail,
        password: registerPassword,
        options: {
          data: {
            username: nextUsername,
            name: nextUsername,
            display_name: nextUsername,
            birth_date: registerBirthDate,
            gender: nextGender,
            email_mfa_enabled: registerEmailMfaEnabled
          }
        }
      });

      if (result.error) {
        throw result.error;
      }

      if (result.data?.session) {
        await ensurePublicAllowedUserRow().catch(() => null);
      }

      const nextProfile = {
        id: result.data?.user?.id || result.data?.session?.user?.id || '',
        username: nextUsername,
        name: nextUsername,
        display_name: nextUsername,
        email: nextEmail,
        birth_date: registerBirthDate,
        bio: '',
        status_message: '',
        gender: nextGender,
        theme_mode: 'system',
        email_mfa_enabled: Boolean(registerEmailMfaEnabled),
        avatar_url: '',
        updated_at: new Date().toISOString()
      };

      setPendingSignupProfile(nextProfile);

      setMessage('Account aangemaakt. Vul de verificatiecode uit je e-mail in om verder te gaan.');
      setView('login');
      setLoginIdentity(registerEmail.trim());
      setLoginEmail(registerEmail.trim());
      setLoginStage('otp');
      setLoginCodePurpose('signup');
      setLoginCode('');
      setLoginHint(`We hebben een verificatiecode gestuurd naar ${maskEmail(registerEmail.trim())}.`);
      setLoginPassword('');
    } catch (formError) {
      const nextError =
        formError && typeof formError === 'object'
          ? String(formError.message || formError.error_description || formError.details || formError.hint || '')
          : '';
      setError(nextError || (formError instanceof Error ? formError.message : 'Account aanmaken mislukt.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotSubmit(event) {
    event?.preventDefault?.();

    if (!publicChatSupabase) {
      setError('Supabase is nog niet gekoppeld voor de public chat.');
      return;
    }

    setForgotBusy(true);
    setForgotError('');
    setForgotMessage('');

    try {
      const result = await publicChatSupabase.auth.resetPasswordForEmail(forgotEmail.trim());

      if (result.error) {
        throw result.error;
      }

      setForgotOpen(false);
      setView('login');
      setLoginStage('otp');
      setLoginCodePurpose('recovery');
      setLoginEmail(forgotEmail.trim());
      setLoginIdentity(forgotEmail.trim());
      setLoginCode('');
      setLoginHint(`We hebben een herstelcode gestuurd naar ${maskEmail(forgotEmail.trim())}.`);
      setForgotMessage('We stuurden een herstelcode naar je adres.');
    } catch (formError) {
      setForgotError(formError instanceof Error ? formError.message : 'Resetmail versturen mislukt.');
    } finally {
      setForgotBusy(false);
    }
  }

  return (
    <section className="public-page">
      <button
        className="public-page__internal-button button button--ghost"
        type="button"
        onClick={() => void handleInternalAccess()}
      >
        <Shield size={16} />
        Interne toegang
      </button>

      <div className="public-page__shell">
        <header className="public-page__hero panel">
          <div className="public-page__hero-brand">
            <BrandMark stacked subtitle="" />
            <div>
              <span className="eyebrow">Open community</span>
              <h1>YOWLMAFFIA</h1>
              <p>Een publieke omgeving om te praten, delen en samen muziek te volgen.</p>
            </div>
          </div>

        </header>

        <div className="public-page__grid">
          <InfoBlock
            eyebrow="Info"
            title={infoBlock.title}
            body={infoBlock.body}
            textColor={infoBlock.textColor}
          />
          <InfoBlock
            eyebrow="Regels"
            title={rulesBlock.title}
            body={rulesBlock.body}
            textColor={rulesBlock.textColor}
          />
        </div>

        <section className="panel public-page__auth">
          <div className="panel__header panel__header--compact">
            <span className="eyebrow">{view === 'register' ? 'Registreren' : 'Inloggen'}</span>
            <h2>{view === 'register' ? 'Nieuw account' : 'Toegang tot de public chat'}</h2>
            <button className="button button--ghost button--small" type="button" onClick={() => setView(view === 'register' ? 'login' : 'register')}>
              <ArrowRight size={16} />
              {view === 'register' ? 'Naar inloggen' : 'Naar registreren'}
            </button>
          </div>

          {!isPublicChatSupabaseConfigured ? (
            <div className="empty-state empty-state--compact">
              <strong>Public Supabase staat nog niet klaar.</strong>
              <p>Koppel eerst je public project zodat inloggen en registreren online kunnen draaien.</p>
            </div>
          ) : null}

          {view === 'register' ? (
            <form className="public-auth-form" onSubmit={handleRegisterSubmit}>
              <div className="public-auth-form__split">
                <label className="field">
                  <span>Naam (username)</span>
                  <input className="input" value={registerUsername} onChange={(event) => setRegisterUsername(event.target.value)} placeholder="Naam waarmee je inlogt" required />
                </label>
                <label className="field">
                  <span>E-mailadres</span>
                  <input className="input" type="email" value={registerEmail} onChange={(event) => setRegisterEmail(event.target.value)} placeholder="jij@mail.com" required />
                </label>
              </div>

              <div className="public-auth-form__split">
                <label className="field">
                  <span>Geboortedatum</span>
                  <input className="input" type="date" value={registerBirthDate} onChange={(event) => setRegisterBirthDate(event.target.value)} required />
                </label>
                <label className="field">
                  <span>Geslacht</span>
                  <select className="input" value={registerGender} onChange={(event) => setRegisterGender(event.target.value)}>
                    <option value="man">Man</option>
                    <option value="vrouw">Vrouw</option>
                    <option value="zeg ik liever niet">Zeg ik liever niet</option>
                  </select>
                </label>
              </div>

              <div className="public-auth-form__split">
                <label className="field">
                  <span>Wachtwoord</span>
                  <input className="input input--password" type="password" value={registerPassword} onChange={(event) => setRegisterPassword(event.target.value)} placeholder={PASSWORD_PLACEHOLDER} required />
                </label>
                <label className="field">
                  <span>MFA via mail</span>
                  <div className="settings-menu__toggle public-auth-form__toggle">
                    <div className="settings-menu__toggle-copy">
                      <strong>Mailcode bij inloggen</strong>
                      <span>Vraag na je wachtwoord nog een e-mailcode bij het inloggen.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={registerEmailMfaEnabled}
                      onChange={(event) => setRegisterEmailMfaEnabled(event.target.checked)}
                      aria-label="MFA via mail bij registratie"
                    />
                  </div>
                </label>
              </div>

              <label className="field">
                <span>Herhaal wachtwoord</span>
                <input className="input input--password" type="password" value={registerConfirmPassword} onChange={(event) => setRegisterConfirmPassword(event.target.value)} placeholder={PASSWORD_PLACEHOLDER} required />
              </label>

              <button className="button button--primary button--full" type="submit" disabled={busy}>
                {busy ? 'Account maken...' : 'Account aanmaken'}
              </button>
            </form>
          ) : (
            <form className="public-auth-form" onSubmit={handleLoginSubmit}>
              {loginStage === 'otp' ? (
                <div className="public-auth-form__forgot">
                  <p className="muted-copy">
                    {loginHint || `We hebben een ${loginCodePurpose === 'recovery' ? 'herstelcode' : 'verificatiecode'} gestuurd naar ${maskEmail(loginEmail)}.`}
                  </p>
                  <label className="field">
                    <span>{loginCodePurpose === 'recovery' ? 'Herstelcode' : 'Verificatiecode'}</span>
                    <input
                      className="input"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={loginCode}
                      onChange={(event) => setLoginCode(event.target.value)}
                      placeholder="Typ de code uit je e-mail"
                      required
                    />
                  </label>
                  <div className="login-form__actions login-reset__actions">
                    <button className="button button--ghost" type="button" disabled={busy} onClick={resetLoginFlow}>
                      Terug
                    </button>
                    <button className="button button--ghost" type="button" disabled={busy} onClick={() => void handleResendLoginCode()}>
                      <RefreshCw size={16} />
                      Code opnieuw sturen
                    </button>
                  </div>
                  <button className="button button--primary button--full" type="button" onClick={(event) => void handleVerifyLoginCode(event)} disabled={busy}>
                    {busy ? 'Verifiëren...' : 'Code verifiëren'}
                  </button>
                </div>
              ) : (
                <>
              <label className="field">
                <span>Naam, username of e-mail</span>
                <input className="input" value={loginIdentity} onChange={(event) => setLoginIdentity(event.target.value)} placeholder="Typ je naam, username of e-mail" required />
              </label>

              <label className="field">
                <span>Wachtwoord</span>
                <input className="input input--password" type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} placeholder={PASSWORD_PLACEHOLDER} required />
              </label>

              {loginFailedAttempts >= 3 ? (
                <button className="button button--secondary button--full" type="button" onClick={() => setForgotOpen((value) => !value)}>
                  <RefreshCw size={16} />
                  Wachtwoord vergeten?
                </button>
              ) : null}

              {forgotOpen ? (
                <div className="public-auth-form__forgot">
                  <p className="muted-copy">Vul je e-mailadres in en we sturen een resetlink naar je public account.</p>
                  <label className="field">
                    <span>E-mailadres</span>
                    <input className="input" type="email" value={forgotEmail} onChange={(event) => setForgotEmail(event.target.value)} placeholder="jouw@mailadres.be" required />
                  </label>
                  <div className="login-form__actions login-reset__actions">
                    <button className="button button--ghost" type="button" disabled={forgotBusy} onClick={() => setForgotOpen(false)}>
                      Terug
                    </button>
                    <button className="button button--primary" type="button" onClick={() => void handleForgotSubmit()} disabled={forgotBusy}>
                      {forgotBusy ? 'Versturen...' : 'Stuur resetmail'}
                    </button>
                  </div>
                </div>
              ) : null}

              <button className="button button--primary button--full" type="submit" disabled={busy}>
                {busy ? 'Inloggen...' : 'Inloggen'}
              </button>
                </>
              )}
            </form>
          )}

          {message ? <p className="form-hint">{message}</p> : null}
          {error ? <p className="form-error">{error}</p> : null}
          {forgotMessage ? <p className="form-hint">{forgotMessage}</p> : null}
          {forgotError ? <p className="form-error">{forgotError}</p> : null}
        </section>

      </div>
    </section>
  );
}

