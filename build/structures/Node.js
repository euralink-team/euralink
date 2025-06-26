const Websocket = require("ws");
const { Rest } = require("./Rest");
const { Track } = require("./Track");

class Node {
    /**
     * @param {import("./Euralink").Euralink} eura 
     * @param {} node 
     */
    constructor(eura, node, options) {
        this.eura = eura;
        this.name = node.name || node.host;
        this.host = node.host || "localhost";
        this.port = node.port || 2333;
        this.password = node.password || "youshallnotpass";
        this.restVersion = options.restVersion;
        this.secure = node.secure || false;
        this.sessionId = node.sessionId || null;
        this.rest = new Rest(eura, this);

        if (options.restVersion === "v4") {
            this.wsUrl = `ws${this.secure ? "s" : ""}://${this.host}:${this.port}/v4/websocket`;
        } else {
            this.wsUrl = `ws${this.secure ? "s" : ""}://${this.host}:${this.port}`;
        }

        this.restUrl = `http${this.secure ? "s" : ""}://${this.host}:${this.port}`;
        this.ws = null;
        this.regions = node.regions;
        /**
         * Lavalink Info fetched While/After connecting.
         * @type {import("..").NodeInfo | null}
         */
        this.info = null;
        this.stats = {
            players: 0,
            playingPlayers: 0,
            uptime: 0,
            memory: {
                free: 0,
                used: 0,
                allocated: 0,
                reservable: 0,
            },
            cpu: {
                cores: 0,
                systemLoad: 0,
                lavalinkLoad: 0,
            },
            frameStats: {
                sent: 0,
                nulled: 0,
                deficit: 0,
            },
        };

        this.connected = false;

        this.resumeKey = options.resumeKey || null;
        this.resumeTimeout = options.resumeTimeout || 60;
        this.autoResume = options.autoResume || false;

        this.reconnectTimeout = options.reconnectTimeout || 5000
        this.reconnectTries = options.reconnectTries || 3;
        this.reconnectAttempt = null;
        this.reconnectAttempted = 1;

        this.lastStats = Date.now();
    }


    lyrics = {
        /**
         * Checks if the node has all the required plugins available.
         * @param {boolean} [eitherOne=true] If set to true, will return true if at least one of the plugins is present.
         * @param {...string} plugins The plugins to look for.
         * @returns {Promise<boolean>} If the plugins are available.
         * @throws {RangeError} If the plugins are missing.
         */
        checkAvailable: async (eitherOne=true,...plugins) => {
            console.log("checkAvailable - plugins", ...plugins)
            if (!this.sessionId) throw new Error(`Node (${this.name}) is not Ready/Connected.`)
            if (!plugins.length) plugins = ["lavalyrics-plugin", "java-lyrics-plugin", "lyrics"];

            const missingPlugins = [];

            plugins.forEach((plugin) => {
                const p = this.info.plugins.find((p) => p.name === plugin)

                if (!p) {
                    missingPlugins.push(plugin)
                    return false;
                }

                return true;
            });

            const AllPluginsMissing = missingPlugins.length === plugins.length;

            if (eitherOne && AllPluginsMissing) {
                throw new RangeError(`Node (${this.name}) is missing plugins: ${missingPlugins.join(", ")} (required for Lyrics)`)
            } else if (!eitherOne && missingPlugins.length) {
                throw new RangeError(`Node (${this.name}) is missing plugins: ${missingPlugins.join(", ")} (required for Lyrics)`)
            }

            return true
        },

        /**
         * Fetches lyrics for a given track or encoded track string.
         * 
         * @param {Track|string} trackOrEncodedTrackStr - The track object or encoded track string.
         * @param {boolean} [skipTrackSource=false] - Whether to skip the track source and fetch from the highest priority source (configured on Lavalink Server).
         * @returns {Promise<Object|null>} The lyrics data or null if the plugin is unavailable Or If no lyrics were found OR some Http request error occured.
         * @throws {TypeError} If `trackOrEncodedTrackStr` is not a `Track` or `string`.
         */
        get: async (trackOrEncodedTrackStr, skipTrackSource=false) => {
            if (!(await this.lyrics.checkAvailable(false, "lavalyrics-plugin"))) return null;
            if(!(trackOrEncodedTrackStr instanceof Track) && typeof trackOrEncodedTrackStr !== "string") throw new TypeError(`Expected \`Track\` or \`string\` for \`trackOrEncodedTrackStr\` in "lyrics.get" but got \`${typeof trackOrEncodedTrackStr}\``)

            let encodedTrackStr = typeof trackOrEncodedTrackStr === "string" ? trackOrEncodedTrackStr : trackOrEncodedTrackStr.track;

            return await this.rest.makeRequest("GET",`/v4/lyrics?skipTrackSource=${skipTrackSource}&track=${encodedTrackStr}`);
        },

        /** @description fetches Lyrics for Currently playing Track 
         * @param {string} guildId The Guild Id of the Player
         * @param {boolean} skipTrackSource skips the Track Source & fetches from highest priority source (configured on Lavalink Server) 
         * @param {string} [plugin] The Plugin to use(**Only required if you have too many known (i.e java-lyrics-plugin, lavalyrics-plugin) Lyric Plugins**)
         */
        getCurrentTrack: async (guildId, skipTrackSource=false, plugin) => {
            const DEFAULT_PLUGIN = "lavalyrics-plugin"
            if (!(await this.lyrics.checkAvailable())) return null;

            const nodePlugins = this.info?.plugins;
            let requestURL = `/v4/sessions/${this.sessionId}/players/${guildId}/track/lyrics?skipTrackSource=${skipTrackSource}&plugin=${plugin}`
            
            // If no `plugin` param is specified, check for `java-lyrics-plugin` or `lyrics` (also if lavalyrics-plugin is not available)
            if(!plugin && (nodePlugins.find((p) => p.name === "java-lyrics-plugin") || nodePlugins.find((p) => p.name === "lyrics")) && !(nodePlugins.find((p) => p.name === DEFAULT_PLUGIN))) {
                requestURL = `/v4/sessions/${this.sessionId}/players/${guildId}/lyrics?skipTrackSource=${skipTrackSource}`
            } else if(plugin && ["java-lyrics-plugin", "lyrics"].includes(plugin)) {
                // If `plugin` param is specified, And it's one of either `lyrics` or `java-lyrics-plugin`
                requestURL = `/v4/sessions/${this.sessionId}/players/${guildId}/lyrics?skipTrackSource=${skipTrackSource}`
            }

            return await this.rest.makeRequest("GET", `${requestURL}`)
        }
    }

