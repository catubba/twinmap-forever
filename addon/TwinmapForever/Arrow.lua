-- The arrow: one point is followed at a time, and an arrow of ours on the screen turns towards it,
-- with its name and how far it is. The point is the next stop of the route when there is one;
-- otherwise the point sent from the app (Send to game) or the flag clicked on the game's map. The
-- flags of ours that are near show on the minimap too. All of it is frames of ours: the game's own
-- map pin and its arrow are never touched. Where the game tells no place (inside a dungeon, or the
-- point is on another continent) the arrow says so and points nowhere.
-- The arrow is dragged where the player wants it; a right click on it stops following. The strip
-- tells the app which point is followed by itself, and the app can ask to let it go.
-- How far and which way from the character's place in the world, and how many yards the minimap
-- shows, adapted from MapUtils, Copyright (c) 2026 D4KiR, GPL-3.0: see THIRD-PARTY-LICENSES.
local _, ns = ...

local ARRIVE = 15     -- yards from the point at which the character is there
local NEAR = 30       -- yards from the point at which the arrow turns gold
local TURN = 0.05     -- seconds between two turns of the arrow
local MINI = 0.1      -- seconds between two looks at the minimap
local MINI_SIZE = 0.7 -- a flag on the minimap, next to one on the map
-- Yards across the minimap at each zoom, outdoors, where the game does not tell its radius.
local ACROSS = { 466.67, 400, 333.33, 266.67, 200, 133.33 }
local IVORY = { 0.953, 0.918, 0.851 }
local GOLD = { 1, 0.82, 0 }
local GREY = { 0.62, 0.62, 0.62 }
local WHITE = { 1, 1, 1 }
-- The arrow, white on a black edge and pointing up, tinted ivory or gold; and the dashed ring where
-- the game tells no direction. Both drawn by addon/art.js.
local ART = "Interface\\AddOns\\TwinmapForever\\Arrow"
local NO_WAY = "Interface\\AddOns\\TwinmapForever\\NoWay"

local targets = {} -- "route", "pin" -> { m, x, y (0 to 1), name }
local arrow, minis = nil, {}
local atan2 = math.atan2 or math.atan

local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end

-- The point followed: the stop of the route comes first.
function ns.Target() return targets.route or targets.pin end
-- The point chosen by itself, whether or not a route comes before it.
function ns.PinFollowed() return targets.pin end

-- kind: "route" for the stop the route is at, "pin" for a point chosen by itself. nil: none.
function ns.SetTarget(kind, point)
  targets[kind] = point
  -- The point chosen by itself is kept through a /reload; the route keeps its own place.
  if kind == "pin" and ns.db then ns.db.following = point and { m = point.m, x = point.x, y = point.y, name = point.name } or nil end
  if ns.MarksChanged then ns.MarksChanged() end
end

-- The point chosen by itself is followed no longer, with no word said.
function ns.Forget() ns.SetTarget("pin", nil) end

-- A click on a flag of the map: it is followed, or no longer if it was.
function ns.FollowClick(mark, followed)
  if followed then
    if targets.route then return ns.Say("arrow.nextStop") end
    ns.Say("arrow.unfollowed", { name = mark.name })
    return ns.Forget()
  end
  ns.SetTarget("pin", { m = mark.m, x = mark.x, y = mark.y, name = mark.name })
  ns.Say(targets.route and "arrow.afterRoute" or "arrow.followed", { name = mark.name })
end

-- The app asks to let go of the point followed by itself: a number new each time, so that the same
-- asking told again at a login lets go of nothing.
ns.receivers.unfollow = function(asked)
  if asked == nil or asked == ns.db.unfollowSeen then return end
  ns.db.unfollowSeen = asked
  if targets.pin then
    ns.Say("arrow.unfollowed", { name = targets.pin.name })
    ns.Forget()
  end
end

-- What the app must know: the point followed by itself, in percent of its map, or that there is
-- none. Told from the first time a point is followed on, also when there is none: the app must hear it go.
ns.sections[#ns.sections + 1] = { name = "follow", period = 1, build = function()
  if not ns.db then return end
  local point = targets.pin
  if point then ns.db.followTold = true end
  if not ns.db.followTold then return end
  return point and { m = point.m, x = point.x * 100, y = point.y * 100, name = point.name } or {}
end }

-- The character's place in the world: the continent, yards north and west, and the way it faces.
local function Here()
  if not (UnitPosition and GetPlayerFacing) then return end
  local north, west, _, continent = UnitPosition("player")
  local facing = Num(GetPlayerFacing())
  if Num(north) and Num(west) and facing then return continent, north, west, facing end
end

-- How far the point is, in yards, and which way: radians to the left of where the character faces.
local function Reading(point)
  local continent, north, west = ns.WorldOf(point)
  local here, myNorth, myWest, facing = Here()
  if not north or not myNorth or here ~= continent then return end
  local dn, dw = north - myNorth, west - myWest
  return math.sqrt(dn * dn + dw * dw), atan2(dw, dn) - facing
end

