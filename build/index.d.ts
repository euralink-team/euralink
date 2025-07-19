import { EventEmitter } from "tseep";

/** Nullable type helper */
type Nullable<T> = T | null;

/**
 * Represents a music track with metadata and utility methods.
 */
export declare class Track {
    constructor(data: any, requester: any, node: Node);
    public track: string;
    public info: {
        identifier: string;
        seekable: boolean;
        author: string;
        length: number;
        stream: boolean;
        sourceName: string;
        title: string;
        uri: string;
        isrc: string | null;
        thumbnail: string | null;
        requester: any;
        pluginInfo?: any;
    };
    /**
     * Attempts to resolve the track using the Euralink instance.
     * Emits 'trackError' on failure.
     * @throws Error if resolution fails
     */
    public resolve(eura: Euralink): Promise<Track>;
    /**
     * Clears the static thumbnail cache for all tracks.
     */
    static clearThumbnailCache(): void;
}

export interface RestOptions {
    secure: boolean;
    host: string;
    port: number;
    sessionId: string;
    password: string;
    restVersion: string;
}

interface RequestOptions {
    guildId: string;
    data: any;
}

interface RestResponse {}

/**
 * REST API manager for Lavalink nodes.
 * Emits: 'restError', 'restCacheCleared'
 */
export declare class Rest extends EventEmitter {
    constructor(eura: Euralink, options: RestOptions);
    public eura: Euralink;
    public url: string;
    public sessionId: RestOptions["sessionId"];
    public password: RestOptions["password"];
    public version: RestOptions["restVersion"];
    public calls: number;

    public setSessionId(sessionId: string): void;
    public makeRequest(method: string, endpoint: string, body?: any): Promise<RestResponse | null>;
    public getPlayers(): Promise<RestResponse | null>;
    public updatePlayer(options: RequestOptions): Promise<void>;
    public destroyPlayer(guildId: string): Promise<RestResponse | null>;
    public getTracks(identifier: string): Promise<void>;
    public decodeTrack(track: string, node?: any): Promise<void>;
    public decodeTracks(tracks: any[]): Promise<void>;
    public getStats(): Promise<void>;
    public getInfo(): Promise<void>;
    public getRoutePlannerStatus(): Promise<void>;
    public getRoutePlannerAddress(address: string): Promise<void>;
    public parseResponse(req: any): Promise<RestResponse | null>;
    /**
     * Clears all REST-related caches and emits 'restCacheCleared'.
     */
    public clearAllCaches(): void;
    /**
     * Destroys the REST client and cleans up resources
     */
    public destroy(): void;
}

// Enhanced Queue interface with all new V0.3.0 methods
export interface Queue<T = Track> extends Array<T> {
    /**
     * Adds a single track to the queue
     */
    add(track: T): void;
    
    /**
     * Adds multiple tracks to the queue
     */
    addMultiple(tracks: T[]): void;
    
    /**
     * Adds a playlist to the queue
     */
    addPlaylist(tracks: T[], playlistInfo?: any): void;
    
    /**
     * Shuffles the queue in place
     */
    shuffle(): this;
    
    /**
     * Asynchronously shuffles the queue in chunks, emits 'queueShuffled' or 'queueError'.
     */
    shuffleAsync(): Promise<this>;
    
    /**
     * Moves a track from one position to another
     */
    move(from: number, to: number): this;
    
    /**
     * Removes a track at the specified index
     */
    remove(index: number): T | null;
    
    /**
     * Gets a range of tracks from the queue
     */
    getRange(start: number, end: number): T[];
    
    /**
     * Finds tracks matching the criteria
     */
    findTrack(criteria: string | ((track: T) => boolean)): T[];
    
    /**
     * Removes tracks matching the criteria
     */
    removeTracks(criteria: string | ((track: T) => boolean)): T[];
    
    /**
     * Gets tracks by source (youtube, soundcloud, etc.)
     */
    getBySource(source: string): T[];
    