    /**
     * @typedef {Object} fetchInfoOptions
     * @property {import("..").Version} [restVersion] The Rest Version to fetch info the from, Default: one set in the constructor(Node.restVersion)
     * @property {boolean} [includeHeaders=false] Whether to include headers in the response returned.
     * 
     * @param {fetchInfoOptions} options 
     */
    async fetchInfo(options = { restVersion: this.restVersion, includeHeaders: false }) {

        return await this.rest.makeRequest("GET", `/${options.restVersion || this.restVersion}/info`, null, options.includeHeaders)
    }

    async connect() {
        if (this.ws) this.ws.close()
        this.eura.emit('debug', this.name, `Checking Node Version`);

        const headers = {
            "Authorization": this.password,
            "User-Id": this.eura.clientId,
            "Client-Name": `Euralink/${this.eura.version}`,
        };

        if (this.restVersion === "v4") {
            if (this.sessionId) headers["Session-Id"] = this.sessionId;
        } else {
            if (this.resumeKey) headers["Resume-Key"] = this.resumeKey;
        }

        this.ws = new Websocket(this.wsUrl, { headers });
        this.ws.on("open", this.open.bind(this));
        this.ws.on("error", this.error.bind(this));
        this.ws.on("message", this.message.bind(this));
        this.ws.on("close", this.close.bind(this));
    }

