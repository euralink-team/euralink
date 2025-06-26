# Euralink

A modern, fast, and feature-rich Lavalink client for Node.js and Discord bots.

[![npm version](https://img.shields.io/npm/v/euralink.svg)](https://www.npmjs.com/package/euralink)
[![GitHub stars](https://img.shields.io/github/stars/euralink-team/euralink.svg?style=social)](https://github.com/euralink-team/euralink)
[![MIT License](https://img.shields.io/github/license/euralink-team/euralink)](LICENSE)
[![Changelog](https://img.shields.io/badge/changelog-view-brightgreen)](https://github.com/euralink-team/euralink/blob/main/CHANGELOG.md)

---

## Features

- ⚡ **Blazing fast** REST and WebSocket communication
- 🧠 **Super-fast track and playlist loading**
  Resolves tracks and playlists in milliseconds using optimized search logic and persistent connections.
- ✅ **Easy-to-use** and modern API
- 🔁 **Supports** v3 and v4 lavalink protocols
- 🎛️ **Advanced player controls** (queue, filters, autoplay, etc.)
- 🌐 **Multi-node support** with smart load balancing
- 🎧 **Rich audio filters** (nightcore, vaporwave, 8D, bassboost, and more)
- ✨ **TypeScript types** included for full intellisense
- 🧩 **Plugin system** for easy extensibility
- 🧱 **Robust error handling** and event system
- 💬 **Ready for Discord.js v14+ and modern Discord bots**
- 🚦 **Automatic player migration** on node failure (failover)
- 🎚️ **Granular queue controls** (shuffle, move, remove, view)
- 🔊 **Automatic voice channel status (EuraSync):** 
  Updates the voice channel status with the current track, supports custom templates, fully automatic
  - Fully automatic
  - Supports custom templates like `🎶 Now playing: {title}`
- 🟢 **Automatic bot activity status:** 
  Updates the bot's activity (user status) with the current track, supports custom templates, fully automatic
  - Fully automatic
  - Customizable templates
- 🖼️ **Playlist thumbnails in playlistInfo**  
  `playlistInfo.thumbnail` is now available directly after a playlist search, for easy use in embeds and dashboards (no separate fetcher needed).

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
const { 
    Client,
    GatewayDispatchEvents,
    GatewayIntentBits,
    Partials
} = require('discord.js')
const { Euralink } = require('euralink')
const config = require('./config.js')

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Channel
    ]
});

const nodes = [
    {
        name: 'Main Node',
        host: 'localhost',
        password: 'youshallnotpass',
        port: 2333,
        secure: false,
        regions: ['us_central', 'us_east']
    }
]

const eura = new Euralink(client, nodes, {
    send: (data) => {
        const guild = client.guilds.cache.get(data.d.guild_id);
        if (guild) {
            guild.shard.send(data);
        }
    },
    defaultSearchPlatform: 'ytmsearch',
    restVersion: 'v4',
    plugins: [] // Optional
});

client.on('ready', async () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);
    eura.init(client.user.id);
    await eura.restoreAllPlayers('./players.json'); // For true resume, the bo will reconnect the VC and play the same song
})

process.on('SIGINT', async () => {
  await eura.saveAllPlayers('./players.json');
  process.exit(0);
}); // For true resume, the bo will reconnect the VC and play the same song

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.content.startsWith('!play ')) return;

    const query = message.content.slice('!play '. length).trim();
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
    })

    const result = await eura.resolve({ 
        query, 
        requester: message.author 
    });

    const { loadType, tracks, playlistInfo } = result;

    /**
     * If you're using a v3 version of lavalink, follow these:
     * 
     * From 'playlist' replace it to "PLAYLIST_LOADED"
     * From 'search' replace it to "SEARCH_RESULT"
     * From 'track' replace it to "TRACK_LOADED"
     * 
     */

    if (loadType === 'playlist') {
        for (const track of resolve.tracks) {
            track.info.requester = message.author;
            player.queue.add(track);
        }
        message.channel.send(`Playlist from \`${playlistInfo.name}\` with \`${tracks.length}\` songs.`)
        if (!player.playing && !player.paused) return player.play();
    } else if (loadType === "search" || loadType === "track") {
        const track = tracks.shift();
        track.info.requester = message.author;

        player.queue.add(track);
        message.channel.send(`Added from queue: \`${track.info.title}\``);
        if (!player.playing && !player.paused) return player.play();
    } else {
        return message.channel.send("There are no results found.");
    }
});

// For debugging: eura.on('debug', (...args) => console.log('[Euralink DEBUG]', ...args));

eura.on('nodeConnect', (node) => {
    console.log(`[Euralink] Connected to node: ${node.name}`)
});

eura.on('nodeReconnect', (node) => {
    console.log(`[Euralink] Node reconnecting: ${node.name}`)
})

eura.on('nodeError', (node, error) => {
    console.log(`Node "${node.name}" encountered an error: ${error.message}.`);
});

eura.on('trackStart', (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send(`🎶 Now playing: **${track.info.title}**`);
});

eura.on('queueEnd', (player) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send('Queue ended, destroying player');
    player.destroy();
});

