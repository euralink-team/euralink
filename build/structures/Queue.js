class Queue extends Array {
    get size() {
        return this.length;
    }

    get first() {
        return this.length ? this[0] : null;
    }

    get last() {
        return this.length ? this[this.length - 1] : null;
    }

    add(track) {
        if (!track) return this;
        
        // Fast single track addition
        this.push(track);
        return this;
    }

    addMultiple(tracks) {
        if (Array.isArray(tracks)) {
            this.push(...tracks);
        }
        return this;
    }

    remove(index) {
        if (index < 0 || index >= this.length) return null;
        return this.splice(index, 1)[0];
    }

    clear() {
        this.length = 0;
        if (this.player && this.player.eura) {
            this.player.eura.emit('queueCleared', this.player);
        }
    }

    // Improved shuffle with async/sync support and better performance
    shuffle() {
        if (this.length <= 1) return this;
        
        // Use Fisher-Yates shuffle algorithm for better performance
        for (let i = this.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this[i], this[j]] = [this[j], this[i]];
        }
        return this;
    }

    async shuffleAsync() {
        try {
            if (this.length <= 1) return this;
            
            // Process in chunks to avoid blocking
            const chunkSize = 1000;
            for (let i = 0; i < this.length; i += chunkSize) {
                const end = Math.min(i + chunkSize, this.length);
                
                // Shuffle current chunk
                for (let j = end - 1; j > i; j--) {
                    const k = i + Math.floor(Math.random() * (j - i + 1));
                    [this[j], this[k]] = [this[k], this[j]];
                }
                
                // Yield control to event loop
                if (i + chunkSize < this.length) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }
            if (this.player && this.player.eura) {
                this.player.eura.emit('queueShuffled', this.player);
            }
            return this;
        } catch (error) {
            if (this.player && this.player.eura) {
                this.player.eura.emit('queueError', this.player, error);
            }
            throw error;
        }
    }

    move(from, to) {
        if (from < 0 || from >= this.length || to < 0 || to >= this.length) return this;
        const item = this.splice(from, 1)[0];
        this.splice(to, 0, item);
        return this;
    }

    // Get tracks by index range
    getRange(start, end) {
        if (start < 0) start = 0;
        if (end > this.length) end = this.length;
        if (start >= end) return [];
        return this.slice(start, end);
    }

    // Find track by criteria
    findTrack(criteria) {
        if (typeof criteria === 'function') {
            return this.find(criteria);
        }
        
        if (typeof criteria === 'string') {
            return this.find(track => 
                track.info.title.toLowerCase().includes(criteria.toLowerCase()) ||
                track.info.author.toLowerCase().includes(criteria.toLowerCase())
            );
        }
        
        return null;
    }

    // Remove tracks by criteria
    removeTracks(criteria) {
        const removed = [];
        const remaining = [];
        
        for (const track of this) {
            if (typeof criteria === 'function') {
                if (criteria(track)) {
                    removed.push(track);
                } else {
                    remaining.push(track);
                }
            } else if (typeof criteria === 'string') {
                if (track.info.title.toLowerCase().includes(criteria.toLowerCase()) ||
                    track.info.author.toLowerCase().includes(criteria.toLowerCase())) {
                    removed.push(track);
                } else {
                    remaining.push(track);
                }
            }
        }
        
        this.length = 0;
        this.push(...remaining);
        
        return removed;
    }

    // Get queue statistics
    getStats() {
        const totalDuration = this.reduce((sum, track) => sum + (track.info.length || 0), 0);
        const uniqueArtists = new Set(this.map(track => track.info.author)).size;
        const uniqueSources = new Set(this.map(track => track.info.sourceName)).size;
        
        return {
            totalTracks: this.length,
            totalDuration,
            averageDuration: this.length > 0 ? totalDuration / this.length : 0,
            uniqueArtists,
            uniqueSources,
            sources: Array.from(new Set(this.map(track => track.info.sourceName)))
        };
    }

    // Reverse queue
    reverse() {
        this.reverse();
        return this;
    }

    // Get tracks by source
    getBySource(source) {
        return this.filter(track => track.info.sourceName === source);
    }

    // Get tracks by artist
    getByArtist(artist) {
        return this.filter(track => 
            track.info.author.toLowerCase().includes(artist.toLowerCase())
        );
    }

    // Get tracks by title
    getByTitle(title) {
        return this.filter(track => 
            track.info.title.toLowerCase().includes(title.toLowerCase())
        );
    }

    // Insert track at specific position
    insert(index, track) {
        if (index < 0) index = 0;
        if (index > this.length) index = this.length;
        this.splice(index, 0, track);
        return this;
    }

    // Swap two tracks
    swap(index1, index2) {
        if (index1 < 0 || index1 >= this.length || index2 < 0 || index2 >= this.length) return this;
        [this[index1], this[index2]] = [this[index2], this[index1]];
        return this;
    }

    // Get random track
    getRandom() {
        if (this.length === 0) return null;
        return this[Math.floor(Math.random() * this.length)];
    }

    // Get multiple random tracks
    getRandomMultiple(count) {
        if (count >= this.length) return [...this];
        
        const shuffled = [...this];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled.slice(0, count);
    }

    toArray() {
        return Array.from(this);
    }

    // Convert to JSON for serialization
    toJSON() {
        return this.map(track => track.toJSON ? track.toJSON() : track);
    }

    // Create queue from array
    static from(array) {
        const queue = new Queue();
        if (Array.isArray(array)) {
            queue.push(...array);
        }
        return queue;
    }

    // Fast batch addition for playlists
    addBatch(tracks) {
        if (!Array.isArray(tracks) || tracks.length === 0) return this;
        
        // Use push with spread operator for maximum performance
        this.push(...tracks);
        
        return this;
    }

    // Ultra-fast playlist loading
    addPlaylist(tracks, playlistInfo = null) {
        if (!Array.isArray(tracks) || tracks.length === 0) return this;
        
        // Pre-allocate array size for better performance
        const startIndex = this.length;
        this.length += tracks.length;
        
        // Fast copy
        for (let i = 0; i < tracks.length; i++) {
            this[startIndex + i] = tracks[i];
        }
        
        return this;
    }
}

module.exports = { Queue }; 