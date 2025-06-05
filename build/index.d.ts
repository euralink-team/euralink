import { EventEmitter } from "events";

type Nullable<T> = T | null;

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
    };
    public resolve(eura: Euralink): Promise<Track>;
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
}

export interface Player {
    toJSON(): any;
    restart(): Promise<void>;
    shuffleQueue(): this;
    moveQueueItem(from: number, to: number): this;
    removeQueueItem(index: number): any;
}

export interface Euralink {
    saveAllPlayers(filePath?: string): Promise<void>;
    restoreAllPlayers(filePath?: string): Promise<void>;
}

export interface Queue<T = any> extends Array<T> {
    shuffle(): this;
    move(from: number, to: number): this;
    remove(index: number): T | null;
    toArray(): T[];
}

export interface EuralinkEvents {
    queueShuffle: (player: Player) => void;
    queueMove: (player: Player, from: number, to: number) => void;
    queueRemove: (player: Player, index: number, removed: any) => void;
    playerMigrated: (player: Player, fromNode: Node, toNode: Node) => void;
    playerError: (player: Player, error: Error) => void;
}

export declare class Plugin {
    constructor(name: string);
    load(eura: Euralink): void;
    unload(eura: Euralink): void;
}

export interface PlayerOptions {
    guildId: string;
    textChannel?: string;
    voiceChannel?: string;
    deaf?: boolean;
    mute?: boolean;
    defaultVolume?: number;
    loop?: LoopOption;
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
    public current: Track;
    public previous: Track | null;
    public playing: boolean;
    public paused: boolean;
    public connected: boolean;
    public timestamp: number;
    public ping: number;
    public isAutoplay: boolean;

    public play(): Promise<Player>;
    public autoplay(player: Player): Promise<Player>;
    public connect(options?: {
        guildId: string;
        voiceChannel: string;
        deaf?: boolean;
        mute?: boolean;
    }): void;
    public stop(): Player;
    public pause(toggle?: boolean): Player;
    public seek(position: number): void;
    public setVolume(volume: number): Player;
    public setLoop(mode: LoopOption): Player;
    public setTextChannel(channel: string): Player;
    public setVoiceChannel(channel: string, options?: {
        mute?: boolean;
        deaf?: boolean;
    }): Player;
    public disconnect(): Player;
    public destroy(): void;
    private handleEvent(payload: any): void;
    private trackStart(player: Player, track: Track, payload: any): void;
    private trackEnd(player: Player, track: Track, payload: any): void;
    private trackError(player: Player, track: Track, payload: any): void;
    private trackStuck(player: Player, track: Track, payload: any): void;
    private socketClosed(player: Player, payload: any): void;
    private set(key: string, value: any): void;
    private get(key: string): any;
    private send(data: any): void;
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

export type EuralinkOptions = {
    send: (payload: {
        op: number;
        d: {
            guild_id: string;
            channel_id: string;
            self_deaf: boolean;
            self_mute: boolean;
        };
    }) => void;
    defaultSearchPlatform?: SearchPlatform;
    restVersion?: Version;
    plugins?: Array<Plugin>;
    multipleTrackHistory?: number | boolean;
    bypassChecks: {
      nodeFetchInfo: boolean;
    };
} & Exclude<NodeOptions, "sessionId">;

export declare const enum EuralinkEventType {
    NodeConnect = "nodeConnect",
    NodeReconnect = "nodeReconnect",
    NodeDisconnect = "nodeDisconnect",
    NodeCreate = "nodeCreate",
    NodeDestroy = "nodeDestroy",
    NodeError = "nodeError",
    SocketClosed = "socketClosed",
    TrackStart = "trackStart",
    TrackEnd = "trackEnd",
    TrackError = "trackError",
    TrackStuck = "trackStuck",
    PlayerCreate = "playerCreate",
    PlayerDisconnect = "playerDisconnect",
    PlayerMove = "playerMove",
    PlayerUpdate = "playerUpdate",
    QueueEnd = "queueEnd",
    Debug = "debug"
}

export type EuralinkEvents = {
    [EuralinkEventType.NodeConnect]: (node: Node) => void;
    [EuralinkEventType.NodeReconnect]: (node: Node) => void;
    [EuralinkEventType.NodeDisconnect]: (node: Node, reason: string) => void;
    [EuralinkEventType.NodeCreate]: (node: Node) => void;
    [EuralinkEventType.NodeDestroy]: (node: Node) => void;
    [EuralinkEventType.NodeError]: (node: Node, error: Error) => void;
    [EuralinkEventType.SocketClosed]: (player: Player, payload: any) => void;
    [EuralinkEventType.TrackStart]: (player: Player, track: Track, payload: any) => void;
    [EuralinkEventType.TrackEnd]: (player: Player, track: Track, payload: any) => void;
    [EuralinkEventType.TrackError]: (player: Player, track: Track, payload: any) => void;
    [EuralinkEventType.TrackStuck]: (player: Player, track: Track, payload: any) => void;
    [EuralinkEventType.PlayerCreate]: (player: Player) => void;
    [EuralinkEventType.PlayerDisconnect]: (player: Player) => void;
    [EuralinkEventType.PlayerMove]: (player: Player, oldChannel: string, newChannel: string) => void;
    [EuralinkEventType.PlayerUpdate]: (player: Player, payload: any) => void;
    [EuralinkEventType.QueueEnd]: (player: Player) => void;
    [EuralinkEventType.Debug]: (message: string[]) => void;
};

type k = string;

export declare class Euralink extends EventEmitter {
    public on<K extends keyof EuralinkEvents>(event: K, listener: EuralinkEvents[K]): this;
    public once<K extends keyof EuralinkEvents>(event: K, listener: EuralinkEvents[K]): this;
    public off<K extends keyof EuralinkEvents>(event: K, listener: EuralinkEvents[K]): this;
    public removeAllListeners<K extends keyof EuralinkEvents>(event?: K): this;
    public emit<K extends keyof EuralinkEvents>(event: K, ...args: Parameters<EuralinkEvents[K]>): boolean;

