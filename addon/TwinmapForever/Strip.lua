-- The strip: the game-to-app channel. One row of pixels along the top of the window, each cell one
-- of 8 colors (R, G, B fully on or off). The app reads it off the screen.
-- Codec and strip drawing adapted from wow-ai, Copyright (c) 2026 chelinho139, MIT License:
-- full text in THIRD-PARTY-LICENSES.
--
-- Block: [0xC7 0x1B] [protocol] [id hi, lo] [len hi, lo] [payload] [fletcher s1, s2],
-- packed MSB-first into 3-bit cells. The first three bytes never change meaning, so every app
-- version can tell which protocol a strip speaks. The checksum covers protocol to payload.
-- Payload: section US version US part US total US chunk of JSON.
--
-- In "steady" mode a block is drawn twice: as it is, then in negative (every cell 7 - v), so the
-- eye sees a still grey line. The reader tells a negative by its inverted magic bytes.
--
-- Temporary, for the camouflage trials: how long each showing lasts, how many times, what is on
-- screen between blocks and how far apart the two levels of a channel are come from the settings
-- (ns.db.on, neg, gap, cycles, idle, base, amp). The reader takes the levels from the row itself.
local _, ns = ...

-- Tuning knobs.
local CELL = 1        -- physical pixels per cell
local RESERVED = 40   -- bytes of a block that are not section data: header, checksum, record
local REFRESH = 30    -- resend an unchanged section this often: nothing acks and a block can be missed. An app opened after the game asks for everything itself (Inbox.lua)
local START_DELAY = 5 -- seconds after entering the world

local MAGIC1, MAGIC2 = 0xC7, 0x1B
local US = "\31"

---------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end

-- Some values are hidden from addons in combat: they must never be compared or sent.
local function IsSecret(v) return issecretvalue and issecretvalue(v) end
local function Num(v) if type(v) == "number" and not IsSecret(v) then return v end end
local function Str(v) if type(v) == "string" and not IsSecret(v) then return v end end
local function Round(v, step) return math.floor(v / step + 0.5) * step end