    /**
     * Gets tracks by artist name
     */
    getByArtist(artist: string): T[];
    
    /**
     * Gets tracks by title
     */
    getByTitle(title: string): T[];
    
    /**
     * Inserts a track at the specified index
     */
    insert(index: number, track: T): void;
    
    /**
     * Swaps two tracks in the queue
     */
    swap(index1: number, index2: number): this;
    
    /**
     * Gets a random track from the queue
     */
    getRandom(): T | null;
    
    /**
     * Gets multiple random tracks from the queue
     */
    getRandomMultiple(count: number): T[];
    
    /**
     * Gets queue statistics
     */
    getStats(): {
        totalTracks: number;
        totalDuration: number;
        uniqueArtists: number;
        averageTrackLength: number;
        longestTrack: T | null;
        shortestTrack: T | null;
    };
    
    /**
     * Converts queue to array
     */
    toArray(): T[];
    
    /**
     * Clears the queue and emits 'queueCleared'.
     */
    clear(): void;
}

// SponsorBlock types
export interface SponsorBlockSegment {
    category: 'sponsor' | 'selfpromo' | 'interaction' | 'intro' | 'outro' | 'preview' | 'music_offtopic' | 'filler';
    start: number;
    end: number;
}

export interface ChapterInfo {
    name: string;
    start: number;
    end: number;
    duration: number;
}

// Lyrics types
export interface LyricsResult {
    lyrics?: string;
    syncedLyrics?: string;
    error?: string;
    metadata?: {
        id: number;
        trackName: string;
        artistName: string;
        albumName?: string;
        duration?: number;
        instrumental?: boolean;
    };
}

// Enhanced Player interface with all V0.3.0 features
export interface PlayerOptions {
    guildId: string;
    textChannel?: string;
    voiceChannel?: string;
    deaf?: boolean;
    mute?: boolean;
    defaultVolume?: number;
    loop?: LoopOption;
    region?: string;
    historyLimit?: number;
    autoResume?: boolean;
    sponsorBlock?: {
        enabled?: boolean;
        categories?: string[];
    };
}

export type LoopOption = "none" | "track" | "queue";

export declare class Player extends EventEmitter {
    constructor(eura: Euralink, node: Node, options: PlayerOptions);
    public eura: Euralink;
    public node: Node;
    public options: PlayerOptions;
    public guildId: string;
    public textChannel: string;
    public voiceChannel: string;
    public connection: Connection;
    public deaf: boolean;
    public mute: boolean;
    public volume: number;
    public loop: string;
    public filters: Filters;
    public data: {};
    public queue: Queue;
    public position: number;
    public current: Track | null;
    public previousTracks: Track[];
    public historyLimit: number;
    public playing: boolean;
    public paused: boolean;
    public connected: boolean;
    public timestamp: number;
    public ping: number;
    public isAutoplay: boolean;
    public autoResumeState: {
        enabled: boolean;
        lastTrack: Track | null;
        lastPosition: number;
        lastVolume: number;
        lastFilters: any;
        lastUpdate: number;
    };
    public sponsorBlock: {
        enabled: boolean;
        categories: string[];
        segments: SponsorBlockSegment[];
        chapters: ChapterInfo[];
    };

    // Basic playback methods
    public play(): Promise<Player>;
    public restart(): Promise<Player>;
    public autoplay(player: Player): Promise<Player>;
    public stop(): Player;
    public pause(toggle?: boolean): Player;
    public seek(position: number): Player;
    public setVolume(volume: number): Player;
    public setLoop(mode: LoopOption): string;

    // Connection methods
    public connect(options?: {
        guildId: string;
        voiceChannel: string;
        textChannel?: string;
        deaf?: boolean;
        mute?: boolean;
    }): Promise<Player>;
    public disconnect(): Promise<Player>;
    public destroy(disconnect?: boolean): Promise<void>;

    // Channel management
    public setTextChannel(channel: string): Player;
    public setVoiceChannel(channel: string, options?: {
        mute?: boolean;
        deaf?: boolean;
    }): Player;

