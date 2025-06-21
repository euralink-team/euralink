const https = require('https');
const crypto = require('crypto');

const httpAgent = new https.Agent({
    keepAlive: true,
    timeout: 8000,
    maxSockets: 5,
    maxFreeSockets: 2,
    freeSocketTimeout: 4000
});

const SC_LINK_PATTERN = /<a\s+itemprop="url"\s+href="(\/[^"]+)"/g;
const SPOTIFY_TOTP_SECRET = Buffer.from('5507145853487499592248630329347', 'utf8');

// Fetch with redirect support and timeout
function fetchPage(url, options = {}) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { ...options, agent: httpAgent }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return fetchPage(new URL(res.headers.location, url).href, options)
                    .then(resolve, reject);
            }

            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Request failed with status: ${res.statusCode}`));
            }

            const data = [];
            res.on('data', chunk => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data).toString()));
        });

        req.on('error', reject);
        req.setTimeout(8000, () => req.destroy(new Error('Request timed out')));
    });
}

// SoundCloud autoplay handler
async function scAutoPlay(baseUrl) {
    try {
        const html = await fetchPage(`${baseUrl}/recommended`);
        const found = [];
        let match;

        while ((match = SC_LINK_PATTERN.exec(html)) !== null) {
            found.push(`https://soundcloud.com${match[1]}`);
            if (found.length >= 40) break;
        }

        if (!found.length) throw new Error('No recommended SoundCloud tracks found.');
        return found[Math.floor(Math.random() * found.length)];
    } catch (err) {
        console.error('[SC Autoplay Error]', err.message);
        return null;
    }
}

// Generate TOTP used for Spotify embed access
function createTotp() {
    const time = Math.floor(Date.now() / 30000);
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(time), 0);

    const hash = crypto.createHmac('sha1', SPOTIFY_TOTP_SECRET).update(buffer).digest();
    const offset = hash[hash.length - 1] & 0xf;

    const code = (
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff)
    );

    return [(code % 1_000_000).toString().padStart(6, '0'), time * 30000];
}

// Spotify autoplay handler
async function spAutoPlay(seedId) {
    const [totp, timestamp] = createTotp();

    const tokenEndpoint = `https://open.spotify.com/api/token?reason=init&productType=embed&totp=${totp}&totpVer=5&ts=${timestamp}`;
    try {
        const tokenData = await fetchPage(tokenEndpoint);
        const tokenJson = JSON.parse(tokenData);
        const token = tokenJson?.accessToken;

        if (!token) throw new Error('No access token from Spotify');

        const recUrl = `https://api.spotify.com/v1/recommendations?limit=10&seed_tracks=${seedId}`;
        const recData = await fetchPage(recUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const parsed = JSON.parse(recData);
        if (!parsed.tracks?.length) throw new Error('No recommended tracks received.');

        const track = parsed.tracks[Math.floor(Math.random() * parsed.tracks.length)];
        return track.id;
    } catch (err) {
        console.error('[Spotify Autoplay Error]', err.message);
        throw err;
    }
}

module.exports = {
    scAutoPlay,
    spAutoPlay
};