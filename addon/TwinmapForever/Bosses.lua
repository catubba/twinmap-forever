-- The bosses killed in the dungeon or raid the character is in, for the app's map: it draws them
-- as done. The game tells each kill as it happens, with the name of the boss.
-- Section "kills": { map = the instance's map, list = { names } }, sent inside an instance only.
--
-- The list is kept with the saved settings, so a /reload or a walk back in after a wipe does not
-- lose it. It starts again in another instance, when the group resets this one, when a boss already
-- on it is killed again, and after two hours with no kill.
-- ponytail: names, not the numbers of the encounters: the app has its bosses by name. A game in
-- another language names them otherwise and marks none; send the numbers and match the game's own
-- table of encounters if that is ever asked for.
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

local function Killed(name)
  local map = Instance()
  if not (map and ns.db and Str(name)) or name == "" then return end
  local k = Kept(map) or { map = map, list = {} }
  for _, had in ipairs(k.list) do
    -- Twice the same boss: the game tells a kill with two events, a moment apart. Much later, it is another run.
    if had == name then
      if Now() - k.at < 60 then return end
      k.list = {}
      break
    end
  end
  k.list[#k.list + 1] = name
  k.at = Now()
  ns.db.kills = k
end

local frame = CreateFrame("Frame")
-- Not every game has every event: one it does not know is left out.
for _, event in ipairs({ "ENCOUNTER_END", "BOSS_KILL", "CHAT_MSG_SYSTEM" }) do pcall(frame.RegisterEvent, frame, event) end
frame:SetScript("OnEvent", function(_, event, a, name, _, _, success)
  if event == "BOSS_KILL" then
    Killed(name)
  elseif event == "ENCOUNTER_END" then
    if Num(success) == 1 then Killed(name) end
  elseif Str(a) and Str(INSTANCE_RESET_SUCCESS) and ns.db and a:find((INSTANCE_RESET_SUCCESS:gsub("%%s", ".+"))) then
    ns.db.kills = nil -- "<dungeon> has been reset."
  end
end)

ns.sections[#ns.sections + 1] = { name = "kills", period = 1, build = function()
  local map = Instance()
  if not map then return end
  local k, list = Kept(map), {}
  for i, name in ipairs(k and k.list or {}) do list[i] = name end
  table.sort(list)
  return { map = map, list = list }
end }
