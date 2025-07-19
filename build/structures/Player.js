const { EventEmitter } = require("tseep");
const { ActivityType } = require('discord.js');
const { Connection } = require("./Connection");
const { Filters } = require("./Filters");
const { Queue } = require("./Queue");
const { spAutoPlay, scAutoPlay } = require('../handlers/autoPlay');
const { inspect } = require("util");

let lrclibClient = null;
try {
    const { Client } = require('lrclib-api');
    lrclibClient = new Client();
} catch (error) {
    console.warn('lrclib-api not installed. Lyrics functionality will be disabled.');
}

class Player extends EventEmitter {
    constructor(eura, node, options) {
        super();
        this.eura = eura;
        this.node = node;
        this.options = options;
        this.guildId = options.guildId;
        this.textChannel = options.textChannel;
        this.voiceChannel = options.voiceChannel;
        this.connection = new Connection(this);
        this.filters = new Filters(this);
        this.mute = options.mute ?? false;
        this.deaf = options.deaf ?? false;
        this.volume = options.defaultVolume ?? 100;
        this.loop = options.loop ?? "none";
        this.data = {};
        this.queue = new Queue();
        this.position = 0;
        this.current = null;
        this.previousTracks = [];
        this.historyLimit = options.historyLimit || 20; // NEW: configurable history size
        this.playing = false;
        this.paused = false;
        this.connected = false;
        this.timestamp = Date.now();
        this.ping = 0;
        this.isAutoplay = false;
        
        this.updateQueue = [];
        this.updateTimeout = null;
        this.batchUpdates = true;
        this.batchDelay = 25;
        
        this.autoResumeState = {
            enabled: options.autoResume ?? false,
            lastTrack: null,
            lastPosition: 0,
            lastVolume: this.volume,
            lastFilters: null,
            lastUpdate: Date.now()
        };

        // SponsorBlock support
        this.sponsorBlock = {
            enabled: options.sponsorBlock?.enabled ?? false,
            categories: options.sponsorBlock?.categories ?? ['sponsor', 'selfpromo', 'interaction'],
            segments: [],
            chapters: []
        };

        this.on("playerUpdate", (packet) => {
            this.connected = packet.state.connected;
            this.position = packet.state.position;
            this.ping = packet.state.ping;
            this.timestamp = packet.state.time || Date.now();
            this.eura.emit("playerUpdate", this, packet);
        });

        this.on("event", (data) => {
            this.handleEvent(data)
        });

        // SponsorBlock event handling
        this.on("SegmentsLoaded", (data) => {
            this.sponsorBlock.segments = data.segments || [];
            this.eura.emit("sponsorBlockSegmentsLoaded", this, data.segments);
        });

        this.on("SegmentSkipped", (data) => {
            this.eura.emit("sponsorBlockSegmentSkipped", this, data.segment);
        });

        this.on("ChaptersLoaded", (data) => {
            this.sponsorBlock.chapters = data.chapters || [];
            this.eura.emit("chaptersLoaded", this, data.chapters);
        });

        this.on("ChapterStarted", (data) => {
            this.eura.emit("chapterStarted", this, data.chapter);
        });
    }
    /**
     * @description gets the Previously played Track
     */
    get previous() {
     return this.previousTracks?.[0]
    }