    constructor(client: any, nodes: LavalinkNode[], options: EuralinkOptions);
    public client: any;
    public nodes: Array<LavalinkNode>;
    public nodeMap: Map<k, Node>;
    public players: Map<k, Player>;
    public options: EuralinkOptions;
    public clientId: string;
    public initiated: boolean;
    public send: EuralinkOptions["send"];
    public defaultSearchPlatform: string;
    public restVersion: EuralinkOptions["restVersion"];
    public readonly leastUsedNodes: Array<Node>;
    public init(clientId: string): this;
    public createNode(options: any): Node;
    public destroyNode(identifier: string): void;
    public updateVoiceState(packet: any): void;
    public fetchRegion(region: string): Array<LavalinkNode>;
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
    public removeConnection(guildId: string): void;
    public resolve(params: {
        query: string;
        source?: string;
        requester: any;
        node?: string | Node;
    }): Promise<nodeResponse>;
    public get(guildId: string): Player;
}

export type LavalinkNode = {
    name?: string;
    host: string;
    port: number;
    password: string;
    secure?: boolean;
    regions?: string[];
} & Partial<NodeOptions>;

export type NodeOptions = {
    restVersion: Version;
    resumeKey?: string;
    sessionId?: string;
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

export declare class Node {
    constructor(eura: Euralink, node: LavalinkNode, options: NodeOptions);
    public eura: Euralink;
    public name: LavalinkNode["name"];
    public host: LavalinkNode["host"];
    public port: LavalinkNode["port"];
    public password: LavalinkNode["password"];
    public secure: LavalinkNode["secure"];
    public restVersion: NodeOptions["restVersion"];
    public rest: Rest;
    public wsUrl: string;
    public restUrl: string;
    private ws: null;
    public resumeKey: NodeOptions["resumeKey"];
    public sessionId: NodeOptions["sessionId"];
    public regions: string[] | null;
    public resumeTimeout: NodeOptions["resumeTimeout"];
    public autoResume: NodeOptions["autoResume"];
    public reconnectTimeout: NodeOptions["reconnectTimeout"];
    public reconnectTries: NodeOptions["reconnectTries"];
    public reconnectAttempt: number;
    public reconnectAttempted: number;
    public connected: boolean;
    public reconnecting: boolean;
    public info: NodeInfo | null;
    public stats: {
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
    public lastStats: number;
    fetchInfo(): Promise<NodeInfo | null>;
    lyrics: {
        checkAvailable: (eitherOne: boolean, ...plugins: string[]) => Promise<boolean>;
        get: (trackOrEncodedTrackStr: Track | string, skipTrackSource: boolean) => Promise<NodeLyricsResult | null>;
        getCurrentTrack: <TPlugin extends LyricPluginWithoutLavaLyrics | (string & {})>(guildId: string, skipTrackSource: boolean, plugin?: TPlugin) => Promise<TPlugin extends LyricPluginWithoutLavaLyrics ? LyricPluginWithoutLavaLyricsResult : NodeLyricsResult | null>;
    };
    connect(): void;
    open(): void;
    error(event: any): void;
    message(msg: any): void;
    close(event: any, reason: string): void;
    reconnect(): void;
    disconnect(): void;
    readonly penalties: number;
}

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

export declare class Filters {
    constructor(player: Player, options: FilterOptions);
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
    public setEqualizer(band: Array<{ band: number; gain: number }>): this;
    public setKaraoke(enabled: boolean, options?: {
        level: number;
        monoLevel: number;
        filterBand: number;
        filterWidth: number;
    }): this;
    public setTimescale(enabled: boolean, options?: {
        speed: number;
        pitch: number;
        rate: number;
    }): this;
    public setTremolo(enabled: boolean, options?: {
        frequency: number;
        depth: number;
    }): this;
    public setVibrato(enabled: boolean, options?: {
        frequency: number;
        depth: number;
    }): this;
    public setRotation(enabled: boolean, options?: {
        rotationHz: number;
    }): this;
    public setDistortion(enabled: boolean, options?: {
        sinOffset: number;
        sinScale: number;
        cosOffset: number;
        cosScale: number;
        tanOffset: number;
        tanScale: number;
        offset: number;
        scale: number;
    }): this;
    public setChannelMix(enabled: boolean, options?: {
        leftToLeft: number;
        leftToRight: number;
        rightToLeft: number;
        rightToRight: number;
    }): this;
    public setLowPass(enabled: boolean, options?: {
        smoothing: number;
    }): this;
    public setBassboost(enabled: boolean, options?: {
        value: number;
    }): this;
    public setSlowmode(enabled: boolean, options?: {
        rate: number;
    }): this;
    public setNightcore(enabled: boolean, options?: {
        rate: number;
    }): this;
    public setVaporwave(enabled: boolean, options?: {
        pitch: number;
    }): this;
    public set8D(enabled: boolean, options?: {
        rotationHz: number;
    }): this;
    public clearFilters(): this;
    public updateFilters(): this;
}

export type Voice = {
    sessionId: string;
    event: null;
    endpoint: string;
};

export declare class Connection {
    constructor(player: Player);
    public player: Player;
    public sessionId: string;
    public voice: Voice;
    public region: string;
    public self_deaf: boolean;
    public self_mute: boolean;
    public voiceChannel: string;
    public setServerUpdate(data: { endpoint: string; token: string }): void;
    public setStateUpdate(data: {
        session_id: string;
        channel_id: string;
        self_deaf: boolean;
        self_mute: boolean;
    }): void;
    private updatePlayerVoiceData(): void;
}

export { Euralink, Node, Player, Track, Queue, Filters, Connection, Rest }; 