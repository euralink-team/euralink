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

client.on('ready', () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);
    eura.init(client.user.id);
})

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

eura.on('nodeConnect', (node) => {
    console.log(`[Euralink] Connected to node: ${node.name}`)
});
eura.on('nodeConnect', (node, error) => {
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
