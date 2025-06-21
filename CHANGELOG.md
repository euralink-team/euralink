# Changelog

## \[0.1.7] - 2025-06-21

### Added

* ✨ **Autoplay Rewrite**: Fully restructured autoplay logic to improve compatibility and control.

  * Handles fallback better and prevents broken responses.
  * Fixes `undefined:2` / `Unexpected token '<'` errors caused by invalid API responses (e.g. when receiving XML instead of JSON).
* ⚡ **Super-Fast Track/Playlist Loading**:

  * Optimized search resolver logic for near-instant load times.
  * Reduced overhead in queue-building from large playlists.
* 🖼️ **Built-in Playlist Thumbnail Utility**:

  * Fetch thumbnails for Spotify, YouTube, SoundCloud, and Apple Music playlists.
  * Available under `const { Thumbnails } = require('euralink');` for use in embeds and dashboards.

### Fixed

* ✅ Better error handling for external APIs (invalid JSON, HTTP errors, etc.).
* ✅ Improved voice channel reconnection edge cases on node failure.