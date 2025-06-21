const fetch = require('node-fetch');

async function getSpotifyPlaylistThumbnail(playlistId, clientId, clientSecret) {
  const token = await getSpotifyToken(clientId, clientSecret);
  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Spotify API error');
  const data = await res.json();
  if (data.images && data.images.length > 0) {
    return data.images[0].url;
  }
  throw new Error('No thumbnail found for this Spotify playlist.');
}

async function getSpotifyToken(clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not provided');
  }
  const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('Failed to get Spotify token');
  const data = await res.json();
  return data.access_token;
}

async function getYouTubePlaylistThumbnail(playlistId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('YouTube API error');
  const data = await res.json();
  if (data.items && data.items.length > 0 && data.items[0].snippet && data.items[0].snippet.thumbnails) {
    return (
      data.items[0].snippet.thumbnails.maxres?.url ||
      data.items[0].snippet.thumbnails.standard?.url ||
      data.items[0].snippet.thumbnails.high?.url ||
      data.items[0].snippet.thumbnails.medium?.url ||
      data.items[0].snippet.thumbnails.default?.url
    );
  }
  throw new Error('No thumbnail found');
}

async function getSoundCloudPlaylistThumbnail(user, set, clientId) {
  const resolveUrl = `https://api.soundcloud.com/resolve?url=https://soundcloud.com/${user}/sets/${set}&client_id=${clientId}`;
  const resolveRes = await fetch(resolveUrl);
  if (!resolveRes.ok) throw new Error('SoundCloud resolve API error');
  const playlistData = await resolveRes.json();
  if (playlistData && playlistData.artwork_url) {
    return playlistData.artwork_url.replace('-large', '-t500x500');
  }
  throw new Error('No thumbnail found for this SoundCloud playlist.');
}

async function getAppleMusicPlaylistThumbnail(playlistId) {
  const url = `https://music.apple.com/playlist/${playlistId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Apple Music fetch error');
  const html = await res.text();
  const ogImageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  if (ogImageMatch && ogImageMatch[1]) {
    return ogImageMatch[1];
  }
  throw new Error('No thumbnail found for this Apple Music playlist.');
}

module.exports = {
  getYouTubePlaylistThumbnail,
  getSpotifyPlaylistThumbnail,
  getSoundCloudPlaylistThumbnail,
  getAppleMusicPlaylistThumbnail
};