    /**
     * @description Fetch lyrics for the current track using lrclib-api, or a custom query
     * @param {Object|null} queryOverride - Optional custom query { track_name, artist_name, album_name }
     * @returns {Promise<{lyrics?: string, syncedLyrics?: string, error?: string, metadata?: Object}>}
     */
    async getLyrics(queryOverride = null) {
        if (!this.current && !queryOverride) {
            return { error: 'No track is currently playing.' };
        }

        if (!lrclibClient) {
            return { error: 'Lyrics functionality not available. Install lrclib-api package.' };
        }

        try {
            let query;
            if (queryOverride) {
                query = { ...queryOverride };
            } else {
                const info = this.current.info;
                let author = info.author;
                // Fallback: try requester username if author is missing
                if (!author && info.requester && info.requester.username) {
                    author = info.requester.username;
                }
                // Fallback: try 'Unknown Artist' if still missing
                if (!author) {
                    author = 'Unknown Artist';
                }
                query = {
                    track_name: info.title,
                    artist_name: author
                };
                if (info.pluginInfo?.albumName) {
                    query.album_name = info.pluginInfo.albumName;
                }
            }

            // Log the query for debugging
            this.eura.emit('debug', this.guildId, `Lyrics query: ${JSON.stringify(query)}`);

            if (!query.track_name || !query.artist_name) {
                return { error: 'Track information incomplete.' };
            }

            // Fetch metadata (contains both plain and synced lyrics if available)
            const meta = await lrclibClient.findLyrics(query);

            if (!meta) {
                return { error: 'Lyrics not found for this track.' };
            }

            const result = {
                metadata: {
                    id: meta.id,
                    trackName: meta.trackName,
                    artistName: meta.artistName,
                    albumName: meta.albumName,
                    duration: meta.duration,
                    instrumental: meta.instrumental
                }
            };

            // Prefer synced lyrics if available
            if (meta.syncedLyrics) {
                result.syncedLyrics = meta.syncedLyrics;
                result.lyrics = meta.plainLyrics;
            } else if (meta.plainLyrics) {
                result.lyrics = meta.plainLyrics;
            } else {
                return { error: 'No lyrics available for this track.' };
            }

            return result;

        } catch (error) {
            this.eura.emit('debug', this.guildId, `Lyrics fetch error: ${error.message}`);
            return { error: `Failed to fetch lyrics: ${error.message}` };
        }
    }

    /**
     * @description Get the current lyric line based on playback position (for synced lyrics)
     * @param {string} syncedLyrics - LRC formatted lyrics string
     * @param {number} currentTimeMs - Current playback position in milliseconds
     * @returns {string} Current lyric line or empty string
     */
    getCurrentLyricLine(syncedLyrics, currentTimeMs = this.position) {
        if (!syncedLyrics || !currentTimeMs) {
            return '';
        }

        try {
            // Simple LRC parser for current line
            const lines = syncedLyrics.split('\n');
            let currentLine = '';

            for (const line of lines) {
                const timeMatch = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]/);
                if (timeMatch) {
                    const minutes = parseInt(timeMatch[1]);
                    const seconds = parseInt(timeMatch[2]);
                    const centiseconds = parseInt(timeMatch[3]);
                    const lineTimeMs = (minutes * 60 + seconds) * 1000 + centiseconds * 10;

                    if (currentTimeMs >= lineTimeMs) {
                        currentLine = line.replace(/\[\d{2}:\d{2}\.\d{2}\]/, '').trim();
                    } else {
                        break; // Found the next line, stop searching
                    }
                }
            }

