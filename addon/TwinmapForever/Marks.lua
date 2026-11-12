-- The marks: the points saved on Twinmap's map (My pins), drawn on the game's world map as small
-- flags, as many as there are. The app sends each as a part of its own, named "mark" and its place;
-- a part taken away takes its flag away. Alt and a right click on a flag removes it here: the strip
-- tells the app, which forgets the point and takes the part away. Alt and a left click on the map
-- sets a new one: it is drawn at once, told on the strip, and kept here until the app says it has
-- taken it among its pins. A click on a flag has the arrow follow it (Arrow.lua), and the point
-- followed is a flag too, in gold. Only frames of ours are drawn, and nothing of the game's own map is touched.
-- value: { m = map, x = 0 to 100, y = 0 to 100, name = text }.
-- Placing a frame on the map's canvas and taking a click on it adapted from MapUtils, Copyright (c) 2026 D4KiR, GPL-3.0: see THIRD-PARTY-LICENSES.
local _, ns = ...

local SIZE = 16
local IVORY = { 0.953, 0.918, 0.851 } -- the flag of the app's map (marks.ts)
local GOLD = { 1, 0.82, 0 }           -- the one the arrow follows
local WAITING = 20 -- marks set here that the app has not taken yet: more than these are not set

local marks = {} -- part -> { m, x, y (0 to 1), name }: the app's pins
local fresh = {} -- id -> the same, for the marks set here that the app has not taken yet
local flags = {} -- the frames, used again from one drawing to the next
local hooked = false
local Redraw

local function Say(line) print("Twinmap Forever: " .. line) end

-- Kept through a /reload and from one run of the game to the next: the marks removed here that
-- the app has not taken away yet, by part, and the ones set here that it has not taken, by id.
local function Kept(key)
  if type(ns.db[key]) ~= "table" then ns.db[key] = {} end
  return ns.db[key]
end
local function Gone() return Kept("marksGone") end
local function New() return Kept("marksNew") end

local function InRange(v) return type(v) == "number" and v >= 0 and v <= 100 end

local function Mark(value)
  if type(value) == "table" and type(value.m) == "number" and InRange(value.x) and InRange(value.y) then
    return { m = value.m, x = value.x / 100, y = value.y / 100, name = type(value.name) == "string" and value.name or "Pin" }
  end
end

-- Every point there is a flag for: the app's pins not removed here, the ones set here, and the
-- point the arrow follows when it is none of them. fn(point, followed, part, id).
function ns.EachMark(fn)
  local target = ns.Target and ns.Target()
  local met = false
  local function Followed(mark)
    local same = target and mark.m == target.m and math.abs(mark.x - target.x) < 1e-4 and math.abs(mark.y - target.y) < 1e-4 or false
    met = met or same
    return same
  end
  local gone = Gone()
  for part, mark in pairs(marks) do
    if not gone[part] then fn(mark, Followed(mark), part, false) end
  end
  for id, mark in pairs(fresh) do fn(mark, Followed(mark), false, id) end
  if target and not met then fn(target, true, false, false) end
end

local function Remove(flag)
  if flag.id then
    New()[flag.id], fresh[flag.id] = nil, nil
  elseif flag.part and marks[flag.part] then
    Gone()[flag.part] = true
  elseif not flag.followed then
    return
  end
  if flag.followed and ns.Forget then ns.Forget() end
  Say(flag.name .. ((flag.id or flag.part) and " is no longer among your pins." or " is no longer followed."))
  Redraw()
end

local function Rect(frame, layer, color, x, y, w, h)
  local t = frame:CreateTexture(nil, layer)
  t:SetColorTexture(color[1], color[2], color[3], 1)
  t:SetPoint("TOPLEFT", frame, "TOPLEFT", x, -y)
  t:SetSize(w, h)
  return t
end

