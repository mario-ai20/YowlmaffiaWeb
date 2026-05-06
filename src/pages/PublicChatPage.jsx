import { ArrowRight, CornerUpLeft, Edit3, MessageSquarePlus, Paperclip, RefreshCw, Send, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import PublicShell from '../components/PublicShell';
import PublicUserProfileDialog from '../components/PublicUserProfileDialog';
import UserAvatar from '../components/UserAvatar';
import { publicChatSupabase, isPublicChatSupabaseConfigured } from '../utils/supabase';
import { getAttachmentPreview } from '../utils/chat';
import {
  ensurePublicAllowedUserRow,
  findPublicAllowedUser,
  loadPublicAllowedUsers,
  normalizePublicUsername,
  PUBLIC_PRESENCE_STALE_MS,
  getPublicUserDisplayLabel,
  resolvePublicPresenceLabel,
  resolvePublicUserAvatar,
  resolvePublicUserFromSession,
  updatePublicAllowedUserRow
} from '../utils/publicUsers';
import { formatRelativeTime } from '../utils/dates';

function getBrusselsDateKey(timestamp) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(timestamp));

  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '00';
  const day = parts.find((part) => part.type === 'day')?.value || '00';
  return `${year}-${month}-${day}`;
}

function formatCountdownToMidnight(timestamp) {
  const now = new Date(timestamp);
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);

  const remainingMs = Math.max(0, nextMidnight.getTime() - now.getTime());
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function getPublicChatIdentitySet(user) {
  return new Set(
    [
      user?.auth_user_id,
      user?.id,
      user?.username,
      user?.displayName,
      user?.name,
      user?.email
    ]
      .map((value) => normalizePublicUsername(value))
      .filter(Boolean)
  );
}

function isPublicChatOwnMessage(message, currentUser, allowedUsers = []) {
  const senderLabel = String(message?.sender || '').trim();
  const isAlertMessage = String(message?.attachment_type || '').trim() === 'application/x-yowlmaffia-alert';
  const senderUser = findPublicAllowedUser(senderLabel, allowedUsers);
  const currentKeys = getPublicChatIdentitySet(currentUser);
  const senderKeys = new Set(
    [
      senderLabel,
      isAlertMessage ? message?.recipient : '',
      senderUser?.auth_user_id,
      senderUser?.id,
      senderUser?.username,
      senderUser?.displayName,
      senderUser?.name,
      senderUser?.email
    ]
      .map((value) => normalizePublicUsername(value))
      .filter(Boolean)
  );

  for (const key of senderKeys) {
    if (currentKeys.has(key)) {
      return true;
    }
  }

  return false;
}

function RelativeTimeText({ value }) {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (!value) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setTick(Date.now());
    }, 1800000);

    return () => window.clearInterval(timer);
  }, [value]);

  return value ? formatRelativeTime(value, tick) : 'zojuist';
}

function MidnightCountdownChip() {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="public-chat__midnight-chip" aria-live="polite">
      <span>Chat reset om 00:00</span>
      <strong>{formatCountdownToMidnight(tick)}</strong>
    </div>
  );
}