    // Queue management methods
    public shuffleQueue(): Promise<Player>;
    public moveQueueItem(from: number, to: number): Player;
    public removeQueueItem(index: number): Player;

    // History and favorites
    public get previous(): Track | null;
    public getHistory(): Track[];
    public getFavorites(): Track[];
    public getUniqueArtistsAndSources(): { artists: Set<string>; sources: Set<string> };

    // Lyrics methods (NEW in V0.3.0)
    public getLyrics(queryOverride?: {
        track_name?: string;
        artist_name?: string;
        album_name?: string;
    }): Promise<LyricsResult>;
    public getCurrentLyricLine(syncedLyrics: string, currentTimeMs?: number): string;

    // SponsorBlock methods (NEW in V0.3.0)
    public setSponsorBlockCategories(categories?: string[]): Promise<boolean>;
    public getSponsorBlockCategories(): Promise<string[] | null>;
    public clearSponsorBlockCategories(): Promise<boolean>;
    public getSponsorBlockSegments(): SponsorBlockSegment[];

    // Chapter methods (NEW in V0.3.0)
    public getChapters(): ChapterInfo[];
    public getCurrentChapter(position?: number): ChapterInfo | null;

    // Auto-resume methods
    public saveAutoResumeState(): void;
    public clearAutoResumeState(): void;

    // Data management
    public set(key: string, value: any): Player;
    public get(key: string): any;
    public clearData(): Player;
    public toJSON(): any;
    public static fromJSON(eura: Euralink, node: Node, data: any): Player;

    // Utility methods
    public formatDuration(ms: number): string;

    // Private methods
    private handleEvent(payload: any): void;
    private trackStart(player: Player, track: Track, payload: any): void;
    private trackEnd(player: Player, track: Track, payload: any): void;
    private trackError(player: Player, track: Track, payload: any): void;
    private trackStuck(player: Player, track: Track, payload: any): void;
    private socketClosed(player: Player, payload: any): void;
    private send(data: any): void;
    private addToPreviousTrack(track: Track): void;
    private queueUpdate(updateData: any): void;
    private processUpdateQueue(): Promise<void>;
    private performUpdate(updateData: any): Promise<void>;
}

// Enhanced filter presets
export type FilterPreset = 
    | 'gaming' | 'gaming_hardcore'
    | 'chill' | 'lofi' | 'ambient'
    | 'party' | 'rave'
    | 'karaoke_soft' | 'karaoke_strong' | 'vocal_boost'
    | '80s' | '90s'
    | 'clarity' | 'warmth'
    | 'cinematic' | 'podcast';

export type FilterChain = {
    type: string;
    enabled?: boolean;
    options?: any;
}[];

export type FilterOptions = {
    volume?: number;
    equalizer?: Array<{ band: number; gain: number }>;
    karaoke?: {
        level: number;
        monoLevel: number;
        filterBand: number;
        filterWidth: number;
    } | null;
    timescale?: {
        speed: number;
        pitch: number;
        rate: number;
    } | null;
    tremolo?: {
        frequency: number;
        depth: number;
    } | null;
    vibrato?: {
        frequency: number;
        depth: number;
    } | null;
    rotation?: {
        rotationHz: number;
    } | null;
    distortion?: {
        sinOffset: number;
        sinScale: number;
        cosOffset: number;
        cosScale: number;
        tanOffset: number;
        tanScale: number;
        offset: number;
        scale: number;
    } | null;
    channelMix?: {
        leftToLeft: number;
        leftToRight: number;
        rightToLeft: number;
        rightToRight: number;
    } | null;
    lowPass?: {
        smoothing: number;
    } | null;
    bassboost?: number | null;
    slowmode?: number | null;
    nightcore?: boolean | null;
    vaporwave?: boolean | null;
    _8d?: boolean | null;
};

/**
 * Audio filter manager for a player.
 * Emits: 'filtersCleared', 'filtersError', 'filtersUpdated'
 */
