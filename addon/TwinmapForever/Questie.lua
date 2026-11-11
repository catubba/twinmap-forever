-- What Questie is showing right now, read from its own tables: the icons it holds for the world
-- map, each with its quest and its place. Its filters (level range, hidden quests, what the
-- character can take), its limits and its switches stay its own: an icon it does not show is not
-- sent. Only numbers go out: the app has the names, from the QuestieDB of the same player.
-- Without Questie nothing is sent.
local _, ns = ...

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function IsSecret(v) return issecretvalue and issecretvalue(v) end
local function Num(v) if type(v) == "number" and not IsSecret(v) then return v end end

-- How Questie calls an icon, and the list it goes in here: a quest to take, one to hand in,
-- anything else is something still to find or to do.
local LISTS = { available = "a", complete = "t" }

-- The icons on the world map (each has a twin on the minimap, left out), as four numbers each:
-- quest, area, x and y in hundredths of a percent of the zone's map. Sorted, so that the same
-- icons always make the same text.
local function Icons(map)
  local all = {}
  for quest, names in pairs(map.questIdFrames or {}) do
    if Num(quest) and type(names) == "table" then
      for _, name in pairs(names) do
        local f = _G[name]
        local data = type(f) == "table" and f.data
        if type(data) == "table" and not f.miniMapIcon and not f.hidden then
          local area, x, y = Num(f.AreaID), Num(f.x), Num(f.y)
          if area and x and y then
            all[#all + 1] = { LISTS[data.Type] or "o", quest, area, math.floor(x * 100 + 0.5), math.floor(y * 100 + 0.5) }
          end
        end
      end
    end
  end
  table.sort(all, function(a, b)
    for i = 1, 5 do
      if a[i] ~= b[i] then return a[i] < b[i] end
    end
    return false
  end)
  local out, before = { a = {}, t = {}, o = {} }, nil
  for _, icon in ipairs(all) do
    -- Two icons of one quest on one spot (two creatures standing together) are one here.
    if not (before and before[1] == icon[1] and before[2] == icon[2] and before[3] == icon[3] and before[4] == icon[4] and before[5] == icon[5]) then
      local list = out[icon[1]]
      for i = 2, 5 do list[#list + 1] = icon[i] end
    end
    before = icon
  end
  return out
end

local function BuildQuestie()
  local modules = QuestieLoader and QuestieLoader._modules
  if not (modules and modules.QuestieMap and modules.ActiveQuests) then return end
  local out = { icons = Icons(modules.QuestieMap), active = {} }
  -- The quests in the log. done: ready to hand in. targets: who or what still has to be found,
  -- as Questie names them ("m_117" a creature, "o_42" an object): the app names the icons by them.
  for id, acceptance in pairs(Try(modules.ActiveQuests.GetAll) or {}) do
    local quest = type(acceptance) == "table" and acceptance.quest
    if Num(id) and quest then
      local targets = {}
      for _, objectives in ipairs({ quest.Objectives or {}, quest.SpecialObjectives or {} }) do
        for _, objective in pairs(objectives) do
          if not objective.Completed then
            for _, spawn in pairs(objective.spawnList or {}) do
              if spawn.TooltipKey then targets[spawn.TooltipKey] = true end
            end
          end
        end
      end
      local keys = {}
      for key in pairs(targets) do keys[#keys + 1] = key end
      table.sort(keys)
      local done = Try(C_QuestLog and C_QuestLog.IsComplete, id) and true or false
      out.active[#out.active + 1] = { id = id, done = done, targets = keys }
    end
  end
  table.sort(out.active, function(a, b) return a.id < b.id end)
  return out
end

-- Every five seconds: a quest finished changes its pin in the app well within fifteen.
ns.sections[#ns.sections + 1] = { name = "questie", period = 5, build = BuildQuestie }
