-- Where the doors of the dungeons are, for the log (Log.lua): the place in the open world a moment
-- before the character is inside a dungeon or a raid. Nothing is read while the log is off.
-- Entry "door": the game's number of the dungeon's map, the game's number of the zone's map the
-- place is counted on, x and y on it from 0 to 1 from its top left.
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
  if map and last then ns.Log("door", map, last[1], last[2], last[3]) end
  last = nil -- a login or a portal: the place of before is no door
end)
frame:SetScript("OnUpdate", function(_, elapsed)
  acc = acc + elapsed
  if acc < EVERY then return end
  acc = 0
  if not ns.Logging() or Inside() then return end
  local map = Num(Try(C_Map.GetBestMapForUnit, "player"))
  local p = map and Try(C_Map.GetPlayerMapPosition, map, "player")
  if type(p) == "table" and Num(p.x) and Num(p.y) then last = { map, p.x, p.y } end
end)
