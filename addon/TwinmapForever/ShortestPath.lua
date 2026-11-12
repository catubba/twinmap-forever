-- Shortest Path Forever, when the player has it: the journey it guides, read through its public API
-- and told to the app on the strip, whoever started it (Twinmap, the player, another addon).
-- Without Shortest Path nothing is read and nothing is sent.
-- And what Twinmap follows (the route, or the point chosen by itself) is given to Shortest Path to
-- guide, under the name "Twinmap": its line and its arrow take the place of our arrow.
-- The journey is asked for again every few seconds instead of on Shortest Path's notices: it answers
-- "loading" while it searches its first plan, and no notice says when the plan is there.
local _, ns = ...

local LEGS = 12 -- legs told at most: a journey across the world has fewer
local TEXT = 60 -- letters of a leg's text, and of the goal's name

local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end
local function Str(v) if type(v) == "string" and not (issecretvalue and issecretvalue(v)) then return v:sub(1, TEXT) end end

-- What the app is told: the journey, { loading = true } while its plan is searched, or that there
-- is none. Told from the first journey on, also when there is none: the app must hear it end.
local function Build()
  local api = ShortestPathForever and ShortestPathForever.API
  if not (ns.db and type(api) == "table" and type(api.Journey) == "function") then return end
  local ok, journey, why = pcall(api.Journey)
  if not ok then return end
  if type(journey) ~= "table" or type(journey.goal) ~= "table" then
    if why == "loading" then ns.db.journeyTold = true end
    if not ns.db.journeyTold then return end
    return why == "loading" and { loading = true } or {}
  end
  ns.db.journeyTold = true
  local goal, legs = journey.goal, {}
  for i, leg in ipairs(type(journey.legs) == "table" and journey.legs or {}) do
    if i > LEGS then break end
    legs[i] = { mode = Str(leg.mode), text = Str(leg.text), s = math.floor(Num(leg.seconds) or 0) }
  end
  local left = Num(journey.secondsLeft) or 0
  return {
    owner = Str(journey.owner),
    name = Str(goal.title),
    -- The goal as Shortest Path names it: a map of the game (often the continent's) and percent of it.
    m = Num(goal.map), x = Num(goal.x) and goal.x * 100, y = Num(goal.y) and goal.y * 100,
    legs = legs,
    -- In steps of 5 seconds: a walk must not send the strip a block every second.
    left = math.floor(left / 5 + 0.5) * 5,
  }
end

ns.sections[#ns.sections + 1] = { name = "journey", period = 2, build = Build }

---------------------------------------------------------------------------
-- Guiding: what Twinmap follows is what Shortest Path is asked to guide. The route comes first, from
-- the stop it is at to its end; with no route, the point chosen by itself. It is asked once for each
-- route and each point: a journey the player clears in Shortest Path, or that another addon
-- replaces, is not asked for again, and our arrow comes back. Shortest Path refuses in combat and
-- while it loads: the asking is tried again until it is taken.
---------------------------------------------------------------------------

local OWNER = "Twinmap"
local SYNC = 1 -- seconds between two looks

local given     -- what Shortest Path was last given: { key, base = the stop of our route its first stop is }
local live = false -- Shortest Path guides what it was given, now

-- Our arrow hides and the route waits for Shortest Path to say a stop is reached.
function ns.Guiding() return live end

-- What is to be guided: a name for it, its stops as Shortest Path takes them, and the stop of our route the first one is.
local function Wanted()
  local route, index = ns.RouteAt()
  if route and route.stops[index] then
    local stops = {}
    for i = index, #route.stops do
      local s = route.stops[i]
      stops[#stops + 1] = { map = s.m, x = s.x / 100, y = s.y / 100, title = s.name }
    end
    return "route " .. route.t, stops, index
  end
  local pin = ns.PinFollowed()
  if pin then return ("pin %s %s %s"):format(pin.m, pin.x, pin.y), { { map = pin.m, x = pin.x, y = pin.y, title = pin.name } } end
end

local function Sync()
  local api = ShortestPathForever and ShortestPathForever.API
  if not (ns.db and type(api) == "table" and type(api.NavigateRoute) == "function" and type(api.CurrentStop) == "function") then
    live = false
    return
  end
  if InCombatLockdown() then return end
  local key, stops, base = Wanted()
  if not key then
    if given and live and type(api.Cancel) == "function" then api.Cancel(OWNER) end
    given, live = nil, false
    return
  end
  local at = given and given.key == key and Num(api.CurrentStop(OWNER))
  if at then
    live = true
    -- Shortest Path reached a stop of the route: ours moves on with it.
    if given.base then ns.RouteReached(given.base + at - 1) end
    local _, index = ns.RouteAt()
    -- A skip in Twinmap put our route ahead of the journey: the journey is given again from there.
    if not (given.base and index and index > given.base + at - 1) then return end
    key, stops, base = Wanted()
    if not key then return end
  elseif given and given.key == key then
    if not live then return end -- cleared by the player or replaced: not asked again
    live = false
    -- The journey is over. At its goal, what Twinmap follows is done too.
    if type(api.Ended) == "function" and api.Ended(OWNER) == "arrived" then
      if given.base then
        local route = ns.RouteAt()
        if route then ns.RouteReached(#route.stops + 1) end
      else
        ns.Forget()
      end
    end
    return
  end
  if api.NavigateRoute(OWNER, stops) == true then given, live = { key = key, base = base }, true end
end

local since = 0
local guide = CreateFrame("Frame")
guide:SetScript("OnUpdate", function(_, elapsed)
  since = since + elapsed
  if since < SYNC then return end
  since = 0
  if not pcall(Sync) then live = false end
end)

---------------------------------------------------------------------------
-- The whole way: where each leg of the journey starts and ends, and the points of a flight or a
-- boat's crossing. Shortest Path's public API does not tell them (asked for: a stopgap until it
-- does). While the game's world map is open, Shortest Path keeps the legs it draws, with their
-- points in yards of the world, on the frame that paints its line there: a field named paths.
-- That field is read, nothing of Shortest Path is called or changed. It is read only while the map
-- is open, when it is fresh; the last reading is kept and told, and the app checks it still fits
-- the journey. A Shortest Path that keeps its legs elsewhere gives no reading, and nothing is lost.
---------------------------------------------------------------------------

local MOST = 40    -- points told of a leg at most
local FRAMES = 4000 -- frames under the world map looked at, at most
local painters = {} -- the frames found holding paths: looked at first the next time
local read          -- the last reading: { legs = { { mode = "flight", p = { continent, north, west, ... } } }, m, x, y = the goal }

-- Every frame under `frame`, a few levels down, that holds a table named paths.
local function Find(frame, depth, found, seen)
  if depth > 7 or seen.n > FRAMES then return end
  seen.n = seen.n + 1
  if type(rawget(frame, "paths")) == "table" then found[#found + 1] = frame end
  if type(frame.GetChildren) ~= "function" then return end
  for _, child in ipairs({ frame:GetChildren() }) do
    if type(child) == "table" then Find(child, depth + 1, found, seen) end
  end
end

-- The legs a frame holds, when they are the journey's: as many at least, of the same modes in the same order.
local function Legs(frame, journey)
  local paths = rawget(frame, "paths")
  if type(paths) ~= "table" or #journey.legs == 0 or #paths < #journey.legs then return end
  local legs = {}
  for i, leg in ipairs(journey.legs) do
    local path = paths[i]
    if type(path) ~= "table" or path.mode ~= leg.mode or type(path.points) ~= "table" or #path.points < 2 then return end
    -- A walk is told by its two ends: the app finds the way between them itself, from where the character is now.
    local points, p = path.points, {}
    local every = path.mode == "walk" and #points - 1 or math.ceil(#points / MOST)
    for at = 1, #points do
      if at == 1 or at == #points or (at - 1) % every == 0 then
        local point = points[at]
        if type(point) ~= "table" or not (Num(point.map) and Num(point.x) and Num(point.y)) then return end
        p[#p + 1], p[#p + 2], p[#p + 3] = point.map, math.floor(point.x + 0.5), math.floor(point.y + 0.5)
      end
    end
    legs[i] = { mode = path.mode, p = p }
  end
  return legs
end

local function Read(journey)
  for _, frame in ipairs(painters) do
    local legs = Legs(frame, journey)
    if legs then return legs end
  end
  local found = {}
  Find(WorldMapFrame, 0, found, { n = 0 })
  painters = found
  for _, frame in ipairs(found) do
    local legs = Legs(frame, journey)
    if legs then return legs end
  end
end

ns.sections[#ns.sections + 1] = { name = "line", period = 2, build = function()
  local api = ShortestPathForever and ShortestPathForever.API
  if not (ns.db and type(api) == "table" and type(api.Journey) == "function") then return end
  local ok, journey, why = pcall(api.Journey)
  if not ok then return end
  if type(journey) ~= "table" or type(journey.legs) ~= "table" or type(journey.goal) ~= "table" then
    -- No journey: the reading goes with it. While its plan is searched the last one stays.
    if why ~= "loading" then read = nil end
  elseif WorldMapFrame and WorldMapFrame:IsShown() then
    local found, legs = pcall(Read, journey)
    -- With the goal it leads to, as the journey itself is told: the app knows a reading of another journey by it.
    local goal = journey.goal
    if found and legs and Num(goal.map) and Num(goal.x) and Num(goal.y) then read = { legs = legs, m = goal.map, x = goal.x * 100, y = goal.y * 100 } end
  end
  if read then ns.db.lineTold = true end
  if not ns.db.lineTold then return end
  return read or {}
end }
