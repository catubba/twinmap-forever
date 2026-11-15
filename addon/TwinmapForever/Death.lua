-- Where the character's corpse lies and where its ghost came back, for the app's map: it marks
-- them and draws the walk back.
-- Section "dead", sent only around a death. Dead: { dead = true, ghost = true once released,
-- corpse = { map, x, y } where the game shows the corpse (percent of that map), inst = the map of
-- the dungeon or raid the character died in, yard = { map, x, y } where the ghost first stood }.
-- Alive again: { dead = false }, for a minute.
--
-- The game shows no corpse that lies in a dungeon: there the ghost comes back to life at the door,
-- and the app marks that door. What is known of a death is kept with the saved settings, so a
-- /reload while a ghost loses neither the dungeon nor the graveyard.
local _, ns = ...

local TOLD = 60 -- seconds "alive again" is said for; the app takes a death not told again for a while for over
local SETTLE = 1 -- seconds a ghost stands before its place is taken for the graveyard: released, the map may settle a moment later

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function IsSecret(v) return issecretvalue and issecretvalue(v) end
local function Num(v) if type(v) == "number" and not IsSecret(v) then return v end end
local function Round(v) return math.floor(v * 100 * 100 + 0.5) / 100 end -- a fraction of a map to percent, two decimals

local function Here()
  local map = Num(Try(C_Map.GetBestMapForUnit, "player"))
  local p = map and Try(C_Map.GetPlayerMapPosition, map, "player")
  if type(p) == "table" and Num(p.x) and Num(p.y) then return { map = map, x = Round(p.x), y = Round(p.y) } end
end

-- The corpse on the map the character is on, else on the maps around it up to its continent: a
-- corpse in the next zone shows only there.
local function Corpse()
  local map = Num(Try(C_Map.GetBestMapForUnit, "player"))
  while map do
    local p = C_DeathInfo and Try(C_DeathInfo.GetCorpseMapPosition, map)
    local x, y = Try(p and p.GetXY, p)
    if Num(x) and Num(y) then return { map = map, x = Round(x), y = Round(y) } end
    local info = Try(C_Map.GetMapInfo, map)
    local up = type(info) == "table" and Num(info.parentMapID)
    map = up and up ~= 0 and (Num(info.mapType) or 3) > 2 and up or nil -- 2: a continent
  end
end

local function Build()
  local d = ns.db and ns.db.dead
  if not Try(UnitIsDeadOrGhost, "player") then
    -- Alive again: said for a while, so a block missed is sent again; never dead, nothing is said.
    if not d then return end
    d.aliveAt = d.aliveAt or GetTime()
    if GetTime() - d.aliveAt < TOLD or d.aliveAt > GetTime() then return { dead = false } end
    ns.db.dead = nil
    return
  end
  if not d or d.aliveAt then d = {} end
  if ns.db then ns.db.dead = d end
  local ghost = Try(UnitIsGhost, "player") == true
  local _, kind, _, _, _, _, _, id = Try(GetInstanceInfo)
  if not ghost and (kind == "party" or kind == "raid") and Num(id) then d.inst = id end
  if ghost then
    local now = GetTime()
    if not d.ghostAt or d.ghostAt > now then d.ghostAt = now end -- the game's clock starts again with the game
    if not d.yard and now - d.ghostAt >= SETTLE and (kind == nil or kind == "none") then d.yard = Here() end
  end
  return { dead = true, ghost = ghost or nil, corpse = not d.inst and Corpse() or nil, inst = d.inst, yard = d.yard }
end

ns.sections[#ns.sections + 1] = { name = "dead", period = 1, build = Build }