    async open() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);

        this.connected = true;
        this.eura.emit('debug', this.name, `Connection with Lavalink established on ${this.wsUrl}`);

        this.info = await this.fetchInfo().then((info) => this.info = info).catch((e) => (console.error(`Node (${this.name}) Failed to fetch info (${this.restVersion}/info) on WS-OPEN: ${e}`), null));

        if (!this.info && !this.options.bypassChecks?.nodeFetchInfo) {
            throw new Error(`Node (${this.name} - URL: ${this.restUrl}) Failed to fetch info on WS-OPEN`);
        }

        if (this.autoResume) {
            for (const player of this.eura.players.values()) {
                if (player.node === this) {
                    player.restart();
                }
            }
        }
    }

    error(event) {
        if (!event) return;
        this.eura.emit("nodeError", this, event);
    }

    message(msg) {
        if (Array.isArray(msg)) msg = Buffer.concat(msg);
        else if (msg instanceof ArrayBuffer) msg = Buffer.from(msg);

        const payload = JSON.parse(msg.toString());
        if (!payload.op) return;

        this.eura.emit("raw", "Node", payload);
        this.eura.emit("debug", this.name, `Lavalink Node Update : ${JSON.stringify(payload)}`);

        if (payload.op === "stats") {
            this.stats = { ...payload };
            this.lastStats = Date.now();
        }

        if (payload.op === "ready") {
            if (this.sessionId !== payload.sessionId) {
                this.rest.setSessionId(payload.sessionId);
                this.sessionId = payload.sessionId;
            }

            this.eura.emit("nodeConnect", this);

            this.eura.emit("debug", this.name, `Ready Payload received ${JSON.stringify(payload)}`);

            if (this.restVersion === "v4") {
                if (this.sessionId) {
                    this.rest.makeRequest(`PATCH`, `/${this.rest.version}/sessions/${this.sessionId}`, { resuming: true, timeout: this.resumeTimeout });
                    this.eura.emit("debug", this.name, `Resuming configured on Lavalink`);
                }
            } else {
                if (this.resumeKey) {
                    this.rest.makeRequest(`PATCH`, `/${this.rest.version}/sessions/${this.sessionId}`, { resumingKey: this.resumeKey, timeout: this.resumeTimeout });
                    this.eura.emit("debug", this.name, `Resuming configured on Lavalink`);
                }
            }
        }

        const player = this.eura.players.get(payload.guildId);
        if (payload.guildId && player) player.emit(payload.op, payload);
    }

    close(event, reason) {
        this.connected = false;
        this.eura.emit('nodeDisconnect', this, event, reason);
        // Migrate players to another node if available
        const healthyNode = this.eura.leastUsedNodes.find(n => n !== this && n.connected);
        if (healthyNode) {
            for (const player of this.eura.players.values()) {
                if (player.node === this) {
                    player.node = healthyNode;
                    player.connect({
                        guildId: player.guildId,
                        voiceChannel: player.voiceChannel,
                        textChannel: player.textChannel,
                        deaf: player.deaf,
                        mute: player.mute
                    });
                    player.restart && player.restart();
                    this.eura.emit('playerMigrated', player, this, healthyNode);
                }
            }
        }
    }

    reconnect() {
        this.reconnectAttempt = setTimeout(() => {
            if (this.reconnectAttempted >= this.reconnectTries) {
                const error = new Error(`Unable to connect with ${this.name} node after ${this.reconnectTries} attempts.`);

                this.eura.emit("nodeError", this, error);
                return this.destroy();
            }

            this.ws?.removeAllListeners();
            this.ws = null;
            this.eura.emit("nodeReconnect", this);
            this.connect();
            this.reconnectAttempted++;
        }, this.reconnectTimeout);
    }

/**
 * Destroys the node connection and cleans up resources.
 * 
 * @param {boolean} [clean=false] - Determines if a clean destroy should be performed.
 *                                  ### If `clean` is `true`
 *                                  it removes all listeners and nullifies the websocket,
 *                                  emits a "nodeDestroy" event, and deletes the node from the nodes map.
 *                                  ### If `clean` is `false`
 *                                  it performs the full disconnect process which includes:
 *                                  - Destroying all players associated with this node.
 *                                  - Closing the websocket connection.
 *                                  - Removing all listeners and nullifying the websocket.
 *                                  - Clearing any reconnect attempts.
 *                                  - Emitting a "nodeDestroy" event.
 *                                  - Deleting the node from the node map.
 *                                  - Setting the connected state to false.
 */
    destroy(clean = false) {
        // Remove all event listeners
        if (typeof this.removeAllListeners === 'function') this.removeAllListeners();
        // Destroy all players associated with this node
        for (const player of this.eura.players.values()) {
            if (player.node === this) player.destroy();
        }
        // Clear reconnect attempt if set
        if (this.reconnectAttempt) clearTimeout(this.reconnectAttempt);
        // Null out references to help GC
        this.eura = null;
        this.ws = null;
        this.rest = null;
        this.info = null;
        // Defensive: clear any other intervals/timeouts if added in the future
        // if (this._interval) clearInterval(this._interval);
        // if (this._timeout) clearTimeout(this._timeout);
        this.connected = false;
        this.eura?.emit("nodeDestroy", this);
    }

    disconnect() {
        if (!this.connected) return;
        this.eura.players.forEach((player) => { if (player.node == this) { player.move() } });
        this.ws.close(1000, "destroy");
        this.ws?.removeAllListeners();
        this.ws = null;
        this.eura.nodes.delete(this.name);
        this.eura.emit("nodeDisconnect", this);
        this.connected = false;
    }

    get penalties() {
        let penalties = 0;
        if (!this.connected) return penalties;
        if (this.stats.players) {
            penalties += this.stats.players;
        }
        if (this.stats.cpu && this.stats.cpu.systemLoad) {
            penalties += Math.round(Math.pow(1.05, 100 * this.stats.cpu.systemLoad) * 10 - 10);
        }
        if (this.stats.frameStats) {
            if (this.stats.frameStats.deficit) {
                penalties += this.stats.frameStats.deficit;
            }
            if (this.stats.frameStats.nulled) {
                penalties += this.stats.frameStats.nulled * 2;
            }
        }
        return penalties;
    }
}

module.exports = { Node }; 