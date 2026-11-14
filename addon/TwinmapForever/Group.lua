-- The companions of the group, for the app's map: who they are and where. The game tells the
-- place of a companion in the open world, on the map that companion is on, but from afar only
-- every five seconds or so. So each Twinmap also tells its own place to the group, on the hidden
-- channel addons have, and a place told that way is believed while it is fresh. Inside a dungeon
-- or a raid the game tells no place, of oneself or of anyone: a companion there is sent without one.
-- Section "group": { list = { { n = name, c = class, r = role, m = map, x = 0 to 100, y = 0 to 100 }, ... } }.
-- The role is "T", "H" or "D" (tank, healer, damage), and missing where the group gave none.
local _, ns = ...

local PREFIX = "TwinmapF" -- 16 letters at most
-- ponytail: one message every 3 seconds, the pace tried in the real game (10 go out at once, then
-- the game refuses; how fast that refills was not measured). Faster once it is.
local SAY_EVERY = 3
local FRESH = 8 -- seconds a place told by a companion is believed over the one the game gives

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function IsSecret(v) return issecretvalue and issecretvalue(v) end
local function Num(v) if type(v) == "number" and not IsSecret(v) then return v end end
local function Str(v) if type(v) == "string" and not IsSecret(v) then return v end end
local ROLES = { TANK = "T", HEALER = "H", DAMAGER = "D" }
local function Percent(v) return math.floor(v * 10000 + 0.5) / 100 end

-- Where a unit is: its zone map and the percent of it, or nothing.
local function PlaceOf(unit)
  local map = Num(Try(C_Map.GetBestMapForUnit, unit))
  if not map then return end
  local p = Try(C_Map.GetPlayerMapPosition, map, unit)
  if type(p) == "table" and Num(p.x) and Num(p.y) then return map, Percent(p.x), Percent(p.y) end
end

-- A name as one text. Forever gives it in two parts, and names the sender of a message as both
-- with a space between; elsewhere the second part is a realm, after a hyphen.
local function NameOf(unit)
  local first, second = Try(UnitName, unit)
  if not Str(first) then return end
  return Str(second) and second ~= "" and first .. " " .. second or first
end

local told = {} -- by name: the place a companion's Twinmap told, and when
local said, nextSay = nil, 0
local had = false -- the app holds companions: it is to be told when there are none left

-- Tells the group where the character is, when that changed.
local function Say(now)
  if now < nextSay or not Try(IsInGroup) then return end
  local map, x, y = PlaceOf("player")
  if not map then return end
  local text = ("1 %d %.2f %.2f"):format(map, x, y)
  if text == said then return end
  said, nextSay = text, now + SAY_EVERY
  Try(C_ChatInfo and C_ChatInfo.SendAddonMessage, PREFIX, text, Try(IsInRaid) and "RAID" or "PARTY")
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGIN")
frame:RegisterEvent("CHAT_MSG_ADDON")
frame:SetScript("OnEvent", function(_, event, prefix, text, _, sender)
  if event == "PLAYER_LOGIN" then
    Try(C_ChatInfo and C_ChatInfo.RegisterAddonMessagePrefix, PREFIX)
    return
  end
  if IsSecret(prefix) or prefix ~= PREFIX or not (Str(text) and Str(sender)) then return end
  local map, x, y = text:match("^1 (%d+) ([%d.]+) ([%d.]+)$")
  map, x, y = tonumber(map), tonumber(x), tonumber(y)
  if not (map and x and y) or x > 100 or y > 100 then return end
  told[(sender:gsub("%-", " "))] = { m = map, x = x, y = y, at = GetTime() }
end)

local function BuildGroup()
  local now = GetTime()
  Say(now)
  local list = {}
  local grouped = Try(IsInGroup)
  -- Alone, and nothing to take back: nothing goes out.
  if not grouped and not had then return end
  had = grouped and true or false
  if grouped then
    local raid = Try(IsInRaid)
    for i = 1, raid and 40 or 4 do
      local unit = (raid and "raid" or "party") .. i
      local name = Try(UnitExists, unit) and not Try(UnitIsUnit, unit, "player") and NameOf(unit)
      if name then
        local entry = { n = name, c = Str(select(2, Try(UnitClass, unit))), r = ROLES[Str(Try(UnitGroupRolesAssigned, unit)) or ""] }
        local heard = told[name]
        if heard and now - heard.at <= FRESH then
          entry.m, entry.x, entry.y = heard.m, heard.x, heard.y
        else
          entry.m, entry.x, entry.y = PlaceOf(unit)
        end
        list[#list + 1] = entry
      end
    end
  end
  table.sort(list, function(a, b) return a.n < b.n end)
  return { list = list }
end

-- Twice a second, in a fight too: a companion near by moves as fast as the character does.
ns.sections[#ns.sections + 1] = { name = "group", period = 0.5, build = BuildGroup, combat = true }
