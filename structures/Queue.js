class Queue extends Array {
    get size() {
        return this.length;
    }

    get first() {
        return this.length ? this[0] : null;
    }

    add(track) {
        this.push(track);
        return this;
    }

    remove(index) {
        if (index < 0 || index >= this.length) return null;
        return this.splice(index, 1)[0];
    }

    clear() {
        this.length = 0;
    }

    shuffle() {
        for (let i = this.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this[i], this[j]] = [this[j], this[i]];
        }
        return this;
    }

    move(from, to) {
        if (from < 0 || from >= this.length || to < 0 || to >= this.length) return this;
        const item = this.splice(from, 1)[0];
        this.splice(to, 0, item);
        return this;
    }

    toArray() {
        return Array.from(this);
    }
}

module.exports = { Queue }; 