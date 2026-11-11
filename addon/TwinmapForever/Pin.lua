-- The pin: a point chosen on Twinmap's map, marked in the game with the game's own map pin, which
-- shows on the world map and is followed on screen. One at a time; the game draws it, nothing here does.
-- value: { m = map, x = 0 to 100, y = 0 to 100, name = text, t = when it was sent }.
local _, ns = ...

local function Say(line) print("Twinmap Forever: " .. line) end

local function InRange(v) return type(v) == "number" and v >= 0 and v <= 100 end

ns.receivers.pin = function(pin)
  if not (C_Map and C_Map.SetUserWaypoint and UiMapPoint) then return end
  if type(pin) ~= "table" then return end -- no pin: one already in the game is the player's to remove
  -- The same pin is told again at every login: a mark the player removed must not come back.
  if pin.t == ns.db.pinAt then return end
  ns.db.pinAt = pin.t
  local name = type(pin.name) == "string" and pin.name or "The point"
  if type(pin.m) ~= "number" or not (InRange(pin.x) and InRange(pin.y)) then return end
  if not C_Map.CanSetUserWaypointOnMap(pin.m) then return Say(name .. " cannot be marked: the game allows no pin on that map.") end
  C_Map.SetUserWaypoint(UiMapPoint.CreateFromCoordinates(pin.m, pin.x / 100, pin.y / 100))
  if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then C_SuperTrack.SetSuperTrackedUserWaypoint(true) end
  Say(name .. " is marked on your map.")
end
