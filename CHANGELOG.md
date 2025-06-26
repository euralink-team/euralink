# Changelog

## [0.1.8] - 2024-06-21

### Added / Improved

* 🧹 **Memory Leak Fixes (destroy)**
  * Player.js: `destroy()` now removes all event listeners and nulls out references to queue, filters, connection, and node.
  * Node.js: `destroy()` removes all event listeners, clears any reconnect timeouts, nulls out references to eura, ws, rest, and info, and destroys all associated players.
* ⚡ **Node Performance & Stats**
  * Node destroy logic ensures no lingering references or timeouts, helping with memory and performance.
* 🎵 **track.position and timestamp**
  * Euralink.js: `savePlayer` and `loadPlayers` now save and restore both position and timestamp for each player.
* ⏳ **Song Loading (async yield)**
  * The async yield (`await new Promise((res) => setTimeout(res, 0));`) is present and retained in the song loading logic for async compatibility.
* 🛡️ **Extra: Defensive Cleanups**
  * Comments and defensive code for future intervals/timeouts are included in both destroy methods.

  You now have:
  * Cleaner memory management.
  * More robust player/node destruction.
  * Accurate saving/restoring of playback position and timestamp.
  * Maintained async compatibility for song loading.

### Removed

* 🚫 **Removed `autoResume`** (as of now)
* 🚫 **Removed `@playlistThumbnails.js`** (now using built-in playlist thumbnail utility)

### Fixed

* ✅ General improvements to error handling and resource cleanup.