export declare class Filters {
    constructor(player: Player, options?: FilterOptions);
    public player: Player;
    public volume: FilterOptions["volume"];
    public equalizer: FilterOptions["equalizer"];
    public karaoke: FilterOptions["karaoke"];
    public timescale: FilterOptions["timescale"];
    public tremolo: FilterOptions["tremolo"];
    public vibrato: FilterOptions["vibrato"];
    public rotation: FilterOptions["rotation"];
    public distortion: FilterOptions["distortion"];
    public channelMix: FilterOptions["channelMix"];
    public lowPass: FilterOptions["lowPass"];
    public bassboost: FilterOptions["bassboost"];
    public slowmode: FilterOptions["slowmode"];
    public nightcore: FilterOptions["nightcore"];
    public vaporwave: FilterOptions["vaporwave"];
    public _8d: FilterOptions["_8d"];

    // Individual filter methods
    public setEqualizer(band: Array<{ band: number; gain: number }>): this;
    public setKaraoke(enabled: boolean, options?: {
        level?: number;
        monoLevel?: number;
        filterBand?: number;
        filterWidth?: number;
    }): this;
    public setTimescale(enabled: boolean, options?: {
        speed?: number;
        pitch?: number;
        rate?: number;
    }): this;
    public setTremolo(enabled: boolean, options?: {
        frequency?: number;
        depth?: number;
    }): this;
    public setVibrato(enabled: boolean, options?: {
        frequency?: number;
        depth?: number;
    }): this;
    public setRotation(enabled: boolean, options?: {
        rotationHz?: number;
    }): this;
    public setDistortion(enabled: boolean, options?: {
        sinOffset?: number;
        sinScale?: number;
        cosOffset?: number;
        cosScale?: number;
        tanOffset?: number;
        tanScale?: number;
        offset?: number;
        scale?: number;
    }): this;
    public setChannelMix(enabled: boolean, options?: {
        leftToLeft?: number;
        leftToRight?: number;
        rightToLeft?: number;
        rightToRight?: number;
    }): this;
    public setLowPass(enabled: boolean, options?: {
        smoothing?: number;
    }): this;
    public setBassboost(enabled: boolean, options?: {
        value?: number;
    }): this;
    public setSlowmode(enabled: boolean, options?: {
        rate?: number;
    }): this;
    public setNightcore(enabled: boolean, options?: {
        rate?: number;
    }): this;
    public setVaporwave(enabled: boolean, options?: {
        pitch?: number;
    }): this;
    public set8D(enabled: boolean, options?: {
        rotationHz?: number;
    }): this;

    // NEW V0.3.0: Advanced filter preset methods
    public setPreset(presetName: FilterPreset, options?: any): Promise<this>;
    public getAvailablePresets(): FilterPreset[];
    public createChain(filters: FilterChain): Promise<this>;

    // Core filter methods
    public clearFilters(): Promise<this>;
    public updateFilters(): Promise<this>;
    public getPayload(): FilterOptions;
}

export type SearchPlatform = "ytsearch" | "ytmsearch" | "scsearch" | "spsearch" | "amsearch" | "dzsearch" | "ymsearch" | (string & {});
export type Version = "v3" | "v4";

export type LavalinkTrackLoadException = {
  message: string | null,
  severity: "common" | "suspicious" | "fault",
  cause: string
};

export type nodeResponse = {
    tracks: Array<Track>;
    loadType: string | null;
    playlistInfo: {
        name: string;
        selectedTrack: number;
    } | null;
    pluginInfo: object;
    exception: LavalinkTrackLoadException | null;
};

// Enhanced Euralink options with V0.3.0 features
export interface EnhancedPerformanceOptions {
    enabled?: boolean;
    connectionPooling?: boolean;
    requestBatching?: boolean;
    memoryOptimization?: boolean;
}

export interface EuraSyncOptions {
    enabled?: boolean;
    template?: string;
}

export interface ActivityStatusOptions {
    enabled?: boolean;
    template?: string;
}

