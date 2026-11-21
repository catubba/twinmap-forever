-- The log of the participation programme: what only the addon can read (Doors.lua, Finds.lua, the trainers of Sheet.lua) and the strip
-- does not carry. Off until the app says yes (the part "log" of the inbox, kept with the rest of
-- it): the player turns the programme on in Twinmap's settings, and the yes holds with the app
-- closed too, until a no arrives.
--
-- One session is one run of the interface, from a login or a /reload to the next. Its entries are
-- held here and written into the saved settings when the game saves them, at logout or /reload: a
-- game that crashes loses the session. The app reads that file, sends the sessions it has not sent
-- yet, and takes nothing away from it: the oldest go by themselves, past MOST sessions or LARGEST bytes.
--
-- An entry is a kind and numbers, nothing else: no text can get into the log, so no name of a
-- player or of a guild and no identifier of a player. A session is kept as the JSON the app sends:
--   {"log":1,"id":"16 hex digits drawn anew","v":"version of the addon","e":[["door",seconds,...],...]}
-- seconds: since the first entry of the session, never the time of day.
local _, ns = ...

local MOST, LARGEST = 10, 200000 -- same as server/src/index.ts

ns.receivers = ns.receivers or {}

local id, began, entries, size

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end

-- The game's number of the dungeon or raid the character is in; nil in the open world.
function ns.Inside()
  local _, kind, _, _, _, _, _, map = Try(GetInstanceInfo)
  return (kind == "party" or kind == "raid") and Num(map) or nil
end

-- Where the character is, for an entry: the game's number of the map the place is counted on, x and
-- y on it from 0 to 1 from its top left; then, where the game tells them, the continent and the place
-- in yards of the world, north then west: the map the game picks for a place may be one of a cave or
-- a city, and the yards are the same on every map. nil where the game does not tell.
function ns.Place()
  local map = Num(Try(C_Map.GetBestMapForUnit, "player"))
  local p = map and Try(C_Map.GetPlayerMapPosition, map, "player")
  if not (type(p) == "table" and Num(p.x) and Num(p.y)) then return nil end
  local north, west, _, continent = Try(UnitPosition, "player")
  if Num(north) and Num(west) and Num(continent) then return map, p.x, p.y, continent, north, west end
  return map, p.x, p.y
end

-- Whether the last word from the app was a yes.
function ns.Logging()
  local inbox = ns.db and ns.db.inbox
  return type(inbox) == "table" and type(inbox.parts) == "table" and inbox.parts.log == true
end

-- A number as JSON, four decimals at the most; nil for anything that is not a plain number.
local function Text(v)
  if type(v) ~= "number" or (issecretvalue and issecretvalue(v)) or v ~= v or v <= -1e9 or v >= 1e9 then return nil end
  return (("%.4f"):format(v):gsub("%.?0+$", ""))
end

-- The session's entry made of these parts, after its kind and its second.
local function Append(kind, parts)
  if not entries then
    id = ("%04x%04x%04x%04x"):format(math.random(0, 65535), math.random(0, 65535), math.random(0, 65535), math.random(0, 65535))
    began, entries, size = GetTime(), {}, 0
  end
  local entry = "[" .. table.concat({ '"' .. kind .. '"', Text(math.floor(GetTime() - began)), unpack(parts) }, ",") .. "]"
  if size + #entry > LARGEST - 100 then return end -- a session alone never outgrows what is kept
  entries[#entries + 1], size = entry, size + #entry + 1
end

-- One entry more: a kind, a short word of ours, and numbers. Anything else among them and the
-- entry is not written.
function ns.Log(kind, ...)
  if not ns.Logging() then return end
  local parts = {}
  for i = 1, select("#", ...) do
    local text = Text((select(i, ...)))
    if not text then return end
    parts[#parts + 1] = text
  end
  Append(kind, parts)
end

-- The one text the log takes: a creature's name, as the game's server gives it (M15-F24), never a
-- player's. Printable, with no quote, no backslash and nothing below a space, 64 bytes at most:
-- anything else and it is not written. The server checks it again.
function ns.LogName(npc, name)
  if not ns.Logging() or not Text(npc) or type(name) ~= "string" or (issecretvalue and issecretvalue(name)) then return end
  if #name == 0 or #name > 64 or name:find('[%c"\\]') then return end
  Append("name", { Text(npc), '"' .. name .. '"' })
end

-- A no, or a yes never heard: nothing is held and nothing stays in the saved settings.
ns.receivers.log = function(on)
  if on == true then return end
  entries = nil
  if ns.db then ns.db.log = nil end
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_LOGOUT")
frame:SetScript("OnEvent", function()
  if not (entries and #entries > 0 and ns.Logging()) then return end
  local kept, total = type(ns.db.log) == "table" and ns.db.log or {}, 0
  kept[#kept + 1] = '{"log":1,"id":"' .. id .. '","v":"' .. ns.VERSION .. '","e":[' .. table.concat(entries, ",") .. "]}"
  for _, session in ipairs(kept) do total = total + #session end
  while #kept > MOST or (total > LARGEST and #kept > 1) do total = total - #table.remove(kept, 1) end
  ns.db.log, entries = kept, nil
end)
