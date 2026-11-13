-- The quests of the game's own log, for a player without Questie: each quest, whether it is ready
-- to hand in, and for each of its objectives what kind it is and whether it is done. Only numbers
-- go out: the app has the names and the places, from the player's QuestieDB. With Questie running
-- nothing is sent from here: what it shows is sent as it is (Questie.lua).
local _, ns = ...

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end

-- What an objective asks for, as QuestieDB groups them: a creature, an object, an item. 0: anything else.
local KINDS = { monster = 1, object = 2, item = 3 }

-- The quest on a row of the log, by either of the game's two ways of telling it; nil for a header.
local function QuestAt(i)
  local info = Try(C_QuestLog and C_QuestLog.GetInfo, i)
  if type(info) == "table" then return not info.isHeader and Num(info.questID) or nil end
  if not GetQuestLogTitle then return nil end
  local ok, _, _, _, header, _, _, _, id = pcall(GetQuestLogTitle, i)
  return ok and not header and Num(id) or nil
end

local function BuildQuests()
  local modules = QuestieLoader and QuestieLoader._modules
  if modules and modules.QuestieMap and modules.ActiveQuests then return end
  -- A game that has neither way of telling its log tells nothing: no log is not an empty log.
  local count = C_QuestLog and C_QuestLog.GetNumQuestLogEntries or GetNumQuestLogEntries
  if not count then return end
  local rows = Num(Try(count)) or 0
  local log = {}
  for i = 1, rows do
    local id = QuestAt(i)
    if id then
      -- Two numbers an objective: its kind, and 1 when it is done.
      local objectives = {}
      for _, objective in ipairs(Try(C_QuestLog and C_QuestLog.GetQuestObjectives, id) or {}) do
        if type(objective) == "table" then
          objectives[#objectives + 1] = KINDS[objective.type] or 0
          objectives[#objectives + 1] = objective.finished and 1 or 0
        end
      end
      log[#log + 1] = { id = id, done = Try(C_QuestLog and C_QuestLog.IsComplete, id) and true or false, o = objectives }
    end
  end
  table.sort(log, function(a, b) return a.id < b.id end)
  return { log = log }
end

-- Every five seconds, as what Questie shows.
ns.sections[#ns.sections + 1] = { name = "quests", period = 5, build = BuildQuests }
