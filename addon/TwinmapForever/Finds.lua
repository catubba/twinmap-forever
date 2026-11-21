-- What the player meets in the open world, for the log (Log.lua): the creatures targeted or under
-- the mouse, the objects looted, and where an objective of a quest moves on. Every one is written
-- down, once a session for each; the app sends only those the player's QuestieDB does not have,
-- or has with no place (app/src/main/gamelog.ts). Nothing is read while the log is off, nor
-- inside a dungeon or a raid.
-- Entry "npc": the creature's number, then the place of the character as ns.Place tells it (Log.lua).
-- Entry "object": the object's number, then the place. On Forever the tooltip of an object has no
-- number: an object is known by its loot, whose source the game tells.
-- Entry "quest": the quest's number, the objective's (from 1), then the place.
-- Entry "talk": an NPC the player talked to (its window opened: gossip, vendor, quest, trainer,
-- flights, bank), the creature's number, then the place: a few steps from the NPC itself. The app
-- sends it only where QuestieDB lacks the NPC or has it somewhere else (M15-F24).
local _, ns = ...

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end
local function Str(v) if type(v) == "string" and not (issecretvalue and issecretvalue(v)) then return v end end

local written = {} -- "npc 1234" -> true: once a session

-- A creature or an object, once a session, where the character is.
local function Once(kind, id)
  local key = kind .. " " .. id
  if written[key] or not ns.Logging() or ns.Inside() then return end
  local place = { ns.Place() }
  if not place[1] then return end
  written[key] = true
  ns.Log(kind, id, unpack(place))
end

-- The number in a GUID of one of these kinds ("Creature", "GameObject"); players, pets and the rest are left alone.
local function Entry(guid, kinds)
  guid = Str(guid)
  if not guid then return nil end
  local kind, id = guid:match("^(%a+)%-%d+%-%d+%-%d+%-%d+%-(%d+)%-")
  return kind and kinds[kind] and tonumber(id) or nil
end
local CREATURES, OBJECTS = { Creature = true, Vehicle = true }, { GameObject = true }

local function Npc(unit)
  local id = Entry(Try(UnitGUID, unit), CREATURES)
  if id then Once("npc", id) end
end

-- What each objective of each quest in the log has done so far: one that moves on is written down.
local done = {} -- quest -> { fulfilled, ... }
local function Objectives()
  local count = C_QuestLog and C_QuestLog.GetNumQuestLogEntries or GetNumQuestLogEntries
  for i = 1, count and Num(Try(count)) or 0 do
    local info = Try(C_QuestLog and C_QuestLog.GetInfo, i)
    local quest = type(info) == "table" and not info.isHeader and Num(info.questID)
    if quest then
      local now = {}
      for k, objective in ipairs(Try(C_QuestLog.GetQuestObjectives, quest) or {}) do
        now[k] = type(objective) == "table" and (Num(objective.numFulfilled) or (objective.finished and 1 or 0)) or 0
        local before = done[quest] and done[quest][k]
        if before and now[k] > before and ns.Logging() and not ns.Inside() then
          local place = { ns.Place() }
          if place[1] then ns.Log("quest", quest, k, unpack(place)) end -- every step: a quest's objective is where it moves on
        end
      end
      done[quest] = now
    end
  end
end

-- The windows an NPC opens when the player talks to it; while one is open the game calls the NPC "npc".
local TALKS = { "GOSSIP_SHOW", "MERCHANT_SHOW", "QUEST_GREETING", "QUEST_DETAIL", "QUEST_PROGRESS", "QUEST_COMPLETE", "TRAINER_SHOW", "TAXIMAP_OPENED", "BANKFRAME_OPENED" }
local talking = {}
for _, event in ipairs(TALKS) do talking[event] = true end

local frame = CreateFrame("Frame")
for _, event in ipairs({ "PLAYER_TARGET_CHANGED", "UPDATE_MOUSEOVER_UNIT", "LOOT_OPENED", "QUEST_LOG_UPDATE", unpack(TALKS) }) do
  pcall(frame.RegisterEvent, frame, event)
end
frame:SetScript("OnEvent", function(_, event)
  if talking[event] then
    local id = Entry(Try(UnitGUID, "npc"), CREATURES)
    if id then Once("talk", id) end
  elseif event == "PLAYER_TARGET_CHANGED" then
    Npc("target")
  elseif event == "UPDATE_MOUSEOVER_UNIT" then
    Npc("mouseover")
  elseif event == "LOOT_OPENED" then
    for slot = 1, Num(Try(GetNumLootItems)) or 0 do
      local sources = { Try(GetLootSourceInfo, slot) } -- guid, count, guid, count, ...
      for i = 1, #sources, 2 do
        local id = Entry(sources[i], OBJECTS)
        if id then Once("object", id) end
      end
    end
  else
    Objectives()
  end
end)
