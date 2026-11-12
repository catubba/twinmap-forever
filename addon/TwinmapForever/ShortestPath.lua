-- Shortest Path Forever, when the player has it: the journey it guides, read through its public API
-- and told to the app on the strip, whoever started it (Twinmap, the player, another addon).
-- Without Shortest Path nothing is read and nothing is sent. Only reading: no call here steers it.
-- The journey is asked for again every few seconds instead of on Shortest Path's notices: it answers
-- "loading" while it searches its first plan, and no notice says when the plan is there.
local _, ns = ...

local LEGS = 12 -- legs told at most: a journey across the world has fewer
local TEXT = 60 -- letters of a leg's text, and of the goal's name

local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end
local function Str(v) if type(v) == "string" and not (issecretvalue and issecretvalue(v)) then return v:sub(1, TEXT) end end

-- What the app is told: the journey, { loading = true } while its plan is searched, or that there
-- is none. Told from the first journey on, also when there is none: the app must hear it end.
local function Build()
  local api = ShortestPathForever and ShortestPathForever.API
  if not (ns.db and type(api) == "table" and type(api.Journey) == "function") then return end
  local ok, journey, why = pcall(api.Journey)
  if not ok then return end
  if type(journey) ~= "table" or type(journey.goal) ~= "table" then
    if why == "loading" then ns.db.journeyTold = true end
    if not ns.db.journeyTold then return end
    return why == "loading" and { loading = true } or {}
  end
  ns.db.journeyTold = true
  local goal, legs = journey.goal, {}
  for i, leg in ipairs(type(journey.legs) == "table" and journey.legs or {}) do
    if i > LEGS then break end
    legs[i] = { mode = Str(leg.mode), text = Str(leg.text), s = math.floor(Num(leg.seconds) or 0) }
  end
  local left = Num(journey.secondsLeft) or 0
  return {
    owner = Str(journey.owner),
    name = Str(goal.title),
    -- The goal as Shortest Path names it: a map of the game (often the continent's) and percent of it.
    m = Num(goal.map), x = Num(goal.x) and goal.x * 100, y = Num(goal.y) and goal.y * 100,
    legs = legs,
    -- In steps of 5 seconds: a walk must not send the strip a block every second.
    left = math.floor(left / 5 + 0.5) * 5,
  }
end

ns.sections[#ns.sections + 1] = { name = "journey", period = 2, build = Build }
