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
        this.timestamp = 0;
        this.ping = 0;
        this.isAutoplay = false;

        this.on("playerUpdate", (packet) => {
            this.connected = packet.state.connected;
            this.position = packet.state.position;
            this.ping = packet.state.ping;
            this.timestamp = packet.state.time;
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

    async play() {
        try {
        if (!this.connected) throw new Error("Player connection is not initiated. Kindly use Euralink.createConnection() and establish a connection, TIP: Check if Guild Voice States intent is set/provided & 'updateVoiceState' is used in the raw(Gateway Raw) event");
        if (!this.queue.length) return;

        this.current = this.queue.shift();

        if (!this.current.track) {
            this.current = await this.current.resolve(this.eura);
        }

        await new Promise((res) => setTimeout(res, 0));

        this.playing = true;
        this.position = 0;

        const { track } = this.current;

        this.node.rest.updatePlayer({
            guildId: this.guildId,
            data: {
                track: {
                    encoded: track,
                },
            },
        });

        return this;
        } catch (err) {
            this.eura.emit('playerError', this, err);
            throw err;
        }
    }

    /**
     * Restores playback after a node reconnect (autoResume).
     * Re-sends the current track, position, paused state, volume, and filters.
     */
    async restart() {
        try {
        if (!this.current || !this.connected) return;
        const data = {
        track: { encoded: this.current.track },
        position: this.position,
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
        this.playing = !this.paused;
        this.eura.emit("debug", this.guildId, "Player state restored after node reconnect (autoResume)");
        } catch (err) {
            this.eura.emit('playerError', this, err);
            throw err;
        }
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

        // If ran on queueEnd event
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
            guild_id: guildId,
            channel_id: voiceChannel,
            self_deaf: deaf,
            self_mute: mute,
        });

        this.connected = true

        this.eura.emit("debug", this.guildId, `Player has informed the Discord Gateway to Establish Voice Connectivity in ${voiceChannel} Voice Channel, Awaiting Confirmation(Via Voice State Update & Voice Server Update events)`);
    }

    stop() {
        this.position = 0;
        this.playing = false;
        this.node.rest.updatePlayer({
            guildId: this.guildId,
            data: { track: { encoded: null } },
        });

        return this;
    }

    pause(toggle = true) {
        this.node.rest.updatePlayer({
            guildId: this.guildId,
            data: { paused: toggle },
        });

        this.playing = !toggle;
        this.paused = toggle;

        return this;
    }

    seek(position) {
        const trackLength = this.current.info.length;
        this.position = Math.max(0, Math.min(trackLength, position));

        this.node.rest.updatePlayer({ guildId: this.guildId, data: { position } });
    }

    setVolume(volume) {
        if (volume < 0 || volume > 1000) {
            throw new Error("[Volume] Volume must be between 0 to 1000");
        }

        this.node.rest.updatePlayer({ guildId: this.guildId, data: { volume } });
        this.volume = volume;
        return this;
    }

    setLoop(mode) {
        if (!mode) {
            throw new Error("You must provide the loop mode as an argument for setLoop");
        }

        if (!["none", "track", "queue"].includes(mode)) {
            throw new Error("setLoop arguments must be 'none', 'track', or 'queue'");
        }

        this.loop = mode;
        return this;
    }

    setTextChannel(channel) {
        if (typeof channel !== "string") throw new TypeError("Channel must be a non-empty string.");
        this.textChannel = channel;
        return this;
    }

    setVoiceChannel(channel, options) {
        if (typeof channel !== "string") throw new TypeError("Channel must be a non-empty string.");

        if (this.connected && channel === this.voiceChannel) {
            throw new ReferenceError(`Player is already connected to ${channel}`);
        }

        this.voiceChannel = channel;

        if (options) {
            this.mute = options.mute ?? this.mute;
            this.deaf = options.deaf ?? this.deaf;
        }

        this.connect({
            deaf: this.deaf,
            guildId: this.guildId,
            voiceChannel: this.voiceChannel,
            textChannel: this.textChannel,
            mute: this.mute,
        });

        return this;
    }

    disconnect() {
        if (!this.voiceChannel) {
            return;
        }

        this.connected = false;
        this.send({
            guild_id: this.guildId,
            channel_id: null,
            self_mute: false,
            self_deaf: false,
        });

        this.voiceChannel = null;
        return this;
    }

    destroy() {
        this.disconnect();

        this.node.rest.destroyPlayer(this.guildId);

        this.eura.emit("playerDisconnect", this);
        this.eura.emit("debug", this.guildId, "Destroyed the player");

        this.eura.players.delete(this.guildId);
    }

    async handleEvent(payload) {
        const player = this.eura.players.get(payload.guildId);
        if (!player) return;

        const track = this.current;

        switch (payload.type) {
            case "TrackStartEvent":
                this.trackStart(player, track, payload);
                break;

            case "TrackEndEvent":
                this.trackEnd(player, track, payload);
                break;

            case "TrackExceptionEvent":
                this.trackError(player, track, payload);
                break;

            case "TrackStuckEvent":
                this.trackStuck(player, track, payload);
                break;

            case "WebSocketClosedEvent":
                this.socketClosed(player, payload);
                break;

            default:
                const error = new Error(`Node encountered an unknown event: '${payload.type}'`);
                this.eura.emit("nodeError", this, error);
                break;
        }
    }

    trackStart(player, track, payload) {
        this.playing = true;
        this.paused = false;
        this.eura.emit(`debug`, `Player (${player.guildId}) has started playing ${track.info.title} by ${track.info.author}`);
        this.eura.emit("trackStart", player, track, payload);
        // EuraSync integration: set voice status
        if (this.eura.euraSync && this.voiceChannel) {
            const info = track && track.info ? track.info : {};
            this.eura.euraSync.setVoiceStatus(this.voiceChannel, {
                title: info.title,
                author: info.author,
                uri: info.uri,
                source: info.sourceName
            });
        }
        // setActivityStatus integration: set bot activity
        if (this.eura.setActivityStatus && this.eura.client && this.eura.client.user) {
            const info = track && track.info ? track.info : {};
            let template = this.eura.setActivityStatus.template || 'Now playing: {title}';
            let status = template
                .replace(/{title}/g, info.title || '')
                .replace(/{author}/g, info.author || '')
                .replace(/{uri}/g, info.uri || '')
                .replace(/{source}/g, info.sourceName || '');
            this.eura.client.user.setActivity({ name: status, type: ActivityType.Listening });
        }
    }

    trackEnd(player, track, payload) {
        this.addToPreviousTrack(track)
        const previousTrack = this.previous;
        // By using lower case We handle both Lavalink Versions(v3, v4) Smartly 😎, 
        // If reason is replaced do nothing expect User do something hopefully else RIP.
        if(payload.reason.toLowerCase() === "replaced") return this.eura.emit("trackEnd", player, track, payload);

        // Replacing & to lower case it Again Smartly 😎, Handled Both Lavalink Versions.
        // This avoids track that got cleaned-up or failed to load to be played again (Via Loop Mode).
        if(["loadfailed", "cleanup"].includes(payload.reason.replace("_", "").toLowerCase())) {

            if(player.queue.length === 0) { 
                this.playing = false;
                this.eura.emit("debug", `Player (${player.guildId}) Track-Ended(${track.info.title}) with reason: ${payload.reason}, emitting queueEnd instead of trackEnd as queue is empty/finished`);
                // EuraSync integration: clear voice status
                if (this.eura.euraSync && this.voiceChannel) {
                    this.eura.euraSync.clearVoiceStatus(this.voiceChannel);
                }
                // setActivityStatus integration: clear bot activity
                if (this.eura.setActivityStatus && this.eura.client && this.eura.client.user) {
                    this.eura.client.user.setActivity(null);
                }
                return this.eura.emit("queueEnd", player);
            }

            this.eura.emit("trackEnd", player, track, payload);
            return player.play();
        }

        this.eura.emit("debug", `Player (${player.guildId}) has the track ${track.info.title} by ${track.info.author} ended with reason: ${payload.reason}`);

        if (this.loop === "track") {
            player.queue.unshift(previousTrack);
            this.eura.emit("debug", `Player (${player.guildId}) looped track ${track.info.title} by ${track.info.author}, as loop mode is set to 'track'`);
            this.eura.emit("trackEnd", player, track, payload);
            return player.play();
        }

        else if (track && this.loop === "queue") {
            player.queue.push(previousTrack);
            this.eura.emit("debug", `Player (${player.guildId}) looping Queue, as loop mode is set to 'queue'`);
            this.eura.emit("trackEnd", player, track, payload);
            return player.play();
        }

        if (player.queue.length === 0) {
            this.playing = false;
            // EuraSync integration: clear voice status
            if (this.eura.euraSync && this.voiceChannel) {
                this.eura.euraSync.clearVoiceStatus(this.voiceChannel);
            }
            // setActivityStatus integration: clear bot activity
            if (this.eura.setActivityStatus && this.eura.client && this.eura.client.user) {
                this.eura.client.user.setActivity(null);
            }
            return this.eura.emit("queueEnd", player);
        }

        else if (player.queue.length > 0) {
            this.eura.emit("trackEnd", player, track, payload);
            return player.play();
        }

        this.playing = false;
        this.eura.emit("queueEnd", player);
    }

    trackError(player, track, payload) {
        this.eura.emit("debug", `Player (${player.guildId}) has an exception/error while playing ${track.info.title} by ${track.info.author} this track, exception received: ${inspect(payload.exception)}`);
        this.eura.emit("trackError", player, track, payload);
        this.stop();
    }

    trackStuck(player, track, payload) {
        this.eura.emit("trackStuck", player, track, payload);
        this.eura.emit("debug", `Player (${player.guildId}) has been stuck track ${track.info.title} by ${track.info.author} for ${payload.thresholdMs}ms, skipping track...`);
        this.stop();
    }

    socketClosed(player, payload) {
        if ([4015, 4009].includes(payload.code)) {
            this.send({
                guild_id: payload.guildId,
                channel_id: this.voiceChannel,
                self_mute: this.mute,
                self_deaf: this.deaf,
            });
        }

        this.eura.emit("socketClosed", player, payload);
        this.pause(true);
        this.eura.emit("debug", `Player (${player.guildId}) Voice Connection has been closed with code: ${payload.code}, Player paused(to any track playing). some possible causes: Voice channel deleted, Or Client(Bot) was kicked`);
    }

    send(data) {
        this.eura.send({ op: 4, d: data });
    }

    set(key, value) {
        return this.data[key] = value;
    }

    get(key) {
        return this.data[key];
    }

    /**
    * @description clears All custom Data set on the Player
    */ 
    clearData() {
      for (const key in this.data) {
        if (this.data.hasOwnProperty(key)) {
          delete this.data[key];
        }
      }
      return this;
    }

    /**
     * Serializes the player state for persistence.
     */
    toJSON() {
        return {
            guildId: this.guildId,
            textChannel: this.textChannel,
            voiceChannel: this.voiceChannel,
            volume: this.volume,
            loop: this.loop,
            position: this.position,
            current: this.current,
            queue: this.queue.toArray ? this.queue.toArray() : Array.from(this.queue),
            previousTracks: this.previousTracks,
            playing: this.playing,
            paused: this.paused,
            filters: this.filters && typeof this.filters.getPayload === 'function' ? this.filters.getPayload() : {},
            isAutoplay: this.isAutoplay
        };
    }

    /**
     * Recreates a player from saved state.
     * @param {Euralink} eura
     * @param {Node} node
     * @param {Object} data
     */
    static fromJSON(eura, node, data) {
        const player = new Player(eura, node, {
            guildId: data.guildId,
            textChannel: data.textChannel,
            voiceChannel: data.voiceChannel,
            defaultVolume: data.volume,
            loop: data.loop
        });
        player.position = data.position;
        player.current = data.current;
        if (Array.isArray(data.queue)) player.queue.add(...data.queue);
        player.previousTracks = data.previousTracks || [];
        player.playing = data.playing;
        player.paused = data.paused;
        if (data.filters && player.filters && typeof player.filters.setPayload === 'function') {
            player.filters.setPayload(data.filters);
        }
        player.isAutoplay = data.isAutoplay;
        return player;
    }

    shuffleQueue() {
        this.queue.shuffle();
        this.eura.emit('queueShuffle', this);
        return this;
    }

    moveQueueItem(from, to) {
        this.queue.move(from, to);
        this.eura.emit('queueMove', this, from, to);
        return this;
    }

    removeQueueItem(index) {
        const removed = this.queue.remove(index);
        this.eura.emit('queueRemove', this, index, removed);
        return removed;
    }
}

module.exports = { Player }; 