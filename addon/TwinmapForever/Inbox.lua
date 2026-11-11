-- The inbox: the app-to-game channel. What Twinmap sends arrives here without a /reload.
--
-- The game reads a file it has not loaded yet fresh from disk, and files must exist when it starts.
-- So the app keeps, next to this addon, a bank of font names and a set of load-on-demand slots. Here
-- a new font name is read every few seconds: the width of its letter A is a number, and a number
-- other than the one of the news we have means there is more. Small news is in the font itself, a
-- byte in the width of each of its other letters; the rest is in a slot, and a session of the
-- interface has only SLOTS of them. Only text widths are measured, and the font's data is read as
-- JSON: data, never code.
-- Slots adapted from wow-ai, Copyright (c) 2026 chelinho139, MIT License: full text in THIRD-PARTY-LICENSES.
local _, ns = ...

local SLOTS = 30      -- same as signal.ts
local BANK = 8184     -- same as signal.ts
local EM, A_BASE, A_STEP = 1000, 100, 50 -- same as signal.ts
local B_WIDTH, C_WIDTH = 1000, 500       -- same as signal.ts
local DATA_FIRST, DATA_LETTERS = 0xE000, 1024 -- same as signal.ts
local DIR = "Interface\\AddOns\\TwinmapForever_Signal\\"
local FALLBACK_FONT = "Fonts\\FRIZQT__.TTF"
local SIZE = 64
local POLL = 5              -- seconds between reads, so the bank lasts about 11 hours of play
local RETRY, GIVE_UP = 1, 8 -- a font loads late, and only when asked again
local MAX_FAILS = 3

-- Who takes each part of the news: ns.receivers.name = function(value), value nil for a part taken
-- away. Called at login with what was last received, and it may be called again with the same value.
ns.receivers = {}
ns.signal = "waiting" -- "waiting", "reading", or why nothing can arrive in this session

local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end

local function Tell(part)
  local fn = ns.receivers[part]
  if fn then pcall(fn, ns.db.inbox.parts[part]) end
end

local function TellAll()
  for part in pairs(ns.receivers) do Tell(part) end
end

local function Stop(why, line)
  ns.signal = why
  if line then print("Twinmap Forever: " .. line) end
end

local used = 0 -- slots loaded in this session of the interface

-- Loads the next slot not used in this session of the interface (/reload frees them all) and takes
-- everything it has. The number we hold moves only when this works, so what could not be loaded now
-- is loaded after the /reload or the restart that the message asks for.
local function LoadNextSlot()
  for i = 1, SLOTS do
    local name = string.format("TwinmapForever_R%02d", i)
    if not C_AddOns.IsAddOnLoaded(name) then
      local loaded, reason = C_AddOns.LoadAddOn(name)
      local got = loaded and TwinmapForeverInbox
      if type(got) ~= "table" or type(got.parts) ~= "table" or not Num(got.seq) then
        return Stop("slot " .. tostring(reason or "empty"), "what Twinmap sent cannot be loaded. Keep the Twinmap Forever slot addons enabled; after Twinmap's first run, restart the game.")
      end
      used = i
      ns.db.inbox = { seq = got.seq, parts = got.parts }
      return TellAll()
    end
  end
  used = SLOTS
  Stop("slots used up", "type /reload to go on receiving from Twinmap.")
end

-- What the app must know of its way to the game: the number of the last news that arrived, so it
-- can say "sent"; how many slots are left before a /reload; and why nothing can arrive, if so.
ns.sections[#ns.sections + 1] = { name = "inbox", period = 1, build = function()
  if not (ns.db and ns.db.inbox) or ns.signal == "waiting" then return end
  return { seq = ns.db.inbox.seq, left = SLOTS - used, off = ns.signal ~= "reading" and ns.signal or nil }
end }

local text, reading
local fails, acc = 0, POLL

-- A trailing letter, because the width of a string may not count the last letter's own width.
local function Width(letter)
  text:SetText(letter .. "C")
  return Num(text:GetStringWidth())
end

local function DataWidth(i)
  local cp = DATA_FIRST + i
  return Width(string.char(0xE0 + math.floor(cp / 4096), 0x80 + math.floor(cp / 64) % 64, 0x80 + cp % 64))
end

