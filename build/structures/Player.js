const { EventEmitter } = require("tseep");
const { ActivityType } = require('discord.js');
const { Connection } = require("./Connection");
const { Filters } = require("./Filters");
const { Queue } = require("./Queue");
const { spAutoPlay, scAutoPlay } = require('../handlers/autoPlay');
const { inspect } = require("util");

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
    }
    /**
     * @description gets the Previously played Track
     */
    get previous() {
     return this.previousTracks?.[0]
    }

    /**
     * @private
     */
    addToPreviousTrack(track) {
      if (Number.isInteger(this.eura.options.multipleTrackHistory) && this.previousTracks.length >= this.eura.options.multipleTrackHistory) {
        this.previousTracks.splice(this.eura.options.multipleTrackHistory, this.previousTracks.length);
      } 
      // If its falsy Save Only last Played Track.
      else if(!this.eura.options.multipleTrackHistory) {
       this.previousTracks[0] = track;
       return;
      }
      this.previousTracks.unshift(track)
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

    connect(options = this) {
        const { guildId, voiceChannel, deaf = true, mute = false } = options;
        this.send({
            op: 4, // Voice State Update opcode
            d: {
                guild_id: guildId,
                channel_id: voiceChannel,
                self_deaf: deaf,
                self_mute: mute,
            }
        });

        // Don't set connected = true here - wait for voice state/server update events
        // this.connected = true

        this.eura.emit("debug", this.guildId, `Player has informed the Discord Gateway to Establish Voice Connectivity in ${voiceChannel} Voice Channel, Awaiting Confirmation(Via Voice State Update & Voice Server Update events)`);
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
        return this;
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

    disconnect() {
        this.send({
            guild_id: this.guildId,
            channel_id: null,
        });

        this.connected = false;
        
        // Clear voice channel status when disconnecting
        if (this.eura.euraSync && this.voiceChannel) {
            this.eura.euraSync.clearVoiceStatus(this.voiceChannel, 'Player disconnected')
                .catch(error => {
                    this.eura.emit("debug", this.guildId, `EuraSync error: ${error.message}`);
                });
        }
        
        this.eura.emit("playerDisconnect", this);
        return this;
    }

    destroy() {
        this.playing = false;
        this.connected = false;
        
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.updateQueue = [];
        
        this.clearAutoResumeState();
        
        // Clear voice channel status when destroying player
        if (this.eura.euraSync && this.voiceChannel) {
            this.eura.euraSync.clearVoiceStatus(this.voiceChannel, 'Player destroyed')
                .catch(error => {
                    this.eura.emit("debug", this.guildId, `EuraSync error: ${error.message}`);
                });
        }
        
        this.node.rest.destroyPlayer(this.guildId);
        this.eura.emit("playerDestroy", this);
        return this;
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
        
        if (this.autoResumeState.enabled && this.current) {
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
}

module.exports = { Player }; 