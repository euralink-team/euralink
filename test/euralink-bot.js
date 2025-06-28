// THIS IS NOT THE OFFICIAL BOT, IT'S ONLY THE EXAMPLE BOT

const { 
    Client,
    GatewayDispatchEvents,
    GatewayIntentBits,
    Partials
} = require('discord.js')
const { Euralink } = require('../build')
const config = require('./config.js')

// Discord.js client with required intents for voice functionality
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

// Lavalink node configuration
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

// Enhanced Euralink V2 configuration with performance features
const eura = new Euralink(client, nodes, {
    send: (data) => {
        console.log(`[Send] Attempting to send:`, JSON.stringify(data, null, 2));
        if (!data.d || !data.d.guild_id) {
            console.log(`[Send] Invalid data structure, skipping`);
            return;
        }
        const guild = client.guilds.cache.get(data.d.guild_id);
        if (guild) {
            console.log(`[Send] Sending to guild ${data.d.guild_id}`);
            guild.shard.send(data);
        } else {
            console.log(`[Send] Guild not found: ${data.d.guild_id}`);
        }
    },
    defaultSearchPlatform: 'ytsearch',
    restVersion: 'v4',
    euraSync: {
        template: '🎵 {title} by {author}'
    },
    setActivityStatus: {
        template: '🎵 {title} by {author}'
    },
    // V2 Performance Features
    autoResume: true,
    lazyLoad: true,
    lazyLoadTimeout: 5000,
    // Reduce debug logging
    debug: false, // Set to false to reduce debug messages
    // Make node info fetching optional for better compatibility
    bypassChecks: {
        nodeFetchInfo: true // Don't require node info to be fetched
    },
    plugins: [] // Optional
});

// Track if players have been loaded for autoResume
let playersLoaded = false;

client.on('ready', async () => {
    console.log(`[Discord] Logged in as ${client.user.tag}`);
    eura.init(client.user.id);
    
    // Debug euraSync initialization
    if (eura.euraSync) {
        console.log(`[EuraSync] ✅ Initialized with template: "${eura.euraSync.template}"`);
    } else {
        console.log(`[EuraSync] ❌ Not initialized - check configuration`);
    }
    
    // Wait a moment for nodes to connect, then load player states for autoResume
    setTimeout(async () => {
        if (!playersLoaded) {
            try {
                console.log('[Euralink V2] Attempting to load player states...');
                const loadedCount = await eura.loadPlayersState('./EuraPlayers.json');
                console.log(`[Euralink V2] ✅ Player states loaded successfully: ${loadedCount} players restored`);
                playersLoaded = true;
                
                // Log details of loaded players
                if (loadedCount > 0) {
                    console.log('[Euralink V2] Loaded players:');
                    for (const [guildId, player] of eura.players) {
                        const trackInfo = player.current ? player.current.info.title : 'No track';
                        console.log(`  - Guild ${guildId}: ${trackInfo} (Queue: ${player.queue.length} tracks)`);
                    }
                }
            } catch (error) {
                console.log('[Euralink V2] ❌ No previous player states found or error loading:', error.message);
                playersLoaded = true; // Mark as loaded even if failed
            }
        }
    }, 2000); // Wait 2 seconds for nodes to connect

    // V2 Health Monitoring - Check system health every 30 seconds
    setInterval(() => {
        const health = eura.getSystemHealth();
        console.log(`[Euralink V2 Health] Nodes: ${health.connectedNodes}/${health.totalNodes} | Players: ${health.totalPlayers} | Avg Ping: ${Math.round(health.averagePing)}ms`);
        
        // Check if we have any connected nodes
        if (health.connectedNodes === 0) {
            console.log('[Euralink V2] ⚠️ No nodes connected! Trying to reconnect...');
            // Try to reconnect nodes
            for (const [name, node] of eura.nodeMap) {
                if (!node.connected) {
                    console.log(`[Euralink V2] Attempting to reconnect to ${name}...`);
                    node.connect();
                }
            }
        }
    }, 30000); // Every 30 seconds
})

