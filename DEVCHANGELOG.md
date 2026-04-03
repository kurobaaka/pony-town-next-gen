# Dev Changelog

## Season 1 — Path 5 | Exp. Stable

### Tools
- Fully redesigned the Tools homepage
- Added a new icon preview tab in tools/ui (some icons may be missing)


#### Updated Icons
- Discord
- Patreon
- VK

#### Icons added
- CircleUser
- HandWave
- Megaphone
- Note
- Pencil
- Redo
- Slash
- Thumbtack
- Undo
- UserCheck
- UserMinus
- UsersSlash


## Season 1 — Patch 4 | Experimental

### Commands & Permissions

- Updated `/time` (moderators):
  - Can freeze time at specific value  
    Example: `/time 12:54 stop`

- Updated `/tp`:
  - Teleport to players
  - Teleport players to yourself
  - Added system messages

- Added moderator commands:
  - `/speed` (movement speed, currently not working)
  - `/locations` (list all locations)
  - `/players` (list players on map)
  - `/maps` (list all maps)

- Updated `/map` output

---

### Admin Tools

- Updated `/time`:
  - Infinite day/night support

- Updated `/collect`:
  - Can clear granted items

- Added:
  - `/setplaytime` (custom playtime)
  - `/setcreated` (custom account creation date)
    - format: `<YYYY-MM-DD | reset>`

---

### UI / Help System

- Updated **Help page**:
  - Commands grouped by categories
  - Categories depend on role:
    - Player
    - Mod
    - Admin
    - Dev
    - Superadmin

---

## Season 1 — Patch 3 | Internal

- Implemented **Build Box** component
- Updated icon to `faHammer`

- Added tests:
  - `/collect`
  - gift milestones
  - seasonal leaderboard messages

- Improved dev workflow:
  - Updated `start server.bat`
  - Updated `start server sprites.bat`


---

## Season 1 — Patch 2 | Internal

- Added Build Box component (early version)
- Updated Credits (team)
- Added test visuals
- Updated `README`