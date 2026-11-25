-- The character sheet, for the app to keep: who the character is, money, bags, bank, what is
-- worn, skills, spells, talents and recipes. Each piece carries the revision of its last change, saved with the character
-- (TwinmapForeverSheet). The app tells back, as its part "sheet", the code and revision it holds
-- for each character; whatever changed after that goes out on the strip, and again every so often,
-- until the app says it has it. So what changed while the app was closed reaches it when it opens.
-- The code is drawn once, with the sheet: a sheet started again (its saved file lost) has another
-- one, and the app then takes it whole. An app ahead of the sheet (the game closed before it
-- saved) is sent everything again, under a revision past the app's.
-- Section "sheet": { key = full name, code, rev, p = { piece = data, ... } }, only the pieces newer
-- than what the app holds; nothing at all when it holds everything.
--   who   { name, race, class, level }   race and class as the game's tokens ("Gnome", "WARLOCK")
--   money copper
--   bags  { { b = container, n = slots, s = { { slot, item, count, key }, ... } }, ... } backpack, bags, reagent bag, keyring
--   bank  the same for the bank and its bags, as they were when last open
--   gear  { { slot, item, durability, most, key }, ... } durability missing for what does not wear (0 and 0 before a key)
--         key: the item's link (below) when it is more than "item:ID", as one with a suffix ("of the Bear") or an enchant
--   tips  { [key] = { { left, colour, right, colour }, ... } } the lines of the game's own tooltip of each item met, read
--         once (C_TooltipInfo) and sent until the app holds them, then no more: the app keeps them all. Colour "rrggbb",
--         "" for white; right and its colour only where the line has a right side. Lines the game adds itself, as the
--         sell price, are not among them.
--   skills  { { skill, rank, most }, ... } every skill line by the game's number: professions, weapons, languages
--   spells  { spell, ... } the spells in the spellbook, those not learned yet left out
--   book    { { name, picture, { spell, ... }, { passive spell, ... } }, ... } the tabs of the spellbook as the game shows
--           them, in its order: the tab's name and picture, then its spells and its passive ones, each in the book's order;
--           last the pet's tab (picture 0), its entries { name, words under it, picture } as the game words them
--   talents { free = points not spent, t = { { node, rank, spell }, ... } } the talents taken
--   recipes { known = { spell, ... }, seen = { profession, ... }, listed = { spell, ... }, cats = { { category, name, order }, ... } }
--           the recipes a profession's window showed learned, and those learned since; seen: the professions whose window
--           was opened; listed: every recipe such a window listed, learned or not; cats: the headings it groups them
--           under, by the game's number, with its order
--   stats   { { category, { { label, value, colour }, ... } }, ... } the statistics of the game's character window, as it
--           words them and in its order; colour "rrggbb" where the game colours the value (green for one raised), else missing
--   trainers { { n = npc, c = class token of a class trainer, s = { { spell, cost, level, skill }, ... } }, ... }
--           what each trainer seen teaches, all of it, learned or not: copper, level and skill it asks
local _, ns = ...