// Save player states on bot shutdown for autoResume
process.on('SIGINT', async () => {
    console.log('[Euralink V2] Saving player states...');
    await eura.savePlayersState('./EuraPlayers.json');
    console.log('[Euralink V2] Player states saved successfully');
    process.exit(0);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const [cmd, ...args] = message.content.trim().split(/\s+/);
    const query = args.join(' ');

    // Helper function to ensure players are loaded for autoResume
    async function ensurePlayersLoaded() {
        if (eura.players.size === 0) {
            try {
                await eura.loadPlayersState('./EuraPlayers.json');
                console.log('[Euralink V2] Players loaded on-demand');
                return true;
            } catch (error) {
                console.log('[Euralink V2] No saved players to load:', error.message);
                return false;
            }
        }
        return true;
    }

    // ===== ESSENTIAL MUSIC COMMANDS =====

    if (cmd === '!play') {
        if (!query) return message.reply('Please provide a search query or URL!');
        const voiceChannel = message.member.voice?.channel;
        if (!voiceChannel) return message.reply('You must be in a voice channel!');

        // Performance monitoring
        const startTime = Date.now();

        // Debug: Check bot permissions
        const botMember = message.guild.members.cache.get(client.user.id);
        const botPermissions = voiceChannel.permissionsFor(botMember);
        console.log(`[Debug] Bot permissions in ${voiceChannel.name}:`, {
            connect: botPermissions.has('Connect'),
            speak: botPermissions.has('Speak'),
            viewChannel: botPermissions.has('ViewChannel'),
            allPermissions: botPermissions.toArray()
        });

        // Debug: Check if bot can join
        if (!botPermissions.has('Connect')) {
            return message.reply('❌ I don\'t have permission to join that voice channel!');
        }

        const player = eura.createConnection({
            guildId: message.guildId,
            voiceChannel: voiceChannel.id,
            textChannel: message.channelId
        });

        const result = await eura.resolve({ query, requester: message.author });
        const { loadType, tracks, playlistInfo } = result;

        if (!tracks.length) return message.reply('No tracks found!');

        // Performance logging
        const loadTime = Date.now() - startTime;
        console.log(`[Performance] Track loading took ${loadTime}ms for ${tracks.length} tracks`);

        /**
         * If you're using a v3 version of lavalink, follow these:
         * 
         * From 'playlist' replace it to "PLAYLIST_LOADED"
         * From 'search' replace it to "SEARCH_RESULT"
         * From 'track' replace it to "TRACK_LOADED"
         * 
         */

        if (loadType === 'playlist') {
            // Fast batch addition for playlists
            for (const track of tracks) {
                track.info.requester = message.author;
            }
            player.queue.addPlaylist(tracks, playlistInfo);
            message.channel.send(`🎵 **Playlist Added**: \`${playlistInfo.name}\` with \`${tracks.length}\` songs added to queue. (Loaded in ${loadTime}ms)`);
        } else if (loadType === 'search' || loadType === 'track') {
            const track = tracks[0];
            track.info.requester = message.author;
            player.queue.add(track);
            message.channel.send(`🎵 **Added to queue**: \`${track.info.title}\` by \`${track.info.author}\` (Loaded in ${loadTime}ms)`);
        } else {
            return message.channel.send("❌ No results found.");
        }

        // Always try to play if not already playing
        if (!player.playing) {
            console.log(`[Debug] Player connected: ${player.connected}, Playing: ${player.playing}, VoiceChannel: ${player.voiceChannel}`);
            
            // If player has a voice channel but isn't connected, try to connect first
            if (player.voiceChannel && !player.connected) {
                console.log(`[Debug] Attempting to reconnect to voice channel ${player.voiceChannel}...`);
                try {
                    player.connect({
                        guildId: player.guildId,
                        voiceChannel: player.voiceChannel,
                        textChannel: player.textChannel
                    });
                } catch (error) {
                    console.log(`[Debug] Failed to reconnect: ${error.message}`);
                }
            }
            
            // Add a small delay to allow voice connection to establish
            setTimeout(() => {
                console.log(`[Debug] After 500ms - Player connected: ${player.connected}, Playing: ${player.playing}`);
                if (player.connected) {
                    player.play();
                } else {
                    // Retry after a longer delay if still not connected
                    setTimeout(() => {
                        console.log(`[Debug] After 2.5s - Player connected: ${player.connected}, Playing: ${player.playing}`);
                        if (player.connected) {
                            player.play();
                        } else {
                            // Try one more time with manual connection
                            if (player.voiceChannel) {
                                console.log(`[Debug] Final attempt - manually connecting to ${player.voiceChannel}`);
                                try {
                                    player.connect({
                                        guildId: player.guildId,
                                        voiceChannel: player.voiceChannel,
                                        textChannel: player.textChannel
                                    });
                                    
                                    setTimeout(() => {
                                        if (player.connected) {
                                            player.play();
                                        } else {
                                            message.channel.send("❌ Failed to connect to voice channel. Please try again.");
                                        }
                                    }, 1000);
                                } catch (error) {
                                    message.channel.send("❌ Failed to connect to voice channel. Please try again.");
                                }
                            } else {
                                message.channel.send("❌ Failed to connect to voice channel. Please try again.");
                            }
                        }
                    }, 2000);
                }
            }, 500);
        }
    }

    if (cmd === '!stop') {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        
        player.stop();
        message.reply('⏹️ **Stopped** - Playback has been stopped and queue cleared.');
    }

    if (cmd === '!skip') {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        
        if (!player.current) return message.reply('❌ No track currently playing.');
        
        const currentTrack = player.current.info.title;
        player.stop(); // This will trigger trackEnd and play next track
        
        message.reply(`⏭️ **Skipped**: \`${currentTrack}\``);
    }

    if (cmd === '!pause') {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        
        if (!player.current) return message.reply('❌ No track currently playing.');
        
        const isPaused = player.paused;
        player.pause(!isPaused);
        
        message.reply(`${isPaused ? '▶️ **Resumed**' : '⏸️ **Paused**'}: \`${player.current.info.title}\``);
    }

    if (cmd === '!volume') {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        
        if (args.length === 0) {
            return message.reply(`🔊 **Current Volume**: ${player.volume}%`);
        }
        
        const volume = parseInt(args[0]);
        if (isNaN(volume) || volume < 0 || volume > 100) {
            return message.reply('❌ Volume must be between 0 and 100.');
        }
        
        player.setVolume(volume);
        message.reply(`🔊 **Volume set to**: ${volume}%`);
    }

    if (cmd === '!nowplaying' || cmd === '!np') {
        const player = eura.players.get(message.guildId);
        if (!player || !player.current) return message.reply('❌ No track currently playing.');
        
        const track = player.current;
        const embed = {
            color: 0x00ff00,
            title: '🎵 Now Playing',
            fields: [
                {
                    name: 'Track',
                    value: `\`${track.info.title}\``,
                    inline: true
                },
                {
                    name: 'Artist',
                    value: `\`${track.info.author}\``,
                    inline: true
                },
                {
                    name: 'Duration',
                    value: `${formatDuration(player.position)} / ${formatDuration(track.info.length)}`,
                    inline: true
                },
                {
                    name: 'Volume',
                    value: `${player.volume}%`,
                    inline: true
                },
                {
                    name: 'Status',
                    value: player.paused ? '⏸️ Paused' : '▶️ Playing',
                    inline: true
                },
                {
                    name: 'Queue',
                    value: `${player.queue.length} tracks remaining`,
                    inline: true
                }
            ]
        };
        
        message.reply({ embeds: [embed] });
    }

    if (cmd === '!disconnect' || cmd === '!leave') {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        
        player.disconnect();
        message.reply('👋 **Disconnected** from voice channel.');
    }

    // ===== QUEUE MANAGEMENT COMMANDS =====

    if (cmd === '!queue') {
        // Ensure players are loaded first
        await ensurePlayersLoaded();
        
        const player = eura.players.get(message.guildId);
        if (!player || !player.queue.length) return message.reply('Queue is empty.');
        
        // V2 Enhanced queue display with statistics
        const queueStats = player.queue.getStats();
        const queue = player.queue.toArray()
            .map((t, i) => `${i + 1}. ${t.info?.title || 'Unknown'} - ${t.info?.author || 'Unknown'}`)
            .join('\n');
        
        const embed = {
            color: 0x00ff00,
            title: '🎶 Current Queue',
            description: queue,
            fields: [
                {
                    name: '📊 Queue Statistics',
                    value: `Total Tracks: ${queueStats.totalTracks}\nTotal Duration: ${formatDuration(queueStats.totalDuration)}\nUnique Artists: ${queueStats.uniqueArtists}`,
                    inline: true
                }
            ]
        };
        
        message.reply({ embeds: [embed] });
    }

    if (cmd === '!shuffle') {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        
        // V2 Enhanced shuffle with async support
        if (player.queue.length > 1000) {
            message.reply('🔀 Shuffling large queue (this may take a moment)...');
            await player.queue.shuffleAsync(); // Non-blocking for large queues
        } else {
            player.queue.shuffle(); // Fast sync shuffle for small queues
        }
        
        message.reply('🔀 Queue shuffled successfully!');
    }

    if (cmd === '!clear') {
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        
        // V2 Enhanced queue clearing
        const removedCount = player.queue.length;
        player.queue.clear();
        message.reply(`🗑️ Cleared ${removedCount} tracks from queue.`);
    }

    // ===== SYSTEM COMMANDS =====

    if (cmd === '!health') {
        const health = eura.getSystemHealth();
        const embed = {
            color: 0x00ff00,
            title: '🏥 Euralink V2 System Health',
            fields: [
                {
                    name: '🌐 Nodes',
                    value: `Connected: ${health.connectedNodes}/${health.totalNodes}`,
                    inline: true
                },
                {
                    name: '🎵 Players',
                    value: `Total: ${health.totalPlayers}\nPlaying: ${health.totalPlayingPlayers}`,
                    inline: true
                },
                {
                    name: '📡 Performance',
                    value: `Avg Ping: ${Math.round(health.averagePing)}ms`,
                    inline: true
                }
            ]
        };
        
        // Add node details
        const nodeDetails = Object.entries(health.nodesHealth)
            .map(([name, node]) => `${name}: ${node.connected ? '🟢' : '🔴'} ${Math.round(node.averagePing)}ms`)
            .join('\n');
        
        if (nodeDetails) {
            embed.fields.push({
                name: '🔧 Node Details',
                value: nodeDetails,
                inline: false
            });
        }
        
        message.reply({ embeds: [embed] });
    }

    if (cmd === '!stats') {
        // Ensure players are loaded first
        await ensurePlayersLoaded();
        
        const player = eura.players.get(message.guildId);
        if (!player) return message.reply('No player for this guild.');
        
        const connectionHealth = player.connection.getHealthStatus();
        const embed = {
            color: 0x00ff00,
            title: '📊 Player Statistics',
            fields: [
                {
                    name: '🎵 Current Track',
                    value: player.current ? `${player.current.info.title} by ${player.current.info.author}` : 'None',
                    inline: false
                },
                {
                    name: '🔗 Connection',
                    value: `Status: ${connectionHealth.state}\nRegion: ${connectionHealth.region || 'Unknown'}\nPing: ${player.ping}ms`,
                    inline: true
                },
                {
                    name: '⚙️ Player State',
                    value: `Playing: ${player.playing ? 'Yes' : 'No'}\nPaused: ${player.paused ? 'Yes' : 'No'}\nVolume: ${player.volume}%`,
                    inline: true
                },
                {
                    name: '📈 Performance',
                    value: `Position: ${formatDuration(player.position)}\nQueue: ${player.queue.length} tracks`,
                    inline: true
                }
            ]
        };
        
        message.reply({ embeds: [embed] });
    }

    // ===== AUTO RESUME COMMANDS =====

    if (cmd === '!autoresume') {
        // Manually trigger autoResume for all loaded players
        try {
            await ensurePlayersLoaded();
            let resumedCount = 0;
            
            for (const [guildId, player] of eura.players) {
                if (player.voiceChannel && player.current && !player.connected) {
                    try {
                        console.log(`[Euralink V2] 🔄 Manual autoResume for guild ${guildId}...`);
                        
                        // Connect to voice channel
                        player.connect({
                            guildId: player.guildId,
                            voiceChannel: player.voiceChannel,
                            textChannel: player.textChannel
                        });
                        
                        // Wait a moment then resume playback
                        setTimeout(async () => {
                            try {
                                if (player.connected && player.current && !player.playing) {
                                    await player.restart();
                                    console.log(`[Euralink V2] ✅ Manual autoResume successful for guild ${guildId}`);
                                    resumedCount++;
                                }
                            } catch (error) {
                                console.log(`[Euralink V2] ❌ Manual autoResume failed for guild ${guildId}: ${error.message}`);
                            }
                        }, 2000);
                        
                    } catch (error) {
                        console.log(`[Euralink V2] ❌ Failed to connect player for guild ${guildId}: ${error.message}`);
                    }
                }
            }
            
            message.reply(`🔄 AutoResume triggered for ${resumedCount} player(s). Check console for details.`);
        } catch (error) {
            message.reply(`❌ Failed to trigger autoResume: ${error.message}`);
        }
    }

    if (cmd === '!resume') {
        // Manually resume playback for current player
        try {
            await ensurePlayersLoaded();
            const player = eura.players.get(message.guildId);
            if (!player) return message.reply('No player for this guild.');
            
            if (!player.current) {
                return message.reply('❌ No track to resume.');
            }
            
            if (!player.connected) {
                return message.reply('❌ Player not connected to voice channel.');
            }
            
            console.log(`[Euralink V2] 🎵 Manual resume for guild ${message.guildId}...`);
            console.log(`[Euralink V2] Player state - Current: ${!!player.current}, Playing: ${player.playing}, Connected: ${player.connected}, Position: ${player.position}ms`);
            
            await player.restart();
            message.reply(`✅ Resumed playback: \`${player.current.info.title}\` at position ${formatDuration(player.position)}`);
            
        } catch (error) {
            message.reply(`❌ Failed to resume playback: ${error.message}`);
        }
    }

    if (cmd === '!seek') {
        // Manually seek to a position
        const args = message.content.split(' ');
        if (args.length < 2) {
            return message.reply('❌ Usage: !seek <position in seconds>');
        }
        
        const positionSeconds = parseInt(args[1]);
        if (isNaN(positionSeconds) || positionSeconds < 0) {
            return message.reply('❌ Invalid position. Please provide a positive number in seconds.');
        }
        
        try {
            await ensurePlayersLoaded();
            const player = eura.players.get(message.guildId);
            if (!player) return message.reply('No player for this guild.');
            
            if (!player.current) {
                return message.reply('❌ No track to seek.');
            }
            
            const positionMs = positionSeconds * 1000;
            await player.seek(positionMs);
            
            // Update autoResumeState with new position
            if (player.autoResumeState) {
                player.autoResumeState.lastPosition = positionMs;
            }
            
            message.reply(`✅ Seeked to ${formatDuration(positionMs)} in \`${player.current.info.title}\``);
            
        } catch (error) {
            message.reply(`❌ Failed to seek: ${error.message}`);
        }
    }

    if (cmd === '!connect') {
        // Manually connect to voice channel
        try {
            await ensurePlayersLoaded();
            const player = eura.players.get(message.guildId);
            if (!player) return message.reply('No player for this guild.');
            
            if (!player.voiceChannel) {
                return message.reply('❌ No voice channel set for this player.');
            }
            
            console.log(`[Euralink V2] 🔗 Manual connection attempt for guild ${message.guildId} to channel ${player.voiceChannel}`);
            console.log(`[Euralink V2] Current state - Connected: ${player.connected}, Playing: ${player.playing}`);
            
            player.connect({
                guildId: player.guildId,
                voiceChannel: player.voiceChannel,
                textChannel: player.textChannel
            });
            
            message.reply(`🔗 Attempting to connect to voice channel <#${player.voiceChannel}>...`);
            
        } catch (error) {
            message.reply(`❌ Failed to connect: ${error.message}`);
        }
    }

    // ===== UTILITY COMMANDS =====

    if (cmd === '!cache') {
        // V2 Cache management
        eura.clearCaches();
        message.reply('🧹 All caches cleared successfully!');
    }

    if (cmd === '!help') {
        const embed = {
            color: 0x00ff00,
            title: '🎵 Euralink V2 Music Bot Commands',
            description: 'Essential music commands for your Discord server',
            fields: [
                {
                    name: '🎵 Music Commands',
                    value: '`!play <query>` - Play a song or playlist\n`!stop` - Stop playback and clear queue\n`!skip` - Skip current track\n`!pause` - Pause/resume playback\n`!volume <0-100>` - Set volume\n`!nowplaying` - Show current track\n`!disconnect` - Leave voice channel',
                    inline: false
                },
                {
                    name: '📋 Queue Commands',
                    value: '`!queue` - Show current queue\n`!shuffle` - Shuffle queue\n`!clear` - Clear queue',
                    inline: false
                },
                {
                    name: '🔄 AutoResume Commands',
                    value: '`!autoresume` - Manually trigger autoResume\n`!resume` - Resume current track\n`!seek <seconds>` - Seek to position',
                    inline: false
                },
                {
                    name: '⚙️ System Commands',
                    value: '`!health` - System health status\n`!stats` - Player statistics\n`!cache` - Clear caches',
                    inline: false
                }
            ],
            footer: {
                text: 'Euralink V2 - Advanced Lavalink Client'
            }
        };
        
        message.reply({ embeds: [embed] });
    }
})

