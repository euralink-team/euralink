const { 
    Client,
    GatewayDispatchEvents,
    GatewayIntentBits,
    Partials
} = require('discord.js');
const { Euralink } = require('euralink');
const config = require('./config.json')

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// Enhanced Euralink V0.3.0 Configuration
const nodes = [
    {
        name: 'Main Node',
        host: 'lavalink.jirayu.net',
        password: 'youshallnotpass',
        port: 13592,
        secure: false,
        regions: ['us_central', 'us_east']
    }
];

// Initialize Euralink with all V0.3.0 features
const eura = new Euralink(client, nodes, {
    send: (data) => {
        const guild = client.guilds.cache.get(data.d.guild_id);
        if (guild) guild.shard.send(data);
    },
    defaultSearchPlatform: 'ytmsearch',
    
    // Enhanced performance features
    enhancedPerformance: {
        enabled: true,
        connectionPooling: true,
        requestBatching: true,
        memoryOptimization: true
    },

    // REST API optimizations
    rest: {
        version: 'v4',
        retryCount: 3,
        timeout: 5000
    },

    // EuraSync (voice channel status)
    euraSync: {
        enabled: true,
        template: '🎵 {title} by {author}'
    },

    // Bot activity status
    activityStatus: {
        enabled: true,
        template: '🎵 {title} by {author}'
    },

    // Enhanced AutoResume
    resume: {
        enabled: true,
        key: 'euralink-v0.3.0-resume',
        timeout: 60000
    },

    // Node management
    node: {
        dynamicSwitching: true,
        autoReconnect: true,
        ws: {
            reconnectTries: 5,
            reconnectInterval: 5000
        }
    },

    // Performance optimizations
    autopauseOnEmpty: true,
    lazyLoad: {
        enabled: true,
        timeout: 5000
    },

    // Advanced track features
    track: {
        historyLimit: 50,
        enableVoting: true,
        enableFavorites: true,
        enableUserNotes: true
    }
});

client.on('ready', async () => {
    console.log(`🎵 [Euralink V0.3.0] Bot ready as ${client.user.tag}`);
    eura.init(client.user.id);

    // Load player states on startup
    try {
        await eura.loadPlayersState('./EuraPlayers.json');
        console.log('📁 [Euralink] Player states loaded successfully');
    } catch (error) {
        console.log('📁 [Euralink] No previous player states found');
    }

    // Perform health check (only if we have real nodes)
    const hasRealNodes = nodes.some(node => !node.host.includes('localhost'));
    if (hasRealNodes) {
        setInterval(async () => {
            const health = await eura.performHealthCheck();
            if (health.overall !== 'healthy') {
                console.log(`⚠️ [Euralink] System health: ${health.overall}`);
            } else {
                console.log(`✅ [Euralink] System health: ${health.overall}`);
            }
        }, 30000); // Every 30 seconds
    } else {
        console.log('ℹ️ [Euralink] Health monitoring disabled (using localhost nodes)');
    }
});

// Enhanced event handlers
eura.on('nodeConnect', (node) => {
    console.log(`🔗 [Euralink] Connected to node: ${node.name}`);
});

eura.on('trackStart', (player, track) => {
    console.log(`🎵 [Euralink] Started: ${track.info.title} by ${track.info.author}`);
});

eura.on('sponsorBlockSegmentsLoaded', (player, segments) => {
    console.log(`🚫 [SponsorBlock] Loaded ${segments.length} segments for ${player.guildId}`);
});

eura.on('sponsorBlockSegmentSkipped', (player, segment) => {
    console.log(`⏭️ [SponsorBlock] Skipped ${segment.category} segment in ${player.guildId}`);
});

eura.on('chaptersLoaded', (player, chapters) => {
    console.log(`📖 [Chapters] Loaded ${chapters.length} chapters for ${player.guildId}`);
});

eura.on('errorRecovered', (context, error) => {
    console.log(`✅ [Euralink] Recovered from error in ${context}`);
});

eura.on('playerMigrated', (player, oldNode, newNode) => {
    console.log(`🔄 [Euralink] Player ${player.guildId} migrated: ${oldNode.name} → ${newNode.name}`);
});

