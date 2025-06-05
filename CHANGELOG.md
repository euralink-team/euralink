# Changelog

## [0.1.1-beta]

### Added
- Player state persistence: `Player.toJSON()`, `Player.fromJSON()`, `Euralink.saveAllPlayers()`, `Euralink.restoreAllPlayers()`
- Advanced queue controls: `shuffle()`, `move(from, to)`, `remove(index)` in `Queue`, and player wrappers
- Player migration on node failure (automatic failover)
- Comprehensive error handling and new error events
- Plugin system example (`plugins/examplePlugin.js`)
- Richer event system: `queueShuffle`, `queueMove`, `queueRemove`, `playerMigrated`
- README documentation for plugins, queue, and persistence
- Example plugin and usage docs

### Changed
- Codebase cleanup and consistency improvements

### Fixed
- Ensured robust autoResume and player restoration 