// V2 Enhanced Event Handlers
eura.on('nodeConnect', (node) => {
    console.log(`[Euralink V2] ✅ Connected to node: ${node.name}`);
    
    // Try to load players if not already loaded
    if (!playersLoaded) {
        setTimeout(async () => {
            try {
                console.log('[Euralink V2] Node connected, attempting to load player states...');
                const loadedCount = await eura.loadPlayersState('./EuraPlayers.json');
                console.log(`[Euralink V2] ✅ Player states loaded after node connection: ${loadedCount} players restored`);
                playersLoaded = true;
                
                // Log details of loaded players
                if (loadedCount > 0) {
                    console.log('[Euralink V2] Loaded players after node connection:');
                    for (const [guildId, player] of eura.players) {
                        const trackInfo = player.current ? player.current.info.title : 'No track';
                        console.log(`  - Guild ${guildId}: ${trackInfo} (Queue: ${player.queue.length} tracks)`);
                        
                        // AutoResume: Connect to voice channel and resume playback
                        if (player.voiceChannel && player.current) {
                            console.log(`[Euralink V2] 🔄 Attempting to autoResume player for guild ${guildId}...`);
                            
                            try {
                                // Connect to voice channel
                                player.connect({
                                    guildId: player.guildId,
                                    voiceChannel: player.voiceChannel,
                                    textChannel: player.textChannel
                                });
                                
                                // Wait a moment for connection to establish
                                setTimeout(async () => {
                                    try {
                                        if (player.connected) {
                                            console.log(`[Euralink V2] ✅ AutoResume successful for guild ${guildId}`);
                                            
                                            // Resume playback at the saved position - always restart if there's a current track
                                            if (player.current) {
                                                console.log(`[Euralink V2] 🎵 Attempting to resume playback for guild ${guildId}...`);
                                                console.log(`[Euralink V2] Player state before restart - Current: ${!!player.current}, Playing: ${player.playing}, Position: ${player.position}ms`);
                                                await player.restart();
                                                console.log(`[Euralink V2] 🎵 Resumed playback for guild ${guildId} at position ${player.position}ms`);
                                            } else {
                                                console.log(`[Euralink V2] ⚠️ No current track to resume for guild ${guildId}`);
                                            }
                                        } else {
                                            console.log(`[Euralink V2] ❌ Failed to connect to voice channel for guild ${guildId}`);
                                        }
                                    } catch (error) {
                                        console.log(`[Euralink V2] ❌ AutoResume failed for guild ${guildId}: ${error.message}`);
                                    }
                                }, 3000); // Increased wait time to 3 seconds for voice connection
                                
                            } catch (error) {
                                console.log(`[Euralink V2] ❌ Failed to connect player for guild ${guildId}: ${error.message}`);
                            }
                        }
                    }
                }
            } catch (error) {
                console.log('[Euralink V2] ❌ Failed to load players after node connection:', error.message);
                playersLoaded = true; // Mark as loaded even if failed
            }
        }, 1000); // Wait 1 second after node connects
    }
});

