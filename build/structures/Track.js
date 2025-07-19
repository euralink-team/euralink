const { getImageUrl } = require("../handlers/fetchImage");

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class Track {
  // Static thumbnail cache to reduce API calls
  static thumbnailCache = new Map();

  constructor(data, requester, node, extra = {}) {
    this.rawData = data;
    this.track = data.encoded;
    this.info = {
      identifier: data.info.identifier,
      seekable: data.info.isSeekable,
      author: data.info.author,
      length: data.info.length,
      stream: data.info.isStream,
      position: data.info.position,
      title: data.info.title,
      uri: data.info.uri,
      requester,
      sourceName: data.info.sourceName,
      isrc: data.info?.isrc || null,
      album: data.info.album || extra.album || null,
      genre: data.info.genre || extra.genre || null,
      releaseYear: data.info.releaseYear || extra.releaseYear || null,
      popularity: data.info.popularity || extra.popularity || null,
      viewCount: data.info.viewCount || extra.viewCount || null,
      previewUrl: data.info.previewUrl || extra.previewUrl || null,
      _cachedThumbnail: data.info.thumbnail ?? null,
      get thumbnail() {
        // Use static cache if available
        const cacheKey = this.identifier + (this.sourceName || '');
        if (Track.thumbnailCache.has(cacheKey)) {
          return Track.thumbnailCache.get(cacheKey);
        }
        let thumb = null;
        if (data.info.thumbnail) {
          thumb = data.info.thumbnail;
        } else if (node.rest.version === "v4" && data.info.artworkUrl) {
          thumb = data.info.artworkUrl;
        } else {
          thumb = getImageUrl(this) || this.fallbackThumbnail;
        }
        Track.thumbnailCache.set(cacheKey, thumb);
        return thumb;
      },
      get fallbackThumbnail() {
        if (this.sourceName === 'youtube' && this.identifier) {
          return `https://img.youtube.com/vi/${this.identifier}/hqdefault.jpg`;
        }
        return 'https://i.imgur.com/8tBXd6H.png';
      },
      get directSourceLink() {
        if (this.sourceName === 'spotify' && this.identifier) {
          return `https://open.spotify.com/track/${this.identifier}`;
        }
        if (this.sourceName === 'youtube' && this.identifier) {
          return `https://www.youtube.com/watch?v=${this.identifier}`;
        }
        return this.uri || null;
      }
    };
    // Voting system
    this.upvotes = extra.upvotes || 0;
    this.downvotes = extra.downvotes || 0;
    // Request count
    this.requestCount = extra.requestCount || 1;
    // Advanced metadata
    this.album = this.info.album;
    this.genre = this.info.genre;
    this.releaseYear = this.info.releaseYear;
    this.popularity = this.info.popularity;
    this.viewCount = this.info.viewCount;
    this.previewUrl = this.info.previewUrl;
    // Related tracks placeholder
    this.relatedTracks = extra.relatedTracks || [];
    // Error state
    this.error = extra.error || null;
    // Favorite timestamp
    this.favoriteTimestamp = extra.favoriteTimestamp || null;
    // User notes
    this.userNotes = extra.userNotes || '';
    // Favorited
    this.favorited = extra.favorited || false;
    // Played at
    this.playedAt = extra.playedAt || null;
    // Replay count
    this.replayCount = extra.replayCount || 0;
    // Source-specific metadata
    this.source = extra.source || {};
  }

  // Voting methods
  upvote() {
    this.upvotes += 1;
  }
  downvote() {
    this.downvotes += 1;
  }

  // Mark as favorite and set timestamp
  favorite() {
    this.favorited = true;
    this.favoriteTimestamp = Date.now();
  }

  // Add a user note
  addNote(note) {
    this.userNotes = note;
  }

  // Add related tracks
  setRelatedTracks(tracks) {
    this.relatedTracks = tracks;
  }

  // Export as plain object (for history, API, etc.)
  toJSON() {
    return {
      rawData: this.rawData,
      track: this.track,
      info: {
        ...this.info,
        thumbnail: this.info.thumbnail,
        fallbackThumbnail: this.info.fallbackThumbnail,
        directSourceLink: this.info.directSourceLink
      },
      upvotes: this.upvotes,
      downvotes: this.downvotes,
      requestCount: this.requestCount,
      album: this.album,
      genre: this.genre,
      releaseYear: this.releaseYear,
      popularity: this.popularity,
      viewCount: this.viewCount,
      previewUrl: this.previewUrl,
      relatedTracks: this.relatedTracks,
      error: this.error,
      favoriteTimestamp: this.favoriteTimestamp,
      userNotes: this.userNotes,
      favorited: this.favorited,
      playedAt: this.playedAt,
      replayCount: this.replayCount,
      source: this.source
    };
  }

  /**
   * Clear the static thumbnail cache.
   */
  static clearThumbnailCache() {
      Track.thumbnailCache.clear();
  }

  async resolve(eura) {
    try {
      await new Promise((res) => setTimeout(res, 0));
      const query = [this.info.author, this.info.title].filter(Boolean).join(" - ");
      const result = await eura.resolve({
        query,
        source: eura.options.defaultSearchPlatform,
        requester: this.info.requester,
      });
      if (!result || !result.tracks.length) return;

      const officialAudio = result.tracks.find((track) => {
        const authorVariants = [this.info.author, `${this.info.author} - Topic`];
        return (
          authorVariants.some((name) =>
            new RegExp(`^${escapeRegExp(name)}$`, "i").test(track.info.author)
          ) ||
          new RegExp(`^${escapeRegExp(this.info.title)}$`, "i").test(track.info.title)
        );
      });
      if (officialAudio) {
        this.info.identifier = officialAudio.info.identifier;
        this.track = officialAudio.track;
        return this;
      }
      if (this.info.length) {
        const sameDuration = result.tracks.find(
          (track) =>
            track.info.length >= this.info.length - 2000 &&
            track.info.length <= this.info.length + 2000
        );
        if (sameDuration) {
          this.info.identifier = sameDuration.info.identifier;
          this.track = sameDuration.track;
          return this;
        }
        const sameDurationAndTitle = result.tracks.find(
          (track) =>
            track.info.title === this.info.title &&
            track.info.length >= this.info.length - 2000 &&
            track.info.length <= this.info.length + 2000
        );
        if (sameDurationAndTitle) {
          this.info.identifier = sameDurationAndTitle.info.identifier;
          this.track = sameDurationAndTitle.track;
          return this;
        }
      }
      this.info.identifier = result.tracks[0].info.identifier;
      this.track = result.tracks[0].track;
      return this;
    } catch (error) {
      if (eura && typeof eura.emit === 'function') {
        eura.emit('trackError', this, error);
      }
      throw error;
    }
  }
}

module.exports = { Track }; 