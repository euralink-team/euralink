const { EventEmitter } = require("tseep");
const { Node } = require("./Node");
const { Player } = require("./Player");
const { Track } = require("./Track");
const https = require('https');
const { version: pkgVersion } = require("../../package.json")
const fs = require('fs/promises');
const { EuraSync } = require("./EuraSync");

const versions = ["v3", "v4"];

class Euralink extends EventEmitter {
  /**
   * @param {Client} client - Your Discord.js client
   * @param {Array} nodes - Lavalink node configs
   * @param {Object} options - Euralink options (modern structured config)
   * @param {Object} options.rest - REST API config
   * @param {Array} [options.plugins] - Array of Euralink plugins
   * @param {Object} [options.sync] - EuraSync config
   * @param {Object} [options.activityStatus] - Activity status config
   * @param {Object} [options.resume] - Auto-resume config
   * @param {Object} [options.node] - Node connection config
   * @param {boolean} [options.autopauseOnEmpty] - Auto-pause when empty
   * @param {Object} [options.lazyLoad] - Lazy loading config
   * @param {string} [options.defaultSearchPlatform] - Default search platform
   * @param {Object} [options.track] - Track-related config
   */
  constructor(client, nodes, options) {
    super();
    // Config validation
    if (!client) throw new Error("[Euralink] Client is required to initialize Euralink");
    if (!nodes || !Array.isArray(nodes)) throw new Error(`[Euralink] Nodes are required & Must Be an Array (Received ${typeof nodes})`);
    if (!options || typeof options !== 'object') throw new Error("[Euralink] Options object is required to initialize Euralink");
    if (!options.defaultSearchPlatform) throw new Error("[Euralink] defaultSearchPlatform is required in options");

    /**
     * WARNING: The resume.enabled option controls whether player state is kept up to date for auto-resume.
     * You can always call loadPlayersState to restore players, but if resume.enabled is false, their state will NOT be updated for future saves.
     * For true auto-resume, set resume.enabled: true and always call savePlayersState on shutdown and loadPlayersState on startup.
     */
    // Modern structured config with full backward compatibility
    this.options = {
      rest: {
        version: options.rest?.version || options.restVersion || 'v4',
        retryCount: options.rest?.retryCount || options.retryCount || 3,
        timeout: options.rest?.timeout || options.timeout || 5000
      },
      plugins: options.plugins || [],
      
      // EuraSync (backward compatibility: euraSync, eurasync, sync)
      euraSync: options.euraSync || options.eurasync || options.sync || { 
        enabled: false, 
        template: options.euraSync?.template || options.eurasync?.template || options.sync?.template || '🎵 {title} by {author}' 
      },
      
      // Activity status (backward compatibility: setActivityStatus, activityStatus)
      activityStatus: options.activityStatus || options.setActivityStatus || { 
        enabled: false, 
        template: '🎵 {title} by {author}' 
      },
      
      // Resume (backward compatibility: autoResume, resume)
      resume: options.resume || { 
        enabled: options.autoResume ?? options.resume?.enabled ?? false, 
        key: options.resumeKey || options.resume?.key || 'euralink-resume', 
        timeout: options.resumeTimeout || options.resume?.timeout || 60000 
      },
      
      // Node configuration (backward compatibility for all old options)
      node: options.node || {
        dynamicSwitching: options.dynamicSwitching ?? options.node?.dynamicSwitching ?? true,
        autoReconnect: options.autoReconnect ?? options.node?.autoReconnect ?? true,
        ws: {
          reconnectTries: options.reconnectTries || options.node?.ws?.reconnectTries || options.node?.reconnectTries || 5,
          reconnectInterval: options.reconnectInterval || options.node?.ws?.reconnectInterval || options.node?.reconnectInterval || 5000
        }
      },
      
      // Legacy options with backward compatibility
      autopauseOnEmpty: options.autopauseOnEmpty ?? true,
      lazyLoad: options.lazyLoad || { enabled: false, timeout: 5000 },
      defaultSearchPlatform: options.defaultSearchPlatform || 'ytmsearch',
      track: options.track || { historyLimit: 20, enableVoting: true, enableFavorites: true, enableUserNotes: true },
      
      // Additional backward compatibility for legacy options
      bypassChecks: options.bypassChecks || {},
      debug: options.debug ?? false
    };

    this.client = client;
    this.nodes = nodes;
    this.nodeMap = new Map();
    this.players = new Map();
    this.clientId = null;
    this.initiated = false;
    this.send = options.send || null;
    this.defaultSearchPlatform = this.options.defaultSearchPlatform;
    this.restVersion = this.options.rest.version;
    this.tracks = [];
    this.loadType = null;
    this.playlistInfo = null;
    this.pluginInfo = null;
    this.plugins = this.options.plugins;
    
    // Performance optimizations
    this.regionCache = new Map();
    this.nodeHealthCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
    
    // Lazy loading support
    this.lazyLoad = this.options.lazyLoad.enabled;
    this.lazyLoadTimeout = this.options.lazyLoad.timeout;

    // Enhanced performance optimizations
    this.enhancedPerformance = {
      enabled: options.enhancedPerformance?.enabled ?? true,
      connectionPooling: options.enhancedPerformance?.connectionPooling ?? true,
      requestBatching: options.enhancedPerformance?.requestBatching ?? true,
      memoryOptimization: options.enhancedPerformance?.memoryOptimization ?? true
    };

    // Always check for updates on startup
    this.checkForUpdates();
    
    // EuraSync support (accepts 'eurasync', 'euraSync', or 'sync' for config key)
    const syncConfig = options.eurasync || options.euraSync || options.sync;
    if (syncConfig?.enabled) {
      this.euraSync = new EuraSync(client, syncConfig);
    } else {
      this.euraSync = null;
    }
    // setActivityStatus support
    if (this.options.activityStatus?.enabled) {
      this.setActivityStatus = this.options.activityStatus;
    } else {
      this.setActivityStatus = null;
    }
    /**
     * @description Package Version Of Euralink
     */
    this.version = pkgVersion;

    if (this.restVersion && !versions.includes(this.restVersion)) throw new RangeError(`${this.restVersion} is not a valid version`);
  }

