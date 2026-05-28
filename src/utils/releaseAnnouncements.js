function normalizeReleaseLine(release = {}) {
  const title = String(release.title || '').trim() || 'Nieuwe release';
  const artistName = String(release.artistName || release.artist_name || '').trim() || 'YOWLMAFFIA';
  const spotifyUrl = String(release.spotifyUrl || release.spotify_url || '').trim();

  return {
    title,
    artistName,
    spotifyUrl,
    body: spotifyUrl
      ? `Nieuwe release: ${artistName} - ${title}\nCheck nu op Spotify: ${spotifyUrl}`
      : `Nieuwe release: ${artistName} - ${title}\nCheck de nieuwste release van YOWLMAFFIA.`
  };
}

async function insertMessage(client, payload) {
  if (!client) {
    return;
  }

  const { error } = await client.from('messages').insert(payload);
  if (error) {
    throw error;
  }
}

export async function announceMusicReleaseInChats({ release, publicClient, internalClient }) {
  const nextRelease = normalizeReleaseLine(release);
  const sender = 'YOWLMAFFIA';

  await Promise.allSettled([
    insertMessage(publicClient, {
      scope: 'public',
      room_key: 'public',
      sender,
      recipient: null,
      body: nextRelease.body,
      attachment_url: null,
      attachment_type: 'application/x-yowlmaffia-release'
    }),
    insertMessage(internalClient, {
      scope: 'team',
      room_key: 'team',
      sender,
      recipient: null,
      body: nextRelease.body,
      attachment_url: null,
      attachment_type: 'application/x-yowlmaffia-release'
    })
  ]);
}
