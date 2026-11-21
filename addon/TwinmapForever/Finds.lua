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
-- And all the game tells of a creature met, for the app to send only of one QuestieDB lacks or has
-- with no place (M15-F24), once a session each: "about" its number, level (-1: unknown to the
-- player), classification (CLASSIFICATIONS), reaction to the player (1 hated to 8 exalted), creature
-- type (TYPES) and faction (1 Alliance, 2 Horde, 0 none); "name" its number and its name, the one text
-- of the log; "opens" its number and the window it opened (WINDOWS); "sells" its number, an item's,
-- the price in copper as shown, how many come at once and how many are left (-1 no limit); "gives"
-- and "takes" its number and a quest's. A creature of a player (pet, totem, guardian, companion) is
-- no creature of the world: none of it is written.
local _, ns = ...

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end
local function Str(v) if type(v) == "string" and not (issecretvalue and issecretvalue(v)) then return v end end

local written = {} -- "npc 1234" -> true: once a session
local TYPES = { Beast = 1, Dragonkin = 2, Demon = 3, Elemental = 4, Giant = 5, Undead = 6, Humanoid = 7, Critter = 8, Mechanical = 9, ["Not specified"] = 10, Totem = 11, ["Non-combat Pet"] = 12, ["Gas Cloud"] = 13, ["Wild Pet"] = 14, Aberration = 15 }
local CLASSIFICATIONS = { normal = 0, elite = 1, rareelite = 2, rare = 3, worldboss = 4, trivial = 5, minus = 6 }
local WINDOWS = { GOSSIP_SHOW = 1, MERCHANT_SHOW = 2, QUEST_GREETING = 3, QUEST_DETAIL = 3, QUEST_PROGRESS = 3, QUEST_COMPLETE = 3, TRAINER_SHOW = 4, TAXIMAP_OPENED = 5, BANKFRAME_OPENED = 6 }

-- A creature or an object, once a session, where the character is.
local function Once(kind, id)
  local key = kind .. " " .. id
  if written[key] or not ns.Logging() or ns.Inside() then return end
  local place = { ns.Place() }
  if not place[1] then return end
  written[key] = true
  ns.Log(kind, id, unpack(place))
end

-- Once a session for this key, in the open world, while the log is on.
local function First(key)
  if written[key] or not ns.Logging() or ns.Inside() then return false end
  written[key] = true
  return true
end

-- A creature of a player: a pet, a totem, a guardian, a companion.
-- ponytail: the type by its English name; a client in another language leaves companions and totems to UnitPlayerControlled.
local function Players(unit)
  if Try(UnitPlayerControlled, unit) then return true end
  local kind = Str(Try(UnitCreatureType, unit))
  return kind == "Totem" or kind == "Non-combat Pet" or kind == "Wild Pet"
end

-- What the game tells of a creature: once a session.
local function About(unit, id)
  if not First("about " .. id) then return end
  local faction = Str(Try(UnitFactionGroup, unit))
  ns.Log("about", id, Num(Try(UnitLevel, unit)) or -1, CLASSIFICATIONS[Str(Try(UnitClassification, unit)) or ""] or -1, Num(Try(UnitReaction, unit, "player")) or 0,
    TYPES[Str(Try(UnitCreatureType, unit)) or ""] or 0, faction == "Alliance" and 1 or faction == "Horde" and 2 or 0)
  ns.LogName(id, Str(Try(UnitName, unit)))
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
  if not id or Players(unit) then return end
  Once("npc", id)
  About(unit, id)
end

-- The NPC whose window opened: where the player stands, what it is, which window, and what that window shows.
local function Talk(event)
  local id = Entry(Try(UnitGUID, "npc"), CREATURES)
  if not id or Players("npc") then return end
  Once("talk", id)
  About("npc", id)
  if First("opens " .. id .. " " .. WINDOWS[event]) then ns.Log("opens", id, WINDOWS[event]) end
  if event == "MERCHANT_SHOW" and First("sells " .. id) then
    -- ponytail: what the window holds when it opens; a vendor whose list comes later (MERCHANT_UPDATE) is read with what it had.
    for i = 1, Num(Try(GetMerchantNumItems)) or 0 do
      local item = Num(Try(GetMerchantItemID, i))
      local _, _, price, quantity, available = Try(GetMerchantItemInfo, i)
      if item then ns.Log("sells", id, item, Num(price) or 0, Num(quantity) or 1, Num(available) or -1) end
    end
  end
  local function quests(kind, list)
    for _, q in ipairs(type(list) == "table" and list or {}) do
      local quest = Num(type(q) == "table" and q.questID or q)
      if quest and First(kind .. " " .. id .. " " .. quest) then ns.Log(kind, id, quest) end
    end
  end
  if event == "GOSSIP_SHOW" and C_GossipInfo then
    quests("gives", Try(C_GossipInfo.GetAvailableQuests))
    quests("takes", Try(C_GossipInfo.GetActiveQuests))
  elseif event == "QUEST_DETAIL" then
    quests("gives", { Num(Try(GetQuestID)) })
  elseif event == "QUEST_PROGRESS" or event == "QUEST_COMPLETE" then
    quests("takes", { Num(Try(GetQuestID)) })
  end
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
    Talk(event)
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