// Enhanced command handler with all new features
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    // Music commands
    if (command === '!play') {
        const query = args.slice(1).join(' ');
        if (!query) return message.reply('❌ Please provide a search query!');

        const member = message.member;
        const voiceChannel = member.voice?.channel;
        if (!voiceChannel) return message.reply('❌ Join a voice channel first!');

        try {
            const player = eura.createConnection({
                guildId: message.guildId,
                voiceChannel: voiceChannel.id,
                textChannel: message.channelId
            });

            const result = await eura.resolve({ query, requester: message.author });
            const { loadType, tracks, playlistInfo } = result;

            if (loadType === 'playlist') {
                player.queue.addMultiple(tracks);
                message.reply(`📀 Added playlist: **${playlistInfo.name}** (${tracks.length} tracks)`);
                if (!player.playing && !player.paused) player.play();
            } else if (loadType === "search" || loadType === "track") {
                const track = tracks[0];
                player.queue.add(track);
                message.reply(`🎵 Added: **${track.info.title}**`);
                if (!player.playing && !player.paused) player.play();
            } else {
                message.reply("❌ No results found.");
            }
        } catch (error) {
            message.reply(`❌ Error: ${error.message}`);
        }
    }

    // SponsorBlock commands
    if (command === '!sponsorblock') {
        const player = eura.get(message.guildId);
        if (!player) return message.reply('❌ No active player!');

        const action = args[1]?.toLowerCase();
        
        if (action === 'enable') {
            await player.setSponsorBlockCategories(['sponsor', 'selfpromo', 'interaction']);
            message.reply('✅ SponsorBlock enabled! Will skip sponsors, self-promos, and interactions.');
        } else if (action === 'disable') {
            await player.clearSponsorBlockCategories();
            message.reply('❌ SponsorBlock disabled.');
        } else if (action === 'status') {
            const categories = await player.getSponsorBlockCategories();
            message.reply(`📊 SponsorBlock categories: ${categories.join(', ') || 'None'}`);
        } else {
            message.reply('❓ Usage: !sponsorblock [enable|disable|status]');
        }
    }

    // Filter preset commands
    if (command === '!preset') {
        const player = eura.get(message.guildId);
        if (!player) return message.reply('❌ No active player!');

        const presetName = args[1]?.toLowerCase();
        
        if (!presetName) {
            const presets = player.filters.getAvailablePresets();
            return message.reply(`🎛️ **Available presets:** ${presets.join(', ')}\n\n💡 Use \`!preset clear\` to reset filters to normal`);
        }

        if (presetName === 'clear' || presetName === 'reset' || presetName === 'normal') {
            try {
                await player.filters.clearFilters();
                message.reply('🧹 **Filters cleared!** Audio restored to normal.');
            } catch (error) {
                message.reply(`❌ Error clearing filters: ${error.message}`);
            }
            return;
        }

        try {
            await player.filters.setPreset(presetName);
            message.reply(`🎛️ Applied preset: **${presetName}**\n\n💡 Use \`!preset clear\` to reset back to normal`);
        } catch (error) {
            message.reply(`❌ ${error.message}`);
        }
    }

    // Lyrics commands  
    if (command === '!lyrics') {
        const player = eura.get(message.guildId);
        if (!player || !player.current) return message.reply('❌ No track playing!');

        const action = args[1]?.toLowerCase();

        try {
            const lyricsResult = await player.getLyrics();
            
            if (lyricsResult.error) {
                message.reply(`❌ ${lyricsResult.error}`);
                return;
            }

            if (action === 'sync' && lyricsResult.syncedLyrics) {
                // Start real-time synced lyrics display
                const initialLine = player.getCurrentLyricLine(lyricsResult.syncedLyrics);
                const lyricsMessage = await message.reply(`🎵 **Live Synced Lyrics**\n\n**Now:** ${initialLine || 'Loading...'}\n\n💡 Lyrics will update in real-time! Use \`!lyrics stop\` to stop.`);
                
                // Store the interval for this guild
                if (!client.syncedLyricsIntervals) client.syncedLyricsIntervals = new Map();
                
                // Clear any existing interval
                const existingInterval = client.syncedLyricsIntervals.get(message.guildId);
                if (existingInterval) clearInterval(existingInterval);
                
                // Store the current track info to detect changes
                let currentTrackId = player.current?.info?.identifier;
                let currentTrackTitle = player.current?.info?.title;
                
                // Start real-time updates
                const lyricsInterval = setInterval(async () => {
                    try {
                        // Check if track changed or player stopped
                        if (!player.current || !player.playing) {
                            clearInterval(lyricsInterval);
                            client.syncedLyricsIntervals.delete(message.guildId);
                            lyricsMessage.edit(`🎵 **Synced lyrics stopped** ⏹️\n\n❌ **Reason:** ${!player.current ? 'No track playing' : 'Playback stopped'}\n\n💡 Use \`!lyrics sync\` on the new track to restart.`);
                            return;
                        }
                        
                        // Check if it's a different track
                        if (player.current.info.identifier !== currentTrackId) {
                            clearInterval(lyricsInterval);
                            client.syncedLyricsIntervals.delete(message.guildId);
                            lyricsMessage.edit(`🎵 **Synced lyrics stopped** ⏹️\n\n🎵 **Reason:** New track started: **${player.current.info.title}**\n\n💡 Use \`!lyrics sync\` to show lyrics for the new track!`);
                            return;
                        }
                        
                        const currentLine = player.getCurrentLyricLine(lyricsResult.syncedLyrics, player.position);
                        const currentChapter = player.getCurrentChapter();
                        const chapterText = currentChapter ? `📖 **Chapter:** ${currentChapter.name}\n` : '';
                        
                        const newContent = `🎵 **Live Synced Lyrics** 🔄\n\n🎵 **Track:** ${currentTrackTitle}\n${chapterText}**Now:** ${currentLine || 'Instrumental section'}\n**Position:** ${player.formatDuration(player.position)} / ${player.formatDuration(player.current.info.length)}\n\n💡 Use \`!lyrics stop\` to stop updates.`;
                        
                        await lyricsMessage.edit(newContent);
                    } catch (error) {
                        // Stop if message was deleted or other error
                        clearInterval(lyricsInterval);
                        client.syncedLyricsIntervals.delete(message.guildId);
                    }
                }, 1000); // Update every second
                
                client.syncedLyricsIntervals.set(message.guildId, lyricsInterval);
                
                // Auto-stop after 10 minutes to prevent spam
                setTimeout(() => {
                    clearInterval(lyricsInterval);
                    client.syncedLyricsIntervals.delete(message.guildId);
                    lyricsMessage.edit(lyricsMessage.content + '\n\n⏰ **Auto-stopped after 10 minutes**');
                }, 600000);
                
            } else if (action === 'stop') {
                // Stop synced lyrics
                if (client.syncedLyricsIntervals?.has(message.guildId)) {
                    clearInterval(client.syncedLyricsIntervals.get(message.guildId));
                    client.syncedLyricsIntervals.delete(message.guildId);
                    message.reply('⏹️ **Synced lyrics stopped.**');
                } else {
                    message.reply('❌ No synced lyrics are currently running.');
                }
                
            } else if (action === 'full' && lyricsResult.lyrics) {
                // Show full lyrics
                const lyrics = lyricsResult.lyrics.substring(0, 1900); // Leave room for formatting
                message.reply(`📝 **Full Lyrics:**\n\`\`\`\n${lyrics}\n\`\`\`${lyrics.length >= 1900 ? '\n\n*Lyrics truncated due to Discord limits*' : ''}`);
                
            } else if (lyricsResult.syncedLyrics) {
                // Show current line and options
                const currentLine = player.getCurrentLyricLine(lyricsResult.syncedLyrics);
                const currentChapter = player.getCurrentChapter();
                const chapterText = currentChapter ? `📖 **Chapter:** ${currentChapter.name}\n\n` : '';
                
                message.reply(`🎵 **Lyrics Available!**\n\n${chapterText}**Current line:** ${currentLine || 'No current line'}\n\n**Commands:**\n🔄 \`!lyrics sync\` - Real-time synced lyrics\n📝 \`!lyrics full\` - Show complete lyrics\n⏹️ \`!lyrics stop\` - Stop synced display`);
                
            } else if (lyricsResult.lyrics) {
                // Show static lyrics (fallback)
                const lyrics = lyricsResult.lyrics.substring(0, 1900);
                message.reply(`📝 **Lyrics:**\n\`\`\`\n${lyrics}\n\`\`\`${lyrics.length >= 1900 ? '\n\n*Lyrics truncated*' : ''}\n\n💡 These lyrics are not synced.`);
            }
        } catch (error) {
            message.reply(`❌ Error fetching lyrics: ${error.message}`);
        }
    }

    // Chapter commands
    if (command === '!chapters') {
        const player = eura.get(message.guildId);
        if (!player) return message.reply('❌ No active player!');

        const chapters = player.getChapters();
        if (chapters.length === 0) {
            return message.reply('❌ No chapters available for current track.');
        }

        const chapterList = chapters.map((ch, i) => 
            `${i + 1}. **${ch.name}** (${player.formatDuration(ch.start)} - ${player.formatDuration(ch.end)})`
        ).join('\n');

        const currentChapter = player.getCurrentChapter();
        const current = currentChapter ? `\n\n🎯 **Current:** ${currentChapter.name}` : '';
        
        message.reply(`📖 **Chapters:**\n${chapterList}${current}`);
    }

    // Health check command
    if (command === '!health') {
        const health = await eura.performHealthCheck();
        const status = health.overall === 'healthy' ? '✅' : '⚠️';
        
        const nodeStatus = Object.entries(health.nodes).map(([name, node]) => 
            `**${name}:** ${node.connected ? '🟢' : '🔴'} (${node.players} players)`
        ).join('\n');

        message.reply(`${status} **System Health: ${health.overall}**\n\n**Nodes:**\n${nodeStatus}\n\n**Performance:**\n- Active Players: ${health.performance.activePlayerCount}\n- Playing: ${health.performance.playingPlayerCount}\n- Memory: ${Math.round(health.performance.memoryUsage.heapUsed / 1024 / 1024)}MB`);
    }

    // Queue management
    if (command === '!queue') {
        const player = eura.get(message.guildId);
        if (!player) return message.reply('❌ No active player!');

        const action = args[1]?.toLowerCase();
        
        if (action === 'shuffle') {
            await player.shuffleQueue();
            message.reply('🔀 Queue shuffled!');
        } else if (action === 'clear') {
            player.queue.clear();
            message.reply('🧹 Queue cleared!');
        } else if (action === 'stats') {
            const stats = player.queue.getStats();
            message.reply(`📊 **Queue Stats:**\n- Total tracks: ${stats.totalTracks}\n- Duration: ${player.formatDuration(stats.totalDuration)}\n- Unique artists: ${stats.uniqueArtists}`);
        } else {
            const upcoming = player.queue.slice(0, 10).map((track, i) => 
                `${i + 1}. **${track.info.title}** by ${track.info.author}`
            ).join('\n') || 'Empty';
            
            message.reply(`📋 **Queue (${player.queue.length} tracks):**\n${upcoming}`);
        }
    }

    // Basic controls
    if (command === '!pause') {
        const player = eura.get(message.guildId);
        if (!player) return message.reply('❌ No active player!');
        player.pause(true);
        message.reply('⏸️ Paused');
    }

    if (command === '!resume') {
        const player = eura.get(message.guildId);
        if (!player) return message.reply('❌ No active player!');
        player.pause(false);
        message.reply('▶️ Resumed');
    }

    if (command === '!skip') {
        const player = eura.get(message.guildId);
        if (!player) return message.reply('❌ No active player!');
        player.stop();
        message.reply('⏭️ Skipped');
    }
});

