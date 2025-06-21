const axios = require('axios');

class EuraSync {
    /**
     * @param {Client} botClient - Your Discord.js client
     * @param {Object} [options]
     * @param {string} [options.template='Now playing: {title}']
     * @param {string} [options.endpoint='https://discord.com/api/v10/channels']
     */
    constructor(botClient, options = {}) {
        this.botClient = botClient;
        this.template = options.template || 'Now playing: {title}';
        this.endpoint = options.endpoint || 'https://discord.com/api/v10/channels';
    }

    /**
     * Set the voice channel status.
     * @param {string} channelId
     * @param {Object} trackInfo - Track info object (should have title, author, uri, source, etc)
     * @param {string} [reason] - Optional reason for audit logs
     */
    async setVoiceStatus(channelId, trackInfo, reason) {
        try {
            const url = `${this.endpoint}/${channelId}/voice-status`;
            const status = this.formatStatus(trackInfo);
            const data = { status };
            const headers = {
                Authorization: `Bot ${this.botClient.token}`,
            };
            if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);

            await axios.put(url, data, { headers });
            // console.log(`[EuraSync] Voice channel status updated for ${channelId}: "${data.status}"`);
        } catch (error) {
            this._handleError(error, 'setVoiceStatus');
        }
    }

    /**
     * Clear the voice channel status (set to empty or default).
     * @param {string} channelId
     * @param {string} [reason]
     */
    async clearVoiceStatus(channelId, reason) {
        try {
            const url = `${this.endpoint}/${channelId}/voice-status`;
            const data = { status: '' };
            const headers = {
                Authorization: `Bot ${this.botClient.token}`,
            };
            if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);

            await axios.put(url, data, { headers });
            // console.log(`[EuraSync] Voice channel status cleared for ${channelId}`);
        } catch (error) {
            this._handleError(error, 'clearVoiceStatus');
        }
    }

    /**
     * Format the status string using the template and track info.
     * @param {Object} trackInfo
     * @returns {string}
     */
    formatStatus(trackInfo = {}) {
        let status = this.template;
        for (const key of Object.keys(trackInfo)) {
            status = status.replace(new RegExp(`{${key}}`, 'g'), trackInfo[key] ?? '');
        }
        return status;
    }

    _handleError(error, method) {
        if (error.response) {
            console.error(`[EuraSync] API Error in ${method} (${error.response.status}): ${error.response.data.message}`);
        } else if (error.request) {
            console.error(`[EuraSync] No response received from API in ${method}`);
        } else {
            console.error(`[EuraSync] Request Setup Error in ${method}: ${error.message}`);
        }
    }
}

module.exports = { EuraSync }; 