-- What Questie is showing right now, read from its own tables: its filters (level range, hidden
-- quests, what the character can take) stay its own. Only numbers go out: the app has the places,
-- from the QuestieDB of the same player. Without Questie nothing is sent.
local _, ns = ...

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function IsSecret(v) return issecretvalue and issecretvalue(v) end
local function Num(v) if type(v) == "number" and not IsSecret(v) then return v end end

local function BuildQuestie()
  local modules = QuestieLoader and QuestieLoader._modules
  local db = Questie and Questie.db
  local profile = db and db.profile
  if not (modules and modules.AvailableQuests and modules.ActiveQuests and profile) then return end
  -- items: Questie also marks who drops a thing that starts a quest (a switch of its own).
  local out = { available = {}, active = {}, items = profile.enableAvailableItems and true or false }
  -- The quests Questie marks as there to take, unless the player turned those icons off.
  if profile.enableAvailable then
    for id, shown in pairs(modules.AvailableQuests.__availableQuests or {}) do
      if shown and Num(id) then out.available[#out.available + 1] = id end
    end
    table.sort(out.available)
  end
  -- The quests in the log. done: ready to hand in. targets: who or what still has to be found,
  -- as Questie names them ("m_117" a creature, "o_42" an object). event: something to do at a place.
  for id, acceptance in pairs(Try(modules.ActiveQuests.GetAll) or {}) do
    local quest = type(acceptance) == "table" and acceptance.quest
    if Num(id) and quest and not quest.HideIcons then
      local targets, event = {}, false
      for _, objectives in ipairs({ quest.Objectives or {}, quest.SpecialObjectives or {} }) do
        for _, objective in pairs(objectives) do
          if not objective.Completed and not objective.HideIcons then
            for _, spawn in pairs(objective.spawnList or {}) do
              if not spawn.TooltipKey then
                event = true
              elseif next(spawn.Spawns or {}) or next(spawn.Waypoints or {}) then
                targets[spawn.TooltipKey] = true
              end
            end
          end
        end
      end
      local keys = {}
      for key in pairs(targets) do keys[#keys + 1] = key end
      table.sort(keys)
      local done = profile.enableTurnins and Try(C_QuestLog and C_QuestLog.IsComplete, id) and true or false
      out.active[#out.active + 1] = { id = id, done = done, event = event, targets = keys }
    end
  end
  table.sort(out.active, function(a, b) return a.id < b.id end)
  return out
end

-- Every five seconds: a quest finished changes its pin in the app well within fifteen.
ns.sections[#ns.sections + 1] = { name = "questie", period = 5, build = BuildQuestie }
