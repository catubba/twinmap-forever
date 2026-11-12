-- The marks: the points saved on Twinmap's map (My pins), drawn on the game's world map as small
-- flags, as many as there are. The app sends each as a part of its own, named "mark" and its place;
-- a part taken away takes its flag away. Alt and a right click on a flag removes it here: the strip
-- tells the app, which forgets the point and takes the part away. Only frames of ours are drawn,
-- and nothing of the game's own map is touched.
-- value: { m = map, x = 0 to 100, y = 0 to 100, name = text }.
-- Placing a frame on the map's canvas adapted from MapUtils, Copyright (c) 2026 D4KiR, GPL-3.0: see THIRD-PARTY-LICENSES.
local _, ns = ...

local SIZE = 16
local IVORY = { 0.953, 0.918, 0.851 } -- the flag of the app's map (marks.ts)

local marks = {} -- part -> { m, x, y (0 to 1), name, continent, world }
local flags = {} -- the frames, used again from one drawing to the next
local hooked = false
local Redraw

-- The marks removed here that the app has not taken away yet, by part. Kept through a /reload.
local function Gone()
  if type(ns.db.marksGone) ~= "table" then ns.db.marksGone = {} end
  return ns.db.marksGone
end

local function InRange(v) return type(v) == "number" and v >= 0 and v <= 100 end

local function Remove(flag)
  if not (flag.part and marks[flag.part]) then return end
  Gone()[flag.part] = true
  print("Twinmap Forever: " .. flag.name .. " is no longer among your pins.")
  Redraw()
end

local function Rect(frame, layer, color, x, y, w, h)
  local t = frame:CreateTexture(nil, layer)
  t:SetColorTexture(color[1], color[2], color[3], 1)
  t:SetPoint("TOPLEFT", frame, "TOPLEFT", x, -y)
  t:SetSize(w, h)
end

-- A pole and its cloth in ivory, on a black edge: the flag of the app's map.
local function NewFlag(canvas)
  local flag = CreateFrame("Frame", nil, canvas)
  flag:SetSize(SIZE, SIZE)
  local black = { 0, 0, 0 }
  Rect(flag, "BACKGROUND", black, 2, 0, 4, 16)
  Rect(flag, "BACKGROUND", black, 2, 0, 13, 9)
  Rect(flag, "ARTWORK", IVORY, 3, 1, 2, 14)
  Rect(flag, "ARTWORK", IVORY, 5, 1, 9, 7)
  flag:EnableMouse(true)
  -- A left click goes through to the map under it, where the game allows saying so.
  if flag.SetPassThroughButtons then pcall(flag.SetPassThroughButtons, flag, "LeftButton") end
  flag:SetScript("OnEnter", function(self)
    if not GameTooltip then return end
    GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
    GameTooltip:SetText(self.name)
    GameTooltip:AddLine("Twinmap pin. Alt and right click removes it.", 1, 1, 1)
    GameTooltip:Show()
  end)
  flag:SetScript("OnLeave", function() if GameTooltip then GameTooltip:Hide() end end)
  flag:SetScript("OnMouseUp", function(self, button)
    if button == "RightButton" and IsAltKeyDown() then Remove(self) end
  end)
  return flag
end

-- Where a mark lies on the map on show, 0 to 1: on its own map as it was sent, on another (the
-- continent, a zone next to it) through its place in the world, where the game tells that.
local function Where(mark, map)
  if mark.m == map then return mark.x, mark.y end
  if mark.world == nil then
    mark.world = false
    if C_Map.GetWorldPosFromMapPos and CreateVector2D then
      local continent, world = C_Map.GetWorldPosFromMapPos(mark.m, CreateVector2D(mark.x, mark.y))
      if continent and world then mark.continent, mark.world = continent, world end
    end
  end
  if not (mark.world and C_Map.GetMapPosFromWorldPos) then return end
  local _, pos = C_Map.GetMapPosFromWorldPos(mark.continent, mark.world, map)
  if not pos then return end
  local x, y = pos:GetXY()
  if type(x) == "number" and type(y) == "number" and x >= 0 and x <= 1 and y >= 0 and y <= 1 then return x, y end
end

local function Draw()
  local world = WorldMapFrame
  if not (world and world.GetCanvas and world.GetMapID) then return end
  if not hooked then
    hooked = true
    if world.OnMapChanged then hooksecurefunc(world, "OnMapChanged", Redraw) end
    if world.OnCanvasScaleChanged then hooksecurefunc(world, "OnCanvasScaleChanged", Redraw) end
    world:HookScript("OnShow", Redraw)
  end
  local n = 0
  local map = world:IsShown() and world:GetMapID()
  if map then
    local canvas, gone = world:GetCanvas(), Gone()
    -- The canvas grows with the zoom: the flag is scaled back, so it keeps its size on the screen.
    local scale = 1 / math.max(world.GetCanvasScale and world:GetCanvasScale() or 1, 0.01)
    for part, mark in pairs(marks) do
      local x, y
      if not gone[part] then x, y = Where(mark, map) end
      if x then
        n = n + 1
        local flag = flags[n] or NewFlag(canvas)
        flags[n] = flag
        flag.part, flag.name = part, mark.name
        flag:SetScale(scale)
        flag:ClearAllPoints()
        flag:SetPoint("CENTER", canvas, "TOPLEFT", canvas:GetWidth() * x / scale, -canvas:GetHeight() * y / scale)
        flag:SetFrameLevel(canvas:GetFrameLevel() + 2400)
        flag:Show()
      end
    end
  end
  for i = n + 1, #flags do flags[i]:Hide() end
end

Redraw = function() pcall(Draw) end

-- Every part named "mark" and a place comes here, with its name: one point each.
ns.receivers.mark = function(value, part)
  if type(part) ~= "string" or part == "mark" then return end
  if type(value) == "table" and type(value.m) == "number" and InRange(value.x) and InRange(value.y) then
    marks[part] = { m = value.m, x = value.x / 100, y = value.y / 100, name = type(value.name) == "string" and value.name or "Pin" }
  else
    marks[part] = nil
    Gone()[part] = nil -- the app has taken it away: nothing is left to tell
  end
  Redraw()
end

-- What the app must know: the marks the player removed in the game, until it takes them away itself.
-- Told as long as there is a mark, also when none is removed: the app must hear that the list is empty again.
ns.sections[#ns.sections + 1] = { name = "marks", period = 1, build = function()
  if not ns.db or (next(marks) == nil and next(Gone()) == nil) then return end
  local gone = {}
  for part in pairs(Gone()) do gone[#gone + 1] = part end
  table.sort(gone)
  return { gone = gone }
end }