-- A pole and its cloth on a black edge: the flag of the app's map. mouse: it takes clicks.
function ns.NewFlag(parent, mouse)
  local flag = CreateFrame("Frame", nil, parent)
  flag:SetSize(SIZE, SIZE)
  local black = { 0, 0, 0 }
  Rect(flag, "BACKGROUND", black, 2, 0, 4, 16)
  Rect(flag, "BACKGROUND", black, 2, 0, 13, 9)
  flag.ink = { Rect(flag, "ARTWORK", IVORY, 3, 1, 2, 14), Rect(flag, "ARTWORK", IVORY, 5, 1, 9, 7) }
  if not mouse then return flag end
  flag:EnableMouse(true)
  flag:SetScript("OnEnter", function(self)
    if not GameTooltip then return end
    GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
    GameTooltip:SetText(self.name)
    GameTooltip:AddLine(self.followed and "Twinmap pin, followed. Click stops following it." or "Twinmap pin. Click follows it.", 1, 1, 1)
    GameTooltip:AddLine("Alt and right click removes it.", 1, 1, 1)
    GameTooltip:Show()
  end)
  flag:SetScript("OnLeave", function() if GameTooltip then GameTooltip:Hide() end end)
  flag:SetScript("OnMouseUp", function(self, button)
    if button == "RightButton" and IsAltKeyDown() then
      Remove(self)
    elseif button == "LeftButton" and not IsAltKeyDown() and ns.FollowClick then
      ns.FollowClick(self.mark, self.followed)
    end
  end)
  return flag
end

-- Ivory, or gold for the point the arrow follows.
function ns.TintFlag(flag, followed)
  local color = followed and GOLD or IVORY
  for _, t in ipairs(flag.ink) do t:SetColorTexture(color[1], color[2], color[3], 1) end
end

-- The place of a point in the world, where the game tells it: the continent, and yards north and
-- west. Found once and kept with the point.
function ns.WorldOf(mark)
  if mark.world == nil then
    mark.world = false
    if C_Map.GetWorldPosFromMapPos and CreateVector2D then
      local continent, world = C_Map.GetWorldPosFromMapPos(mark.m, CreateVector2D(mark.x, mark.y))
      if continent and world then
        mark.continent, mark.world = continent, world
        mark.north, mark.west = world:GetXY()
      end
    end
  end
  if mark.world then return mark.continent, mark.north, mark.west end
end

-- Where a mark lies on the map on show, 0 to 1: on its own map as it was sent, on another (the
-- continent, a zone next to it) through its place in the world.
local function Where(mark, map)
  if mark.m == map then return mark.x, mark.y end
  if not (ns.WorldOf(mark) and C_Map.GetMapPosFromWorldPos) then return end
  local _, pos = C_Map.GetMapPosFromWorldPos(mark.continent, mark.world, map)
  if not pos then return end
  local x, y = pos:GetXY()
  if type(x) == "number" and type(y) == "number" and x >= 0 and x <= 1 and y >= 0 and y <= 1 then return x, y end
end

-- Alt and a left click on the map: a mark of ours on that point, named as the app names a bare
-- point, by its zone and its coordinates. Gives back whether the click was ours, as the map asks.
local function OnMapClick(map, button, x, y)
  if button ~= "LeftButton" or not IsAltKeyDown() then return false end
  local m = map and map.GetMapID and map:GetMapID()
  if type(m) ~= "number" or type(x) ~= "number" or type(y) ~= "number" or x < 0 or x > 1 or y < 0 or y > 1 then return false end
  local new, count = New(), 0
  for _ in pairs(new) do count = count + 1 end
  if count >= WAITING then
    Say("open Twinmap before setting more pins: it has not taken the last " .. WAITING .. " yet.")
    return true
  end
  local px, py = math.floor(x * 10000 + 0.5) / 100, math.floor(y * 10000 + 0.5) / 100
  local info = C_Map.GetMapInfo and C_Map.GetMapInfo(m)
  local name = ("%s %.1f, %.1f"):format(type(info) == "table" and type(info.name) == "string" and info.name or "Pin", px, py)
  local id = ("%dx%dy%d"):format(m, math.floor(px * 100 + 0.5), math.floor(py * 100 + 0.5))
  new[id] = { m = m, x = px, y = py, name = name }
  fresh[id] = Mark(new[id])
  Say(name .. " is among your pins.")
  Redraw()
  return true
