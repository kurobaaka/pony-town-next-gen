# Changelog

## Season 1 — Path 5 | Exp. Stable

### Fixes
- Fixed multiple issues from Path 4
- Fixed a critical issue with changelog display

### Features
- Added the ability to change chat type by holding the chat tag or clicking it (LMB)
- Added typing indicator
- Added support for up to three chat bubbles
- Added VK button
- Added UI toggle in the game world (F6 key)

### Improvements
- Replaced advertisement button images with SVG icons
- Completely redesigned and updated the character list

### Removed
- Removed Discord Pony button

---

*More updates coming soon...*

---

## Season 1 — Patch 4 | Unstable

⚠ **IMPORTANT:** This update has not been tested at all due to a fatal server startup error. The build may be unstable or not function correctly.

- Added the **Imported Character** window
- Added the **Character Deletion** window
- Added the **Changelog** popup window

- Changelog improvements:
  - Opens when hovering over the "Changelog" label
  - Automatically opens after a server update
  - Automatically opens after a server restart (test builds)

- Account system changes:
  - Split `/account` into:
    - `/accountdate`
    - `/accountid`
    - `/playtime`
  - Added `/age` (displays date of birth)

- Added `/collections` (`/col`) — shows toys, gifts, eggs, clovers, candies

- Added `/achievements` (`/achs`)
  - Displays contextual player messages based on:
    - account age
    - playtime

- Updated command system:
  - Commands are now organized into categories (`/help` or `/?`)

- Fixed issues:
  - Fixed `scale` in character editor
  - Fixed `background` issues in editor


---

## Season 1 — Patch 3 | Stable

- Updated project name to **"The 🍏 Server"** across components
- Added character scale customization
- Added emoji button to character name input

- Updated `/toys` command:
  - Shows collected toys or a message if none are collected

- Added `/collect` (admin):
  - Modify gifts, candies, toys

- Added milestone tracking for collected gifts

- Added utility functions:
  - `formatISODate` (YYYY-MM-DD)
  - `alignColumns` (text alignment)


---

## Season 1 — Patch 2 | Stable

- Updated account info:
  - Added creation date
  - Added total playtime

- Updated stats UI:
  - Moved to top center
  - Added pony coordinates display

- Fixed various bugs


---

## Season 1 — Patch 1 | Stable

- Initial server release
- Updated server logo
- Added account info page
- Updated loading screen