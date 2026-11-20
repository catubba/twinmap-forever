-- The inbox: the app-to-game channel. What Twinmap sends arrives here without a /reload.
--
-- The game reads a file it has not loaded yet fresh from disk, and files must exist when it starts.
-- So the app keeps, next to this addon, a bank of font names. Here a new font name is read every few
-- seconds, in a fight too: the width of its letter A is a number, and a number other than the last
-- one read means the font says something new. The news is in the font itself, a byte in the width
-- of each of its other letters: what changed since the send we say we have (the app reads that on
-- the strip), or everything when we follow another history of sends. News too big for one font
-- comes in pieces, a font each. Only text widths are measured, and the font's data is read as JSON:
-- data, never code.
local _, ns = ...

local BANK = 20460    -- same as signal.ts
local OLD_BANK = 8184 -- what an app before 0.5 made; the rest is there from the start of the game after
local EM, A_BASE, A_STEP = 1000, 100, 50 -- same as signal.ts
local B_WIDTH, C_WIDTH = 1000, 500       -- same as signal.ts
local DATA_FIRST, DATA_LETTERS = 0xE000, 1024 -- same as signal.ts
local D_STEP = 200                            -- same as signal.ts
local DIR = "Interface\\AddOns\\TwinmapForever_Signal\\"
local FALLBACK_FONT = "Fonts\\FRIZQT__.TTF"
local SIZE = 64
-- Seconds between reads. In a dungeon or a raid the app tells where the character is, which the
-- game does not: at 1.5 the bank lasts 8.5 hours of that, at 5 it lasts 28. Faster while pieces come.
local POLL, POLL_INSIDE, POLL_PIECES = 5, 1.5, 1
-- A font is never there at the first asking and always at the next frame (950 of 950 in the game,
-- 15 November 2026, in a fight too): it is asked again every frame.
local GIVE_UP, PROBE_WAIT = 8, 2
local MAX_FAILS = 3

-- Who takes each part of the news: ns.receivers.name = function(value, part), value nil for a part
-- taken away. Called at login with what was last received, and it may be called again with the same
-- value. A part named with letters and then more ("mark" and a place) goes to the receiver of the
-- letters: one receiver for as many parts as the app cares to send.
ns.receivers = ns.receivers or {}
ns.signal = "waiting" -- "waiting", "reading", or why nothing can arrive in this session

local function Num(v) if type(v) == "number" and not (issecretvalue and issecretvalue(v)) then return v end end

local function Tell(part)
  local fn = ns.receivers[part] or ns.receivers[part:match("^%a+") or ""]
  if fn then pcall(fn, ns.db.inbox.parts[part], part) end
end

-- before: the parts held until now, when a slot has just replaced them all: one of them that is no
-- longer there is told as taken away.
local function TellAll(before)
  local parts = ns.db.inbox.parts
  for part in pairs(ns.receivers) do Tell(part) end
  for part in pairs(parts) do
    if not ns.receivers[part] then Tell(part) end
  end
  for part in pairs(before or {}) do
    if parts[part] == nil and not ns.receivers[part] then Tell(part) end
  end
end

local function Stop(why, line)
  ns.signal = why
  if line then print("Twinmap Forever: " .. line) end
end

-- What the app must know of its way to the game: the history of sends we follow and the number of
-- the last one that arrived, so it can say "sent" and tell what is missing; how far a send in
-- pieces has come; and why nothing can arrive, if so. In a fight too: the app waits on it.
-- left: the slots, small addons loaded on demand, once carried what did not fit a font, and an app
-- from then takes this section only with their count in it.
ns.sections[#ns.sections + 1] = { name = "inbox", period = 0.25, combat = true, build = function()
  if not (ns.db and ns.db.inbox) or ns.signal == "waiting" then return end
  return {
    id = ns.db.inbox.id, seq = ns.db.inbox.seq, left = 30, off = ns.signal ~= "reading" and ns.signal or nil,
    got = ns.pieces and { ns.pieces.seq, ns.pieces.i } or nil,
  }
end }

-- The app was just opened and has heard nothing yet: it says so with a number new each time, and
-- everything is sent again at once. The same number told again, at a login, asks for nothing.
ns.receivers.sync = function(session)
  if session == nil or session == ns.db.syncSeen then return end
  ns.db.syncSeen = session
  ns.ResendAll()
end

-- The addon cannot look for a newer version of itself: the app, which keeps itself up to date and
-- comes out with the addon under one number, tells its own at every start. A higher one is said in
-- chat, once in a session of the interface. It is told again at every login, so the line comes
-- back until the addon is updated, and then never.
local function Newer(a, b)
  local x, y = a:gmatch("%d+"), b:gmatch("%d+")
  while true do
    local m, n = tonumber(x() or ""), tonumber(y() or "")
    if not m then return false end
    if not n or m ~= n then return not n or m > n end
  end
end
local announced = false
ns.receivers.latest = function(version)
  -- Three numbers and nothing else: what comes from a file is never printed as it is.
  if announced or type(version) ~= "string" or not version:match("^%d+%.%d+%.%d+$") then return end
  if not Newer(version, ns.VERSION) then return end
  announced = true
  print(("Twinmap Forever: a newer version (%s) is available on CurseForge. You are using %s."):format(version, ns.VERSION))
end

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

-- What the font carries: a byte in the width of each data letter. The first two say how wide 0 and
-- 255 are, then length and sum, then the text. Anything that does not add up is no data.
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
  return table.concat(bytes)
end