export interface ResumeOptions {
    enabled?: boolean;
    key?: string;
    timeout?: number;
}

export interface NodeOptions {
    dynamicSwitching?: boolean;
    autoReconnect?: boolean;
    ws?: {
        reconnectTries?: number;
        reconnectInterval?: number;
    };
}

export interface RestConfigOptions {
    version?: Version;
    retryCount?: number;
    timeout?: number;
}

export interface TrackOptions {
    historyLimit?: number;
    enableVoting?: boolean;
    enableFavorites?: boolean;
    enableUserNotes?: boolean;
}

export interface LazyLoadOptions {
    enabled?: boolean;
    timeout?: number;
}

export type EuralinkOptions = {
    send: (payload: {
        op: number;
        d: {
            guild_id: string;
            channel_id: string | null;
            self_deaf: boolean;
            self_mute: boolean;
        };
    }) => void;
    defaultSearchPlatform?: SearchPlatform;
    
    // Legacy options (still supported)
    restVersion?: Version;
    retryCount?: number;
    timeout?: number;
    dynamicSwitching?: boolean;
    autoReconnect?: boolean;
    reconnectTries?: number;
    reconnectInterval?: number;
    autoResume?: boolean;
    resumeKey?: string;
    resumeTimeout?: number;
    eurasync?: EuraSyncOptions;
    setActivityStatus?: ActivityStatusOptions;
    
    // NEW V0.3.0: Enhanced structured options
    rest?: RestConfigOptions;
    plugins?: Array<Plugin>;
    euraSync?: EuraSyncOptions;
    sync?: EuraSyncOptions; // Alias for euraSync
    activityStatus?: ActivityStatusOptions;
    resume?: ResumeOptions;
    node?: NodeOptions;
    enhancedPerformance?: EnhancedPerformanceOptions;
    autopauseOnEmpty?: boolean;
    lazyLoad?: LazyLoadOptions;
    track?: TrackOptions;
    debug?: boolean;
    bypassChecks?: {
        nodeFetchInfo?: boolean;
    };
};

// Health monitoring types (NEW in V0.3.0)
export interface NodeHealthStatus {
    connected: boolean;
    uptime: number;
    ping: number;
    averagePing: number;
    penalties: number;
    players: number;
    playingPlayers: number;
    cpuLoad: number;
    memoryUsage: number;
}

export interface SystemHealthReport {
    timestamp: number;
    overall: 'healthy' | 'degraded' | 'critical';
    nodes: Record<string, NodeHealthStatus>;
    players: Record<string, string>;
    performance: {
        activePlayerCount: number;
        playingPlayerCount: number;
        memoryUsage: NodeJS.MemoryUsage;
        cacheSize: number;
    };
}

// Enhanced events with V0.3.0 additions
export interface EuralinkEvents {
    // Core events
    nodeConnect: (node: Node) => void;
    nodeReconnect: (node: Node) => void;
    nodeDisconnect: (node: Node, reason: string) => void;
    nodeCreate: (node: Node) => void;
    nodeDestroy: (node: Node) => void;
    nodeError: (node: Node, error: Error) => void;
    socketClosed: (player: Player, payload: any) => void;
    trackStart: (player: Player, track: Track, payload: any) => void;
    trackEnd: (player: Player, track: Track, payload: any) => void;
    trackError: (player: Player, track: Track, payload: any) => void;
    trackStuck: (player: Player, track: Track, payload: any) => void;
    playerCreate: (player: Player) => void;
    playerDestroy: (player: Player) => void;
    playerDisconnect: (player: Player) => void;
    playerMove: (player: Player, oldChannel: string, newChannel: string) => void;
    playerUpdate: (player: Player, payload: any) => void;
    queueEnd: (player: Player, track: Track, payload: any) => void;
    debug: (...args: any[]) => void;
    
    // Queue events
    queueShuffle: (player: Player) => void;
    queueMove: (player: Player, from: number, to: number) => void;
    queueRemove: (player: Player, removed: Track, index: number) => void;
    queueCleared: (player: Player) => void;
    queueShuffled: (player: Player) => void;
    queueError: (player: Player, error: Error) => void;
    
