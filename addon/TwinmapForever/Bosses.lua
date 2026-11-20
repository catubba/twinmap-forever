-- The bosses killed in the dungeon or raid the character is in, for the app's map: it draws them
-- as done. The game tells each kill as it happens, with the name of the boss.
-- Section "kills": { map = the instance's map, list = { names }, ids = { numbers of the fights },
-- rares = { numbers of the rare creatures targeted }, slain = { those of them seen dead } }, sent inside an
-- instance only. The rares tell the participation programme which of them were there in a run, and where
-- (the app's bosses.ts). The names are in the game's language; the numbers are the same in every one,
-- and the app finds by them the boss of a game in another language.
--
-- The list is kept with the saved settings, so a /reload or a walk back in after a wipe does not
-- lose it. It starts again in another instance, when the group resets this one, when a boss already
-- on it is killed again, and after two hours with no kill.
local _, ns = ...

local KEPT = 2 * 60 * 60 -- seconds
local Now = time or GetTime

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function IsSecret(v) return issecretvalue and issecretvalue(v) end
local function Num(v) if type(v) == "number" and not IsSecret(v) then return v end end
local function Str(v) if type(v) == "string" and not IsSecret(v) then return v end end

-- The map of the instance the character is in, or nothing in the open world.
local function Instance()
  local _, kind, _, _, _, _, _, id = Try(GetInstanceInfo)
  if Str(kind) and kind ~= "none" then return Num(id) end
end

-- The kills kept, if they are of this instance and not too old.
local function Kept(map)
  local k = ns.db and ns.db.kills
  if type(k) ~= "table" or k.map ~= map or type(k.list) ~= "table" or Now() - (Num(k.at) or 0) > KEPT then return end
  return k
end

local function Killed(name, id)
  local map = Instance()
  if not (map and ns.db and Str(name)) or name == "" then return end
  local k = Kept(map) or { map = map, list = {} }
  for _, had in ipairs(k.list) do
    -- Twice the same boss: the game tells a kill with two events, a moment apart. Much later, it is another run.
    if had == name then
      if Now() - k.at < 60 then return end
      k.list, k.ids = {}, {}
      break
    end
  end
  k.list[#k.list + 1] = name
  k.ids = type(k.ids) == "table" and k.ids or {} -- kept by an addon before the numbers
  if Num(id) then k.ids[#k.ids + 1] = id end
  k.at = Now()
  ns.db.kills = k
end

-- One number more in a list of the kills of this map, once.
local function Add(map, field, npc)
  local k = Kept(map) or { map = map, list = {}, at = Now() }
  k[field] = type(k[field]) == "table" and k[field] or {}
  for _, had in ipairs(k[field]) do
    if had == npc then return end
  end
  k[field][#k[field] + 1] = npc
  ns.db.kills = k
end

-- A rare creature targeted in here, as the game classes it, is kept with the kills; and once more when it is seen dead.
local function Met()
  local map, guid, class = Instance(), Str(Try(UnitGUID, "target")), Str(Try(UnitClassification, "target"))
  local npc = map and guid and (class == "rare" or class == "rareelite") and tonumber(guid:match("^Creature%-%d+%-%d+%-%d+%-%d+%-(%d+)%-"))
  if not (npc and ns.db) then return end
  Add(map, "rares", npc)
  if Try(UnitIsDead, "target") == true then Add(map, "slain", npc) end
end

local frame = CreateFrame("Frame")
-- Not every game has every event: one it does not know is left out.
for _, event in ipairs({ "ENCOUNTER_END", "BOSS_KILL", "CHAT_MSG_SYSTEM", "PLAYER_TARGET_CHANGED", "UNIT_HEALTH" }) do pcall(frame.RegisterEvent, frame, event) end
frame:SetScript("OnEvent", function(_, event, a, name, _, _, success)
  if event == "PLAYER_TARGET_CHANGED" or (event == "UNIT_HEALTH" and a == "target") then
    Met()
  elseif event == "BOSS_KILL" then
    Killed(name, a)
  elseif event == "ENCOUNTER_END" then
    if Num(success) == 1 then Killed(name, a) end
  elseif Str(a) and Str(INSTANCE_RESET_SUCCESS) and ns.db and a:find((INSTANCE_RESET_SUCCESS:gsub("%%s", ".+"))) then
    ns.db.kills = nil -- "<dungeon> has been reset."
  end
end)

ns.sections[#ns.sections + 1] = { name = "kills", period = 1, build = function()
  local map = Instance()
  if not map then return end
  local k, out = Kept(map), { map = map }
  for _, field in ipairs({ "list", "ids", "rares", "slain" }) do
    out[field] = {}
    for i, v in ipairs(k and type(k[field]) == "table" and k[field] or {}) do out[field][i] = v end
    table.sort(out[field])
  end
  return out
end }
