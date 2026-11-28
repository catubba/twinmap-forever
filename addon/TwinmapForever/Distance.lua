-- Inside a dungeon or a raid the game tells addons no place: the app finds it from the picture of
-- the minimap. With the participation programme on, and only then, the place is also found here, from
-- the distance the game tells to a flight master that is super-tracked: one flight master at a time,
-- several in turn, each with its place in the world (FlightMasters.lua), and the point where all those
-- distances meet, height included. It goes with the position (inst.far, Strip.lua), and the app
-- writes it beside each picture of the minimap it keeps for the programme: the pictures get their
-- true place, even where the minimap is not read.
--
-- Super-tracking a flight master takes the game's arrow from what the player tracked: the arrow is
-- hidden while it runs and what was tracked is given back after. It stops for the rest of the
-- dungeon when the player tracks something else, and for the rest of the session when the game hides
-- the distance, a call fails, or too few flight masters answer.
local _, ns = ...

local PIN = Enum and Enum.SuperTrackingMapPinType and Enum.SuperTrackingMapPinType.TaxiNode or 2
local SETTLE = 0.3 -- seconds after a switch before the distance is taken: the game is a few frames late
local GIVE_UP = 1.2 -- seconds with no new value: that flight master gives nothing
local RUN = 12 -- yards a second: a value that moved less than this since the switch may still be the old one
local CENSUS, ACTIVE = 12, 6 -- flight masters tried on the way in, and those then taken in turn
local KEEP = 2 -- seconds a distance stays in the place
local SOLVE_EVERY = 0.25
local FRESH = 1 -- seconds a place is told after it was found
local GOOD = 5 -- yards: a place whose distances miss it by more is not told
local LOST = 4 -- places in a row missing by more than GOOD: start again
local FAST = 40 -- yards a second: a faster move between two places is a jump, not a run
local TRIES = 5 -- censuses with no place before it gives up for the session

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) and v == v then return v end end

local running, broken, yielded
local census, active, pool, at
local node, switchedAt, stale
local last = {}
local fix, foundAt, misses, vx, vy = nil, 0, 0, 0, 0
local tries = 0
local saved
local solveAt = 0

-- 3x3 by Cramer's rule: m row by row, b the right side.
local function Solve3(m, b)
  local det = m[1] * (m[5] * m[9] - m[6] * m[8]) - m[2] * (m[4] * m[9] - m[6] * m[7]) + m[3] * (m[4] * m[8] - m[5] * m[7])
  if det == 0 or det ~= det then return end
  local function D(c1, c2, c3)
    return c1[1] * (c2[2] * c3[3] - c2[3] * c3[2]) - c2[1] * (c1[2] * c3[3] - c1[3] * c3[2]) + c3[1] * (c1[2] * c2[3] - c1[3] * c2[2])
  end
  local a, b2, c = { m[1], m[4], m[7] }, { m[2], m[5], m[8] }, { m[3], m[6], m[9] }
  return D(b, b2, c) / det, D(a, b, c) / det, D(a, b2, b) / det
end

-- Least squares on the differences of the squared distances: needs no place to start from.
local function Linear(list)
  local f = list[1]
  local k = f.x * f.x + f.y * f.y + f.z * f.z - f.d * f.d
  local m, b = { 0, 0, 0, 0, 0, 0, 0, 0, 0 }, { 0, 0, 0 }
  for i = 2, #list do
    local p = list[i]
    local r = { 2 * (p.x - f.x), 2 * (p.y - f.y), 2 * (p.z - f.z) }
    local c = p.x * p.x + p.y * p.y + p.z * p.z - p.d * p.d - k
    for a = 1, 3 do
      b[a] = b[a] + r[a] * c
      for q = 1, 3 do m[(a - 1) * 3 + q] = m[(a - 1) * 3 + q] + r[a] * r[q] end
    end
  end
  return Solve3(m, b)
end