    // Filter events
    filtersCleared: (player: Player) => void;
    filtersError: (player: Player, error: Error) => void;
    filtersUpdated: (player: Player) => void;
    
    // REST events
    restCacheCleared: () => void;
    restError: (error: Error) => void;
    
    // Connection events
    connectionError: (connection: Connection, error: Error) => void;
    
    // Plugin events
    pluginLoaded: (plugin: Plugin) => void;
    pluginUnloaded: (plugin: Plugin) => void;
    
    // NEW V0.3.0: SponsorBlock events
    sponsorBlockSegmentsLoaded: (player: Player, segments: SponsorBlockSegment[]) => void;
    sponsorBlockSegmentSkipped: (player: Player, segment: SponsorBlockSegment) => void;
    
    // NEW V0.3.0: Chapter events
    chaptersLoaded: (player: Player, chapters: ChapterInfo[]) => void;
    chapterStarted: (player: Player, chapter: ChapterInfo) => void;
    
    // NEW V0.3.0: Enhanced error recovery events
    playerMigrated: (player: Player, oldNode: Node, newNode: Node) => void;
    playerMigrationFailed: (player: Player, error: Error) => void;
    errorRecovered: (context: string, error: Error) => void;
    errorRecoveryFailed: (context: string, originalError: Error, recoveryError: Error) => void;
    
    // NEW V0.3.0: Health monitoring events
    healthCheck: (report: SystemHealthReport) => void;
    
    // Cleanup event
    destroy: () => void;
}

export declare class Plugin {
    /**
     * @param name The plugin name (required)
     * @throws Error if name is not provided
     */
    constructor(name: string);
    public name: string;
    /**
     * Called when the plugin is loaded. Emits 'pluginLoaded' if Euralink is provided.
     */
    load(eura: Euralink): void;
    /**
     * Called when the plugin is unloaded. Emits 'pluginUnloaded' if Euralink is provided.
     */
    unload(eura: Euralink): void;
}

// Enhanced Euralink class with V0.3.0 features
export declare class Euralink extends EventEmitter {
    public on<K extends keyof EuralinkEvents>(event: K, listener: EuralinkEvents[K]): this;
    public once<K extends keyof EuralinkEvents>(event: K, listener: EuralinkEvents[K]): this;
    public off<K extends keyof EuralinkEvents>(event: K, listener: EuralinkEvents[K]): this;
    public removeAllListeners<K extends keyof EuralinkEvents>(event?: K): this;
    public emit<K extends keyof EuralinkEvents>(event: K, ...args: Parameters<EuralinkEvents[K]>): boolean;

    constructor(client: any, nodes: LavalinkNode[], options: EuralinkOptions);
    public client: any;
    public nodes: Array<LavalinkNode>;
    public nodeMap: Map<string, Node>;
    public players: Map<string, Player>;
    public options: EuralinkOptions;
    public clientId: string | null;
    public initiated: boolean;
    public send: EuralinkOptions["send"];
    public defaultSearchPlatform: string;
    public restVersion: string;
    public tracks: Track[];
    public loadType: string | null;
    public playlistInfo: any;
    public pluginInfo: any;
    public plugins: Plugin[];
    public version: string;
    
    // Performance optimization properties
    public regionCache: Map<string, any>;
    public nodeHealthCache: Map<string, any>;
    public cacheTimeout: number;
    public lazyLoad: boolean;
    public lazyLoadTimeout: number;
    public enhancedPerformance: EnhancedPerformanceOptions;
    public euraSync: any;
    public setActivityStatus: any;

    // Core methods
    public init(clientId: string): this;
    public validateConfig(): boolean;
    public clearAllCaches(): void;
    