  /**
   * Validate the current config. Throws if invalid.
   */
  validateConfig() {
    if (!this.client) throw new Error("[Euralink] Client is required");
    if (!this.nodes || !Array.isArray(this.nodes)) throw new Error("[Euralink] Nodes must be an array");
    if (!this.options.defaultSearchPlatform) throw new Error("[Euralink] defaultSearchPlatform is required");
    // Add more checks as needed
    return true;
  }

  /**
   * Clear all internal caches (region, node health, etc)
   */
  clearAllCaches() {
    this.regionCache.clear();
    this.nodeHealthCache.clear();
    this.emit("debug", "All caches cleared");
  }

  get leastUsedNodes() {
    return [...this.nodeMap.values()]
      .filter((node) => node.connected)
      .sort((a, b) => {
        // Improved node selection with health metrics
        const aHealth = this.getNodeHealth(a);
        const bHealth = this.getNodeHealth(b);
        return aHealth.score - bHealth.score;
      });
  }

  // Get node health score for better load balancing
  getNodeHealth(node) {
    const now = Date.now();
    const cached = this.nodeHealthCache.get(node.name);
    
    if (cached && (now - cached.timestamp) < this.cacheTimeout) {
      return cached.health;
    }
    
    const health = node.getHealthStatus();
    const score = this.calculateNodeScore(health);
    
    this.nodeHealthCache.set(node.name, {
      health: { ...health, score },
      timestamp: now
    });
    
    return { ...health, score };
  }

  // Calculate node score for load balancing
  calculateNodeScore(health) {
    let score = 0;
    
    // Lower score = better node
    score += health.penalties * 10;
    score += health.cpuLoad * 100;
    score += health.memoryUsage * 0.5;
    score += health.ping * 0.1;
    score += health.players * 2;
    score += health.playingPlayers * 5;
    
    return score;
  }

  init(clientId) {
    if (this.initiated) return this;
    this.clientId = clientId;
    this.nodes.forEach((node) => this.createNode(node));
    this.initiated = true;

    this.emit("debug", `Euralink initialized, connecting to ${this.nodes.length} node(s)`);

    if (this.plugins) {
      this.emit("debug", `Loading ${this.plugins.length} Euralink plugin(s)`);

      this.plugins.forEach((plugin) => {
        plugin.load(this);
      });
    }
  }

  createNode(options) {
    // Ensure restVersion is included in node config
    const nodeConfig = {
      ...options,
      restVersion: this.options.rest.version || options.restVersion || 'v4',
    };
    const node = new Node(this, nodeConfig, this.options);
    this.nodeMap.set(nodeConfig.name || nodeConfig.host, node);
    node.connect();
    this.emit("nodeCreate", node);
    return node;
  }