client.on('raw', (d) => {
    if (
        ![
            GatewayDispatchEvents.VoiceStateUpdate,
            GatewayDispatchEvents.VoiceServerUpdate,
        ].includes(d.t)
    )
    return
    eura.updateVoiceState(d);
});

client.login(config.token)
```

Inside `config.js` file

```js
module.exports = {
  token: 'YOUR_BOT_TOKEN_HERE'
}
```

---

## Voice Channel Status & Bot Activity Status

Euralink can automatically update your bot's **voice channel status** (if supported by Discord) and **bot activity status** (user status) to show the currently playing track. This is fully automatic—no manual event handling needed!

### Enable Voice Channel Status (EuraSync)

```js
const eura = new Euralink(client, nodes, {
  // ...other options,
  euraSync: true // Enable with default template: 'Now playing: {title}'
});
```

#### Custom Template
You can customize the status message:
```js
euraSync: { template: ':musical_note: {title} by {author}' }
```
Supported placeholders: `{title}`, `{author}`, `{uri}`, `{source}`

---

### Enable Bot Activity Status

```js
const eura = new Euralink(client, nodes, {
  // ...other options,
  setActivityStatus: true // Enable with default template: 'Now playing: {title}'
});
```

#### Custom Template
```js
setActivityStatus: { template: ':notes: {title} by {author}' }
```

- The bot's activity will update on every track start, and clear when the queue ends.
- No need to manually handle `trackStart` or `queueEnd` events for these features!

---

### Example: Fetching a Spotify Playlist Thumbnail

```js
const { Thumbnails } = require('euralink');

const url = await Thumbnails.getSpotifyPlaylistThumbnail(
  'yourPlaylistId',
  'yourSpotifyClientId',
  'yourSpotifyClientSecret'
);
console.log('Thumbnail:', url);
```

---

## Example Bot with Other Commands

Go here [Example Bot](https://github.com/euralink-team/euralink/blob/main/test/euralink-bot.js)

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

See [TypeDocs](https://euralink-website.vercel.app/) or [index.d.ts](./build/index.d.ts) for full typings and API docs.

---

## TypeScript Support

Euralink ships with full TypeScript types. Just import as usual:

```ts
import { Euralink, Player, Node, Track } from 'euralink';
```

---

## 🌟 Official Bot

<div style="text-align: center;">
  <table>
    <tr>
      <td align="center" width="200">
        <img src="https://media.discordapp.net/attachments/1379961285822644228/1380143372223909888/ChatGPT_Image_Jun_4_2025_08_36_33_PM_optimized_1000.png?ex=6842ce2d&is=68417cad&hm=5ce85d095418f15344303425747168d0ee57629609cd903ca16d203bf318a72c&=&format=webp&quality=lossless&width=971&height=971" width="96" height="96" alt="Euralink Bot"/><br>
        <b>Euralink Official Bot</b><br>
        <a href="https://discord.com/oauth2/authorize?client_id=1379804561166041210&permissions=3148800&scope=bot%20applications.commands">
          <img src="https://img.shields.io/badge/Add%20to%20Discord-5865F2?logo=discord&logoColor=white&style=for-the-badge" alt="Add to Discord"/>
        </a><br>
        <a href="https://github.com/Ryuzii/euralink-bot">
          <img src="https://img.shields.io/badge/GitHub-Source%20Code-black?logo=github&style=for-the-badge" alt="GitHub Source"/>
        </a><br>
        <a href="https://discord.gg/4Dmfd6yE7F">
          <img src="https://img.shields.io/badge/Join%20Support%20Server-5865F2?logo=discord&logoColor=white&style=for-the-badge" alt="Discord Server"/>
        </a>
      </td>
    </tr>
  </table>
</div>

---

---

## Honorable Mention

<div style="text-align: center;">
  <table style="margin: 0 auto;">
    <tr>
      <td style="text-align: center;">
        <img src="https://avatars.githubusercontent.com/u/86982643?v=4" alt="Toddy Avatar" width="64" height="64" style="border-radius: 50%;"><br>
        <strong>Honorable Mention:</strong><br>
        <a href="https://github.com/ToddyTheNoobDud" target="_blank" rel="noopener noreferrer">
          Toddy – Developer of Aqualink (Inspired tseep integration)
        </a>
      </td>
    </tr>
  </table>
</div>

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

---

## Plugin System

Euralink supports a simple plugin system. Plugins can hook into Euralink events and extend functionality.

**Example:**

```js
const ExamplePlugin = require('./plugins/examplePlugin');

const eura = new Euralink(client, [/* nodes */], {
  send: (data) => { /* ... */ },
  plugins: [new ExamplePlugin()]
});
```

See `plugins/examplePlugin.js` for a sample plugin.

---

## Advanced Queue Controls

Euralink's `Queue` class supports advanced features:

- `shuffle()` — Shuffle the queue
- `move(from, to)` — Move a track from one position to another
- `remove(index)` — Remove a track by index

You can also use these via the player:

```js
player.shuffleQueue();
player.moveQueueItem(0, 2);
player.removeQueueItem(1);
```

---

## Player State Persistence

You can save and restore all player states for true auto-resume after bot restarts:

```js
// Save all players
await eura.saveAllPlayers('./players.json');

// Restore all players
await eura.restoreAllPlayers('./players.json');
``` 