    // Node management
    public readonly leastUsedNodes: Array<Node>;
    public createNode(options: any): Node;
    public destroyNode(identifier: string): void;
    public getNodeHealth(node: Node): NodeHealthStatus;
    public calculateNodeScore(health: NodeHealthStatus): number;
    public fetchRegion(region: string): Node[];
    public getBestNodeForRegion(region: string): Node | undefined;
    
    // Player management
    public createConnection(options: {
        guildId: string;
        voiceChannel: string;
        textChannel: string;
        deaf?: boolean;
        mute?: boolean;
        defaultVolume?: number;
        loop?: LoopOption;
        region?: string;
    }): Player;
    public createPlayer(node: Node, options: PlayerOptions): Player;
    public destroyPlayer(guildId: string): void;
    public removeConnection(guildId: string): void;
    public get(guildId: string): Player | undefined;
    
    // Voice state management
    public updateVoiceState(packet: any): void;
    
    // Track resolution
    public resolve(params: {
        query: string;
        source?: string;
        requester: any;
        node?: string | Node;
    }): Promise<nodeResponse>;
    public search(query: string, requester: any, source?: string): Promise<nodeResponse>;
    
    // NEW V0.3.0: Health monitoring
    public getNodesHealth(): Record<string, NodeHealthStatus>;
    public getSystemHealth(): SystemHealthReport;
    public performHealthCheck(): Promise<SystemHealthReport>;
    
    // NEW V0.3.0: Enhanced error recovery
    public recoverFromError(error: Error, context?: string): Promise<boolean>;
    public migratePlayer(player: Player): Promise<boolean>;
    
    // NEW V0.3.0: AutoResume system
    public savePlayersState(filePath: string): Promise<any>;
    public loadPlayersState(filePath: string): Promise<number>;
    
    // Cache management
    public clearCaches(): void;
    
    // Version checking
    public checkForUpdates(): Promise<void>;
    public isNewerVersion(version1: string, version2: string): boolean;
    
    // Cleanup
    public destroy(): void;
}

export type LavalinkNode = {
    name?: string;
    host: string;
    port: number;
    password: string;
    secure?: boolean;
    regions?: string[];
    restVersion?: Version;
    sessionId?: string;
    resumeKey?: string;
    resumeTimeout?: number;
    autoResume?: boolean;
    reconnectTimeout?: number;
    reconnectTries?: number;
};

type NodeInfo = {
    version: NodeInfoSemanticVersionObj;
    buildTime: number;
    git: {
        branch: string;
        commit: string;
        commitTime: string;
    };
    jvm: string;
    lavaplayer: string;
    sourceManagers: string[];
    filters: string[];
    plugins: Array<{
        name: string;
        version: string;
    }>;
};

type NodeInfoSemanticVersionObj = {
    semver: string;
    major: number;
    minor: number;
    patch: number;
};

type LyricPluginWithoutLavaLyrics = "java-lyrics-plugin" | "lyrics";

export type LyricPluginWithoutLavaLyricsResult = {
    type: "timed" | "text" | (string & {}),
    track: {
        title: string;
        author: string;
        album: string | null;
        albumArt: {
            url: string;
            height: number;
            width: number;
        }[] | null;
    };
    source: string;
} | { 
    type: "text";
    text: string;
} | {
    type: "timed";
    lines: {
        line: string;
        range: {
            start: number;
            end: number;
        };
    }[];
};

export interface NodeLyricsResult {
  sourceName: string;
  provider: string;
  text: Nullable<string>;
  lines: Array<NodeLyricsLine>;
  plugin: object;
}

interface NodeLyricsLine {
  timestamp: number;
  duration: number;
  line: string;
  plugin: object;
}

