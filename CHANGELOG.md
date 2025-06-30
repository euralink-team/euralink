# Changelog

All notable changes to Euralink will be documented in this file.

## [0.2.1] - 2025-01-30

### 🔧 Bug Fixes & Reliability

- **Fixed Player State Corruption**: Resolved a critical issue where the player's connection state could become inconsistent after being restored or disconnected. The `disconnect()` method was improved to ensure the bot reliably leaves the voice channel, preventing cases where it would get "stuck".
- **Corrected Node Availability Check**: Fixed a crash that incorrectly reported "No nodes are available" when creating a player, even with active Lavalink nodes. The check now correctly verifies the live status of nodes instead of relying on the initial static configuration.
- Special thanks to **@hamptonn** for reporting these issues.
