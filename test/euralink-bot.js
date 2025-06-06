// THIS IS NOT THE OFFICIAL BOT, IT'S ONLY THE EXAMPLE BOT

const { 
    Client,
    GatewayDispatchEvents,
    GatewayIntentBits,
    Partials
} = require('discord.js')
const { Euralink } = require('../build')
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
        host: 'lavalink.jirayu.net',
        password: 'youshallnotpass',
        port: 13592,
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
    defaultSearchPlatform: 'spsearch',
    restVersion: 'v4',
    euraSync: true,
    setActivityStatus: true,
    plugins: [] // Optional
});

client.on('ready', async () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);
    eura.init(client.user.id);
    await eura.restoreAllPlayers('./players.json');
})

process.on('SIGINT', async () => {
    await eura.saveAllPlayers('./players.json');
    process.exit(0);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const [cmd, ...args] = message.content.trim().split(/\s+/);
    const query = args.join(' ');

    if (cmd === '!play') {
        if (!query) return message.reply('Please provide a search query or URL!');
        const voiceChannel = message.member.voice?.channel;
        if (!voiceChannel) return message.reply('You must be in a voice channel!');

        const player = eura.createConnection({
            guildId: message.guildId,
            voiceChannel: voiceChannel.id,
            textChannel: message.channelId
        });

        const result = await eura.resolve({ query, requester: message.author });
        const { loadType, tracks, playlistInfo } = result;

        if (!tracks.length) return message.reply('No tracks found!');

        /**
         * If you're using a v3 version of lavalink, follow these:
         * 
         * From 'playlist' replace it to "PLAYLIST_LOADED"
         * From 'search' replace it to "SEARCH_RESULT"
         * From 'track' replace it to "TRACK_LOADED"
         * 
         */


        if (loadType === 'playlist') {
            for (const track of tracks) {
                track.info.requester = message.author;
                player.queue.add(track);
            }
            message.channel.send(`Playlist: \`${playlistInfo.name}\` with \`${tracks.length}\` songs added.`);
        } else if (loadType === 'search' || loadType === 'track') {
            const track = tracks[0];
            track.info.requester = message.author;
            player.queue.add(track);
            message.channel.send(`Added to queue: \`${track.info.title}\``);
        } else {
            return message.channel.send("No results found.");
        }

        if (!player.playing && !player.paused) return player.play();
    }

    if (cmd === '!queue') {
        const player = eura.players.get(message.guildId);
        if (!player || !player.queue.length) return message.reply('Queue is empty.');
        const queue = player.queue.toArray()
            .map((t, i) => `${i + 1}. ${t.info?.title || 'Unknown'}`)
            .join('\n');
        message.reply('🎶 Current queue:\n' + queue);
    }

    if (cmd === '!shuffle') {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        player.shuffleQueue();
        message.reply('🔀 Queue shuffled!');
    }

    if (cmd === '!move' && args.length === 2) {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        const from = parseInt(args[0], 10) - 1;
        const to = parseInt(args[1], 10) - 1;
        player.moveQueueItem(from, to);
        message.reply(`Moved track from position ${from + 1} to ${to + 1}.`);
    }

    if (cmd === '!remove' && args.length === 1) {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        const index = parseInt(args[0], 10) - 1;
        player.removeQueueItem(index);
        message.reply(`Removed track at position ${index + 1}.`);
    }
});

eura.on('nodeConnect', (node) => {
    console.log(`[Euralink] Connected to node: ${node.name}`)
});
eura.on('nodeError', (node, error) => {
    console.log(`Node "${node.name}" encountered an error: ${error.message}.`);
});

/*
*
* IF YOU USE euraSync and setActivityStatus REMOVE THIS EVENT
*
* trackStart and queueEnd
*
*/

eura.on('trackStart', (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send(`🎶 Now playing: **[${track.info.title}](${track.info.url || track.info.uri})**`);
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