local function Json(v)
  if IsSecret(v) then return "null" end
  local t = type(v)
  if t == "string" then
    return '"' .. (v:gsub('[%c"\\]', function(c) return string.format("\\u%04x", c:byte()) end)) .. '"'
  elseif t == "number" then
    if v ~= v or v == math.huge or v == -math.huge then return "null" end
    if v == math.floor(v) then return string.format("%.0f", v) end
    return (string.format("%.2f", v):gsub("%.?0+$", "")) -- two decimals at most, no zeros at the end
  elseif t == "boolean" then
    return tostring(v)
  elseif t == "table" then
    local parts = {}
    if next(v) == nil or v[1] ~= nil then
      for i, x in ipairs(v) do parts[i] = Json(x) end
      return "[" .. table.concat(parts, ",") .. "]"
    end
    -- Sorted keys: change detection compares the text.
    local keys = {}
    for k in pairs(v) do keys[#keys + 1] = k end
    table.sort(keys)
    for i, k in ipairs(keys) do parts[i] = Json(k) .. ":" .. Json(v[k]) end
    return "{" .. table.concat(parts, ",") .. "}"
  end
  return "null"
end
ns.Json = Json -- Sheet.lua tells a change by the text

---------------------------------------------------------------------------
-- Sections: what gets sent. Each builder runs in a pcall.
---------------------------------------------------------------------------

-- Inside a dungeon or a raid the minimap is put at its widest once, on the way in: the app finds
-- the place from its picture, and the more rooms it shows the surer the place. On the way out it
-- goes back to what it was, unless the game or the player has changed it meanwhile. The zoom of
-- before is kept in the saved choices, so reloading the interface inside does not lose it.
local function Widen(inside)
  if not (Minimap and ns.db) then return end
  local zoom = Num(Try(Minimap.GetZoom, Minimap))
  if not zoom then return end
  if inside then
    if ns.db.zoomBefore == nil then
      ns.db.zoomBefore = zoom
      if zoom ~= 0 then Try(Minimap.SetZoom, Minimap, 0) end
    end
  elseif ns.db.zoomBefore ~= nil then
    if zoom == 0 and ns.db.zoomBefore ~= 0 then Try(Minimap.SetZoom, Minimap, ns.db.zoomBefore) end
    ns.db.zoomBefore = nil
  end
end

local function BuildPos()
  local out = { zone = Str(Try(GetZoneText)), sub = Str(Try(GetSubZoneText)) }
  local mapId = Num(Try(C_Map.GetBestMapForUnit, "player"))
  if mapId then
    out.map = mapId
    local p = Try(C_Map.GetPlayerMapPosition, mapId, "player")
    if type(p) == "table" and Num(p.x) and Num(p.y) then
      -- Percent of the zone map, to two decimals: a step or two of the character, so the arrow
      -- of the app moves with every reading instead of once in a few.
      out.x, out.y = Round(p.x * 100, 0.01), Round(p.y * 100, 0.01)
    end
  end
  -- Degrees, anticlockwise from north, in steps of 10: turning on the spot should not send every second.
  local facing = Num(Try(GetPlayerFacing))
  if facing then out.facing = Round(math.deg(facing), 10) % 360 end
  -- Under a roof (a cave, a mine, a house): the app then shows the rooms of the place.
  if Try(IsIndoors) == true then out.indoors = true end
  -- Inside a dungeon, a raid or a battleground: which one. It travels with the position, so the
  -- app never holds the place of one moment with the instance of another.
  local name, kind, _, _, _, _, _, id = Try(GetInstanceInfo)
  Widen(kind == "party" or kind == "raid")
  if Str(kind) and kind ~= "none" and Num(id) then
    local inst = { id = id, name = Str(name), kind = kind }
    -- Where in it, if the game tells addons: yards of the world, north then west, to the yard.
    local north, west = Try(UnitPosition, "player")
    if Num(north) and Num(west) then inst.x, inst.y = Round(north, 1), Round(west, 1) end
    -- In a dungeon or a raid the game tells addons no place: the app finds it from the picture of
    -- the minimap on the screen. So here, and nowhere else, it is told where the minimap is: the
    -- pixels of its middle from the top left of the window, its width, its zoom, and whether it
    -- turns with the character.
    if (kind == "party" or kind == "raid") and Minimap then
      local cx, cy = Try(Minimap.GetCenter, Minimap)
      local width, scale = Num(Try(Minimap.GetWidth, Minimap)), Num(Try(Minimap.GetEffectiveScale, Minimap))
      local _, physH = GetPhysicalScreenSize()
      if Num(cx) and Num(cy) and width and scale and Num(physH) then
        local pixel = scale * physH / 768
        inst.mini = { x = Round(cx * pixel, 1), y = Round(physH - cy * pixel, 1), size = Round(width * pixel, 1), zoom = Num(Try(Minimap.GetZoom, Minimap)) or 0 }
        if Try(GetCVar, "rotateMinimap") == "1" then inst.mini.turns = true end
        -- How many yards it shows from its middle to its edge: it changes with the zoom, and between under a roof and the open.
        local radius = C_Minimap and Num(Try(C_Minimap.GetViewRadius))
        if radius and radius > 0 then inst.mini.r = Round(radius, 0.1) end
      end
    end
    out.inst = inst
  end
  -- In a fight only this section goes out: the app says so, instead of showing the rest as fresh.
  if Try(InCombatLockdown) then out.combat = true end
  return out
end

-- Level and experience, for the bar at the foot of the app's panel. Nothing at the level cap but the level.
-- The side too ("A" or "H"): the app shows only who serves it.
local function BuildChar()
  local level = Num(Try(UnitLevel, "player"))
  if not level then return end
  local faction = Str(Try(UnitFactionGroup, "player"))
  local side = (faction == "Alliance" and "A") or (faction == "Horde" and "H") or nil
  -- Who: name and surname, as the sheet calls the character (Sheet.lua), so the app knows whose sheet is the one in game.
  local name, surname = Try(UnitFullName, "player")
  name, surname = Str(name), Str(surname)
  if name and surname and surname ~= "" then name = name .. " " .. surname end
  return { level = level, xp = Num(Try(UnitXP, "player")), max = Num(Try(UnitXPMax, "player")), rested = Num(Try(GetXPExhaustion)), side = side, name = name }
end

-- name, seconds between checks, builder. combat: also sent during a fight; the rest waits for its end.
-- refresh: seconds after which it is sent again unchanged, when not REFRESH. The position is the
-- heartbeat: the app takes the strip for stopped when none comes for a while. It is also read four
-- times a second: the app's arrow glides from one reading to the next, and counts on this period
-- (PERIOD in the app's glide.ts). first: its block goes out before the ones waiting, so a long
-- section cut in many blocks never holds the arrow back.
local SECTIONS = {
  { name = "pos", period = 0.25, build = BuildPos, combat = true, refresh = 10, first = true },
  { name = "char", period = 2, build = BuildChar },
}
ns.sections = SECTIONS -- other files add their own

---------------------------------------------------------------------------
-- Strip
---------------------------------------------------------------------------

local function Encode(id, payload)
  local len = #payload
  local bytes = { MAGIC1, MAGIC2, ns.PROTOCOL, math.floor(id / 256) % 256, id % 256, math.floor(len / 256) % 256, len % 256 }
  for i = 1, len do bytes[#bytes + 1] = payload:byte(i) end
  local s1, s2 = 0, 0
  for i = 3, #bytes do
    s1 = (s1 + bytes[i]) % 255
    s2 = (s2 + s1) % 255
  end
  bytes[#bytes + 1] = s1
  bytes[#bytes + 1] = s2

  local cells, acc, nbits = {}, 0, 0
  for i = 1, #bytes do
    acc = acc * 256 + bytes[i]
    nbits = nbits + 8
    while nbits >= 3 do
      nbits = nbits - 3
      cells[#cells + 1] = math.floor(acc / 2 ^ nbits) % 8
      acc = acc % 2 ^ nbits
    end
  end
  if nbits > 0 then cells[#cells + 1] = (acc * 2 ^ (3 - nbits)) % 8 end
  return cells
end

local strip, anchored, sized
-- A block's two looks, "plain" and "negative", are painted once and then only shown and hidden:
-- showing one costs nothing, so they can swap every frame. "flat" is one even cell.
local layers = {}

local function RowCells()
  return math.floor(GetPhysicalScreenSize() / CELL)
end

local function Place()
  if not strip then
    strip = CreateFrame("Frame", "TwinmapForeverStrip", UIParent)
    strip:SetFrameStrata("TOOLTIP")
    strip:SetFrameLevel(10000)
    strip:SetIgnoreParentScale(true)
  end
  if not sized then -- again whenever the window changes size
    -- One UI unit = one physical pixel.
    local _, physH = GetPhysicalScreenSize()
    strip:SetScale(768 / physH)
    strip:SetSize(RowCells() * CELL, CELL)
    sized = true
  end
  local point = ns.db.position == "BOTTOM" and "BOTTOMLEFT" or "TOPLEFT"
  if point ~= anchored then
    strip:ClearAllPoints()
    strip:SetPoint(point, UIParent, point, 0, 0)
    anchored = point
  end
end

local function Layer(key)
  local f = layers[key]
  if not f then
    Place()
    f = CreateFrame("Frame", nil, strip)
    f:SetAllPoints(strip)
    f.cells = {}
    layers[key] = f
  end
  return f
end

-- A color channel, off or on, as the game wants it: 0 to 1.
local function Level(on)
  return math.min(255, ns.db.base + (on and ns.db.amp or 0)) / 255
end

-- Every cell touched is time taken from the frame it is drawn in, and a row is thousands of them:
-- so only the cells of the block are painted, only the ones that changed since the last block, and
-- the row past the end of the block is one even cell (the reader never looks there).
local painted = {} -- for each layer: the levels it was painted at, the value of each cell, how many are shown
local function Paint(key, cells)
  local f, row, off, on = Layer(key), RowCells(), Level(false), Level(true)
  local was = painted[key] or { v = {}, used = 0 }
  painted[key] = was
  local n = math.min(#cells, row)
  -- Other levels: every cell again, the ones past the end of this block too when their turn comes.
  -- One cell left at the levels of before and the app reads the whole row wrong.
  if was.off ~= off or was.on ~= on then was.v, was.off, was.on = {}, off, on end
  for i = 1, n do
    local v = cells[i]
    if key == "negative" then v = 7 - v end
    local t = f.cells[i]
    if not t then
      t = f:CreateTexture(nil, "OVERLAY")
      t:SetSize(CELL, CELL)
      t:SetPoint("TOPLEFT", f, "TOPLEFT", (i - 1) * CELL, 0)
      f.cells[i] = t
    end
    if was.v[i] ~= v then
      t:SetColorTexture(v >= 4 and on or off, v % 4 >= 2 and on or off, v % 2 == 1 and on or off, 1)
      was.v[i] = v
    end
  end
  for i = was.used + 1, n do f.cells[i]:Show() end
  for i = n + 1, was.used do f.cells[i]:Hide() end
  was.used = n
  was.rest = was.rest or f:CreateTexture(nil, "OVERLAY")
  if n < row then
    local mid = (off + on) / 2
    was.rest:ClearAllPoints()
    was.rest:SetPoint("TOPLEFT", f, "TOPLEFT", n * CELL, 0)
    was.rest:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", 0, 0)
    was.rest:SetColorTexture(mid, mid, mid, 1)
    was.rest:Show()
  else
    was.rest:Hide()
  end
end

-- Halfway between off and on: what a block and its negative average to.
local function PaintFlat()
  local f = Layer("flat")
  local t = f.cells[1]
  if not t then
    t = f:CreateTexture(nil, "OVERLAY")
    t:SetAllPoints(f)
    f.cells[1] = t
  end
  local mid = (Level(false) + Level(true)) / 2
  t:SetColorTexture(mid, mid, mid, 1)
  t:Show()
end

-- Puts one layer on screen, or none.
local function Show(key)
  Place()
  for k, f in pairs(layers) do
    if k ~= key then f:Hide() end
  end
  if key then
    strip:Show()
    layers[key]:Show()
  else
    strip:Hide()
  end
end

---------------------------------------------------------------------------
-- Scheduler: each section is rebuilt on its period and queued when its JSON
-- changed or REFRESH passed. In combat only the sections marked for it.
---------------------------------------------------------------------------

local queue = {}
local version, blockId = 0, 0
local startAt
local showing, timer = false, 0
local steps = {} -- what is left to show of the block on screen: { layer or "rest", seconds }
local last, paintedCells, paintedStamp -- the last block's cells; what the layers hold now
local negativeDue -- the cells the negative has still to be painted with
local ahead -- the next block, painted before its turn while another look is on screen
local shown -- the look on screen
local paused = false

-- What is on screen while no block is: nothing, or the even line.
local function Rest()
  if ns.db.idle == "hide" then return Show(nil) end
  PaintFlat()
  Show("flat")
end

local function Stale(cells) return cells ~= paintedCells or ns.tuneStamp ~= paintedStamp end

-- Paints a block. Its negative is painted later, in a frame of its own: the two looks of a long
-- block in one frame are a frame the player sees.
local function Prepare(cells)
  Paint("plain", cells)
  negativeDue = cells
  paintedCells, paintedStamp = cells, ns.tuneStamp
end

-- Lines up the showings of a block: as it is, its negative, a rest, as many times as asked.
local function Begin(cells)
  local db = ns.db
  local steady = db.mode ~= "fast"
  if Stale(cells) then Prepare(cells) end
  for _ = 1, math.max(1, db.cycles) do
    steps[#steps + 1] = { "plain", db.on / 1000 }
    if steady then steps[#steps + 1] = { "negative", db.neg / 1000 } end
    if db.gap > 0 then steps[#steps + 1] = { "rest", db.gap / 1000 } end
  end
  last = cells
end

local function Enqueue(s, json)
  local name = s.name
  for i = #queue, 1, -1 do
    if queue[i].name == name then table.remove(queue, i) end
  end
  version = version % 9999 + 1
  local parts, pos = {}, 1
  local chunk = math.floor(RowCells() * 3 / 8) - RESERVED
  while pos <= #json do
    local stop = math.min(pos + chunk - 1, #json)
    -- Never cut a UTF-8 character: each chunk is decoded on its own.
    while stop < #json and stop > pos do
      local b = json:byte(stop + 1)
      if b >= 0x80 and b < 0xC0 then stop = stop - 1 else break end
    end
    parts[#parts + 1] = json:sub(pos, stop)
    pos = stop + 1
  end
  for i, part in ipairs(parts) do
    local item = { name = name, combat = s.combat, text = table.concat({ name, version, i, #parts, part }, US) }
    if s.first then table.insert(queue, i, item) else queue[#queue + 1] = item end
  end
end

-- Queues what a section built, if it changed or its refresh is due.
local function Built(s, value, now)
  if type(value) ~= "table" then return end
  local json = Json(value)
  if json ~= s.json or now >= (s.sentAt or 0) + (s.refresh or REFRESH) then
    s.json, s.sentAt = json, now
    Enqueue(s, json)
  end
end

-- A section marked spread has a long build: it yields where it can stop, and goes on one piece a
-- frame, its JSON in a frame of its own. The same data, a few frames later, and no frame pays it all.
-- Returns true when a piece of a long build ran: the frame has had its share of work.
local function Tick(now, combat)
  local busy = false
  for _, s in ipairs(SECTIONS) do
    if s.combat or not combat then
      if not s.work and now >= (s.nextAt or 0) then
        s.nextAt = now + s.period
        if s.spread then
          s.work = coroutine.create(function()
            local value = s.build()
            coroutine.yield()
            Built(s, value, GetTime())
          end)
        else
          local ok, value = pcall(s.build)
          if ok then Built(s, value, now) end
        end
      end
      if s.work then
        busy = true
        coroutine.resume(s.work) -- an error ends it, as pcall does for the others
        if coroutine.status(s.work) == "dead" then s.work = nil end
      end
    end
  end
  return busy
end

-- The next block to draw: in combat, the first one allowed there.
local function Next(combat)
  for i, item in ipairs(queue) do
    if item.combat or not combat then return table.remove(queue, i) end
  end
end

-- The cells of the next block, if there is one.
local function Take(combat)
  local item = Next(combat)
  if not item then return end
  blockId = (blockId + 1) % 65536
  return Encode(blockId, item.text)
end

-- Everything is sent again, changed or not: asked for when someone new is reading the strip.
function ns.ResendAll()
  for _, s in ipairs(SECTIONS) do s.nextAt, s.json = 0, nil end
end

local driver = CreateFrame("Frame")
driver:RegisterEvent("PLAYER_ENTERING_WORLD")
driver:RegisterEvent("DISPLAY_SIZE_CHANGED")
driver:SetScript("OnEvent", function(_, event)
  if event == "PLAYER_ENTERING_WORLD" then
    startAt = startAt or GetTime() + START_DELAY
    return
  end
  -- The window changed size: the row has another length and another pixel scale. Blocks cut for
  -- the old row are dropped and everything is sent again, cut for the new one.
  sized, paintedCells = nil, nil
  queue, steps, last, ahead, timer = {}, {}, nil, nil, 0
  for _, s in ipairs(SECTIONS) do s.nextAt, s.json = 0, nil end
end)
driver:SetScript("OnUpdate", function(_, elapsed)
  if not startAt then return end
  if ns.db.paused then
    if not paused then
      paused, queue, steps, last, ahead, timer = true, {}, {}, nil, nil, 0
      Show(nil)
      showing, shown = false, nil
    end
    return
  end
  if paused then -- back on: nothing went out meanwhile, so everything is sent again
    paused = false
    for _, s in ipairs(SECTIONS) do s.nextAt, s.json = 0, nil end
  end
  local now = GetTime()
  if now < startAt then return end
  local combat = InCombatLockdown()
  local busy = Tick(now, combat) -- every frame: each section keeps its own period
  timer = timer - elapsed
  -- No frame both paints a long block and shows it: a look is painted out of sight, in a frame
  -- that shows nothing new, and comes on screen in a later one.
  if timer > 0 then
    if busy then return end
    if negativeDue and shown == "plain" then
      Paint("negative", negativeDue)
      negativeDue = nil
    elseif not ahead and #steps == 0 and shown ~= "plain" then
      ahead = Take(combat)
      if ahead then Prepare(ahead) end
    end
    return
  end
  if #steps == 0 then
    local cells = ahead
    ahead = nil
    if not cells and busy and #queue > 0 then return end
    local waited = cells ~= nil
    cells = cells or Take(combat)
    if cells and not waited and Stale(cells) and shown ~= "plain" then
      -- What is on screen stays one frame more: an empty frame between blocks is a visible blink.
      Prepare(cells)
      ahead = cells
      return
    end
    if cells then
      Begin(cells)
    elseif last and ns.db.idle == "repeat" then
      Begin(last)
    end
  end
  local step = table.remove(steps, 1)
  if step then
    if step[1] == "negative" and negativeDue then
      Paint("negative", negativeDue)
      negativeDue = nil
    end
    if step[1] == "rest" then Rest() else Show(step[1]) end
    showing, shown, timer = true, step[1], step[2]
  elseif showing then
    Rest()
    showing, shown = false, nil
  end
end)