local function NewArrow()
  local f = CreateFrame("Frame", "TwinmapForeverArrow", UIParent)
  f:SetSize(64, 64)
  local at = ns.db.arrowAt
  if type(at) == "table" and type(at[1]) == "string" then
    f:SetPoint(at[1], UIParent, at[2] or at[1], at[3] or 0, at[4] or 0)
  else
    f:SetPoint("TOP", UIParent, "TOP", 0, -140)
  end
  f:SetMovable(true)
  f:EnableMouse(true)
  f:RegisterForDrag("LeftButton")
  f:SetClampedToScreen(true)
  f:SetScript("OnDragStart", function(self) self:StartMoving() end)
  f:SetScript("OnDragStop", function(self)
    self:StopMovingOrSizing()
    local point, _, relative, x, y = self:GetPoint(1)
    if type(point) == "string" then ns.db.arrowAt = { point, relative, x, y } end
  end)
  f:SetScript("OnMouseUp", function(_, button)
    if button ~= "RightButton" then return end
    if targets.route then return ns.Say("arrow.onRoute") end
    if targets.pin then
      ns.Say("arrow.unfollowed", { name = targets.pin.name })
      ns.Forget()
    end
  end)
  f.art = f:CreateTexture(nil, "ARTWORK")
  f.art:SetTexture(ART)
  f.art:SetAllPoints()
  f.noWay = f:CreateTexture(nil, "ARTWORK")
  f.noWay:SetTexture(NO_WAY)
  f.noWay:SetAllPoints()
  f.name = f:CreateFontString(nil, "OVERLAY", "GameFontNormal")
  f.name:SetPoint("TOP", f, "BOTTOM", 0, -2)
  f.far = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
  f.far:SetPoint("TOP", f.name, "BOTTOM", 0, -2)
  return f
end

-- Turns the arrow to the left by so many radians, in gold when near; nil puts the ring in its place.
local function Turn(turn, near)
  arrow.art:SetShown(turn ~= nil)
  arrow.noWay:SetShown(turn == nil)
  if not turn then return end
  local tint = near and GOLD or IVORY
  arrow.art:SetVertexColor(tint[1], tint[2], tint[3])
  arrow.art:SetRotation(turn)
end

local function Point()
  local point = ns.Target()
  if not point then
    if arrow then arrow:Hide() end
    return
  end
  arrow = arrow or NewArrow()
  local yards, turn = Reading(point)
  if yards and yards <= ARRIVE and not targets.route then
    ns.Say("arrow.arrived", { name = point.name })
    arrow:Hide()
    return ns.Forget()
  end
  -- Shortest Path guides to this very point, with its own arrow and line: ours stays out of the way.
  if ns.Guiding and ns.Guiding() then return arrow:Hide() end
  arrow.name:SetText(point.name)
  -- Under the name: how far, and on a route which stop of how many.
  local far = yards and ns.T("arrow.yards", { yards = math.floor(yards + 0.5) }) or ns.L["arrow.noWay"]
  if targets.route and ns.RouteAt then
    local route, index = ns.RouteAt()
    if route then far = ns.T("arrow.stopOf", { far = far, index = index, count = #route.stops }) end
  end
  local color = yards and WHITE or GREY
  arrow.far:SetText(far)
  arrow.far:SetTextColor(color[1], color[2], color[3])
  Turn(turn, yards and yards <= NEAR)
  arrow:Show()
end

-- The flags near enough, on the minimap: north is up, unless the minimap turns with the character.
local function Minis()
  local n = 0
  local here, myNorth, myWest, facing = Here()
  if Minimap and Minimap.GetWidth and myNorth then
    local radius = C_Minimap and C_Minimap.GetViewRadius and Num(C_Minimap.GetViewRadius())
    if not radius or radius <= 0 then radius = (ACROSS[(Num(Minimap:GetZoom()) or 0) + 1] or ACROSS[1]) / 2 end
    local turns = GetCVar and GetCVar("rotateMinimap") == "1"
    local cos, sin = turns and math.cos(facing) or 1, turns and math.sin(facing) or 0
    local half = Minimap:GetWidth() / 2
    ns.EachMark(function(mark, followed)
      local continent, north, west = ns.WorldOf(mark)
      if not north or continent ~= here then return end
      local dn, dw = north - myNorth, west - myWest
      if dn * dn + dw * dw > radius * radius * 0.85 then return end -- inside the round edge, with the flag whole
      local x, y = -dw * cos + dn * sin, dw * sin + dn * cos
      n = n + 1
      local flag = minis[n] or ns.NewFlag(Minimap, false)
      minis[n] = flag
      flag.mini, flag.name = true, mark.name
      ns.TintFlag(flag, followed)
      flag:SetScale(MINI_SIZE)
      flag:ClearAllPoints()
      flag:SetPoint("CENTER", Minimap, "CENTER", x / radius * half / MINI_SIZE, y / radius * half / MINI_SIZE)
      flag:SetFrameLevel(Minimap:GetFrameLevel() + 5)
      flag:Show()
    end)
  end
  for i = n + 1, #minis do minis[i]:Hide() end
end

local sinceTurn, sinceMini = 0, 0
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:SetScript("OnEvent", function()
  -- The point followed before the /reload is followed again.
  local kept = ns.db.following
  if not targets.pin and type(kept) == "table" and type(kept.m) == "number" and type(kept.x) == "number" and type(kept.y) == "number" then
    ns.SetTarget("pin", { m = kept.m, x = kept.x, y = kept.y, name = type(kept.name) == "string" and kept.name or ns.L["pin.default"] })
  end
end)
frame:SetScript("OnUpdate", function(_, elapsed)
  if not ns.db then return end
  sinceTurn, sinceMini = sinceTurn + elapsed, sinceMini + elapsed
  if sinceTurn >= TURN then
    sinceTurn = 0
    pcall(Point)
  end
  if sinceMini >= MINI then
    sinceMini = 0
    pcall(Minis)
  end
end)