-- The containers by the game's own numbers, as Bagnon takes them. On Forever (in the game, 17
-- November 2026) the bags go up to the reagent bag (5), the keyring is -1, and the bank has no -1:
-- it is 6, its bags 7 and after. Where the game still has a bank of its own number, it comes first.
local WORN_BAGS = NUM_TOTAL_EQUIPPED_BAG_SLOTS or NUM_BAG_SLOTS or 4
local BANK_BAGS = math.max(7, NUM_BANKBAGSLOTS or Constants and Constants.InventoryConstants and Constants.InventoryConstants.NumCharacterBankSlots or 0)
local BAGS, BANK = {}, {}
for bag = BACKPACK_CONTAINER or 0, WORN_BAGS do BAGS[#BAGS + 1] = bag end
if KEYRING_CONTAINER then BAGS[#BAGS + 1] = KEYRING_CONTAINER end
if BANK_CONTAINER and BANK_CONTAINER ~= KEYRING_CONTAINER then BANK[1] = BANK_CONTAINER end
for bag = WORN_BAGS + 1, WORN_BAGS + BANK_BAGS do BANK[#BANK + 1] = bag end
local WORN = 19 -- equipment slots, head to tabard

local function Ok(ok, ...) if ok then return ... end end
local function Try(f, ...) if f then return Ok(pcall(f, ...)) end end
local function IsSecret(v) return issecretvalue and issecretvalue(v) end
local function Num(v) if type(v) == "number" and not IsSecret(v) then return v end end
local function Str(v) if type(v) == "string" and not IsSecret(v) and v ~= "" then return v end end

-- On Forever a character has a name and a surname, in the two values the game gives.
local function Key()
  local name, surname = Try(UnitFullName, "player")
  name, surname = Str(name), Str(surname)
  return name and (surname and name .. " " .. surname or name)
end
ns.Key = Key -- Portrait.lua says whose picture it is by the same name

-- An item's key: its link as "item:ID:enchant:...", with the level and the specialisation of whoever
-- holds it left out, so that it stays the same as the character grows, and no empty fields at the end.
local function KeyOf(link)
  local s = Str(link) and link:match("|H(item:[^|]+)|h")
  if not s then return nil end
  local f = {}
  for v in (s .. ":"):gmatch("([^:]*):") do f[#f + 1] = v end
  f[10], f[11] = "", "" -- "item", id, enchant, four gems, suffix, unique, level, specialisation, ...
  return (table.concat(f, ":"):gsub(":+$", ""))
end

local function Hex(c)
  if type(c) ~= "table" or not Num(c.r) or not Num(c.g) or not Num(c.b) then return "" end
  local hex = string.format("%02x%02x%02x", math.floor(c.r * 255 + 0.5), math.floor(c.g * 255 + 0.5), math.floor(c.b * 255 + 0.5))
  return hex == "ffffff" and "" or hex
end

-- The tooltips read since the last send, by key: those of items not met before (Tips, below).
local tipsHave, tipsNew = {}, {}

local function Meet(key, read)
  if not key or tipsHave[key] or tipsNew[key] or not C_TooltipInfo then return end
  local data = Try(read)
  if type(data) ~= "table" or type(data.lines) ~= "table" then tipsHave[key] = true return end
  local lines = {}
  for _, l in ipairs(data.lines) do
    local left = type(l) == "table" and Str(l.leftText)
    if left then
      local line = { left, Hex(l.leftColor) }
      local right = Str(l.rightText)
      if right then line[3], line[4] = right, Hex(l.rightColor) end
      lines[#lines + 1] = line
    end
  end
  if #lines > 0 then tipsNew[key] = lines else tipsHave[key] = true end -- one with no lines is not asked again this session
end

-- What a container holds, slot by slot; nothing for a container that is not there.
local function Container(bag)
  local size = C_Container and Num(Try(C_Container.GetContainerNumSlots, bag)) or 0
  if size <= 0 then return nil end
  local held = {}
  for slot = 1, size do
    local info = Try(C_Container.GetContainerItemInfo, bag, slot)
    local item = type(info) == "table" and Num(info.itemID)
    if item then
      local key = KeyOf(info.hyperlink)
      Meet(key, function() return C_TooltipInfo.GetBagItem(bag, slot) end)
      held[#held + 1] = { slot, item, Num(info.stackCount) or 1, key ~= "item:" .. item and key or nil }
    end
  end
  return { b = bag, n = size, s = held }
end

local function Containers(list)
  local out = {}
  for _, bag in ipairs(list) do out[#out + 1] = Container(bag) end
  return out
end

local function Worn()
  local out = {}
  for slot = 1, WORN do
    local item = Num(Try(GetInventoryItemID, "player", slot))
    if item then
      local now, most = Try(GetInventoryItemDurability, slot)
      local key = KeyOf(Try(GetInventoryItemLink, "player", slot))
      Meet(key, function() return C_TooltipInfo.GetInventoryItem("player", slot) end)
      if key and key ~= "item:" .. item then
        out[#out + 1] = { slot, item, Num(now) or 0, Num(most) or 0, key }
      else
        out[#out + 1] = { slot, item, Num(now), Num(most) }
      end
    end
  end
  return out
end

-- Forever's own ways: the old GetNumSpellTabs and GetTalentInfo are not there (wow-state, in the game).
local function Skills()
  local out = {}
  for i = 1, C_SkillInfo and Num(Try(C_SkillInfo.GetNumSkillLines)) or 0 do
    local line = Try(C_SkillInfo.GetSkillLineInfo, i)
    if type(line) == "table" and not line.isHeader and Num(line.skillID) then
      out[#out + 1] = { line.skillID, Num(line.rank) or 0, Num(line.maxRank) or 0 }
    end
  end
  table.sort(out, function(a, b) return a[1] < b[1] end)
  return out
end

-- The spells, by number, and the book as the game shows it: its tabs in order, each with its name and picture, the
-- spells it shows and then the passive ones, in its order.
local function Spells()
  local out, have, tabs = {}, {}, {}
  local book = C_SpellBook
  if not (book and book.GetNumSpellBookSkillLines) then return out, tabs end
  local bank = Enum and Enum.SpellBookSpellBank and Enum.SpellBookSpellBank.Player or 0
  local future = Enum and Enum.SpellBookItemType and Enum.SpellBookItemType.FutureSpell
  for line = 1, Num(Try(book.GetNumSpellBookSkillLines)) or 0 do
    local info = Try(book.GetSpellBookSkillLineInfo, line)
    local first = type(info) == "table" and Num(info.itemIndexOffset) or 0
    local active, passive = {}, {}
    for i = first + 1, first + (type(info) == "table" and Num(info.numSpellBookItems) or 0) do
      local item = Try(book.GetSpellBookItemInfo, i, bank)
      local spell = type(item) == "table" and item.itemType ~= future and Num(item.spellID)
      if spell then
        if not have[spell] then have[spell], out[#out + 1] = true, spell end
        local list = item.isPassive and passive or active
        list[#list + 1] = spell
      end
    end
    if #active + #passive > 0 then tabs[#tabs + 1] = { Str(info.name) or "", Num(info.iconID) or 0, active, passive } end
  end
  -- The pet's tab, of the pet summoned last: its commands and stances are no spells the app can name, so each of its
  -- entries goes as the game words it, { name, words under it, picture }.
  local pets = Enum and Enum.SpellBookSpellBank and Enum.SpellBookSpellBank.Pet
  local count = pets and book.HasPetSpells and Num(Try(book.HasPetSpells))
  if count and count > 0 then
    local active, passive = {}, {}
    for i = 1, count do
      local item = Try(book.GetSpellBookItemInfo, i, pets)
      if type(item) == "table" and Str(item.name) then
        local list = item.isPassive and passive or active
        list[#list + 1] = { item.name, Str(item.subName) or "", Num(item.iconID) or 0 }
      end
    end
    if #active + #passive > 0 then tabs[#tabs + 1] = { Str(PET) or "Pet", 0, active, passive } end
  end
  table.sort(out)
  return out, tabs
end

-- The talent trees of the active set, as wow-state reads them in the game.
local function Talents()
  local config = C_ClassTalents and Try(C_ClassTalents.GetActiveConfigID)
  local info = config and C_Traits and Try(C_Traits.GetConfigInfo, config)
  if type(info) ~= "table" or type(info.treeIDs) ~= "table" then return nil end
  local taken, spare = {}, 0
  for _, tree in ipairs(info.treeIDs) do
    for _, node in ipairs(Try(C_Traits.GetTreeNodes, tree) or {}) do
      local n = Try(C_Traits.GetNodeInfo, config, node)
      -- currentRank first: ranksPurchased is 0 on a rank given for free.
      local rank = type(n) == "table" and n.isVisible ~= false and Num(n.currentRank or n.ranksPurchased) or 0
      if rank > 0 then
        local entry = (type(n.activeEntry) == "table" and n.activeEntry.entryID) or (type(n.entryIDs) == "table" and n.entryIDs[1])
        local e = entry and Try(C_Traits.GetEntryInfo, config, entry)
        local d = type(e) == "table" and e.definitionID and Try(C_Traits.GetDefinitionInfo, e.definitionID)
        taken[#taken + 1] = { node, rank, type(d) == "table" and Num(d.spellID or d.overriddenSpellID) or nil }
      end
    end
    for _, c in ipairs(Try(C_Traits.GetTreeCurrencyInfo, config, tree, false) or {}) do
      spare = math.max(spare, type(c) == "table" and Num(c.quantity) or 0)
    end
  end
  table.sort(taken, function(a, b) return a[1] < b[1] end)
  local points = Num(Try(UnitCharacterPoints, "player")) or 0
  return { free = points > 0 and points or spare, t = taken }
end

-- The statistics of the character window, worked out by the game itself: its own list of categories
-- (PAPERDOLL_STATCATEGORIES) and, for each line, its own function, which writes the label and the value
-- on the row it is given. Here the row is a stand-in that only keeps what it is told. A line the game
-- hides is left out: one it writes nothing on, one whose showFunc says no, one at its hideAt value.
-- Then the resistances, which the window adds by itself. Nothing where the game has no such list.
local function Row()
  local got = {}
  -- Whatever else the game asks of the row is there, as something it can call or empty.
  local any
  any = setmetatable({}, { __call = function() end, __index = function() return any end })
  local function Text(key)
    return setmetatable({}, { __index = function(_, method)
      if method == "SetText" then return function(_, text) got[key] = text end end
      if method == "SetFormattedText" then return function(_, ...) got[key] = Ok(pcall(string.format, ...)) end end
      return any
    end })
  end
  return setmetatable({ Label = Text("label"), Value = Text("value") }, { __index = function() return any end }), got
end

local SCHOOLS = { { 6, "Arcane" }, { 2, "Fire" }, { 4, "Frost" }, { 3, "Nature" }, { 5, "Shadow" } }

local function Stats()
  if type(PAPERDOLL_STATCATEGORIES) ~= "table" or type(PAPERDOLL_STATINFO) ~= "table" then return nil end
  local out = {}
  for _, cat in ipairs(PAPERDOLL_STATCATEGORIES) do
    if type(cat) == "table" and cat.unit == "player" and type(cat.stats) == "table" then
      local rows = {}
      for _, stat in ipairs(cat.stats) do
        local info = type(stat) == "table" and PAPERDOLL_STATINFO[stat.stat]
        if type(info) == "table" and info.updateFunc and (not stat.showFunc or Try(stat.showFunc)) then
          local row, got = Row()
          pcall(info.updateFunc, row, "player")
          local label, value = got.label, got.value
          -- A value hidden from addons (in a fight): the statistics stay as they were.
          if IsSecret(label) or IsSecret(value) or IsSecret(rawget(row, "numericValue")) then return nil end
          label, value = Str(label), Str(value)
          if label and value then
            local colour, plain = value:match("^|c%x%x(%x%x%x%x%x%x)(.-)|r$")
            if plain then value, colour = plain, colour:lower() end
            local number = Num(rawget(row, "numericValue")) or tonumber((value:gsub("[%%,]", "")))
            if stat.hideAt == nil or number ~= stat.hideAt then
              rows[#rows + 1] = { (label:gsub(":%s*$", "")), value, colour }
            end
          end
        end
      end
      if #rows > 0 then out[#out + 1] = { Str(cat.categoryName) or "", rows } end
    end
  end
  local resist = {}
  for _, school in ipairs(SCHOOLS) do
    local _, total = Try(UnitResistance, "player", school[1])
    if IsSecret(total) then return nil end
    if Num(total) then resist[#resist + 1] = { Str(_G["SPELL_SCHOOL" .. school[1] .. "_CAP"]) or school[2], tostring(total) } end
  end
  if #resist > 0 then out[#out + 1] = { Str(RESISTANCE_LABEL) or "Resistances", resist } end
  return #out > 0 and out or nil
end

-- Skills, spells, talents and statistics change seldom and take longer to read: again when the game
-- says they changed, and every half minute besides.
local AGAIN = 30
local slow, slowAt = {}, 0

-- Recipes: the window of a profession lists all its recipes, learned or not, and each one learned
-- since the game tells as it happens. Kept in the saved sheet, so a window opened once is enough.
local known, seen, listed, cats -- spell -> true, profession -> true, spell -> true, category -> { name, order }
local scanDue, learned = false, {}

local function ScanWindow()
  local T = C_TradeSkillUI
  if not (T and T.GetAllRecipeIDs) then return end
  -- Someone else's recipes, shown through a link or by an NPC, are not this character's.
  if Try(T.IsTradeSkillLinked) or Try(T.IsTradeSkillGuild) or Try(T.IsNPCCrafting) then return end
  local ids = Try(T.GetAllRecipeIDs)
  if type(ids) ~= "table" or #ids == 0 then return end
  local now, under, heads = {}, {}, 0
  for _, id in ipairs(ids) do
    local info = Try(T.GetRecipeInfo, id)
    -- A recipe not told learned or not is still loading: the window's next update has it.
    if type(info) ~= "table" or type(info.learned) ~= "boolean" or not Num(id) then return end
    now[id] = info.learned
    if Num(info.categoryID) and not under[info.categoryID] then heads = heads + 1 under[info.categoryID] = heads end
  end
  for id, yes in pairs(now) do known[id], listed[id] = yes or nil, true end
  -- The headings, in the window's order: the game's own where it gives one, else as they first came.
  for category, first in pairs(under) do
    local info = T.GetCategoryInfo and Try(T.GetCategoryInfo, category)
    local name = type(info) == "table" and Str(info.name)
    if name then cats[category] = { name, Num(info.uiOrder) or first } end
  end
  local base = Try(T.GetBaseProfessionInfo)
  if type(base) == "table" and Num(base.professionID) then seen[base.professionID] = true end
end

local function Recipes(s)
  if not known then
    known, seen, listed, cats = {}, {}, {}, {}
    local held = s.pieces.recipes and s.pieces.recipes.data
    held = type(held) == "table" and held or {}
    for _, id in ipairs(type(held.known) == "table" and held.known or {}) do known[id] = true end
    for _, id in ipairs(type(held.seen) == "table" and held.seen or {}) do seen[id] = true end
    for _, id in ipairs(type(held.listed) == "table" and held.listed or {}) do listed[id] = true end
    for _, c in ipairs(type(held.cats) == "table" and held.cats or {}) do
      if type(c) == "table" and Num(c[1]) and Str(c[2]) then cats[c[1]] = { c[2], Num(c[3]) or 0 } end
    end
  end
  if scanDue then scanDue = false ScanWindow() end
  for _, id in ipairs(learned) do known[id] = true end
  learned = {}
  local out = { known = {}, seen = {}, listed = {}, cats = {} }
  for id in pairs(known) do out.known[#out.known + 1] = id end
  for id in pairs(seen) do out.seen[#out.seen + 1] = id end
  for id in pairs(listed) do out.listed[#out.listed + 1] = id end
  for id, c in pairs(cats) do out.cats[#out.cats + 1] = { id, c[1], c[2] } end
  table.sort(out.known)
  table.sort(out.seen)
  table.sort(out.listed)
  table.sort(out.cats, function(a, b) return a[1] < b[1] end)
  return out
end

-- Trainers: read once a visit, with every filter of the window on, then the filters set back (One for
-- All does the same on Forever, UI/TrainerSpells.lua). The game names no spell: a hidden tooltip does.
local trainers -- npc -> { n, c, s }
local read = {} -- npc -> { n, c, s }: the trainers read in this session, for the sheet to take in
local trainerDue = false
local logged = {} -- npc -> true: the trainers already in this session of the log
local tip

local function ServiceSpell(i)
  tip = tip or CreateFrame("GameTooltip", "TwinmapForeverTrainerTip", nil, "GameTooltipTemplate")
  local id
  pcall(function()
    tip:SetOwner(UIParent, "ANCHOR_NONE")
    tip:SetTrainerService(i)
    id = select(2, tip:GetSpell())
    tip:Hide()
  end)
  return Num(id)
end

local FILTERS = { "available", "unavailable", "used" }

local function ReadTrainer()
  local guid = Str(Try(UnitGUID, "npc"))
  local npc = guid and tonumber(guid:match("^Creature%-%d+%-%d+%-%d+%-%d+%-(%d+)%-"))
  if not npc or (Num(Try(GetNumTrainerServices)) or 0) == 0 then return false end
  local on = {}
  for _, f in ipairs(FILTERS) do
    if not Try(GetTrainerServiceTypeFilter, f) and SetTrainerServiceTypeFilter and pcall(SetTrainerServiceTypeFilter, f, true) then on[#on + 1] = f end
  end
  local lines = {}
  for i = 1, Num(Try(GetNumTrainerServices)) or 0 do
    local name, _, kind = Try(GetTrainerServiceInfo, i)
    local spell = Str(name) and kind ~= "header" and ServiceSpell(i)
    if spell then
      local _, skill = Try(GetTrainerServiceSkillReq, i)
      lines[#lines + 1] = { spell, Num(Try(GetTrainerServiceCost, i)) or 0, Num(Try(GetTrainerServiceLevelReq, i)) or 0, tonumber(skill) or 0 }
    end
  end
  for _, f in ipairs(on) do pcall(SetTrainerServiceTypeFilter, f, false) end
  if #lines == 0 then return false end
  table.sort(lines, function(a, b) return a[1] < b[1] end)
  local _, class, classId = Try(UnitClass, "player")
  local trade = Try(IsTradeskillTrainer)
  read[npc] = { n = npc, c = not trade and Str(class) or nil, s = lines }
  -- The log (Log.lua), once a session for each trainer. Entry "trainer": the NPC, the class's number
  -- for a class trainer (0 for a profession), how its faction stands to the character (UnitReaction,
  -- 4 neutral to 8 exalted: a good standing lowers the costs), then a line: spell, copper, level, skill.
  if not logged[npc] and ns.Logging() then
    logged[npc] = true
    local standing = Num(Try(UnitReaction, "npc", "player")) or 0
    for _, l in ipairs(lines) do ns.Log("trainer", npc, trade and 0 or Num(classId) or 0, standing, l[1], l[2], l[3], l[4]) end
  end
  return true
end

local function Trainers(s)
  if not trainers then
    trainers = {}
    local held = s.pieces.trainers and s.pieces.trainers.data
    for _, t in ipairs(type(held) == "table" and held or {}) do
      if type(t) == "table" and Num(t.n) then trainers[t.n] = t end
    end
  end
  for npc, t in pairs(read) do trainers[npc] = t end
  local out = {}
  for _, t in pairs(trainers) do out[#out + 1] = t end
  table.sort(out, function(a, b) return a.n < b.n end)
  return out
end

local bankOpen = false

-- The pieces as the game tells them now. The bank only while it is open: the game tells it no other time.
local function Read(s)
  local _, race = Try(UnitRace, "player")
  local _, class = Try(UnitClass, "player")
  local pieces = {
    who = { name = Key(), race = Str(race), class = Str(class), level = Num(Try(UnitLevel, "player")) },
    money = Num(Try(GetMoney)),
    bags = Containers(BAGS),
    gear = Worn(),
  }
  if bankOpen then pieces.bank = Containers(BANK) end
  local now = GetTime()
  if now >= slowAt then
    slow, slowAt = { skills = Skills(), talents = Talents(), stats = Stats() or slow.stats }, now + AGAIN
    slow.spells, slow.book = Spells()
  end
  pieces.skills, pieces.spells, pieces.book, pieces.talents, pieces.stats = slow.skills, slow.spells, slow.book, slow.talents, slow.stats
  pieces.recipes = Recipes(s)
  pieces.trainers = Trainers(s)
  return pieces
end

local function NewCode() return string.format("%04x%04x", math.random(0, 0xffff), math.random(0, 0xffff)) end

-- The saved sheet, made right if it is missing or not ours.
local function Saved()
  local s = TwinmapForeverSheet
  if type(s) ~= "table" or type(s.code) ~= "string" or not Num(s.rev) or type(s.pieces) ~= "table" then
    s = { code = NewCode(), rev = 0, pieces = {} }
    TwinmapForeverSheet = s
  end
  return s
end

-- A piece whose text changed takes the next revision.
local function Update(s)
  for name, data in pairs(Read(s)) do
    local held = s.pieces[name]
    if not held or ns.Json(held.data) ~= ns.Json(data) then
      s.rev = s.rev + 1
      s.pieces[name] = { rev = s.rev, data = data }
    end
  end
end

-- The app's word: { [key] = { code, rev } }, what it holds of each character's sheet.
ns.receivers = ns.receivers or {} -- Inbox.lua, which calls them, is loaded after this file
local told = {}
ns.receivers.sheet = function(value) told = type(value) == "table" and value or {} end

-- The tooltips the app does not hold yet: each one is kept with the revision it came at, and goes
-- out while the app's revision is older. Once it holds them the piece is empty, and stays so.
local function Tips(s, since)
  s.tips = type(s.tips) == "table" and s.tips or {}
  for key, lines in pairs(tipsNew) do
    if not s.tips[key] then s.tips[key] = { at = s.rev + 1, lines = lines } end
  end
  tipsNew = {}
  local out = {}
  for key, t in pairs(s.tips) do
    tipsHave[key] = true
    if type(t) == "table" and Num(t.at) and t.at > since then out[key] = t.lines end
  end
  local held = s.pieces.tips
  if not held or ns.Json(held.data) ~= ns.Json(out) then
    s.rev = s.rev + 1
    s.pieces.tips = { rev = s.rev, data = out }
  end
end

local function Build()
  local key = ns.ready and Key()
  if not key then return end
  local s = Saved()
  Update(s)
  local word = told[key]
  local since = 0
  if type(word) == "table" and word.code == s.code and Num(word.rev) then
    if word.rev > s.rev then
      -- The app has more than this sheet remembers: everything again, past the app's revision.
      s.rev = word.rev + 1
      for _, piece in pairs(s.pieces) do piece.rev = s.rev end
    else
      since = word.rev
    end
  end
  Tips(s, since)
  if s.rev <= since then return end
  local p = {}
  for name, piece in pairs(s.pieces) do
    if piece.rev > since then p[name] = piece.data end
  end
  return { key = key, code = s.code, rev = s.rev, p = p }
end

local frame = CreateFrame("Frame")
frame:RegisterEvent("BANKFRAME_OPENED")
frame:RegisterEvent("BANKFRAME_CLOSED")
frame:RegisterEvent("TRAINER_SHOW")
frame:RegisterEvent("TRAINER_CLOSED")
for _, event in ipairs({ "SPELLS_CHANGED", "LEARNED_SPELL_IN_TAB", "SKILL_LINES_CHANGED", "CHAT_MSG_SKILL", "TRAIT_CONFIG_UPDATED",
  "CHARACTER_POINTS_CHANGED", "PLAYER_LEVEL_UP", "PLAYER_EQUIPMENT_CHANGED", "TRADE_SKILL_SHOW", "TRADE_SKILL_LIST_UPDATE", "TRADE_SKILL_DATA_SOURCE_CHANGED", "NEW_RECIPE_LEARNED" }) do
  pcall(frame.RegisterEvent, frame, event) -- one the game does not have is left out
end
-- A trainer's window is read on its own clock, not the strip's: paused, the strip takes no sheet, and
-- the log (Log.lua) still has the trainer. The window may still be empty when it opens: read again,
-- twice a second, until it is not.
local trainerAt = 0
frame:SetScript("OnUpdate", function()
  if not trainerDue then return end
  local now = GetTime()
  if now < trainerAt then return end
  trainerAt = now + 0.5
  if ReadTrainer() then trainerDue = false end
end)
frame:SetScript("OnEvent", function(_, event, recipe)
  if event == "BANKFRAME_OPENED" or event == "BANKFRAME_CLOSED" then
    bankOpen = event == "BANKFRAME_OPENED"
  elseif event == "TRAINER_SHOW" or event == "TRAINER_CLOSED" then
    trainerDue = event == "TRAINER_SHOW"
  elseif event == "NEW_RECIPE_LEARNED" then
    if Num(recipe) then learned[#learned + 1] = recipe end
  elseif event:match("^TRADE_SKILL") then
    scanDue = true
  else
    slowAt = 0
  end
end)

ns.sections[#ns.sections + 1] = { name = "sheet", period = 2, build = Build }
