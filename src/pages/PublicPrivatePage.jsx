import { Check, CornerUpLeft, Edit3, Paperclip, RefreshCw, Send, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import ChatMediaLightbox from '../components/ChatMediaLightbox';
import PublicShell from '../components/PublicShell';
import PublicUserProfileDialog from '../components/PublicUserProfileDialog';
import RichTextContent from '../components/RichTextContent';
import SetupNotice from '../components/SetupNotice';
import UserAvatar from '../components/UserAvatar';
import { createLocalAttachmentPreview, getAttachmentPreview, getChatRoomKey } from '../utils/chat';
import { formatRelativeTime } from '../utils/dates';
import {
  DEFAULT_PUBLIC_USERS,
  ensurePublicAllowedUserRow,
  findPublicAllowedUser,
  getPublicUserDisplayLabel,
  loadPublicAllowedUsers,
  normalizePublicUsername,
  PUBLIC_PRESENCE_STALE_MS,
  resolvePublicPresenceLabel,
  resolvePublicUserFromSession,
  updatePublicAllowedUserRow
} from '../utils/publicUsers';
import { publicChatSupabase } from '../utils/supabase';

const PUBLIC_CHAT_STORAGE_KEY = 'yowlmaffia-public-chat-auth';

function readStoredPublicChatSession() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PUBLIC_CHAT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parsePeerFromSearch(search = '') {
  return normalizePublicUsername(new URLSearchParams(search).get('peer') || '');
}

function resolvePeerUsername(value, allowedUsers = []) {
  const normalized = normalizePublicUsername(value);
  if (!normalized) {
    return '';
  }

  const resolved = findPublicAllowedUser(normalized, allowedUsers);
  return normalizePublicUsername(resolved?.username || normalized);
}

function isMissingReplyColumnError(error) {
  const message = String(error?.message || error?.details || error?.hint || '').toLowerCase();
  return message.includes('reply_to_message_id')
    || message.includes('reply_to_sender')
    || message.includes('reply_to_body')
    || message.includes('reply_to_created_at')
    || message.includes('schema cache');
}

export default function PublicPrivatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const composerRef = useRef(null);
  const fileInputRef = useRef(null);
  const listRef = useRef(null);
  const allowedUsersRef = useRef(DEFAULT_PUBLIC_USERS);
  const manualSignOutRef = useRef(false);

  const [session, setSession] = useState(readStoredPublicChatSession());
  const [allowedUsers, setAllowedUsers] = useState(DEFAULT_PUBLIC_USERS);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [peerUsername, setPeerUsername] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [chatError, setChatError] = useState('');
  const [editingMessageId, setEditingMessageId] = useState('');
  const [editingDraft, setEditingDraft] = useState('');
  const [editingBusy, setEditingBusy] = useState(false);
  const [replyingMessageId, setReplyingMessageId] = useState('');
  const [replyingMessage, setReplyingMessage] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [selectedProfile, setSelectedProfile] = useState(null);
  const pendingAttachmentPreview = useMemo(() => createLocalAttachmentPreview(attachment), [attachment]);

  const requestedPeerUsername = useMemo(() => parsePeerFromSearch(location.search), [location.search]);

  useEffect(() => {
    return () => {
      if (pendingAttachmentPreview?.url) {
        URL.revokeObjectURL(pendingAttachmentPreview.url);
      }
    };
  }, [pendingAttachmentPreview]);

  useEffect(() => {
    allowedUsersRef.current = allowedUsers;
  }, [allowedUsers]);

  useEffect(() => {
    if (!publicChatSupabase) {
      setLoadingAuth(false);
      return undefined;
    }

    let cancelled = false;

    async function bootstrap() {
      const storedSession = readStoredPublicChatSession();
      let sessionResult = { data: { session: null } };
      let users = [];

      try {
        [sessionResult, users] = await Promise.all([
          publicChatSupabase.auth.getSession(),
          loadPublicAllowedUsers().catch(() => [])
        ]);
      } catch (error) {
        console.error(error);
        users = await loadPublicAllowedUsers().catch(() => []);
      }

      if (cancelled) {
        return;
      }

      const nextSession = sessionResult?.data?.session || storedSession || null;
      const nextUsers = Array.isArray(users) && users.length ? users : DEFAULT_PUBLIC_USERS;

      setSession(nextSession);
      setAllowedUsers(nextUsers);
      setCurrentUser(resolvePublicUserFromSession(nextSession, nextUsers));
      setLoadingAuth(false);
    }

    bootstrap();

    const {
      data: { subscription }
    } = publicChatSupabase.auth.onAuthStateChange((_, nextSession) => {
      if (cancelled) {
        return;
      }

      if (manualSignOutRef.current) {
        if (!nextSession) {
          manualSignOutRef.current = false;
        }

        setSession(nextSession);
        setCurrentUser(null);
        return;
      }

      const nextUsers = allowedUsersRef.current;
      setSession(nextSession);
      setCurrentUser(resolvePublicUserFromSession(nextSession, nextUsers));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setCurrentUser(resolvePublicUserFromSession(session, allowedUsers));
  }, [session, allowedUsers]);

  const peers = useMemo(
    () => allowedUsers.filter((user) => normalizePublicUsername(user.username) !== normalizePublicUsername(currentUser?.username)),
    [allowedUsers, currentUser?.username]
  );

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    const nextRequestedPeer = resolvePeerUsername(requestedPeerUsername, allowedUsers);
    const hasRequestedPeer = peers.some((peer) => normalizePublicUsername(peer.username) === nextRequestedPeer);
    const hasSelectedPeer = peers.some((peer) => normalizePublicUsername(peer.username) === normalizePublicUsername(peerUsername));

    if (hasRequestedPeer && normalizePublicUsername(peerUsername) !== nextRequestedPeer) {
      setPeerUsername(nextRequestedPeer);
      return;
    }

    if (!hasSelectedPeer) {
      setPeerUsername(peers[0]?.username || '');
    }
  }, [allowedUsers, currentUser, peerUsername, peers, requestedPeerUsername]);

  const activePeer = useMemo(
    () => peers.find((peer) => normalizePublicUsername(peer.username) === normalizePublicUsername(peerUsername)) || null,
    [peerUsername, peers]
  );

  const roomKey = useMemo(
    () => getChatRoomKey('private', currentUser, activePeer?.username || ''),
    [activePeer?.username, currentUser]
  );

  const roomLabel = activePeer ? `Privé met ${getPublicUserDisplayLabel(activePeer) || activePeer.username}` : 'Privé chat';
  const onlinePeople = useMemo(
    () => allowedUsers.filter(
      (user) => resolvePublicPresenceLabel(user, nowTick, PUBLIC_PRESENCE_STALE_MS, currentUser?.username) === 'online'
    ),
    [allowedUsers, currentUser?.username, nowTick]
  );
  const offlinePeople = useMemo(
    () => allowedUsers.filter(
      (user) => resolvePublicPresenceLabel(user, nowTick, PUBLIC_PRESENCE_STALE_MS, currentUser?.username) !== 'online'
    ),
    [allowedUsers, currentUser?.username, nowTick]
  );

  function getOfflineLastSeenLabel(user) {
    const lastSeenAt = user?.last_online_at;
    if (!lastSeenAt) {
      return '';
    }

    return `${formatRelativeTime(lastSeenAt, nowTick)} online`;
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setEditingMessageId('');
    setEditingDraft('');
    setEditingBusy(false);
    setReplyingMessageId('');
    setReplyingMessage(null);
    setSelectedProfile(null);
  }, [roomKey]);

  useEffect(() => {
    if (currentUser) {
      window.setTimeout(() => composerRef.current?.focus?.(), 0);
    }
  }, [currentUser?.username, peerUsername]);

  useEffect(() => {
    if (!publicChatSupabase || !currentUser || !roomKey) {
      setMessages([]);
      setMessagesLoading(false);
      return undefined;
    }

    let cancelled = false;
    let channel = null;

    async function loadMessages() {
      setMessagesLoading(true);
      const { data, error } = await publicChatSupabase
        .from('messages')
        .select('*')
        .eq('scope', 'private')
        .eq('room_key', roomKey)
        .order('created_at', { ascending: true });

      if (cancelled) {
        return;
      }

      setMessages(error ? [] : (data || []));
      setMessagesLoading(false);
    }

    loadMessages();

    channel = publicChatSupabase
      .channel(`public-private-${roomKey}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_key=eq.${roomKey}` }, loadMessages)
      .subscribe();

    return () => {
      cancelled = true;
      if (channel) {
        publicChatSupabase.removeChannel(channel);
      }
    };
  }, [currentUser, roomKey, refreshTick]);

  useEffect(() => {
    if (!publicChatSupabase || !currentUser?.email) {
      return undefined;
    }

    let cancelled = false;

    async function markPrivateNotificationsAsRead() {
      const now = new Date().toISOString();
      const { error } = await publicChatSupabase
        .from('notifications')
        .update({ is_read: true, read_at: now })
        .eq('recipient_email', currentUser.email)
        .eq('kind', 'private_message')
        .eq('is_read', false);

      if (!cancelled && error) {
        console.error(error);
      }
    }

    void markPrivateNotificationsAsRead();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.email, roomKey]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function reloadCurrentMessages() {
    if (!publicChatSupabase || !currentUser || !roomKey) {
      return;
    }

    setMessagesLoading(true);
    const refreshed = await publicChatSupabase
      .from('messages')
      .select('*')
      .eq('scope', 'private')
      .eq('room_key', roomKey)
      .order('created_at', { ascending: true });

    setMessages(refreshed.error ? [] : (refreshed.data || []));
    setMessagesLoading(false);
  }

  function cancelEditMessage() {
    setEditingMessageId('');
    setEditingDraft('');
    setEditingBusy(false);
  }

  function startEditMessage(message) {
    setEditingMessageId(message.id);
    setEditingDraft(message.body || '');
    setChatError('');
  }

  function startReplyMessage(message) {
    setReplyingMessageId(message.id);
    setReplyingMessage({
      id: message.id,
      sender: message.sender || '',
      body: message.body || '',
      created_at: message.created_at || '',
      attachment_url: message.attachment_url || '',
      attachment_type: message.attachment_type || ''
    });
    setChatError('');
    window.setTimeout(() => composerRef.current?.focus?.(), 0);
  }

  function cancelReplyMessage() {
    setReplyingMessageId('');
    setReplyingMessage(null);
    window.setTimeout(() => composerRef.current?.focus?.(), 0);
  }

  function openProfile(user) {
    setSelectedProfile(user);
    setChatError('');
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (!publicChatSupabase || !currentUser || !activePeer) {
      return;
    }

    if (!draft.trim() && !attachment) {
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
        const storagePath = `chat/${roomKey}/${safeName}`;
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

      const senderUsername = currentUser.username || currentUser.displayName || currentUser.name || 'Onbekend';
      const payload = {
        scope: 'private',
        room_key: roomKey,
        sender: senderUsername,
        recipient: activePeer.username,
        body: draft.trim() || '',
        attachment_url: attachmentUrl,
        attachment_type: attachmentType,
        reply_to_message_id: replyingMessage?.id || null,
        reply_to_sender: replyingMessage?.sender || null,
        reply_to_body: replyingMessage?.body || null,
        reply_to_created_at: replyingMessage?.created_at || null
      };

      const { error } = await publicChatSupabase.from('messages').insert(payload);
      if (error) {
        if (!isMissingReplyColumnError(error)) {
          throw error;
        }

        const fallbackPayload = {
          scope: 'private',
          room_key: roomKey,
          sender: senderUsername,
          recipient: activePeer.username,
          body: draft.trim() || '',
          attachment_url: attachmentUrl,
          attachment_type: attachmentType
        };

        const fallback = await publicChatSupabase.from('messages').insert(fallbackPayload);
        if (fallback.error) {
          throw fallback.error;
        }
      }

      const nextOnlineAt = new Date().toISOString();
      await updatePublicAllowedUserRow(currentUser, { last_online_at: nextOnlineAt, updated_at: nextOnlineAt });

      setDraft('');
      setAttachment(null);
      cancelReplyMessage();
      await reloadCurrentMessages();
      window.setTimeout(() => composerRef.current?.focus?.(), 0);
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Privébericht versturen mislukt.');
      setMessagesLoading(false);
    } finally {
      setSending(false);
    }
  }

  async function handleSaveEditedMessage(message) {
    const nextBody = editingDraft.trim();
    if (!nextBody) {
      setChatError('Bericht mag niet leeg zijn.');
      return;
    }

    setEditingBusy(true);
    setChatError('');

    try {
      const { error } = await publicChatSupabase.from('messages').update({ body: nextBody }).eq('id', message.id);
      if (error) {
        throw error;
      }

      cancelEditMessage();
      await reloadCurrentMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht bijwerken mislukt.');
      setMessagesLoading(false);
    } finally {
      setEditingBusy(false);
    }
  }

  async function handleDeleteMessage(message) {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Weet je zeker dat je dit bericht wilt verwijderen?')
      : false;

    if (!confirmed) {
      return;
    }

    const senderLabel = String(message?.sender || '').trim();
    const isMine =
      normalizePublicUsername(senderLabel) === normalizePublicUsername(currentUser?.username);

    if (!isMine) {
      setChatError('Je kan alleen je eigen berichten verwijderen.');
      return;
    }

    setEditingBusy(true);
    setChatError('');

    try {
      const { error } = await publicChatSupabase.from('messages').delete().eq('id', message.id);
      if (error) {
        throw error;
      }

      if (editingMessageId === message.id) {
        cancelEditMessage();
      }

      await reloadCurrentMessages();
    } catch (error) {
      console.error(error);
      setChatError(error instanceof Error ? error.message : 'Bericht verwijderen mislukt.');
      setMessagesLoading(false);
    } finally {
      setEditingBusy(false);
    }
  }

  async function handleSignOut() {
    if (!publicChatSupabase) {
      navigate('/');
      return;
    }

    manualSignOutRef.current = true;
    await publicChatSupabase.auth.signOut();
    navigate('/');
  }

  if (!publicChatSupabase) {
    return <SetupNotice />;
  }

  if (loadingAuth) {
    return (
      <section className="public-page">
        <div className="public-page__shell">
          <div className="empty-state empty-state--compact">
            <strong>Privé chats laden...</strong>
            <p>We openen je gesprekken veilig.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!currentUser) {
    return (
      <section className="public-page">
        <div className="public-page__shell">
          <div className="empty-state empty-state--compact">
            <strong>Privé chats openen niet</strong>
            <p>Log opnieuw in op de public startpagina om een gesprek te openen.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <PublicShell user={currentUser} onSignOut={handleSignOut} statusText="Alles bijgewerkt">
      <section className="chat-page public-private-page">
        <div className="page-title">
          <div>
            <span className="eyebrow">Privé chats</span>
            <h1>Praat één op één</h1>
            <p>Stuur rechtstreeks berichten, foto's en bestanden naar iemand uit de public community.</p>
          </div>

          <div className="page-title__actions">
            <button className="button button--secondary" type="button" onClick={() => setRefreshTick((value) => value + 1)}>
              <RefreshCw size={16} />
              Vernieuwen
            </button>
          </div>
        </div>

        <div className="chat-page__tabs panel">
          {peers.length ? (
            <select className="input chat-page__peer" value={peerUsername} onChange={(event) => setPeerUsername(event.target.value)}>
              {peers.map((peer) => (
                <option key={peer.username} value={peer.username}>
                  {getPublicUserDisplayLabel(peer)}
                </option>
              ))}
            </select>
          ) : (
            <div className="empty-state empty-state--compact">
              <strong>Geen ontvangers</strong>
              <p>Er staan nog geen andere openbare leden klaar om mee te chatten.</p>
            </div>
          )}

          <div className="chat-page__room">
            <strong>{roomLabel}</strong>
            <span>{messages.length} berichten</span>
          </div>
        </div>

        <div className="chat-page__layout">
          <div className="panel chat-page__thread">
            <div className="panel__header">
              <span className="eyebrow">Gesprek</span>
              <h2>{roomLabel}</h2>
            </div>

            <div className="chat-page__messages" ref={listRef}>
              {messagesLoading ? (
                <div className="empty-state">
                  <strong>Berichten laden...</strong>
                  <p>Realtime chat wordt opgehaald.</p>
                </div>
              ) : messages.length ? (
                messages.map((message) => {
                  const senderUser = findPublicAllowedUser(message.sender, allowedUsers);
                  const senderLabel = getPublicUserDisplayLabel(senderUser) || message.sender || 'Onbekend';
                  const isMine =
                    normalizePublicUsername(message.sender) === normalizePublicUsername(currentUser?.username);
                  const isEditing = editingMessageId === message.id;
                  const attachmentPreview = getAttachmentPreview(
                    message.attachment_url,
                    message.attachment_type,
                    message.body || 'attachment'
                  );

                  return (
                    <article key={message.id} className={`chat-bubble ${isMine ? 'is-mine' : ''}`}>
                      {message.reply_to_message_id ? (
                        <div className="chat-bubble__reply">
                          <span>Reageert op {message.reply_to_sender || 'een bericht'}</span>
                          <p>{message.reply_to_body || 'Oud bericht'}</p>
                        </div>
                      ) : null}

                      <div className="chat-bubble__meta">
                        <div className="chat-bubble__sender">
                          <button
                            className="chat-bubble__profile-trigger"
                            type="button"
                            onClick={() => senderUser && openProfile(senderUser)}
                            disabled={!senderUser}
                            aria-label={`Open profiel van ${senderLabel}`}
                          >
                            <UserAvatar user={senderUser} name={senderLabel} src={senderUser?.avatar_url || ''} size={30} />
                            <strong>{senderLabel}</strong>
                          </button>
                        </div>

                        <div className="chat-bubble__meta-right">
                          <span>{formatRelativeTime(message.created_at, nowTick)}</span>
                          <button
                            className="icon-button icon-button--small"
                            type="button"
                            onClick={() => startReplyMessage(message)}
                            disabled={editingBusy}
                            aria-label="Reageer op bericht"
                          >
                            <CornerUpLeft size={14} />
                          </button>
                          {isMine ? (
                            <div className="chat-bubble__actions">
                              <button
                                className="icon-button icon-button--small"
                                type="button"
                                onClick={() => startEditMessage(message)}
                                disabled={editingBusy}
                                aria-label="Bewerk bericht"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                className="icon-button icon-button--small icon-button--danger"
                                type="button"
                                onClick={() => handleDeleteMessage(message)}
                                disabled={editingBusy}
                                aria-label="Verwijder bericht"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="chat-bubble__editor">
                          <textarea
                            className="input chat-bubble__editor-input"
                            value={editingDraft}
                            onChange={(event) => setEditingDraft(event.target.value)}
                          />
                          <div className="chat-bubble__editor-actions">
                            <button
                              className="button button--secondary button--small"
                              type="button"
                              onClick={cancelEditMessage}
                              disabled={editingBusy}
                            >
                              Annuleer
                            </button>
                            <button
                              className="button button--primary button--small"
                              type="button"
                              onClick={() => handleSaveEditedMessage(message)}
                              disabled={editingBusy}
                            >
                              <Check size={14} />
                              Opslaan
                            </button>
                          </div>
                        </div>
                      ) : message.body ? (
                        <RichTextContent text={message.body} />
                      ) : null}

                      {attachmentPreview ? (
                        <div className="chat-bubble__attachment">
                          {attachmentPreview.kind === 'image' ? (
                            <ChatMediaLightbox
                              kind="image"
                              url={attachmentPreview.url}
                              alt="Bijlage afbeelding"
                              mediaClassName="chat-bubble__attachment-media"
                            />
                          ) : null}
                          {attachmentPreview.kind === 'video' ? (
                            <ChatMediaLightbox
                              kind="video"
                              url={attachmentPreview.url}
                              alt="Bijlage video"
                              mediaClassName="chat-bubble__attachment-media"
                            />
                          ) : null}
                          {attachmentPreview.kind === 'audio' ? <audio src={attachmentPreview.url} controls /> : null}
                          {attachmentPreview.kind === 'file' ? (
                            <a href={attachmentPreview.url} target="_blank" rel="noreferrer">
                              Open bestand
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="empty-state">
                  <strong>Nog geen privéberichten</strong>
                  <p>Start het gesprek met {activePeer ? getPublicUserDisplayLabel(activePeer) : 'iemand'}.</p>
                </div>
              )}
            </div>

            <form className="chat-page__composer" onSubmit={handleSendMessage}>
              {replyingMessage ? (
                <div className="chat-page__replying">
                  <div>
                    <strong>Reageren op {replyingMessage.sender || 'bericht'}</strong>
                    <p>{replyingMessage.body || 'Bericht zonder tekst'}</p>
                  </div>
                  <button className="button button--ghost button--small" type="button" onClick={cancelReplyMessage}>
                    Annuleer
                  </button>
                </div>
              ) : null}

              {pendingAttachmentPreview ? (
                <div className="chat-page__attachment-preview chat-page__attachment-preview--above">
                  {pendingAttachmentPreview.kind === 'image' ? (
                    <ChatMediaLightbox
                      kind="image"
                      url={pendingAttachmentPreview.url}
                      alt="Preview afbeelding"
                      mediaClassName="chat-page__attachment-preview-media"
                    />
                  ) : null}
                  {pendingAttachmentPreview.kind === 'video' ? (
                    <ChatMediaLightbox
                      kind="video"
                      url={pendingAttachmentPreview.url}
                      alt="Preview video"
                      mediaClassName="chat-page__attachment-preview-media"
                    />
                  ) : null}
                  {pendingAttachmentPreview.kind === 'audio' ? <audio src={pendingAttachmentPreview.url} controls /> : null}
                  {pendingAttachmentPreview.kind === 'file' ? <span className="chat-page__attachment-preview-file">Bestand klaar om te versturen</span> : null}
                  <button className="button button--ghost button--compact" type="button" onClick={() => setAttachment(null)}>
                    Verwijder bijlage
                  </button>
                </div>
              ) : null}

              <input
                ref={composerRef}
                className="input"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={activePeer ? `Typ een bericht naar ${getPublicUserDisplayLabel(activePeer)}...` : 'Kies eerst een ontvanger...'}
                disabled={sending || !activePeer}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendMessage(event);
                  }
                }}
              />

              <button className="icon-button" type="button" onClick={() => fileInputRef.current?.click()} aria-label="Bijlage">
                <Paperclip size={16} />
              </button>

              <button className="button button--primary" type="submit" disabled={sending || !activePeer}>
                <Send size={16} />
                {sending ? 'Versturen...' : 'Bericht sturen'}
              </button>

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
            </form>
            {chatError ? <div className="error-message chat-page__error">{chatError}</div> : null}
          </div>

          <aside className="panel chat-page__sidebar">
            <div className="panel__header">
              <span className="eyebrow">Team</span>
              <h2>Wie is er online?</h2>
            </div>

            <div className="chat-page__people">
              <div className="chat-page__presence-group">
                <div className="chat-page__presence-header">
                  <strong>Wie is er online?</strong>
                  <span>{onlinePeople.length}</span>
                </div>

                {onlinePeople.map((user) => (
                  <button
                    key={`public-private-online-${user.username}`}
                    className={`chat-person ${activePeer?.username === user.username ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => {
                      setPeerUsername(user.username);
                      navigate(`/public/private?peer=${encodeURIComponent(user.username)}`);
                    }}
                  >
                    <UserAvatar user={user} name={getPublicUserDisplayLabel(user)} size={42} />
                    <div>
                      <strong>{getPublicUserDisplayLabel(user)}</strong>
                      <span>online</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="chat-page__presence-group">
                <div className="chat-page__presence-header">
                  <strong>Wie is er offline?</strong>
                  <span>{offlinePeople.length}</span>
                </div>

                {offlinePeople.map((user) => (
                  <button
                    key={`public-private-offline-${user.username}`}
                    className={`chat-person ${activePeer?.username === user.username ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => {
                      setPeerUsername(user.username);
                      navigate(`/public/private?peer=${encodeURIComponent(user.username)}`);
                    }}
                  >
                    <UserAvatar user={user} name={getPublicUserDisplayLabel(user)} size={42} showDot />
                    <div>
                      <strong>{getPublicUserDisplayLabel(user)}</strong>
                      <span>{getOfflineLastSeenLabel(user) || 'offline'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <PublicUserProfileDialog
        open={Boolean(selectedProfile)}
        onClose={() => setSelectedProfile(null)}
        user={selectedProfile}
        onlineLabel={
          selectedProfile
            ? resolvePublicPresenceLabel(selectedProfile, nowTick, PUBLIC_PRESENCE_STALE_MS, currentUser?.username)
            : 'offline'
        }
      />
    </PublicShell>
  );
}
