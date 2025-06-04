// Euralink Discord Bot Example (Message Command)
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const { Euralink } = require('../build');

const TOKEN = 'MTMyMzE4NjE5NjI4OTE2MzI4NA.GR8SIQ.X9hYQ9feaUEzjrYvBbVJ_scqpPQIQFjm4ZYZw8'; // Replace with your bot token

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// Euralink setup
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
  send: (data) => {
    const guild = client.guilds.cache.get(data.d.guild_id);
    if (guild) {
      guild.shard.send(data);
    }
  },
  defaultSearchPlatform: 'ytmsearch',
  restVersion: 'v4'
  // plugins: []
});

// If you want debugging
// eura.on('debug', (...args) => console.log('[Euralink DEBUG]', ...args));

eura.on('nodeConnect', node => console.log(`[Euralink] Connected to node: ${node.name}`));
eura.on('trackStart', (player, track) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send(`🎶 Now playing: **${track.info.title}**`);
});

client.once(Events.ClientReady, () => {
  console.log(`[Discord] Logged in as ${client.user.tag}`);
  eura.init(client.user.id);
});

client.on(Events.MessageCreate, async message => {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith('!play ')) return;

  const query = message.content.slice('!play '.length).trim();
  if (!query) return message.reply('Please provide a search query or URL!');

  const member = message.member;
  const voiceChannel = member.voice?.channel;
  if (!voiceChannel) {
    return message.reply('You must be in a voice channel!');
  }

  const player = eura.createConnection({
    guildId: message.guildId,
    voiceChannel: voiceChannel.id,
    textChannel: message.channelId
  });

  const result = await eura.resolve({ 
    query, 
    requester: message.author 
  });

  const { loadType, tracks, playlistInfo } = result;

  if (loadType === 'playlist') {
    for (const track of result.tracks) {
      track.info.requester = message.author;
      player.queue.add(track);
    }
    message.channel.send(`Added: \`${tracks.length} tracks\` from \`${playlistInfo.name}\``);
    if (!player.playing && !player.paused) return player.play();
  } else if (loadType === 'search' || loadType === 'track') {
    const track = tracks.shift();
    track.info.requester = message.author;

    player.queue.add(track);
    message.channel.send(`Added: \`${track.info.title}\``);
    if (!player.playing && !player.paused) return player.play();
  } else {
    return message.channel.send('There are no results found.');
  }
});

eura.on('queueEnd', player => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send('Queue ended, destroying player');
  player.destroy();
});

client.on('raw', d => {
  if (
    ![
      Events.VoiceStateUpdate, 
      Events.VoiceServerUpdate
    ].includes(d.t)
  ) 
  return;
  eura.updateVoiceState(d);
});

client.login(TOKEN);