eura.on('nodeError', (node, error) => {
    console.log(`[Euralink V2] ❌ Node "${node.name}" encountered an error: ${error.message}.`);
});

eura.on('nodeDisconnect', (node, event, reason) => {
    console.log(`[Euralink V2] 🔌 Node "${node.name}" disconnected. Reason: ${reason || 'Unknown'}`);
});

eura.on('nodeDestroy', (node) => {
    console.log(`[Euralink V2] 🗑️ Node "${node.name}" destroyed.`);
});

eura.on('playerCreate', (player) => {
    console.log(`[Euralink V2] 🎵 Player created for guild: ${player.guildId}`);
});

eura.on('playerDestroy', (player) => {
    console.log(`[Euralink V2] 🗑️ Player destroyed for guild: ${player.guildId}`);
    
    // Debug euraSync usage
    if (eura.euraSync && player.voiceChannel) {
        console.log(`[EuraSync] 🧹 Clearing voice channel status (player destroyed)`);
    }
});

eura.on('trackStart', (player, track) => {
    console.log(`[Euralink V2] ▶️ Started playing: ${track.info.title} in guild: ${player.guildId}`);
    
    // Debug euraSync usage
    if (eura.euraSync && player.voiceChannel) {
        console.log(`[EuraSync] 🎵 Updating voice channel status for: ${track.info.title}`);
    }

    // Send message to text channel
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) {
        channel.send(`🎵 **Now Playing**: \`${track.info.title}\` by \`${track.info.author}\``);
    }
});