end

local function Draw()
  local world = WorldMapFrame
  if not (world and world.GetCanvas and world.GetMapID) then return end
  if not hooked then
    hooked = true
    if world.OnMapChanged then hooksecurefunc(world, "OnMapChanged", Redraw) end
    if world.OnCanvasScaleChanged then hooksecurefunc(world, "OnCanvasScaleChanged", Redraw) end
    world:HookScript("OnShow", Redraw)
    if world.AddCanvasClickHandler then
      world:AddCanvasClickHandler(function(map, button, x, y)
        local ok, ours = pcall(OnMapClick, map, button, x, y)
        return ok and ours
      end, 100)
    end
  end
  local n = 0
  local map = world:IsShown() and world:GetMapID()
  if map then
    local canvas = world:GetCanvas()
    -- The canvas grows with the zoom: the flag is scaled back, so it keeps its size on the screen.
    local scale = 1 / math.max(world.GetCanvasScale and world:GetCanvasScale() or 1, 0.01)
    ns.EachMark(function(mark, followed, part, id)
      local x, y = Where(mark, map)
      if not x then return end
      n = n + 1
      local flag = flags[n] or ns.NewFlag(canvas, true)
      flags[n] = flag
      flag.part, flag.id, flag.name, flag.mark, flag.followed = part, id, mark.name, mark, followed
      ns.TintFlag(flag, followed)
      flag:SetScale(scale)
      flag:ClearAllPoints()
      flag:SetPoint("CENTER", canvas, "TOPLEFT", canvas:GetWidth() * x / scale, -canvas:GetHeight() * y / scale)
      flag:SetFrameLevel(canvas:GetFrameLevel() + (followed and 2401 or 2400))
      flag:Show()
    end)
  end
  for i = n + 1, #flags do flags[i]:Hide() end
end

Redraw = function() pcall(Draw) end
ns.MarksChanged = Redraw -- the point followed changed: its flag turns gold, the old one ivory

-- Every part named "mark" and a place comes here, with its name: one point each.
ns.receivers.mark = function(value, part)
  if type(part) ~= "string" or part == "mark" then return end
  marks[part] = Mark(value)
  if not marks[part] then Gone()[part] = nil end -- the app has taken it away: nothing is left to tell
  Redraw()
end

-- The marks set here that the app now has among its pins, by id: from now on they are its own.
ns.receivers.taken = function(ids)
  if type(ids) ~= "table" then return end
  local new = New()
  for _, id in ipairs(ids) do
    if type(id) == "string" then new[id], fresh[id] = nil, nil end
  end
  Redraw()
end

-- What the app must know: the marks the player removed in the game, until it takes them away
-- itself, and the ones set in the game, until it takes them. Told as long as there is a mark, also
-- when both lists are empty: the app must hear that they are empty again.
ns.sections[#ns.sections + 1] = { name = "marks", period = 1, build = function()
  if not ns.db or (next(marks) == nil and next(Gone()) == nil and next(New()) == nil) then return end
  local gone, new = {}, {}
  for part in pairs(Gone()) do gone[#gone + 1] = part end
  table.sort(gone)
  for id, mark in pairs(New()) do new[#new + 1] = { id = id, m = mark.m, x = mark.x, y = mark.y, name = mark.name } end
  table.sort(new, function(a, b) return a.id < b.id end)
  return { gone = gone, new = new }
end }

-- At login the marks set here and not taken yet are drawn again, and the map is asked for its clicks.
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:SetScript("OnEvent", function()
  for id, value in pairs(New()) do fresh[id] = fresh[id] or Mark(value) end
  Redraw()
end)
