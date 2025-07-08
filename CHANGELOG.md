# Changelog

## [0.2.5] - 2024-08-07

### Major Features & Improvements
- **Grouped Config Structure:**
  - All options are now grouped (rest, plugins, sync, activityStatus, resume, node, autopauseOnEmpty, lazyLoad, defaultSearchPlatform, track, debug, bypassChecks) for clarity and extensibility.
  - See README for a full advanced config example.
- **Advanced Options:**
  - New options for REST retries/timeouts, node reconnect, lazy loading, track history, voting, favorites, user notes, and more.
- **Event-Driven Architecture:**
  - New events: `filtersCleared`, `filtersError`, `filtersUpdated`, `queueCleared`, `queueShuffled`, `queueError`, `restCacheCleared`, `restError`, `connectionError`, `pluginLoaded`, `pluginUnloaded`.
  - All major actions and errors now emit events for easy integration and debugging.
- **Robust Error Handling:**
  - All async methods use try/catch and emit user-friendly error events.
  - Improved runtime validation and descriptive error messages.
- **Cache & State Management:**
  - Methods to clear all caches and state: `clearAllCaches`, `clearState`, `clearThumbnailCache`, etc.
  - Utility commands in the example bot: `!clearrestcache`, `!clearnodestate`, `!cleartrackthumbs`, `!clearconnection`.
- **README & Documentation:**
  - README now includes a full advanced config example, option table, and new event documentation.
  - Usage patterns and grouped config structure are clearly explained.

### Breaking Changes
- `restVersion` is now expected inside the `rest` group, not at the root of the options object.
- All config options should use the new grouped structure for best compatibility.

### Other Changes
- Improved JSDoc and type definitions.
- Example bot updated to demonstrate all new features and commands.
- All structure files linted and tested for reliability.

---
