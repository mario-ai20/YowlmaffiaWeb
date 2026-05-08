import { createDefaultCoverDataUrl } from './defaultCover';
import { normalizeUsername } from './users';

export function getChatRoomKey(scope, currentUser, peerUsername = '') {
  if (scope === 'team') {
    return 'team';
  }

  const participants = [normalizeUsername(currentUser?.username), normalizeUsername(peerUsername)]
    .filter(Boolean)
    .sort();
  return `dm:${participants.join(':') || 'unknown'}`;
}

export function getChatLabel(scope, currentUser, peerUsername = '') {
  if (scope === 'team') {
    return 'Team chat';
  }

  return `Privé met ${peerUsername || 'iemand'}`;
}

export function getAttachmentPreview(attachmentUrl, attachmentType, fallbackTitle = 'media') {
  if (!attachmentUrl) {
    return null;
  }

  if (attachmentType?.startsWith('image/')) {
    return {
      kind: 'image',
      url: attachmentUrl
    };
  }

  if (attachmentType?.startsWith('video/')) {
    return {
      kind: 'video',
      url: attachmentUrl
    };
  }

  if (attachmentType?.startsWith('audio/')) {
    return {
      kind: 'audio',
      url: attachmentUrl
    };
  }

  return {
    kind: 'file',
    url: attachmentUrl,
    title: fallbackTitle
  };
}

export function createLocalAttachmentPreview(file) {
  if (!file) {
    return null;
  }

  const url = URL.createObjectURL(file);

  if (file.type?.startsWith('image/')) {
    return {
      kind: 'image',
      url
    };
  }

  if (file.type?.startsWith('video/')) {
    return {
      kind: 'video',
      url
    };
  }

  if (file.type?.startsWith('audio/')) {
    return {
      kind: 'audio',
      url
    };
  }

  return {
    kind: 'file',
    url,
    title: 'Bijlage'
  };
}

export function createChatFallbackAvatar(label) {
  return createDefaultCoverDataUrl(label || 'YOWLMAFFIA', 'chat');
}
