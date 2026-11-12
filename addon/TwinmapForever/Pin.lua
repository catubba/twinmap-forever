-- The pin: a point chosen on Twinmap's map with Send to game. The arrow of ours follows it
-- (Arrow.lua), and it shows as a gold flag on the game's map. One at a time: a new one takes the
-- place of the one before. The game's own map pin is left alone.
-- value: { m = map, x = 0 to 100, y = 0 to 100, name = text, t = when it was sent }.
local _, ns = ...

local function InRange(v) return type(v) == "number" and v >= 0 and v <= 100 end

ns.receivers.pin = function(pin)
  if type(pin) ~= "table" then return end -- no pin: the one followed is the player's to let go
  -- The same pin is told again at every login: a point reached or let go must not come back.
  if pin.t == ns.db.pinAt then return end
  ns.db.pinAt = pin.t
  local name = type(pin.name) == "string" and pin.name or "The point"
  if type(pin.m) ~= "number" or not (InRange(pin.x) and InRange(pin.y)) then return end
  ns.SetTarget("pin", { m = pin.m, x = pin.x / 100, y = pin.y / 100, name = name })
  print("Twinmap Forever: " .. name .. " is followed: the arrow points to it.")
end
