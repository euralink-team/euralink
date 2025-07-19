class Plugin {
    constructor(name) {
        if (!name) throw new Error('[Plugin] Plugin name is required');
        this.name = name;
    }

    load(eura) {
        if (eura && typeof eura.emit === 'function') {
            eura.emit('pluginLoaded', this);
        }
    }
    unload(eura) {
        if (eura && typeof eura.emit === 'function') {
            eura.emit('pluginUnloaded', this);
        }
    }
}

module.exports = { Plugin }; 