  destroyNode(identifier) {
    const node = this.nodeMap.get(identifier);
    if (!node) return;
    node.disconnect();
    this.nodeMap.delete(identifier);
    this.nodeHealthCache.delete(identifier);
    this.emit("nodeDestroy", node);
  }

  updateVoiceState(packet) {
    if (!["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(packet.t)) return;
    const player = this.players.get(packet.d.guild_id);
    if (!player) return;

    if (packet.t === "VOICE_SERVER_UPDATE") {
      player.connection.setServerUpdate(packet.d);
    } else if (packet.t === "VOICE_STATE_UPDATE") {
      if (packet.d.user_id !== this.clientId) return;
      player.connection.setStateUpdate(packet.d);
    }
  }

  // Improved region fetching with caching and better performance
  fetchRegion(region) {
    const now = Date.now();
    const cacheKey = `region_${region}`;
    const cached = this.regionCache.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < this.cacheTimeout) {
      return cached.nodes;
    }
    
    const nodesByRegion = [...this.nodeMap.values()]
      .filter((node) => node.connected && node.regions?.includes(region?.toLowerCase()))
      .sort((a, b) => {
        const aHealth = this.getNodeHealth(a);
        const bHealth = this.getNodeHealth(b);
        return aHealth.score - bHealth.score;
      });

    // Cache the result
    this.regionCache.set(cacheKey, {
      nodes: nodesByRegion,
      timestamp: now
    });

    return nodesByRegion;
  }

  async checkForUpdates() {
    try {
      const { version: pkgVersion } = require("../../package.json");
      
      // Skip update check if we're on a development/local version
      if (pkgVersion.includes('dev') || pkgVersion.includes('local')) {
        this.emit("debug", `[Euralink] Development version detected: ${pkgVersion}, skipping update check`);
        return;
      }
      
      await new Promise((resolve, reject) => {
        https.get('https://registry.npmjs.org/euralink', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const info = JSON.parse(data);
              const latest = info['dist-tags'].latest;
              
              // Better version comparison - don't show update if current is newer
              if (latest && this.isNewerVersion(latest, pkgVersion)) {
                console.log(`[Euralink] 🚨 New version available: ${latest} (current: ${pkgVersion})\nRun \`npm install euralink@latest\` to update!`);
              } else if (latest && latest !== pkgVersion) {
                this.emit("debug", `[Euralink] Version check: NPM has ${latest}, you have ${pkgVersion} (you may have a newer local version)`);
              }
              resolve();
            } catch (e) {
              this.emit("debug", `Failed checking updates for euralink: ${e.message}`);
              resolve();
            }
          });
        }).on('error', (err) => {
          this.emit("debug", `Failed checking updates for euralink: ${err.message}`);
          resolve();
        });
      });
    } catch (err) {
      this.emit("debug", `[Euralink] Error in checkForUpdates: ${err.message}`);
    }
  }

  // Helper function to compare versions properly
  isNewerVersion(version1, version2) {
    const v1parts = version1.replace(/[^\d.]/g, '').split('.').map(Number);
    const v2parts = version2.replace(/[^\d.]/g, '').split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return true;
      if (v1part < v2part) return false;
    }
    
    return false;
  }

  // Get best node for a specific region
  getBestNodeForRegion(region) {
    const regionNodes = this.fetchRegion(region);
    return regionNodes.length > 0 ? regionNodes[0] : this.leastUsedNodes[0];
  }

  /**
   * Creates a connection based on the provided options.
   *
   * @param {Object} options - The options for creating the connection.
   * @param {string} options.guildId - The ID of the guild.
   * @param {string} [options.region] - The region for the connection.
   * @param {number} [options.defaultVolume] - The default volume of the player. **By-Default**: **100**
   * @param {import("..").LoopOption} [options.loop] - The loop mode of the player.
   * @throws {Error} Throws an error if Euralink is not initialized or no nodes are available.
   * @return {Player} The created player.
   */
  createConnection(options) {
    if (!this.initiated) throw new Error("You have to initialize Euralink in your ready event");

    const player = this.players.get(options.guildId);
    if (player) return player;

    if (this.leastUsedNodes.length === 0) throw new Error("No nodes are available");
    
    let node;
    if (options.region) {
      node = this.getBestNodeForRegion(options.region);
    } else {
      node = this.leastUsedNodes[0];
    }

    if (!node) throw new Error("No nodes are available");

    return this.createPlayer(node, options);
  }

  createPlayer(node, options) {
    const player = new Player(this, node, options);
    this.players.set(options.guildId, player);

    player.connect(options);

    this.emit('debug', `Created a player (${options.guildId}) on node ${node.name}`);

    this.emit("playerCreate", player);
    return player;
  }

  destroyPlayer(guildId) {
    const player = this.players.get(guildId);
    if (!player) return;
    player.destroy();
    this.players.delete(guildId);

    this.emit("playerDestroy", player);
  }

  removeConnection(guildId) {
    this.players.get(guildId)?.destroy();
    this.players.delete(guildId);
  }

  /**
   * @param {object} param0 
   * @param {string} param0.query used for searching as a search Query  
   * @param {*} param0.source  A source to search the query on example:ytmsearch for youtube music
   * @param {*} param0.requester the requester who's requesting 
   * @param {(string | Node)} [param0.node] the node to request the query on either use node identifier/name or the node class itself
   * @returns {import("..").nodeResponse} returned properties values are nullable if lavalink doesn't  give them
   * */
  async resolve({ query, source, requester, node }) {
    try {
      if (!this.initiated) throw new Error("You have to initialize Euralink in your ready event");
      
      if(node && (typeof node !== "string" && !(node instanceof Node))) throw new Error(`'node' property must either be an node identifier/name('string') or an Node/Node Class, But Received: ${typeof node}`)
      
      const querySource = source || this.defaultSearchPlatform;

      const requestNode = (node && typeof node === 'string' ? this.nodeMap.get(node) : node) || this.leastUsedNodes[0];
      if (!requestNode) throw new Error("No nodes are available.");

      const regex = /^https?:\/\//;
      const identifier = regex.test(query) ? query : `${querySource}:${query}`;

      this.emit("debug", `Searching for ${query} on node "${requestNode.name}"`);

      let response = await requestNode.rest.makeRequest(`GET`, `/${requestNode.rest.version}/loadtracks?identifier=${encodeURIComponent(identifier)}`);

      // Handle failed requests (like 500 errors)
      if (!response || response.loadType === "error") {
        this.emit("debug", `Search failed for "${query}" on node "${requestNode.name}": ${response?.data?.message || 'Unknown error'}`);
        
        // Try fallback search if it's a URL
        if (regex.test(query)) {
          this.emit("debug", `Attempting fallback search for "${query}"`);
          const fallbackIdentifier = `${querySource}:${query}`;
          response = await requestNode.rest.makeRequest(`GET`, `/${requestNode.rest.version}/loadtracks?identifier=${encodeURIComponent(fallbackIdentifier)}`);
        }
        
        // If still failed, throw error
        if (!response || response.loadType === "error") {
          throw new Error(response?.data?.message || 'Failed to load tracks');
        }
      }

      // for resolving identifiers - Only works in Spotify and Youtube
      if (response.loadType === "empty" || response.loadType === "NO_MATCHES") {
        response = await requestNode.rest.makeRequest(`GET`, `/${requestNode.rest.version}/loadtracks?identifier=https://open.spotify.com/track/${query}`);
        if (response.loadType === "empty" || response.loadType === "NO_MATCHES") {
          response = await requestNode.rest.makeRequest(`GET`, `/${requestNode.rest.version}/loadtracks?identifier=https://www.youtube.com/watch?v=${query}`);
        }
      }

      if (requestNode.rest.version === "v4") {
        if (response.loadType === "track") {
          this.tracks = response.data ? [new Track(response.data, requester, requestNode)] : [];

          this.emit("debug", `Search Success for "${query}" on node "${requestNode.name}", loadType: ${response.loadType}, Resulted track Title: ${this.tracks[0].info.title} by ${this.tracks[0].info.author}`);
        } else if (response.loadType === "playlist") {
          // Fast parallel track creation for playlists
          const trackData = response.data?.tracks || [];
          this.tracks = new Array(trackData.length);
          
          // Synchronously create Track instances for each track
          this.tracks = trackData.map((track, index) => new Track(track, requester, requestNode));

          this.emit("debug", `Search Success for "${query}" on node "${requestNode.name}", loadType: ${response.loadType} tracks: ${this.tracks.length}`);
        } else {
          // Fast parallel track creation for search results
          const trackData = response.loadType === "search" && response.data ? response.data : [];
          this.tracks = new Array(trackData.length);
          
          // Use Promise.all for parallel processing
          const trackPromises = trackData.map((track, index) => {
            return Promise.resolve(new Track(track, requester, requestNode));
          });
          
          this.tracks = await Promise.all(trackPromises);

          this.emit("debug", `Search ${this.loadType !== "error" ? "Success" : "Failed"} for "${query}" on node "${requestNode.name}", loadType: ${response.loadType} tracks: ${this.tracks.length}`);
        }
      } else {
        // v3 (Legacy or Lavalink V3) - Fast parallel processing
        const trackData = response?.tracks || [];
        this.tracks = new Array(trackData.length);
        
        // Use Promise.all for parallel processing
        const trackPromises = trackData.map((track, index) => {
          return Promise.resolve(new Track(track, requester, requestNode));
        });
        
        this.tracks = await Promise.all(trackPromises);

        this.emit("debug", `Search ${this.loadType !== "error" || this.loadType !== "LOAD_FAILED" ? "Success" : "Failed"} for "${query}" on node "${requestNode.name}", loadType: ${response.loadType} tracks: ${this.tracks.length}`);
      }
      
      if (
        requestNode.rest.version === "v4" &&
        response.loadType === "playlist"
      ) {
        this.playlistInfo = response.data?.info || null;
      } else {
        this.playlistInfo = null;
      }

      this.loadType = response.loadType;

      return {
        loadType: response.loadType,
        tracks: this.tracks,
        playlistInfo: this.playlistInfo,
        pluginInfo: this.pluginInfo,
      };
    } catch (error) {
      this.emit("debug", `Search failed for "${query}": ${error.message}`);
      throw error;
    }
  }

  get(guildId) {
    return this.players.get(guildId);
  }

  async search(query, requester, source = this.defaultSearchPlatform) {
    return this.resolve({ query, source, requester });
  }

  // Get all nodes health status
  getNodesHealth() {
    const health = {};
    for (const [name, node] of this.nodeMap) {
      health[name] = this.getNodeHealth(node);
    }
    return health;
  }

  // Get overall system health
  getSystemHealth() {
    const nodesHealth = this.getNodesHealth();
    const connectedNodes = Object.values(nodesHealth).filter(h => h.connected);
    const totalPlayers = Object.values(nodesHealth).reduce((sum, h) => sum + h.players, 0);
    const totalPlayingPlayers = Object.values(nodesHealth).reduce((sum, h) => sum + h.playingPlayers, 0);
    
    return {
      totalNodes: Object.keys(nodesHealth).length,
      connectedNodes: connectedNodes.length,
      totalPlayers,
      totalPlayingPlayers,
      averagePing: connectedNodes.length > 0 ? 
        connectedNodes.reduce((sum, h) => sum + h.averagePing, 0) / connectedNodes.length : 0,
      nodesHealth
    };
  }

  // Clear caches
  clearCaches() {
    this.regionCache.clear();
    this.nodeHealthCache.clear();
    this.emit("debug", "All caches cleared");
  }

  // Save player states for autoResume
  async savePlayersState(filePath) {
    try {
      const playersData = {};
      
      for (const [guildId, player] of this.players) {
        if (player.current || player.queue.length > 0) {
          playersData[guildId] = player.toJSON();
        }
      }
      
      await fs.writeFile(filePath, JSON.stringify(playersData, null, 2));
      this.emit("debug", `Saved ${Object.keys(playersData).length} player states to ${filePath}`);
      
      return playersData;
    } catch (error) {
      this.emit("debug", `Failed to save player states: ${error.message}`);
      throw error;
    }
  }

  // Load player states for autoResume
  async loadPlayersState(filePath) {
    try {
      // Warn if resume.enabled is false
      if (!this.options.resume?.enabled) {
        this.emit("debug", `[Euralink] WARNING: loadPlayersState called but resume.enabled is false. Players will be restored, but their state will NOT be kept up to date for future saves. Set resume.enabled: true for full auto-resume support.`);
      }
      const data = await fs.readFile(filePath, 'utf8');
      const playersData = JSON.parse(data);
      
      let loadedCount = 0;
      
      for (const [guildId, playerData] of Object.entries(playersData)) {
        try {
          // Find the best node for this player
          const node = this.leastUsedNodes[0];
          if (!node) {
            this.emit("debug", `No available nodes to restore player for guild ${guildId}`);
            continue;
          }
          
          // Create player from saved state
          const player = Player.fromJSON(this, node, playerData);
          // Force autoResumeState.enabled to match current config
          player.autoResumeState.enabled = !!this.options.resume?.enabled;
          this.players.set(guildId, player);
          
          // Save autoResume state if enabled
          if (this.options.resume?.enabled && player.autoResumeState.enabled) {
            player.saveAutoResumeState();
          }
          
          loadedCount++;
          this.emit("playerCreate", player);
          this.emit("debug", `Restored player for guild ${guildId}`);
        } catch (error) {
          this.emit("debug", `Failed to restore player for guild ${guildId}: ${error.message}`);
        }
      }
      
      this.emit("debug", `Loaded ${loadedCount} player states from ${filePath}`);
      return loadedCount;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.emit("debug", `No player state file found at ${filePath}`);
        return 0;
      }
      this.emit("debug", `Failed to load player states: ${error.message}`);
      throw error;
    }
  }

  /**
   * Enhanced error recovery system
   */
  async recoverFromError(error, context = 'unknown') {
    this.emit("debug", `Starting error recovery for: ${context}`);
    
    try {
      // Check node connectivity
      const healthyNodes = this.leastUsedNodes;
      if (healthyNodes.length === 0) {
        this.emit("debug", "No healthy nodes available, attempting reconnection");
        for (const [name, node] of this.nodeMap) {
          if (!node.connected) {
            await node.connect();
          }
        }
      }

      // Migrate players from failed nodes
      const failedPlayers = [];
      for (const [guildId, player] of this.players) {
        if (!player.node.connected && player.connected) {
          failedPlayers.push(player);
        }
      }

      if (failedPlayers.length > 0) {
        this.emit("debug", `Migrating ${failedPlayers.length} players from failed nodes`);
        for (const player of failedPlayers) {
          await this.migratePlayer(player);
        }
      }

      this.emit("errorRecovered", context, error);
      return true;
    } catch (recoveryError) {
      this.emit("errorRecoveryFailed", context, error, recoveryError);
      return false;
    }
  }

  /**
   * Migrate player to a healthy node
   */
  async migratePlayer(player) {
    try {
      const healthyNodes = this.leastUsedNodes;
      if (healthyNodes.length === 0) {
        throw new Error("No healthy nodes available for migration");
      }

      const newNode = healthyNodes[0];
      const oldNode = player.node;
      
      // Save current state
      const playerState = {
        current: player.current,
        position: player.position,
        volume: player.volume,
        paused: player.paused,
        queue: [...player.queue],
        filters: player.filters.getPayload ? player.filters.getPayload() : {}
      };

      // Update player node
      player.node = newNode;
      
      // Restore state on new node
      if (playerState.current) {
        await player.restart();
      }

      this.emit("playerMigrated", player, oldNode, newNode);
      this.emit("debug", `Player ${player.guildId} migrated from ${oldNode.name} to ${newNode.name}`);
      
      return true;
    } catch (error) {
      this.emit("playerMigrationFailed", player, error);
      return false;
    }
  }

  /**
   * System health check
   */
  async performHealthCheck() {
    const healthReport = {
      timestamp: Date.now(),
      overall: 'healthy',
      nodes: {},
      players: {},
      performance: {}
    };

    // Check nodes
    for (const [name, node] of this.nodeMap) {
      const nodeHealth = node.getHealthStatus();
      healthReport.nodes[name] = nodeHealth;
      
      if (!nodeHealth.connected || nodeHealth.penalties > 100) {
        healthReport.overall = 'degraded';
      }
    }

    // Check players
    let activePlayerCount = 0;
    let playingPlayerCount = 0;
    for (const [guildId, player] of this.players) {
      activePlayerCount++;
      if (player.playing) playingPlayerCount++;
      
      if (!player.connected && player.voiceChannel) {
        healthReport.players[guildId] = 'disconnected';
        healthReport.overall = 'degraded';
      }
    }

    healthReport.performance = {
      activePlayerCount,
      playingPlayerCount,
      memoryUsage: process.memoryUsage(),
      cacheSize: this.regionCache.size + this.nodeHealthCache.size
    };

    this.emit("healthCheck", healthReport);
    return healthReport;
  }

  // Destroy all resources
  destroy() {
    // Destroy all players
    for (const player of this.players.values()) {
      player.destroy();
    }
    this.players.clear();

    // Destroy all nodes
    for (const node of this.nodeMap.values()) {
      node.destroy();
    }
    this.nodeMap.clear();

    // Clear caches
    this.clearCaches();

    this.initiated = false;
    this.emit("destroy");
  }
}

module.exports = { Euralink }; 