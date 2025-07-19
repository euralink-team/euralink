class Filters {
    constructor(player, options = {}) {
        this.player = player;
        this.volume = options.volume || 1
        this.equalizer = options.equalizer || [];
        this.karaoke = options.karaoke || null;
        this.timescale = options.timescale || null;
        this.tremolo = options.tremolo || null;
        this.vibrato = options.vibrato || null;
        this.rotation = options.rotation || null;
        this.distortion = options.distortion || null;
        this.channelMix = options.channelMix || null;
        this.lowPass = options.lowPass || null;
        this.bassboost = options.bassboost || null;
        this.slowmode = options.slowmode || null;
        this.nightcore = options.nightcore || null;
        this.vaporwave = options.vaporwave || null;
        this._8d = options._8d || null;
    }

    /**
     * 
     * @param {string[]} band
     * @returns 
     */

    setEqualizer(band) {
        this.equalizer = band;
        this.updateFilters();
        return this;
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setKaraoke(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this.karaoke = {
                level: options.level || 1.0,
                monoLevel: options.monoLevel || 1.0,
                filterBand: options.filterBand || 220.0,
                filterWidth: options.filterWidth || 100.0
            };

            this.updateFilters();
            return this;
        } else {
            this.karaoke = null;
            this.updateFilters();
            return this;
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setTimescale(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this.timescale = {
                speed: options.speed || 1.0,
                pitch: options.pitch || 1.0,
                rate: options.rate || 1.0
            };

            this.updateFilters();
            return this;
        } else {
            this.timescale = null;
            this.updateFilters();
            return this;
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setTremolo(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this.tremolo = {
                frequency: options.frequency || 2.0,
                depth: options.depth || 0.5
            };

            this.updateFilters();
            return this;
        } else {
            this.tremolo = null;
            this.updateFilters();
            return this;
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setVibrato(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this.vibrato = {
                frequency: options.frequency || 2.0,
                depth: options.depth || 0.5
            };

            this.updateFilters();
            return this;
        } else {
            this.vibrato = null;
            this.updateFilters();
            return this;
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setRotation(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this.rotation = {
                rotationHz: options.rotationHz || 0.0
            };

            this.updateFilters();
            return this;
        } else {
            this.rotation = null;
            this.updateFilters();
            return this;
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setDistortion(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this.distortion = {
                sinOffset: options.sinOffset || 0.0,
                sinScale: options.sinScale || 1.0,
                cosOffset: options.cosOffset || 0.0,
                cosScale: options.cosScale || 1.0,
                tanOffset: options.tanOffset || 0.0,
                tanScale: options.tanScale || 1.0,
                offset: options.offset || 0.0,
                scale: options.scale || 1.0
            };

            this.updateFilters();
            return this;
        } else {
            this.distortion = null;
            this.updateFilters();
            return this;
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setChannelMix(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this.channelMix = {
                leftToLeft: options.leftToLeft || 1.0,
                leftToRight: options.leftToRight || 0.0,
                rightToLeft: options.rightToLeft || 0.0,
                rightToRight: options.rightToRight || 1.0
            };

            this.updateFilters();
            return this;
        } else {
            this.channelMix = null;
            this.updateFilters();
            return this;
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setLowPass(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this.lowPass = {
                smoothing: options.smoothing || 20.0
            };

            this.updateFilters();
            return this;
        } else {
            this.lowPass = null;
            this.updateFilters();
            return this;
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setBassboost(enabled, options = {}) {
        if (!this.player) return;

        if (enabled) {
            if (options.value < 0 || options.value > 5) throw new Error("Bassboost value must be between 0 and 5");

            this.bassboost = options.value || 5;
            const num = (options.value || 5 - 1) * (1.25 / 9) - 0.25;

            this.setEqualizer(Array(13).fill(0).map((n, i) => ({
                band: i,
                gain: num
            })));
        } else {
            this.bassboost = null;
            this.setEqualizer([]);
        }
    }

    setSlowmode(enabled, options = {}) {
        if (!this.player) return;

        if (enabled) {
            this.slowmode = true;

            this.setTimescale(true, {
                rate: options.rate || 0.8
            })
        } else {
            this.slowmode = null;
            this.setTimescale(false)
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setNightcore(enabled, options = {}) {
        if (!this.player) return;

        if (enabled) {
            if (!this.player) return;
            this.nightcore = enabled;

            this.setTimescale(true, {
                rate: options.rate || 1.5
            })

            this.vaporwave = false;
        } else {
            this.nightcore = null;
            this.setTimescale(false)
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    setVaporwave(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this.vaporwave = enabled;

            this.setTimescale(true, {
                pitch: options.pitch || 0.5
            })

            if (enabled) {
                this.nightcore = false;
            }
        } else {
            this.vaporwave = null;
            this.setTimescale(false)
        }
    }

    /**
     * 
     * @param {boolean} enabled 
     * @param {*} options 
     * @returns 
     */

    set8D(enabled, options = {}) {
        if (!this.player) return;

        if (enabled == true) {
            this._8d = enabled;

            this.setRotation(true, {
                rotationHz: options.rotationHz || 0.2
            });
        } else {
            this._8d = null;
            this.setRotation(false)
        }
    }

    async clearFilters() {
        try {
            Object.assign(this, new Filters(this.player));
            await this.updateFilters();
            if (this.player && this.player.eura) {
                this.player.eura.emit("filtersCleared", this.player);
            }
            return this;
        } catch (error) {
            if (this.player && this.player.eura) {
                this.player.eura.emit("filtersError", this.player, error);
            }
            throw error;
        }
    }

    async updateFilters() {
        try {
            const { equalizer, karaoke, timescale, tremolo, vibrato, rotation, distortion, channelMix, lowPass, volume } = this;
            await this.player.node.rest.updatePlayer({
                guildId: this.player.guildId,
                data: {
                    filters: { volume, equalizer, karaoke, timescale, tremolo, vibrato, rotation, distortion, channelMix, lowPass }
                }
            });
            if (this.player && this.player.eura) {
                this.player.eura.emit("filtersUpdated", this.player);
            }
            return this;
        } catch (error) {
            if (this.player && this.player.eura) {
                this.player.eura.emit("filtersError", this.player, error);
            }
            throw error;
        }
    }

    /**
     * Apply preset filter combinations
     */
    async setPreset(presetName, options = {}) {
        const presets = {
            // Gaming presets
            gaming: { nightcore: { enabled: true, rate: 1.2 }, bassboost: { enabled: true, value: 2 } },
            gaming_hardcore: { nightcore: { enabled: true, rate: 1.4 }, bassboost: { enabled: true, value: 4 } },
            
            // Chill presets
            chill: { lowpass: { enabled: true, smoothing: 35.0 } },
            lofi: { lowpass: { enabled: true, smoothing: 25.0 } },
            
            // Party presets
            party: { bassboost: { enabled: true, value: 3 }, '8d': { enabled: true } },
            rave: { bassboost: { enabled: true, value: 5 } },
            
            // Vocal presets
            karaoke_soft: { karaoke: { enabled: true, level: 0.5 } },
            karaoke_strong: { karaoke: { enabled: true, level: 1.0 } },
            
            // Audio enhancement
            clarity: { equalizer: [{ band: 3, gain: 0.1 }, { band: 4, gain: 0.15 }, { band: 5, gain: 0.1 }] }
        };

        const preset = presets[presetName.toLowerCase()];
        if (!preset) {
            throw new Error(`Preset "${presetName}" not found. Available: ${Object.keys(presets).join(', ')}`);
        }

        await this.clearFilters();

        for (const [filterName, filterOptions] of Object.entries(preset)) {
            if (filterOptions.enabled) {
                switch (filterName) {
                    case 'nightcore': this.setNightcore(true, filterOptions); break;
                    case 'bassboost': this.setBassboost(true, filterOptions); break;
                    case '8d': this.set8D(true, filterOptions); break;
                    case 'karaoke': this.setKaraoke(true, filterOptions); break;
                    case 'lowpass': this.setLowPass(true, filterOptions); break;
                    case 'equalizer': this.setEqualizer(filterOptions); break;
                }
            }
        }

        this.player.eura.emit("debug", this.player.guildId, `Applied preset: ${presetName}`);
        return this;
    }

    /**
     * Get all available presets
     */
    getAvailablePresets() {
        return ['gaming', 'gaming_hardcore', 'chill', 'lofi', 'party', 'rave', 'karaoke_soft', 'karaoke_strong', 'clarity'];
    }
}

module.exports = { Filters }; 