export default function PublicChatPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [allowedUsers, setAllowedUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [chatError, setChatError] = useState('');
  const [replyingMessage, setReplyingMessage] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingDraft, setEditingDraft] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [presenceTick, setPresenceTick] = useState(() => Date.now());
  const listRef = useRef(null);
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const dailyResetRef = useRef('');

  function createFallbackSenderProfile(sender = '') {
    const nextLabel = String(sender || 'Onbekend').trim() || 'Onbekend';
    const isAlertProfile = normalizePublicUsername(nextLabel) === 'yowlmaffia';
    return {
      id: nextLabel,
      auth_user_id: '',
      username: nextLabel,
      displayName: nextLabel,
      name: nextLabel,
      email: '',
      birth_date: '',
      email_mfa_enabled: true,
      accent: isAlertProfile ? '#ff445f' : '#72d4ff',
      avatar_url: '',
      updated_at: '',
      last_online_at: '',
      bio: '',
      status_message: '',
      theme_mode: 'system',
      gender: 'zeg ik liever niet'
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

      setSession(initialSession);
      setAllowedUsers(nextUsers);
      setCurrentUser(resolvedUser);
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

  const visibleAllowedUsers = useMemo(() => {
    if (!currentUser) {
      return allowedUsers;
    }

    const currentKey = normalizePublicUsername(
      currentUser.auth_user_id || currentUser.id || currentUser.username || currentUser.email || currentUser.displayName
    );
    const matchesCurrent = allowedUsers.some((user) => {
      const candidateKey =
        normalizePublicUsername(user.auth_user_id || user.id || user.username || user.email || user.displayName);
      return currentKey && candidateKey && currentKey === candidateKey;
    });

    if (matchesCurrent) {
      return allowedUsers;
    }

    return [...allowedUsers, currentUser];
  }, [allowedUsers, currentUser]);

  const onlinePeople = useMemo(() => {
    return visibleAllowedUsers.filter((user) => resolvePublicPresenceLabel(user, presenceTick, PUBLIC_PRESENCE_STALE_MS, currentUser?.username) === 'online');
  }, [visibleAllowedUsers, currentUser?.username, presenceTick]);

  const offlinePeople = useMemo(() => {
    return visibleAllowedUsers.filter((user) => resolvePublicPresenceLabel(user, presenceTick, PUBLIC_PRESENCE_STALE_MS, currentUser?.username) === 'offline');
  }, [visibleAllowedUsers, currentUser?.username, presenceTick]);

  useEffect(() => {
    if (!publicChatSupabase || !currentUser) {
      setMessages([]);
      setMessagesLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function loadMessages() {
      setMessagesLoading(true);
      const { data, error } = await publicChatSupabase
        .from('messages')
        .select('*')
        .or('room_key.eq.public,scope.eq.public')
        .order('created_at', { ascending: true });

      if (!cancelled) {
        if (error) {
          console.error(error);
          setMessages([]);
        } else {
          setMessages((data || []).filter((message) => message?.room_key === 'public' || message?.scope === 'public'));
        }
        setMessagesLoading(false);
      }
    }

    loadMessages();

    const channel = publicChatSupabase
      .channel('public-chat-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadMessages)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(channel);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!publicChatSupabase || !currentUser) {
      return undefined;
    }

    let cancelled = false;

    async function reloadAllowedUsers() {
      const users = await loadPublicAllowedUsers().catch(() => []);
      if (!cancelled) {
        setAllowedUsers(Array.isArray(users) ? users : []);
      }
    }

    reloadAllowedUsers();

    const channel = publicChatSupabase
      .channel('public-chat-allowed-users-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'allowed_users' }, reloadAllowedUsers)
      .subscribe();

    return () => {
      cancelled = true;
      publicChatSupabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUser?.username]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPresenceTick(Date.now());
    }, 1800000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!publicChatSupabase || !currentUser) {
      return undefined;
    }

    const todayKey = getBrusselsDateKey(presenceTick);
    if (dailyResetRef.current === todayKey) {
      return undefined;
    }

    let cancelled = false;

    async function ensureDailyReset() {
      try {
        const { data, error } = await publicChatSupabase.rpc('clear_public_chat_messages');
        if (error) {
          throw error;
        }

        if (cancelled) {
          return;
        }

        dailyResetRef.current = todayKey;

        if (data) {
          await reloadMessages();
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
        }
      }
    }

    void ensureDailyReset();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.username, presenceTick]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setReplyingMessage(null);
    setEditingMessageId('');
    setEditingDraft('');
    setSelectedProfile(null);
  }, [currentUser?.username]);

  useEffect(() => {
    if (currentUser) {
      window.setTimeout(() => composerRef.current?.focus?.(), 0);
    }
  }, [currentUser?.username]);

  async function reloadMessages() {
    if (!publicChatSupabase || !currentUser) {
      return;
    }

    const { data, error } = await publicChatSupabase
      .from('messages')
      .select('*')
      .or('room_key.eq.public,scope.eq.public')
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setMessages((data || []).filter((message) => message?.room_key === 'public' || message?.scope === 'public'));
  }

  function openProfile(user) {
    setSelectedProfile(user);
  }

  function startReplyMessage(message) {
    setReplyingMessage({
      id: message.id,
      sender: message.sender || '',
      body: message.body || '',
      created_at: message.created_at || ''
    });
    setEditingMessageId('');
    setEditingDraft('');
    setChatError('');
    window.setTimeout(() => composerRef.current?.focus?.(), 0);
  }

  function cancelReplyMessage() {
    setReplyingMessage(null);
    window.setTimeout(() => composerRef.current?.focus?.(), 0);
  }

  function startEditMessage(message) {
    setEditingMessageId(message.id);
    setEditingDraft(message.body || '');
    setReplyingMessage(null);
    setChatError('');
  }

  function cancelEditMessage() {
    setEditingMessageId('');
    setEditingDraft('');
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!publicChatSupabase || !currentUser) {
      return;
    }

    const nextBody = draft.trim();
    if (!nextBody && !attachment) {
      return;
    }

    setSending(true);
    setChatError('');

    try {
      await ensurePublicAllowedUserRow().catch(() => null);

      let attachmentUrl = null;
      let attachmentType = null;

      if (attachment) {
        const safeName = `${Date.now()}-${attachment.name.replaceAll(' ', '-').replace(/[^a-zA-Z0-9._-]/g, '')}`;
        const storagePath = `chat/public/${safeName}`;
        const { error: uploadError } = await publicChatSupabase.storage.from('media').upload(storagePath, attachment, {
          contentType: attachment.type,
          upsert: false
        });

        if (uploadError) {
          throw uploadError;
        }

        attachmentUrl = publicChatSupabase.storage.from('media').getPublicUrl(storagePath).data.publicUrl;
        attachmentType = attachment.type || 'application/octet-stream';
      }

      const senderUsername =
        String(
          currentUser.username ||
            currentUser.displayName ||
            currentUser.name ||
            currentUser.email ||
            'Onbekend'
        ).trim() || 'Onbekend';
      const payload = {
        scope: 'public',
        room_key: 'public',
        sender: senderUsername,
        recipient: null,
        body: nextBody || (attachment ? attachment.name : ''),
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        reply_to_message_id: replyingMessage?.id || null,
        reply_to_sender: replyingMessage?.sender || null,
        reply_to_body: replyingMessage?.body || null,
        reply_to_created_at: replyingMessage?.created_at || null
      };

      const { error } = await publicChatSupabase.from('messages').insert(payload);
      if (error) {
        throw error;
      }

      const nextOnlineAt = new Date().toISOString();
      await updatePublicAllowedUserRow(currentUser, { last_online_at: nextOnlineAt, updated_at: nextOnlineAt });

      setDraft('');
      setAttachment(null);
      cancelReplyMessage();
      await reloadMessages();
      window.setTimeout(() => composerRef.current?.focus?.(), 0);
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht versturen mislukt.');
    } finally {
      setSending(false);
    }
  }

  async function handleSaveEditedMessage(message) {
    if (!publicChatSupabase || !currentUser) {
      return;
    }

    const nextBody = editingDraft.trim();
    if (!nextBody) {
      setChatError('Bericht mag niet leeg zijn.');
      return;
    }

    try {
      const { error } = await publicChatSupabase.from('messages').update({ body: nextBody }).eq('id', message.id);
      if (error) {
        throw error;
      }

      cancelEditMessage();
      await reloadMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht bijwerken mislukt.');
    }
  }

  async function handleDeleteMessage(message) {
    const confirmed = typeof window !== 'undefined' ? window.confirm('Weet je zeker dat je dit bericht wilt verwijderen?') : false;
    if (!confirmed || !publicChatSupabase || !currentUser) {
      return;
    }

    const isOwnMessage = isPublicChatOwnMessage(message, currentUser, allowedUsers);

    if (!isOwnMessage) {
      setChatError('Je kan alleen je eigen berichten verwijderen.');
      return;
    }

    try {
      const { error } = await publicChatSupabase.from('messages').delete().eq('id', message.id);
      if (error) {
        throw error;
      }

      if (editingMessageId === message.id) {
        cancelEditMessage();
      }

      await reloadMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht verwijderen mislukt.');
    }
  }

  async function handleSignOut() {
    if (!publicChatSupabase) {
      navigate('/');
      return;
    }

    await publicChatSupabase.auth.signOut();
    navigate('/');
  }

  const statusText = onlinePeople.length ? `${onlinePeople.length} online` : 'Alles bijgewerkt';

  if (loadingAuth) {
    return (
      <section className="public-page">
        <div className="public-page__shell">
          <div className="empty-state empty-state--compact">
            <strong>Public chat laden...</strong>
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
      <section className="public-chat">
        <div className="public-chat__layout">
          <div className="panel public-chat__main">
            <div className="panel__header panel__header--compact public-chat__header">
              <div>
                <span className="eyebrow">Public chat</span>
                <h2>Chat met de community</h2>
              </div>
              <button className="button button--ghost button--compact" type="button" onClick={() => void reloadMessages()}>
                <RefreshCw size={16} />
                Herladen
              </button>
            </div>

              <div className="public-chat__messages" ref={listRef}>
                {messagesLoading ? (
                  <div className="empty-state empty-state--compact public-chat__empty-state">
                    <strong>Berichten laden...</strong>
                    <p>We halen de publieke chat uit Supabase.</p>
                  </div>
                ) : messages.length ? (
                messages.map((message) => {
                  const senderLabel = String(message.sender || '').trim() || 'Onbekend';
                  const senderUser = findPublicAllowedUser(senderLabel, allowedUsers) || null;
                  const senderProfile = senderUser || createFallbackSenderProfile(senderLabel);
                  const isOwnMessage = isPublicChatOwnMessage(message, currentUser, allowedUsers);
                  const isAlertMessage = String(message.attachment_type || '').trim() === 'application/x-yowlmaffia-alert';
                  const replySource = message.reply_to_sender || '';
                  const attachmentPreview = getAttachmentPreview(message.attachment_url, message.attachment_type, message.body || 'attachment');

                  return (
                    <article key={message.id} className={`public-chat__message ${isOwnMessage ? 'is-own' : ''} ${isAlertMessage ? 'is-alert' : ''}`.trim()}>
                      <button className="public-chat__message-avatar" type="button" onClick={() => openProfile(senderProfile)}>
                        <UserAvatar user={senderProfile} name={senderLabel} size={40} showDot />
                      </button>

                      <div className="public-chat__message-body">
                        <div className="public-chat__message-meta">
                          <button className="public-chat__message-name" type="button" onClick={() => openProfile(senderProfile)}>
                            {isAlertMessage ? 'YOWLMAFFIA' : getPublicUserDisplayLabel(senderProfile)}
                          </button>
                          <span className="public-chat__message-time">
                            <RelativeTimeText value={message.created_at} />
                          </span>
                        </div>

                        {replySource ? (
                          <div className="public-chat__reply-preview">
                            <span>Antwoord op {replySource}</span>
                            <p>{message.reply_to_body || 'Verwijderd bericht'}</p>
                          </div>
                        ) : null}

                        {editingMessageId === message.id ? (
                          <div className="public-chat__edit">
                            <textarea
                              className="input public-chat__textarea"
                              rows={3}
                              value={editingDraft}
                              onChange={(event) => setEditingDraft(event.target.value)}
                            />
                            <div className="public-chat__actions">
                              <button className="button button--ghost button--compact" type="button" onClick={cancelEditMessage}>
                                Annuleren
                              </button>
                              <button className="button button--primary button--compact" type="button" onClick={() => void handleSaveEditedMessage(message)}>
                                Opslaan
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="public-chat__message-text">{message.body || 'Geen berichttekst.'}</p>
                        )}

                        {attachmentPreview ? (
                          <div className="chat-bubble__attachment">
                            {attachmentPreview.kind === 'image' ? <img src={attachmentPreview.url} alt={message.body || 'attachment'} /> : null}
                            {attachmentPreview.kind === 'video' ? <video src={attachmentPreview.url} controls playsInline /> : null}
                            {attachmentPreview.kind === 'audio' ? <audio src={attachmentPreview.url} controls /> : null}
                            {attachmentPreview.kind === 'file' ? (
                              <a href={attachmentPreview.url} target="_blank" rel="noreferrer">
                                Open bestand
                              </a>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="public-chat__actions">
                          <button className="button button--ghost button--compact" type="button" onClick={() => startReplyMessage(message)}>
                            <CornerUpLeft size={16} />
                            Reageer
                          </button>

                          {isOwnMessage ? (
                            <>
                              <button className="button button--ghost button--compact" type="button" onClick={() => startEditMessage(message)}>
                                <Edit3 size={16} />
                                Bewerken
                              </button>
                              <button className="button button--danger button--compact" type="button" onClick={() => void handleDeleteMessage(message)}>
                                <Trash2 size={16} />
                                Verwijder
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
                ) : (
                  <div className="empty-state empty-state--compact public-chat__empty-state">
                    <strong>Nog geen berichten</strong>
                    <p>Wees de eerste die iets in de public chat zet.</p>
                  </div>
                )}
            </div>

            <form className="public-chat__composer" onSubmit={handleSendMessage}>
              {replyingMessage ? (
                <div className="public-chat__replying">
                  <span>Je antwoordt op {replyingMessage.sender || 'iemand'}</span>
                  <p>{replyingMessage.body || 'Verwijderd bericht'}</p>
                  <button className="button button--ghost button--compact" type="button" onClick={cancelReplyMessage}>
                    Annuleren
                  </button>
                </div>
              ) : null}

              <label className="field">
                <span>Bericht</span>
                <textarea
                  ref={composerRef}
                  className="input public-chat__composer-input"
                  rows={4}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={false}
                  readOnly={false}
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSendMessage(event);
                    }
                  }}
                  placeholder="Typ hier je bericht..."
                />
              </label>

              <div className="public-chat__composer-actions">
                <button className="button button--secondary" type="button" onClick={() => navigate('/public/dashboard')}>
                  <ArrowRight size={16} />
                  Naar dashboard
                </button>
                <button className="icon-button icon-button--small" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Bijlage">
                  <Paperclip size={16} />
                </button>
                <button className="button button--primary" type="submit" disabled={sending}>
                  <Send size={16} />
                  {sending ? 'Versturen...' : 'Bericht sturen'}
                </button>
                <MidnightCountdownChip />
              </div>

              <input
                ref={fileInputRef}
                hidden
                type="file"
                accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setAttachment(file);
                  event.target.value = '';
                }}
              />

              {attachment ? <div className="chat-page__attachment-chip">Bijlage klaar: {attachment.name}</div> : null}

              {chatError ? <p className="form-error">{chatError}</p> : null}
            </form>
          </div>

          <aside className="panel public-chat__sidebar">
            <div className="panel__header panel__header--compact">
              <span className="eyebrow">Leden</span>
              <h2>Wie is er online?</h2>
            </div>

            <div className="public-chat__people">
              {onlinePeople.length ? (
                onlinePeople.map((user) => (
                  <button className="public-chat__person" type="button" key={user.username} onClick={() => openProfile(user)}>
                    <UserAvatar user={user} name={getPublicUserDisplayLabel(user)} size={42} showDot />
                    <div>
                      <strong>{getPublicUserDisplayLabel(user)}</strong>
                      <span>online</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>Niemand online</strong>
                  <p>De online status wordt live bijgewerkt vanuit Supabase.</p>
                </div>
              )}
            </div>

            <div className="panel__header panel__header--compact public-chat__offline-heading">
              <span className="eyebrow">Offline</span>
              <h2>Wie is er offline?</h2>
            </div>

            <div className="public-chat__people">
              {offlinePeople.length ? (
                offlinePeople.map((user) => (
                  <button className="public-chat__person is-offline" type="button" key={user.username} onClick={() => openProfile(user)}>
                    <UserAvatar user={user} name={getPublicUserDisplayLabel(user)} size={42} />
                    <div>
                      <strong>{getPublicUserDisplayLabel(user)}</strong>
                      <span>{user.last_online_at ? <><RelativeTimeText value={user.last_online_at} /> online</> : 'offline'}</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="empty-state empty-state--compact">
                  <strong>Iedereen online</strong>
                  <p>Er zijn momenteel geen offline leden.</p>
                </div>
              )}
            </div>
          </aside>
        </div>

        <PublicUserProfileDialog
          open={Boolean(selectedProfile)}
          user={selectedProfile}
          currentUsername={currentUser?.username || ''}
          onClose={() => setSelectedProfile(null)}
          onStartMessage={(user) => {
            const nextPeer = findPublicAllowedUser(user?.username || user?.displayName || user?.name || user?.email || '', allowedUsers)?.username || user?.username || user?.displayName || '';
            setSelectedProfile(null);
            navigate(`/public/private?peer=${encodeURIComponent(nextPeer)}`);
          }}
        />
      </section>
    </PublicShell>
  );
}
