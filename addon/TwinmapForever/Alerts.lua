-- Alerts on auction prices: Twinmap checks them at every hour's prices and sends the met ones here,
-- a part "alert" and the alert's number each. Said in chat once, to the character that set the alert:
-- another one in game waits, and the right one hears it at its next login. Only read and printed.
-- value: { who = name and surname, t = the alert's number, name = the item, at = the lowest price now,
-- when = "below", "above" or "appears", price = the line, h = the hour of the prices }.
local _, ns = ...

local function Money(copper)
  if GetCoinTextureString then
    local ok, text = pcall(GetCoinTextureString, copper)
    if ok and type(text) == "string" then return text end
  end
  local g, s, c = math.floor(copper / 10000), math.floor(copper / 100) % 100, copper % 100
  local out = {}
  if g > 0 then out[#out + 1] = g .. "g" end
  if s > 0 then out[#out + 1] = s .. "s" end
  if c > 0 or #out == 0 then out[#out + 1] = c .. "c" end
  return table.concat(out, " ")
end

local function Whole(v) return type(v) == "number" and v >= 0 and v == math.floor(v) end

ns.receivers.alert = function(a, part)
  ns.db.alertsSaid = type(ns.db.alertsSaid) == "table" and ns.db.alertsSaid or {}
  local said = ns.db.alertsSaid
  if type(a) ~= "table" then said[part] = nil return end -- removed in the app
  if said[part] or a.who ~= ns.Key() or type(a.name) ~= "string" or not (Whole(a.at) and Whole(a.price)) then return end
  said[part] = true
  local name, hour = a.name:gsub("|", "||"), type(a.h) == "string" and a.h:match("^%d%d:%d%d$")
  local line = a.when == "appears" and ("%s is on sale again, from %s"):format(name, Money(a.at))
    or ("%s is at %s, %s %s"):format(name, Money(a.at), a.when == "above" and "above" or "below", Money(a.price))
  print("Twinmap Forever: " .. line .. " at the auction house" .. (hour and (" (prices of " .. hour .. ").") or "."))
end