// Essential: Forward Discord voice events to Euralink
client.on('raw', (d) => {
    if ([GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) {
        eura.updateVoiceState(d);
    }
});

// Save player states on shutdown
process.on('SIGINT', async () => {
    console.log('🔄 [Euralink] Saving player states...');
    
    // Clean up synced lyrics intervals
    if (client.syncedLyricsIntervals) {
        console.log('🧹 [Euralink] Cleaning up synced lyrics intervals...');
        for (const interval of client.syncedLyricsIntervals.values()) {
            clearInterval(interval);
        }
        client.syncedLyricsIntervals.clear();
    }
    
    try {
        await eura.savePlayersState('./EuraPlayers.json');
        console.log('✅ [Euralink] Player states saved successfully');
    } catch (error) {
        console.log('❌ [Euralink] Failed to save player states:', error.message);
    }
    process.exit(0);
});

// Replace with your bot token
client.login(config.token);

console.log(`
🎵 Euralink V0.3.0 Enhanced Example Bot
=====================================
Features:
✅ SponsorBlock integration
✅ Real-time lyrics with sync
✅ Advanced filter presets  
✅ Chapter support
✅ Enhanced error recovery
✅ Health monitoring
✅ Performance optimizations
✅ AutoResume system

Commands:
!play <query>         - Play music
!sponsorblock <action> - Manage SponsorBlock (enable/disable/status)
!preset <name>        - Apply filter preset (!preset clear to reset)
!lyrics [sync/full/stop] - Get lyrics (sync for real-time display)
!chapters            - Show video chapters
!health              - System health check
!queue <action>       - Queue management (shuffle/clear/stats)
!pause/!resume/!skip  - Basic controls

Ready to make Euralink the best lavalink client! 🚀
`);
