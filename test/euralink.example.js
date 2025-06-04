// Example Euralink usage test
// Run with: node test/euralink.example.js

const { Euralink } = require('../build');

// Mock Discord client (replace with your actual Discord.js client)
const client = {
  ws: {
    send: (data) => console.log('[Discord WS SEND]', data)
  },
  user: {
    id: '1323186196289163284'
  }
};

const eura = new Euralink(client, [
  {
    name: 'main',
    host: 'lavalink.jirayu.net',
    port: 13592,
    password: 'youshallnotpass',
    secure: false,
    regions: ['us_central', 'us_east']
  }
], {
  send: (data) => client.ws.send(data),
  defaultSearchPlatform: 'ytmsearch',
  restVersion: 'v4',
  plugins: []
});

eura.on('debug', (...args) => console.log('[Euralink DEBUG]', ...args));
eura.on('nodeConnect', async node => {
  console.log(`[Euralink] Connected to node: ${node.name}`);

  // Now it's safe to create a player!
  const guildId = '1323234949481893908';
  const voiceChannel = '1324407986428317747';
  const textChannel = '1324374533695864970';

  const player = eura.createConnection({
    guildId,
    voiceChannel,
    textChannel,
  });

  // Search for a track
  const result = await eura.resolve({ query: 'Never Gonna Give You Up', requester: 'TestUser' });
  if (result.tracks.length) {
    player.queue.add(result.tracks[0]);
    await player.play();
    console.log('[Euralink] Playback started!');
  } else {
    console.log('[Euralink] No tracks found.');
  }
});

eura.on('trackStart', (player, track) => console.log(`[Euralink] Now playing: ${track.info.title}`));

eura.init(client.user.id); 