// Enhanced Node class with V0.3.0 features
export declare class Node extends EventEmitter {
    constructor(eura: Euralink, node: LavalinkNode, options: any);
    public eura: Euralink;
    public name: string;
    public host: string;
    public port: number;
    public password: string;
    public secure: boolean;
    public restVersion: string;
    public sessionId: string | null;
    public rest: Rest;
    public wsUrl: string;
    public restUrl: string;
    public ws: any;
    public resumeKey: string | null;
    public regions: string[] | null;
    public resumeTimeout: number;
    public autoResume: boolean;
    public reconnectTimeout: number;
    public reconnectTries: number;
    public reconnectAttempt: any;
    public reconnectAttempted: number;
    public connected: boolean;
    public info: NodeInfo | null;
    public stats: {
        players: number;
        playingPlayers: number;
        uptime: number;
        memory: {
            free: number;
            used: number;
            allocated: number;
            reservable: number;
        };
        cpu: {
            cores: number;
            systemLoad: number;
            lavalinkLoad: number;
        };
        frameStats: {
            sent: number;
            nulled: number;
            deficit: number;
        };
    };
    public lastStats: number;
    public connectionStartTime: number | null;
    public lastPing: number;
    public pingHistory: number[];
    public maxPingHistory: number;
    public autoResumePlayers: Map<string, any>;
    
    // Core methods
    public constructWsUrl(): string;
    public constructRestUrl(): string;
    public fetchInfo(options?: { restVersion?: string, includeHeaders?: boolean }): Promise<NodeInfo | null>;
    public clearState(): void;
    public connect(): Promise<void>;
    public open(): Promise<void>;
    public error(event: any): void;
    public message(msg: any): Promise<void>;
    public close(event: any, reason: string): void;
    public reconnect(): void;
    public disconnect(): void;
    public destroy(clean?: boolean): void;
    public performAutoResume(): Promise<void>;
    
    // Health monitoring
    public readonly penalties: number;
    public getHealthStatus(): NodeHealthStatus;
    
    // Lyrics support
    public lyrics: {
        checkAvailable: (eitherOne?: boolean, ...plugins: string[]) => Promise<boolean>;
        get: (trackOrEncodedTrackStr: Track | string, skipTrackSource?: boolean) => Promise<NodeLyricsResult | null>;
        getCurrentTrack: <TPlugin extends LyricPluginWithoutLavaLyrics | (string & {})>(guildId: string, skipTrackSource?: boolean, plugin?: TPlugin) => Promise<TPlugin extends LyricPluginWithoutLavaLyrics ? LyricPluginWithoutLavaLyricsResult : NodeLyricsResult | null>;
    };
}

export type Voice = {
    sessionId: string;
    event: null;
    endpoint: string;
};

/**
 * Manages the voice connection for a player.
 * Emits: 'connectionError'
 */
export declare class Connection {
    constructor(player: Player);
    public player: Player;
    public sessionId: string;
    public voice: Voice;
    public region: string;
    public self_deaf: boolean;
    public self_mute: boolean;
    public voiceChannel: string;
    public connectionState: 'disconnected' | 'connecting' | 'connected';
    
    public setServerUpdate(data: { endpoint: string; token: string }): void;
    public setStateUpdate(data: {
        session_id: string;
        channel_id: string;
        self_deaf: boolean;
        self_mute: boolean;
    }): void;
    public clearState(): void;
    private updatePlayerVoiceData(): void;
}

// EuraSync class for voice channel status updates
export declare class EuraSync {
    constructor(client: any, config: EuraSyncOptions);
    public client: any;
    public config: EuraSyncOptions;
    public setVoiceStatus(voiceChannel: string, trackInfo: any, status: string): Promise<void>;
    public clearVoiceStatus(voiceChannel: string, reason: string): Promise<void>;
}

// Export all classes and types
export { 
    Euralink, 
    Node, 
    Player, 
    Track, 
    Queue, 
    Filters, 
    Connection, 
    Rest, 
    Plugin, 
    EuraSync 
};

// Export all types
export type {
    EuralinkOptions,
    EuralinkEvents,
    PlayerOptions,
    FilterOptions,
    FilterPreset,
    FilterChain,
    LavalinkNode,
    SponsorBlockSegment,
    ChapterInfo,
    LyricsResult,
    NodeHealthStatus,
    SystemHealthReport,
    SearchPlatform,
    Version,
    LoopOption,
    nodeResponse
};
