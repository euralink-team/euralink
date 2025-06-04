# Euralink

A modern, fast, and feature-rich Lavalink client for Node.js and Discord bots.

[![npm version](https://img.shields.io/npm/v/euralink.svg)](https://www.npmjs.com/package/euralink)
[![GitHub stars](https://img.shields.io/github/stars/euralink-team/euralink.svg?style=social)](https://github.com/euralink-team/euralink)
[![MIT License](https://img.shields.io/github/license/euralink-team/euralink)](LICENSE)

---

## Features

- **Blazing fast** REST and WebSocket communication
- **Easy-to-use** and modern API
- **Advanced player controls** (queue, filters, autoplay, etc.)
- **Multi-node support** with smart load balancing
- **Rich audio filters** (nightcore, vaporwave, 8D, bassboost, and more)
- **TypeScript types** included for full intellisense
- **Plugin system** for easy extensibility
- **Robust error handling** and event system
- **Ready for Discord.js v14+ and modern Discord bots**

---

## Installation

```bash
npm install euralink
```

---

## Getting Started

First, install dependencies:

```bash
npm install euralink discord.js@14
```

---

Here's a simple Discord bot example using Euralink and discord.js v14. This bot will join your voice channel and play music when you type `!play <query>` in chat.

**Important:** For reliable playback, you must forward Discord's raw Voice State Update and Voice Server Update events to Euralink. See the `client.on('raw', ...)` handler below.

```js
const { Client, GatewayDispatchEvents, GatewayIntentBits, Partials, Events } = require('discord.js');
const { Euralink } = require('euralink');

const TOKEN = 'YOUR_BOT_TOKEN_HERE'; // Replace with your bot token

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

const eura = new Euralink(client, [
  {
    name: 'main',
    host: 'localhost', // Your Lavalink host
    port: 2333,        // Your Lavalink port
    password: 'youshallnotpass',
    secure: false,
    regions: ['us_central', 'us_east']
  }
], {
  send: (data) => {
    const guild = client.guilds.cache.get(data.d.guild_id);
    if (guild) guild.shard.send(data);
  },
  defaultSearchPlatform: 'ytmsearch',
  restVersion: 'v4',
  // plugins: []
});

// eura.on('debug', (...args) => console.log('[Euralink DEBUG]', ...args)); // If you want debugging
eura.on('nodeConnect', node => console.log(`Connected to node: ${node.name}`));
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

eura.on('queueEnd', (player) => {
  const channel = client.channels.cache.get(player.textChannel);
  if (channel) channel.send('Queue ended, destroying player');
  player.destroy();
});

// Forward raw voice events to Euralink for proper playback
client.on('raw', (d) => {
  if (![
    GatewayDispatchEvents.VoiceStateUpdate,
    GatewayDispatchEvents.VoiceServerUpdate,
  ].includes(d.t)) return;
  eura.updateVoiceState(d);
});

client.login(TOKEN);
```

---

- Replace `YOUR_BOT_TOKEN_HERE` with your bot's token.
- Make sure your Lavalink server is running and the credentials match.
- Join a voice channel and type `!play Never Gonna Give You Up` in chat!

---

## API Overview

- **Euralink**: Main manager, node and player management, search, events
- **Node**: Represents a Lavalink node (REST + WS)
- **Player**: Per-guild player, queue, filters, events
- **Track**: Track metadata and resolving
- **Queue**: Array-based queue with helpers
- **Filters**: Audio filters (nightcore, bassboost, etc.)
- **Connection**: Voice state/session management
- **Rest**: REST API wrapper
- **Plugin**: Extend Euralink with custom plugins

See [TypeDocs](https://euralink.js.org/) or [index.d.ts](./build/index.d.ts) for full typings and API docs.

---

## TypeScript Support

Euralink ships with full TypeScript types. Just import as usual:

```ts
import { Euralink, Player, Node, Track } from 'euralink';
```

---

## Contributing

Contributions, issues, and feature requests are welcome!

- [Open an issue](https://github.com/euralink-team/euralink/issues)
- [Submit a pull request](https://github.com/euralink-team/euralink/pulls)

---

## License

MIT © Ryuzii & Euralink contributors

---

## Links

- [Documentation](https://euralink.js.org/)
- [GitHub](https://github.com/euralink-team/euralink)
- [NPM](https://www.npmjs.com/package/euralink) 