eura.on('trackEnd', (player, track, reason) => {
    console.log(`[Euralink V2] ⏹️ Track ended: ${track.info.title} (${reason}) in guild: ${player.guildId}`);
    
    // Debug euraSync usage
    if (eura.euraSync && player.voiceChannel && reason === 'STOPPED') {
        console.log(`[EuraSync] 🧹 Clearing voice channel status (track stopped)`);
    }

    // Send message to text channel for certain reasons
    if (reason === 'STOPPED' || reason === 'REPLACED') {
        const channel = client.channels.cache.get(player.textChannel);
        if (channel) {
            if (reason === 'STOPPED') {
                channel.send(`⏹️ **Stopped playing**: \`${track.info.title}\``);
            } else if (reason === 'REPLACED') {
                channel.send(`🔄 **Track replaced**: \`${track.info.title}\``);
            }
        }
    }
});

eura.on('queueEnd', (player) => {
    console.log(`[Euralink V2] 📭 Queue ended for guild: ${player.guildId}`);
    
    // Send message to text channel
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) {
        channel.send(`📭 **Queue ended** - No more tracks to play.`);
    }
    
    // Don't destroy the player - keep it for autoResume
    // Only destroy if autoResume is disabled and no current track
    if (!player.autoResumeState.enabled && !player.current) {
        console.log(`[Euralink V2] 🗑️ Destroying player for guild ${player.guildId} (no autoResume, no current track)`);
        player.destroy();
    } else {
        console.log(`[Euralink V2] 💾 Keeping player for guild ${player.guildId} (autoResume enabled or has current track)`);
    }
});