-- News as the app writes it: { id, seq, parts } with "from", the send it goes on top of, or "all".
local function Decode(data)
  local json = C_EncodingUtil and C_EncodingUtil.DeserializeJSON
  if not json then return nil end
  local ok, news = pcall(json, data)
  return ok and type(news) == "table" and type(news.parts) == "table" and type(news.id) == "string" and Num(news.seq) and news or nil
end

-- A piece of news too big for one font: a line of "#id send piece pieces", then its bytes. The
-- pieces are held in ns.pieces until the last, and the strip tells the app which one to write next.
-- A /reload loses them: the app then starts from the first.
local function Piece(data)
  local id, seq, i, k, rest = data:match("^#(%S+) (%d+) (%d+) (%d+)\n()")
  if not id then return nil end
  seq, i, k = tonumber(seq), tonumber(i), tonumber(k)
  if i == 1 then ns.pieces = { id = id, seq = seq, k = k, i = 0, data = {} } end
  local held = ns.pieces
  if not held or held.id ~= id or held.seq ~= seq or held.k ~= k or i ~= held.i + 1 then return nil end
  held.i, held.data[i] = i, data:sub(rest)
  if i < k then return nil end
  ns.pieces = nil
  return Decode(table.concat(held.data))
end

-- Takes news in. What changed goes on top of the send it says, or of any send after that one: the
-- app tells everything that changed since. Anything else is not for what we hold, and is left: the
-- app reads on the strip what we hold, and writes what fits.
local function Take(news)
  local inbox = ns.db.inbox
  if news.all then
    if news.id == inbox.id and news.seq == inbox.seq then return end
    local before = inbox.parts
    ns.db.inbox = { id = news.id, seq = news.seq, parts = news.parts }
    return TellAll(before)
  end
  if news.id ~= inbox.id or not Num(news.from) or inbox.seq < news.from or inbox.seq >= news.seq then return end
  inbox.seq = news.seq
  for part, value in pairs(news.parts) do
    inbox.parts[part] = value or nil -- false: the part was taken away
    Tell(part)
  end
end

-- The number in the letter A. B and C tell our font from a fallback, where they are not 500 units apart.
-- The game makes each letter a whole number of the screen's pixels wide, so a unit is measured on the
-- two data letters that say how wide 0 and 255 are, 51,000 units apart: measured on B and C, 500
-- apart, half a pixel was 1.3% and A read one number off (48 as 47, at an interface scale of 1.2).
-- The letter of 0 is as wide as the A of number 0.
local function ReadNumber()
  local a, b, c, d0, d255 = Width("A"), Width("B"), Width("C"), DataWidth(0), DataWidth(1)
  if not (a and b and c and d0 and d255) or d255 <= d0 then return nil end
  local perUnit = (d255 - d0) / (255 * D_STEP)
  if math.abs(perUnit * EM / SIZE - 1) > 0.2 or math.abs((b - c) / perUnit - (B_WIDTH - C_WIDTH)) > 100 then return nil end
  return math.floor((a - d0) / perUnit / A_STEP + 0.5)
end

local function Failed()
  reading = nil
  fails = fails + 1
  -- No message: an addon without the app, or before the restart after the app's first run, is no fault. /twinmap tells.
  if fails >= MAX_FAILS then Stop("fonts not readable") end
end

local bank -- the names this run of the game has
local seen  -- the number of the font last taken in

-- Until SetFont says yes the font is still loading and the text measures the previous one.
-- The text is set anyway: that is what asks the game to go on loading it.
local function Attempt()
  local ok, assigned = pcall(text.SetFont, text, reading.path, SIZE, "")
  if reading.probe then
    -- The last name of the bank, read for nothing but being there: the app made the names past
    -- OLD_BANK later, and a game that was running then does not have them until it starts again.
    if ok and assigned then
      bank, reading, acc = BANK - 1, nil, POLL -- and the first read at the next frame
    elseif reading.waited > PROBE_WAIT then
      bank, reading, acc = OLD_BANK, nil, POLL
    end
    return
  end
  local number = ReadNumber()
  if not (ok and assigned) then return end
  if not number then return Failed() end
  reading, fails, ns.signal = nil, 0, "reading"
  if number == seen then return end
  local data = ReadData()
  if not data then return end -- the read fell in the middle of a write: the next one has it
  seen = number
  local news = data:sub(1, 1) == "#" and Piece(data) or Decode(data)
  if news then Take(news) end
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
  if not bank then
    reading = { path = DIR .. string.format("f%04d.ttf", BANK - 1), waited = 0, probe = true }
    return Attempt()
  end
  -- Kept across /reload, when the names already read stay cached. A new run of the game has them
  -- all fresh. ponytail: a name cached by another account in the same run reads old, and what the
  -- app wrote since comes at the next read; on a run past the whole bank every read is old. Count
  -- per run of the game if that happens.
  local index = (ns.db.signalPos or 0) % bank
  ns.db.signalPos = (index + 1) % bank
  reading = { path = DIR .. string.format("f%04d.ttf", index), waited = 0 }
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
  if reading then
    reading.waited = reading.waited + elapsed
    Attempt()
    if reading and reading.waited > GIVE_UP then Failed() end
    return
  end
  acc = acc + elapsed
  local ok, _, kind = pcall(GetInstanceInfo)
  if acc >= (ns.pieces and POLL_PIECES or ok and (kind == "party" or kind == "raid") and POLL_INSIDE or POLL) then
    acc = 0
    BeginRead()
  end
end)