            return currentLine;
        } catch (error) {
            this.eura.emit('debug', this.guildId, `Lyric line parsing error: ${error.message}`);
            return '';
        }
    }

    /**
     * @private
     */
    addToPreviousTrack(track) {
        if (!track) return;
        // Attach metadata
        const now = Date.now();
        let historyEntry = {
            ...track,
            playedAt: now,
            replayCount: 1
        };
        // If this track is already the most recent, increment replayCount
        if (this.previousTracks.length > 0 && this.previousTracks[0].info.identifier === track.info.identifier) {
            this.previousTracks[0].replayCount += 1;
            this.previousTracks[0].playedAt = now;
        } else {
            this.previousTracks.unshift(historyEntry);
            // Enforce history size limit
            if (this.previousTracks.length > this.historyLimit) {
                this.previousTracks = this.previousTracks.slice(0, this.historyLimit);
            }
        }
    }
    /**
     * @description Get the full track history (recently played)
     * @returns {Array} Array of track history entries
     */
    getHistory() {
        return this.previousTracks;
    }

    /**
     * Get all favorite tracks from history.
     * @returns {Array} Array of favorited tracks
     */
    getFavorites() {
        return this.previousTracks.filter(track => track.favorited);
    }

    /**
     * Get unique artists and sources from queue and history.
     * @returns {Object} { artists: Set, sources: Set }
     */
    getUniqueArtistsAndSources() {
        const artists = new Set();
        const sources = new Set();
        for (const track of [...this.queue, ...this.previousTracks]) {
            if (track.info?.author) artists.add(track.info.author);
            if (track.info?.sourceName) sources.add(track.info.sourceName);
        }
        return { artists, sources };
    }

    queueUpdate(updateData) {
        if (!this.batchUpdates) {
            this.performUpdate(updateData);
            return;
        }

        this.updateQueue.push({
            ...updateData,
            timestamp: Date.now()
        });

        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }

        this.updateTimeout = setTimeout(() => {
            this.processUpdateQueue();
        }, this.batchDelay);
    }

    async processUpdateQueue() {
        if (this.updateQueue.length === 0) return;

        const mergedUpdate = {};
        for (const update of this.updateQueue) {
            Object.assign(mergedUpdate, update);
        }
        this.updateQueue = [];

        try {
            await this.performUpdate(mergedUpdate);
        } catch (error) {
            this.eura.emit('playerError', this, error);
        }
    }

    async performUpdate(updateData) {
        try {
            await this.node.rest.updatePlayer({
                guildId: this.guildId,
                data: updateData,
            });
        } catch (error) {
            this.eura.emit('playerError', this, error);
            throw error;
        }
    }

    async play() {
        try {
            if (!this.connected) {
                throw new Error("Player connection is not initiated. Kindly use Euralink.createConnection() and establish a connection, TIP: Check if Guild Voice States intent is set/provided & 'updateVoiceState' is used in the raw(Gateway Raw) event");
            }
            if (!this.queue.length) return;
            this.current = this.queue.shift();
            if (!this.current.track) {
                this.current = await this.current.resolve(this.eura);
            }
            this.playing = true;
            this.position = 0;
            this.timestamp = Date.now();
            const { track } = this.current;
            this.queueUpdate({
                track: {
                    encoded: track,
                },
            });
            return this;
        } catch (err) {
            this.eura.emit('playerError', this, err);
            throw err;
        }
    }

    async restart() {
        try {
        if (!this.current || !this.connected) return;
            
            // Use saved position from autoResumeState if available, otherwise use current position
            const resumePosition = this.autoResumeState.lastPosition || this.position;
            
        const data = {
        track: { encoded: this.current.track },
                position: resumePosition,
        paused: this.paused,
        volume: this.volume,
        };
            
        if (this.filters && typeof this.filters.getPayload === "function") {
        const filterPayload = this.filters.getPayload();
        if (filterPayload && Object.keys(filterPayload).length > 0) {
            data.filters = filterPayload;
        }
        }
            
        await this.node.rest.updatePlayer({
        guildId: this.guildId,
        data,
        });
            
            // Update the position to match what we sent to Lavalink
            this.position = resumePosition;
        this.playing = !this.paused;
            this.autoResumeState.lastUpdate = Date.now();
            
            this.eura.emit("debug", this.guildId, `Player state restored after node reconnect (autoResume) at position ${resumePosition}ms`);
        } catch (err) {
            this.eura.emit('playerError', this, err);
            throw err;
        }
    }

    saveAutoResumeState() {
        if (!this.autoResumeState.enabled) return;
        
        this.autoResumeState = {
            ...this.autoResumeState,
            lastTrack: this.current,
            lastPosition: this.position,
            lastVolume: this.volume,
            lastFilters: this.filters.getPayload ? this.filters.getPayload() : null,
            lastUpdate: Date.now()
        };
    }

    clearAutoResumeState() {
        this.autoResumeState = {
            enabled: this.autoResumeState.enabled,
            lastTrack: null,
            lastPosition: 0,
            lastVolume: this.volume,
            lastFilters: null,
            lastUpdate: Date.now()
        };
    }

    /**
     * 
     * @param {this} player 
     * @returns 
     */
    async autoplay(player) {
        if (!player) {
            if (player == null) {
                this.isAutoplay = false;
                return this;
            } else if (player == false) {
                this.isAutoplay = false;
                return this;
            } else throw new Error("Missing argument. Quick Fix: player.autoplay(player)");
        }

        // Check if player is still connected before attempting autoplay
        if (!this.connected) {
            this.eura.emit("debug", this.guildId, "Player disconnected from voice, skipping autoplay");
            return this;
        }

        this.isAutoplay = true;

        if (player.previous) {
            if (player.previous.info.sourceName === "youtube") {
                try {
                    let data = `https://www.youtube.com/watch?v=${player.previous.info.identifier}&list=RD${player.previous.info.identifier}`;

                    let response = await this.eura.resolve({ query: data, source: "ytmsearch", requester: player.previous.info.requester });

                    if (this.node.rest.version === "v4") {
                        if (!response || !response.tracks || ["error", "empty"].includes(response.loadType)) return this.stop();
                    } else {
                        if (!response || !response.tracks || ["LOAD_FAILED", "NO_MATCHES"].includes(response.loadType)) return this.stop();
                    }

                    let track = response.tracks[Math.floor(Math.random() * Math.floor(response.tracks.length))];
                    this.queue.push(track);
                    this.play();
                    return this
                } catch (e) {
                    return this.stop();
                }
            } else if (player.previous.info.sourceName === "soundcloud") {
                try {
                    scAutoPlay(player.previous.info.uri).then(async (data) => {
                        // Check connection again before proceeding
                        if (!this.connected) {
                            this.eura.emit("debug", this.guildId, "Player disconnected during autoplay, aborting");
                            return;
                        }

                        let response = await this.eura.resolve({ query: data, source: "scsearch", requester: player.previous.info.requester });

                        if (this.node.rest.version === "v4") {
                            if (!response || !response.tracks || ["error", "empty"].includes(response.loadType)) return this.stop();
                        } else {
                            if (!response || !response.tracks || ["LOAD_FAILED", "NO_MATCHES"].includes(response.loadType)) return this.stop();
                        }

                        let track = response.tracks[Math.floor(Math.random() * Math.floor(response.tracks.length))];

                        this.queue.push(track);
                        this.play();
                        return this;
                    })
                } catch (e) {
                    console.log(e);
                    return this.stop();
                }
            } else if (player.previous.info.sourceName === "spotify") {
                try {
                    spAutoPlay(player.previous.info.identifier).then(async (data) => {
                        // Check connection again before proceeding
                        if (!this.connected) {
                            this.eura.emit("debug", this.guildId, "Player disconnected during autoplay, aborting");
                            return;
                        }

                        const response = await this.eura.resolve({ query: `https://open.spotify.com/track/${data}`, requester: player.previous.info.requester });

                        if (this.node.rest.version === "v4") {
                            if (!response || !response.tracks || ["error", "empty"].includes(response.loadType)) return this.stop();
                        } else {
                            if (!response || !response.tracks || ["LOAD_FAILED", "NO_MATCHES"].includes(response.loadType)) return this.stop();
                        }

                        let track = response.tracks[Math.floor(Math.random() * Math.floor(response.tracks.length))];
                        this.queue.push(track);
                        this.play();
                        return this;
                    })
                } catch (e) {
                    console.log(e);
                    return this.stop();
                }
            }
        } else return this;
    }

    async connect(options = this) {
        if (this.eura.leastUsedNodes.length === 0) throw new Error("No nodes are available.");
        if (this.connected) {
            this.eura.emit("debug", `Player ${this.guildId} is already connected.`);
            return this;
        }

        const { guildId, voiceChannel, textChannel } = options;
        if (!guildId || !voiceChannel || !textChannel) {
            throw new Error("Missing required options: guildId, voiceChannel, textChannel");
        }

        if (this.connection.connectionState === 'connecting') {
            this.eura.emit("debug", `Player ${this.guildId} is already connecting.`);
            return this;
        }

        this.connection.connectionState = 'connecting';
        this.voiceChannel = voiceChannel;
        this.textChannel = textChannel;

        try {
            this.eura.send({
                op: 4,
                d: {
                    guild_id: guildId,
                    channel_id: voiceChannel,
                    self_mute: this.mute,
                    self_deaf: this.deaf,
                },
            });
            this.eura.emit("debug", `Player ${this.guildId} requested to connect to voice channel ${voiceChannel}.`);
        } catch (error) {
            this.connection.connectionState = 'disconnected';
            throw error;
        }

        return this;
    }

    stop() {
        this.position = 0;
        this.playing = false;
        this.timestamp = Date.now();
        
        this.queueUpdate({
            track: { encoded: null }
        });

        return this;
    }

    pause(toggle = true) {
        this.queueUpdate({
            paused: toggle
        });

        this.playing = !toggle;
        this.paused = toggle;
        this.timestamp = Date.now();

        return this;
    }

    seek(position) {
        this.queueUpdate({
            position: position
        });

        this.position = position;
        this.timestamp = Date.now();

        return this;
    }

    setVolume(volume) {
        if (volume < 0 || volume > 1000) throw new RangeError("Volume must be between 0 and 1000");

        this.queueUpdate({
            volume: volume
        });

        this.volume = volume;
        return this;
    }

    setLoop(mode) {
        if (!["none", "track", "queue"].includes(mode)) throw new RangeError("Loop mode must be 'none', 'track', or 'queue'");

        this.loop = mode;
        return this.loop;
    }

    setTextChannel(channel) {
        this.textChannel = channel;
        return this;
    }

    setVoiceChannel(channel, options) {
        this.voiceChannel = channel;
        this.connection.voiceChannel = channel;

        if (options?.deaf !== undefined) this.deaf = options.deaf;
        if (options?.mute !== undefined) this.mute = options.mute;

        this.send({
            guild_id: this.guildId,
            channel_id: channel,
            self_deaf: this.deaf,
            self_mute: this.mute,
        });

        this.eura.emit("playerMove", this.voiceChannel, channel);
        return this;
    }

    async disconnect() {
        if (this.connection.connectionState === 'disconnected' || !this.voiceChannel) {
            return this;
        }
        
        this.pause(true);
        this.playing = false;
        
        // Proactively send voice update to leave the channel
        try {
            this.eura.send({
                op: 4,
                d: {
                    guild_id: this.guildId,
                    channel_id: null,
                    self_mute: false,
                    self_deaf: false,
                },
            });
        } catch (error) {
            this.eura.emit("playerError", this, error);
        }

        this.connection.connectionState = 'disconnected';
        this.connected = false;
        this.voiceChannel = null;

        // Use a small delay to ensure the event is emitted after state change
        setTimeout(() => {
            this.eura.emit("playerDisconnect", this);
        }, 100);

        return this;
    }

    async destroy(disconnect = true) {
        if (disconnect) {
            await this.disconnect();
        }

        // Clear any pending updates
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
        this.updateQueue = [];
        
        try {
            await this.node.rest.destroyPlayer(this.guildId);
            this.eura.emit("debug", `Player ${this.guildId} destroyed on node ${this.node.options.name}`);
        } catch (error) {
            // Log error but continue cleanup
            this.eura.emit("playerError", this, new Error(`Failed to destroy player on node: ${error.message}`));
        }
        
        // Final cleanup
        if (this.eura.players.has(this.guildId)) {
            this.eura.players.delete(this.guildId);
        }
        // Clear bot activity status if setActivityStatus is enabled
        if (this.eura.setActivityStatus && this.eura.client.user) {
            this.eura.client.user.setActivity(null);
        }
        this.eura.emit("playerDestroy", this);
    }

    async handleEvent(payload) {
        switch (payload.type) {
            case "TrackStartEvent":
                this.trackStart(this, this.current, payload);
                break;
            case "TrackEndEvent":
                this.trackEnd(this, this.current, payload);
                break;
            case "TrackExceptionEvent":
                this.trackError(this, this.current, payload);
                break;
            case "TrackStuckEvent":
                this.trackStuck(this, this.current, payload);
                break;
            case "WebSocketClosedEvent":
                this.socketClosed(this, payload);
                break;
            default:
                this.eura.emit("debug", this.guildId, `Unknown event type: ${payload.type}`);
        }
    }

    trackStart(player, track, payload) {
        this.playing = true;
        this.timestamp = Date.now();
        
        this.eura.emit("trackStart", player, track, payload);
        
        if (this.eura.setActivityStatus && this.eura.client.user) {
            const activityText = this.eura.setActivityStatus.template
                .replace('{title}', track.info.title)
                .replace('{author}', track.info.author)
                .replace('{duration}', this.formatDuration(track.info.length));
                
            this.eura.client.user.setActivity(activityText, { type: ActivityType.Listening });
        }

        if (this.eura.euraSync && this.voiceChannel) {
            const trackInfo = {
                title: track.info.title,
                author: track.info.author,
                duration: this.formatDuration(track.info.length),
                uri: track.info.uri,
                source: track.info.sourceName
            };
            
            this.eura.euraSync.setVoiceStatus(this.voiceChannel, trackInfo, 'Track started playing')
                .catch(error => {
                    this.eura.emit("debug", this.guildId, `EuraSync error: ${error.message}`);
                });
        }
    }

    trackEnd(player, track, payload) {
                this.playing = false;
        this.addToPreviousTrack(track);

        this.eura.emit("trackEnd", player, track, payload);

        if (payload.reason === "REPLACED") {
            this.eura.emit("trackEnd", player, track, payload);
            return;
        }

        // Check if player is still connected before attempting to play next track
        if (!this.connected) {
            this.eura.emit("debug", this.guildId, "Player disconnected from voice, skipping next track playback");
            this.eura.emit("queueEnd", player, track, payload);
            // Clear bot activity status if setActivityStatus is enabled
            if (this.eura.setActivityStatus && this.eura.client.user) {
                this.eura.client.user.setActivity(null);
            }
            return;
        }

        if (this.loop === "track" && payload.reason !== "STOPPED") {
            this.queue.unshift(track);
            this.play();
            return;
        }

        if (this.loop === "queue" && payload.reason !== "STOPPED") {
            this.queue.push(track);
            this.play();
            return;
        }

        if (this.queue.length > 0) {
            this.play();
            return;
        }

        if (this.isAutoplay) {
            this.autoplay(player);
            return;
        }

            if (this.eura.euraSync && this.voiceChannel) {
            this.eura.euraSync.clearVoiceStatus(this.voiceChannel, 'Queue ended')
                .catch(error => {
                    this.eura.emit("debug", this.guildId, `EuraSync error: ${error.message}`);
                });
        }

        // Clear bot activity status if setActivityStatus is enabled
        if (this.eura.setActivityStatus && this.eura.client.user) {
            this.eura.client.user.setActivity(null);
        }

        this.eura.emit("queueEnd", player, track, payload);
    }

    trackError(player, track, payload) {
        this.eura.emit("trackError", player, track, payload);
    }

    trackStuck(player, track, payload) {
        this.eura.emit("trackStuck", player, track, payload);
    }

    socketClosed(player, payload) {
        this.eura.emit("socketClosed", player, payload);
        
        if (this.autoResumeState.enabled && this.eura.options.resume?.enabled && this.current) {
            setTimeout(() => {
                this.restart();
            }, 1000);
        }
    }

    send(data) {
        this.eura.send(data);
    }

    set(key, value) {
        this.data[key] = value;
        return this;
    }

    get(key) {
        return this.data[key];
    }

    clearData() {
        this.data = {};
      return this;
    }

    toJSON() {
        return {
            guildId: this.guildId,
            textChannel: this.textChannel,
            voiceChannel: this.voiceChannel,
            volume: this.volume,
            loop: this.loop,
            playing: this.playing,
            paused: this.paused,
            connected: this.connected,
            position: this.position,
            timestamp: this.timestamp,
            ping: this.ping,
            current: this.current,
            queue: this.queue,
            previousTracks: this.previousTracks,
            data: this.data,
            autoResumeState: this.autoResumeState
        };
    }

    static fromJSON(eura, node, data) {
        const player = new Player(eura, node, {
            guildId: data.guildId,
            textChannel: data.textChannel,
            voiceChannel: data.voiceChannel,
            defaultVolume: data.volume,
            loop: data.loop,
        });

        player.playing = data.playing;
        player.paused = data.paused;
        player.connected = data.connected;
        player.position = data.position;
        player.timestamp = data.timestamp;
        player.ping = data.ping;
        player.current = data.current;
        
        // Properly reconstruct Queue instance
        if (data.queue && Array.isArray(data.queue)) {
            player.queue.length = 0; // Clear the default queue
            player.queue.push(...data.queue); // Add all tracks from saved queue
        }
        
        player.previousTracks = data.previousTracks;
        player.data = data.data;
        player.autoResumeState = data.autoResumeState;

        // Ensure autoResumeState.lastPosition is set to the saved position
        if (player.autoResumeState && player.position > 0) {
            player.autoResumeState.lastPosition = player.position;
        }

        return player;
    }

    async shuffleQueue() {
        if (this.queue.length <= 1) return this;
        
        const shuffled = [...this.queue];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        this.queue = shuffled;
        this.eura.emit("queueShuffle", this);
        return this;
    }

    moveQueueItem(from, to) {
        if (from < 0 || from >= this.queue.length || to < 0 || to >= this.queue.length) return this;
        const item = this.queue.splice(from, 1)[0];
        this.queue.splice(to, 0, item);
        this.eura.emit("queueMove", this, from, to);
        return this;
    }

    removeQueueItem(index) {
        if (index < 0 || index >= this.queue.length) return this;
        const removed = this.queue.splice(index, 1)[0];
        this.eura.emit("queueRemove", this, removed, index);
        return this;
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        }
        return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
    }

    /**
     * Set SponsorBlock categories for automatic skipping
     * @param {Array<string>} categories Array of category names to skip
     * @returns {Promise<boolean>} Success status
     */
    async setSponsorBlockCategories(categories = ['sponsor', 'selfpromo', 'interaction']) {
        try {
            if (!this.node.sessionId) {
                throw new Error('Node session not available');
            }

            await this.node.rest.makeRequest(
                'PUT',
                `/v4/sessions/${this.node.sessionId}/players/${this.guildId}/sponsorblock/categories`,
                categories
            );

            this.sponsorBlock.categories = categories;
            this.sponsorBlock.enabled = categories.length > 0;
            
            this.eura.emit("debug", this.guildId, `SponsorBlock categories updated: ${categories.join(', ')}`);
            return true;
        } catch (error) {
            this.eura.emit("debug", this.guildId, `Failed to set SponsorBlock categories: ${error.message}`);
            return false;
        }
    }

    /**
     * Get current SponsorBlock categories
     * @returns {Promise<Array<string>|null>} Current categories or null on error
     */
    async getSponsorBlockCategories() {
        try {
            if (!this.node.sessionId) {
                throw new Error('Node session not available');
            }

            const response = await this.node.rest.makeRequest(
                'GET',
                `/v4/sessions/${this.node.sessionId}/players/${this.guildId}/sponsorblock/categories`
            );

            return response || [];
        } catch (error) {
            this.eura.emit("debug", this.guildId, `Failed to get SponsorBlock categories: ${error.message}`);
            return null;
        }
    }

    /**
     * Clear SponsorBlock categories (disable automatic skipping)
     * @returns {Promise<boolean>} Success status
     */
    async clearSponsorBlockCategories() {
        try {
            if (!this.node.sessionId) {
                throw new Error('Node session not available');
            }

            await this.node.rest.makeRequest(
                'DELETE',
                `/v4/sessions/${this.node.sessionId}/players/${this.guildId}/sponsorblock/categories`
            );

            this.sponsorBlock.categories = [];
            this.sponsorBlock.enabled = false;
            
            this.eura.emit("debug", this.guildId, "SponsorBlock categories cleared");
            return true;
        } catch (error) {
            this.eura.emit("debug", this.guildId, `Failed to clear SponsorBlock categories: ${error.message}`);
            return false;
        }
    }

    /**
     * Get loaded SponsorBlock segments for current track
     * @returns {Array} Array of segments
     */
    getSponsorBlockSegments() {
        return this.sponsorBlock.segments;
    }

    /**
     * Get loaded chapters for current track
     * @returns {Array} Array of chapters
     */
    getChapters() {
        return this.sponsorBlock.chapters;
    }

    /**
     * Get current chapter based on playback position
     * @param {number} position Current position in milliseconds
     * @returns {Object|null} Current chapter or null
     */
    getCurrentChapter(position = this.position) {
        if (!this.sponsorBlock.chapters.length) return null;

        for (const chapter of this.sponsorBlock.chapters) {
            if (position >= chapter.start && position < chapter.end) {
                return chapter;
            }
        }

        return null;
    }
}

module.exports = { Player };