-- Gauss-Newton on the distances themselves, from a place; with how far, on the average, they miss it.
local function Refine(x, y, z, list)
  for _ = 1, 5 do
    local m, b = { 0, 0, 0, 0, 0, 0, 0, 0, 0 }, { 0, 0, 0 }
    for _, p in ipairs(list) do
      local dx, dy, dz = x - p.x, y - p.y, z - p.z
      local r = math.sqrt(dx * dx + dy * dy + dz * dz)
      if r > 0 then
        local u = { dx / r, dy / r, dz / r }
        for a = 1, 3 do
          b[a] = b[a] - u[a] * (r - p.d)
          for q = 1, 3 do m[(a - 1) * 3 + q] = m[(a - 1) * 3 + q] + u[a] * u[q] end
        end
      end
    end
    local sx, sy, sz = Solve3(m, b)
    if not sx then break end
    x, y, z = x + sx, y + sy, z + sz
    if math.abs(sx) + math.abs(sy) + math.abs(sz) < 0.01 then break end
  end
  local sum = 0
  for _, p in ipairs(list) do sum = sum + (math.sqrt((x - p.x) ^ 2 + (y - p.y) ^ 2 + (z - p.z) ^ 2) - p.d) ^ 2 end
  return x, y, z, math.sqrt(sum / #list)
end

local function Place(list, from)
  if #list < 4 then return end
  if from then
    local x, y, z, miss = Refine(from.x, from.y, from.z, list)
    if miss <= GOOD then return x, y, z, miss end
  end
  -- No place to start from, or it led astray (a jump, a fall): from nothing.
  local x, y, z = Linear(list)
  if x then return Refine(x, y, z, list) end
end

-- The distances of the flight masters named, those not older than KEEP when now is given; on the way,
-- each moved by what the character ran since it was read, along the line from its flight master.
local function Distances(ids, now)
  local list = {}
  for _, i in ipairs(ids) do
    local seen, n = last[i], ns.FLIGHT_MASTERS[i]
    if seen and (not now or now - seen.t <= KEEP) then
      local d = seen.d
      if now and fix then
        local dx, dy = fix.x - n[2], fix.y - n[3]
        local r = math.sqrt(dx * dx + dy * dy + (fix.z - n[4]) ^ 2)
        if r > 0 then d = d + (dx * vx + dy * vy) / r * (now - seen.t) end
      end
      list[#list + 1] = { x = n[2], y = n[3], z = n[4], d = d }
    end
  end
  return list
end

-- Those that answered, the ACTIVE farthest apart as seen from the place: each next one the direction
-- farthest from those taken, starting from the one most above or below.
local function Spread(answered, from)
  local dirs = {}
  for _, i in ipairs(answered) do
    local n = ns.FLIGHT_MASTERS[i]
    local dx, dy, dz = n[2] - from.x, n[3] - from.y, n[4] - from.z
    local r = math.sqrt(dx * dx + dy * dy + dz * dz)
    if r > 0 then dirs[#dirs + 1] = { i = i, dx / r, dy / r, dz / r } end
  end
  table.sort(dirs, function(a, b) return math.abs(a[3]) > math.abs(b[3]) end)
  local chosen = { table.remove(dirs, 1) }
  while #chosen < ACTIVE and #dirs > 0 do
    local best, bestAt = -1, 1
    for k, d in ipairs(dirs) do
      local nearest = math.huge
      for _, c in ipairs(chosen) do nearest = math.min(nearest, (d[1] - c[1]) ^ 2 + (d[2] - c[2]) ^ 2 + (d[3] - c[3]) ^ 2) end
      if nearest > best then best, bestAt = nearest, k end
    end
    chosen[#chosen + 1] = table.remove(dirs, bestAt)
  end
  local ids = {}
  for _, c in ipairs(chosen) do ids[#ids + 1] = c.i end
  return ids
end

local function Hide(hidden)
  if SuperTrackedFrame then Try(SuperTrackedFrame.SetAlpha, SuperTrackedFrame, hidden and 0 or 1) end
end

-- chosen: the player chose what to track meanwhile, and that stays as it is.
local function Stop(chosen)
  if not running then return end
  running, fix, node = false, nil, nil
  if chosen == true then
    saved = nil
    return Hide(false)
  end
  Try(C_SuperTrack.ClearSuperTrackedMapPin)
  if saved then
    if saved.kind and saved.id then Try(C_SuperTrack.SetSuperTrackedMapPin, saved.kind, saved.id) end
    if saved.waypoint then Try(C_SuperTrack.SetSuperTrackedUserWaypoint, true) end
    if saved.quest and saved.quest ~= 0 then Try(C_SuperTrack.SetSuperTrackedQuestID, saved.quest) end
  end
  saved = nil
  Hide(false)
end

local function Switch(now)
  node = census and census[at] or active[at]
  stale = Num(Try(C_Navigation.GetDistance)) or 0
  if not pcall(C_SuperTrack.SetSuperTrackedMapPin, PIN, ns.FLIGHT_MASTERS[node][1]) then
    broken = true
    return Stop()
  end
  switchedAt = now
end

-- On the way in, or after losing the place: the first CENSUS flight masters (then the others, in
-- their order) one after the other, from nothing.
local function Begin(now)
  census, active, pool, at, last, fix, misses = {}, nil, {}, 1, {}, nil, 0
  for i = 1, #ns.FLIGHT_MASTERS do
    if i <= CENSUS then census[#census + 1] = i else pool[#pool + 1] = i end
  end
  Switch(now)
end

local function Next(now)
  if census then
    if at < #census then
      at = at + 1
      return Switch(now)
    end
    local answered = {}
    for _, i in ipairs(census) do if last[i] then answered[#answered + 1] = i end end
    local x, y, z, miss = Place(Distances(answered))
    -- The distances of a census are a few seconds apart: a character running meanwhile misses more.
    if not x or miss > 3 * GOOD then
      tries = tries + 1
      if tries >= TRIES then
        broken = true -- the game gives too little here: nothing more this session
        return Stop()
      end
      return Begin(now)
    end
    fix, foundAt, census, at = { x = x, y = y, z = z, r = miss }, now, nil, 0
    active = Spread(answered, fix)
    for _, i in ipairs(answered) do
      local taken = false
      for _, a in ipairs(active) do taken = taken or a == i end
      if not taken then table.insert(pool, 1, i) end
    end
  end
  at = at % #active + 1
  Switch(now)
end

-- Whether what the game tracks is still ours: the player may have chosen a quest or a pin meanwhile.
local function StillOurs()
  local kind, id = Try(C_SuperTrack.GetSuperTrackedMapPin)
  if kind ~= nil and not (kind == PIN and id == ns.FLIGHT_MASTERS[node][1]) then return false end
  local quest = Num(Try(C_SuperTrack.GetSuperTrackedQuestID))
  return not (quest and quest ~= 0 and quest ~= (saved and saved.quest))
end

local function Read(now)
  if not StillOurs() then
    yielded = select(8, Try(GetInstanceInfo))
    return Stop(true)
  end
  local d = Try(C_Navigation.GetDistance)
  if issecretvalue and issecretvalue(d) then
    broken = true
    return Stop()
  end
  d = Num(d)
  local waited = now - switchedAt
  local fresh = d and d > 0 and math.abs(d - stale) > 0.5 + RUN * waited
  -- With a place, the distance expected from it: a value near it is the new one as soon as it comes,
  -- so a round of the flight masters takes a few frames each instead of SETTLE.
  local near = false
  if fresh and fix and not census then
    local n, ahead = ns.FLIGHT_MASTERS[node], now - foundAt
    local expected = math.sqrt((fix.x + vx * ahead - n[2]) ^ 2 + (fix.y + vy * ahead - n[3]) ^ 2 + (fix.z - n[4]) ^ 2)
    near = math.abs(d - expected) <= 3 + 2 * fix.r + 15 * ahead
  end
  if fresh and (near or waited >= SETTLE) then
    last[node] = { d = d, t = now }
    Next(now)
  elseif waited >= GIVE_UP then
    -- No answer: in turn, its place goes to the next one not yet tried.
    if active and #pool > 0 then
      table.insert(pool, active[at])
      active[at] = table.remove(pool, 1)
    end
    Next(now)
  end
end

local function Solve(now)
  if census or now - solveAt < SOLVE_EVERY then return end
  solveAt = now
  local x, y, z, miss = Place(Distances(active, now), fix)
  if not x or miss > GOOD then
    misses = misses + 1
    if misses >= LOST then Begin(now) end
    return
  end
  if fix and now > foundAt then
    local sx, sy = (x - fix.x) / (now - foundAt), (y - fix.y) / (now - foundAt)
    if math.sqrt(sx * sx + sy * sy) > FAST then sx, sy = 0, 0 end
    vx, vy = (vx + sx) / 2, (vy + sy) / 2
  end
  fix, foundAt, misses = { x = x, y = y, z = z, r = miss }, now, 0
end

local function Wanted()
  if broken or not (ns.Logging and ns.Logging()) or not ns.FLIGHT_MASTERS then return false end
  if not (C_SuperTrack and C_SuperTrack.SetSuperTrackedMapPin and C_Navigation and C_Navigation.GetDistance) then return false end
  local _, kind, _, _, _, _, _, map = Try(GetInstanceInfo)
  if kind ~= "party" and kind ~= "raid" then
    yielded = nil
    return false
  end
  return map ~= yielded and Num((Try(UnitPosition, "player"))) == nil
end

local function Start(now)
  running, vx, vy, tries = true, 0, 0, 0
  saved = {}
  saved.quest = Num(Try(C_SuperTrack.GetSuperTrackedQuestID))
  saved.waypoint = Try(C_SuperTrack.IsSuperTrackingUserWaypoint) == true
  saved.kind, saved.id = Try(C_SuperTrack.GetSuperTrackedMapPin)
  Begin(now)
end

local lookedAt = 0
local frame = CreateFrame("Frame")
frame:SetScript("OnUpdate", function()
  local now = GetTime()
  if now - lookedAt >= 1 then
    lookedAt = now
    local wanted = Wanted()
    if wanted and not running then Start(now) elseif running and not wanted then Stop() end
  end
  if not running then return end
  Hide(true)
  Read(now)
  if running then Solve(now) end
end)
frame:RegisterEvent("PLAYER_LOGOUT")
frame:SetScript("OnEvent", function() Stop() end)

-- The place found from the distances, while fresh and sure: north, west and height in yards of the
-- instance, and how far the distances miss it on the average. nil otherwise.
function ns.Far()
  if not (running and fix and not census and GetTime() - foundAt <= FRESH) then return end
  return fix.x, fix.y, fix.z, fix.r
end
