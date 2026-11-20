-- Where the doors of the dungeons are, for the log (Log.lua): the place in the open world a moment
-- before the character is inside a dungeon or a raid. Nothing is read while the log is off.
-- Entry "door": the game's number of the dungeon's map, then the place as ns.Place tells it (Log.lua).
-- Flights and portals are not written down: the flight nodes are in the game's own tables, which
-- the app reads, and nothing uses the far end of a portal yet.
local _, ns = ...

local EVERY = 1 -- seconds between two looks at the place: the door is at most that far behind

local last, acc = nil, 0
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:SetScript("OnEvent", function()
  local map = ns.Inside()
  if map and last then ns.Log("door", map, unpack(last)) end
  last = nil -- a login or a portal: the place of before is no door
end)
frame:SetScript("OnUpdate", function(_, elapsed)
  acc = acc + elapsed
  if acc < EVERY then return end
  acc = 0
  if not ns.Logging() or ns.Inside() then return end
  local place = { ns.Place() }
  if place[1] then last = place end
end)
