-- The route: stops chosen on Twinmap's map, walked in order. The next stop is marked with the game's
-- own map pin, followed on screen; when the character is at it, the one after takes its place. The
-- strip tells the app how far along the route is. Only places are read, and only the pin is set.
-- value: { t = when it was sent, at = the stop to start from, stops = { { m = map, x, y = 0 to 100,
-- rx, ry = how near counts as there, in percent of that map, name = text } } }.
local _, ns = ...

local CHECK = 0.5 -- seconds between looks at where the character is

local route   -- the route the app sent, checked
local index   -- the stop to walk to; past the last one: the route is done
local acc = 0

local function Say(line) print("Twinmap Forever: " .. line) end

local function Mark(stop)
  if not (C_Map and C_Map.SetUserWaypoint and UiMapPoint) then return end
  if not stop then return C_Map.ClearUserWaypoint() end
  if not C_Map.CanSetUserWaypointOnMap(stop.m) then return Say(stop.name .. " cannot be marked: the game allows no pin on that map.") end
  C_Map.SetUserWaypoint(UiMapPoint.CreateFromCoordinates(stop.m, stop.x / 100, stop.y / 100))
  if C_SuperTrack and C_SuperTrack.SetSuperTrackedUserWaypoint then C_SuperTrack.SetSuperTrackedUserWaypoint(true) end
end

-- quiet: the place on the route is being taken up again after a login, not reached.
local function Go(i, quiet)
  index = math.max(1, math.min(i, #route.stops + 1))
  ns.db.routeAt = { t = route.t, at = index }
  local stop = route.stops[index]
  pcall(Mark, stop)
  if quiet then return end
  if stop then Say(("stop %d of %d, %s."):format(index, #route.stops, stop.name)) else Say("route complete.") end
end

local function Checked(value)
  if type(value) ~= "table" or type(value.t) ~= "number" or type(value.stops) ~= "table" or #value.stops == 0 then return end
  local stops = {}
  for i, s in ipairs(value.stops) do
    local ok = type(s) == "table"
    for _, key in ipairs({ "m", "x", "y", "rx", "ry" }) do ok = ok and type(s[key]) == "number" end
    if not ok or s.rx <= 0 or s.ry <= 0 then return end
    stops[i] = { m = s.m, x = s.x, y = s.y, rx = s.rx, ry = s.ry, name = type(s.name) == "string" and s.name or ("Stop " .. i) }
  end
  return { t = value.t, at = type(value.at) == "number" and value.at or 1, stops = stops }
end

ns.receivers.route = function(value)
  local new = Checked(value)
  if not new then
    if route then pcall(Mark, nil) end -- ours goes with the route
    route, index, ns.db.routeAt = nil, nil, nil
    return
  end
  if route and route.t == new.t then return end
  route = new
  -- The same route again, at a login: the place on it is kept. A new one starts where the app says.
  local kept = ns.db.routeAt
  if type(kept) == "table" and kept.t == new.t and type(kept.at) == "number" then return Go(kept.at, true) end
  Go(new.at)
end

-- The app skipped ahead on the route the game has: only forwards, and only on that very route.
ns.receivers.step = function(value)
  if route and type(value) == "table" and value.t == route.t and type(value.at) == "number" and value.at > index then Go(value.at) end
end

-- /twinmap skip: on to the stop after. Gives back whether there was a route to skip on.
function ns.SkipStop()
  if not route or index > #route.stops then return false end
  Go(index + 1)
  return true
end

ns.sections[#ns.sections + 1] = { name = "route", period = 1, build = function()
  if route then return { t = route.t, at = index, of = #route.stops } end
end }

local frame = CreateFrame("Frame")
frame:SetScript("OnUpdate", function(_, elapsed)
  acc = acc + elapsed
  if acc < CHECK then return end
  acc = 0
  local stop = route and route.stops[index]
  if not stop then return end
  -- The character's place on the stop's own map: nothing where it is not on that map, or in an instance.
  local ok, here = pcall(C_Map.GetPlayerMapPosition, stop.m, "player")
  local x, y = ok and here and here.x, ok and here and here.y
  if type(x) ~= "number" or type(y) ~= "number" or (issecretvalue and (issecretvalue(x) or issecretvalue(y))) then return end
  local dx, dy = (x * 100 - stop.x) / stop.rx, (y * 100 - stop.y) / stop.ry
  if dx * dx + dy * dy <= 1 then Go(index + 1) end
end)