eura.on('trackError', (player, track, error) => {
    console.log(`[Euralink V2] ❌ Track error: ${track.info.title} - ${error.message}`);
    
    // Send error message to text channel
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) {
        channel.send(`❌ **Track Error**: \`${track.info.title}\` - ${error.message}`);
    }
});

eura.on('trackStuck', (player, track, threshold) => {
    console.log(`[Euralink V2] 🔄 Track stuck: ${track.info.title} (threshold: ${threshold}ms)`);
    
    // Send stuck message to text channel
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) {
        channel.send(`🔄 **Track stuck**: \`${track.info.title}\` - Skipping to next track.`);
    }
});

eura.on('debug', (message) => {
    console.log(`[Euralink V2 Debug] ${message}`);
});

// V2 Performance monitoring
eura.on('apiResponse', (endpoint, response, metrics) => {
    if (metrics.responseTime > 1000) {
        console.log(`[Euralink V2] ⚠️ Slow API call: ${endpoint} took ${metrics.responseTime}ms`);
    }
});

// Add voice event listeners
client.on('raw', (packet) => {
    console.log(`[Raw Event] Received: ${packet.t}`);
    if ([GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(packet.t)) {
        console.log(`[Raw Event] Processing voice event: ${packet.t}`);
        eura.updateVoiceState(packet);
    }
});

// Utility function for formatting duration
function formatDuration(ms) {
    if (!ms || ms < 0) return '0:00';
    
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

client.login(config.token)
