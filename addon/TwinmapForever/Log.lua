-- The log of the participation programme: what only the addon can read (Doors.lua, the trainers of Sheet.lua) and the strip
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

-- One entry more: a kind, a short word of ours, and numbers. Anything else among them and the
-- entry is not written.
function ns.Log(kind, ...)
  if not ns.Logging() then return end
  if not entries then
    id = ("%04x%04x%04x%04x"):format(math.random(0, 65535), math.random(0, 65535), math.random(0, 65535), math.random(0, 65535))
    began, entries, size = GetTime(), {}, 0
  end
  local parts = { '"' .. kind .. '"', Text(math.floor(GetTime() - began)) }
  for i = 1, select("#", ...) do
    local text = Text((select(i, ...)))
    if not text then return end
    parts[#parts + 1] = text
  end
  local entry = "[" .. table.concat(parts, ",") .. "]"
  if size + #entry > LARGEST - 100 then return end -- a session alone never outgrows what is kept
  entries[#entries + 1], size = entry, size + #entry + 1
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