-- The news itself, when it is small: a byte in the width of each data letter. The first two say
-- how wide 0 and 255 are, then length and sum, then JSON. Anything that does not add up is no data.
local function ReadData()
  local w0, w255 = DataWidth(0), DataWidth(1)
  if not (w0 and w255) or w255 <= w0 then return nil end
  local function Byte(i)
    local w = DataWidth(i + 2)
    local v = w and math.floor((w - w0) / (w255 - w0) * 255 + 0.5)
    return v and v >= 0 and v <= 255 and v or nil
  end
  local h1, h2, h3, h4 = Byte(0), Byte(1), Byte(2), Byte(3)
  if not (h1 and h2 and h3 and h4) then return nil end
  local len = h1 * 256 + h2
  if len < 1 or len > DATA_LETTERS - 6 then return nil end
  local bytes, sum = {}, 0
  for i = 1, len do
    local v = Byte(i + 3)
    if not v then return nil end
    bytes[i] = string.char(v)
    sum = (sum * 31 + v) % 65536
  end
  if sum ~= h3 * 256 + h4 then return nil end
  local json = C_EncodingUtil and C_EncodingUtil.DeserializeJSON
  if not json then return nil end
  local ok, news = pcall(json, table.concat(bytes))
  return ok and type(news) == "table" and type(news.parts) == "table" and news or nil
end

-- The number in the letter A. B and C tell our font from a fallback, where they are not 500 units apart.
local function ReadNumber()
  local a, b, c = Width("A"), Width("B"), Width("C")
  if not (a and b and c) then return nil end
  local perUnit = (b - c) / (B_WIDTH - C_WIDTH)
  if math.abs(perUnit * EM / SIZE - 1) > 0.2 then return nil end
  return math.floor(((a - c) / perUnit + C_WIDTH - A_BASE) / A_STEP + 0.5)
end

local function Failed()
  reading = nil
  fails = fails + 1
  -- No message: an addon without the app, or before the restart after the app's first run, is no fault. /twinmap tells.
  if fails >= MAX_FAILS then Stop("fonts not readable") end
end

-- Until SetFont says yes the font is still loading and the text measures the previous one.
-- The text is set anyway: that is what asks the game to go on loading it.
local function Attempt()
  local ok, assigned = pcall(text.SetFont, text, reading.path, SIZE, "")
  local number = ReadNumber()
  if not (ok and assigned) then return end
  if not number then return Failed() end
  reading, fails, ns.signal = nil, 0, "reading"
  local inbox = ns.db.inbox
  if number == inbox.seq then return end
  local news = ReadData()
  if news and news.seq == number and news.prev == inbox.seq then
    -- Only what this send changed, and only on top of the send before it: no slot spent.
    inbox.seq = number
    for part, value in pairs(news.parts) do
      inbox.parts[part] = value or nil -- false: the part was taken away
      Tell(part)
    end
  else
    LoadNextSlot() -- too big for a font, a send was missed, or the read fell in the middle of a write
  end
end

local function BeginRead()
  if not text then
    text = UIParent:CreateFontString(nil, "OVERLAY")
    text:SetPoint("TOPLEFT", UIParent, "TOPLEFT", 0, 0)
    text:SetAlpha(0)
    text:SetWordWrap(false)
    text:SetNonSpaceWrap(false)
    pcall(text.SetFont, text, FALLBACK_FONT, SIZE, "")
  end
  -- Kept across /reload, when the names already read stay cached. A new run of the game has them
  -- all fresh. ponytail: a name cached by another account in the same run reads old, and costs
  -- one slot; on a run past the whole bank (11 hours) every read is old. Count per run of the game if that happens.
  local index = ns.db.signalPos or 0
  ns.db.signalPos = (index + 1) % BANK
  reading = { path = DIR .. string.format("f%04d.ttf", index), waited = 0, sinceTry = 0 }
  Attempt()
end

local started = false
local frame = CreateFrame("Frame")
frame:RegisterEvent("PLAYER_ENTERING_WORLD")
frame:SetScript("OnEvent", function()
  if started then return end
  started = true
  if type(ns.db.inbox) ~= "table" or type(ns.db.inbox.parts) ~= "table" then ns.db.inbox = { seq = 0, parts = {} } end
  TellAll()
end)
frame:SetScript("OnUpdate", function(_, elapsed)
  if not started or (ns.signal ~= "waiting" and ns.signal ~= "reading") then return end
  if InCombatLockdown() then return end -- read right after: loading a slot in combat was never tried
  if reading then
    reading.waited = reading.waited + elapsed
    reading.sinceTry = reading.sinceTry + elapsed
    if reading.sinceTry >= RETRY then
      reading.sinceTry = 0
      Attempt()
    end
    if reading and reading.waited > GIVE_UP then Failed() end
    return
  end
  acc = acc + elapsed
  if acc >= POLL then
    acc = 0
    BeginRead()
  end
end)
