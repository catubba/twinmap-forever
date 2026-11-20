-- Where the doors of the dungeons are, for the log (Log.lua): the place in the open world a moment
-- before the character is inside a dungeon or a raid. Nothing is read while the log is off.
-- Entry "door": the game's number of the dungeon's map, the game's number of the zone's map the
-- place is counted on, x and y on it from 0 to 1 from its top left; then, where the game tells
-- them, the continent and the place in yards of the world, north then west: the map the game picks
-- for a place may be one of a cave or a city, and the yards are the same on every map.
-- Flights and portals are not written down: the flight nodes are in the game's own tables, which
-- the app reads, and nothing uses the far end of a portal yet.
local _, ns = ...

local EVERY = 1 -- seconds between two looks at the place: the door is at most that far behind

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end

local function Inside()
  local _, kind, _, _, _, _, _, map = Try(GetInstanceInfo)
  return (kind == "party" or kind == "raid") and Num(map) or nil
end

local last, acc = nil, 0
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:SetScript("OnEvent", function()
  local map = Inside()
  if map and last then ns.Log("door", map, unpack(last)) end
  last = nil -- a login or a portal: the place of before is no door
end)
frame:SetScript("OnUpdate", function(_, elapsed)
  acc = acc + elapsed
  if acc < EVERY then return end
  acc = 0
  if not ns.Logging() or Inside() then return end
  local map = Num(Try(C_Map.GetBestMapForUnit, "player"))
  local p = map and Try(C_Map.GetPlayerMapPosition, map, "player")
  if not (type(p) == "table" and Num(p.x) and Num(p.y)) then return end
  local north, west, _, continent = Try(UnitPosition, "player")
  last = { map, p.x, p.y }
  if Num(north) and Num(west) and Num(continent) then last[4], last[5], last[6] = continent, north, west end
end)
