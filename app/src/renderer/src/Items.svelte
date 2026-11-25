<script module lang="ts">
  import type { ItemFacts } from '../../shared/items'
  // What the four panels share: what the game says of each item, asked for once, and what is typed in the filter of
  // Inventory, which dims what does not match in the slots of the others too.
  let facts = $state.raw<ItemFacts>({})
  let asked = false
  const filter = $state({ typed: '' })
</script>

<script lang="ts">
  // The panels of the Character workspace (M20-F8), each one part of what was Items, from the sheet the app keeps
  // (shared/items.ts), for the character shown; they read the same with the game closed, and say how old they are.
  // character: what is worn as the game's character window lays it, the picture taken off it, the statistics; bags and
  // bank: their grids; inventory: a row for each item, and the other characters' rows of what is typed in its filter.
  import { ago, type Known } from '../../shared/characters'
  import { coins, filterRows, ITEMS_FILE, gridsOf, itemMatches, itemRows, othersHolding, placeName, PLACES, QUALITY_COLORS, QUALITY_TEXT, sortRows, wornOf, WORN_LEFT, WORN_RIGHT, WORN_WEAPONS, type Cell, type Column, type Grid, type ItemRow, type Place } from '../../shared/items'
  import { around, t, type Key } from '../../shared/i18n'
  import type { PortraitsTold } from '../../shared/portrait'
  import type { Sheets } from '../../shared/sheet'
  import { statsOf } from '../../shared/stats'
  import { lowestOf, type Listing } from '../../shared/ah'
  import { itemTip } from './item-tip.svelte'
  import { columns } from './columns'
  import { inApp, TILES } from './web'

  // listing: the prices of the auction house on show (M18-F8), for what each item fetches there; null without them.
  let { part, sheets, portraits, shown, known, now, listing = null, onpick }: { part: 'character' | 'bags' | 'bank' | 'inventory'; sheets: Sheets; portraits: PortraitsTold; shown: Known | null; known: Known[]; now: number; listing?: Listing | null; onpick: (key: string) => void } = $props()

  // What the game says of each item, made beside the map (tiles-worker.ts). Without it the items have their numbers and no prices.
  if (!asked) {
    asked = true
    void fetch(`${TILES}/${ITEMS_FILE}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((read: ItemFacts) => (facts = read))
      .catch(() => {})
  }
  const typed = $derived(filter.typed)
  let place = $state<Place | null>(null)
  let column = $state<Column>('value')
  let up = $state(false)
  const sheet = $derived(shown ? sheets[shown.key] : undefined)
  const lowest = $derived((key: string) => lowestOf(listing, key))
  const all = $derived(sheet ? itemRows(sheet, facts, lowest) : [])
  const rows = $derived(sortRows(filterRows(all, typed).filter((r) => !place || r.place === place), column, up))
  const others = $derived(shown ? othersHolding(sheets, shown.key, facts, typed, lowest).flatMap((o) => o.rows.map((r) => ({ ...r, who: known.find((k) => k.key === o.key) }))) : [])
  const othersSorted = $derived(sortRows(others, column, up) as typeof others)
  const worn = $derived(sheet ? wornOf(sheet) : new Map())
  const grids = $derived(sheet ? gridsOf(sheet) : null)
  const worth = $derived(all.reduce((n, r) => n + r.value, 0))
  const auction = $derived(all.reduce((n, r) => n + r.auction, 0))
  const money = $derived(typeof sheet?.pieces.money === 'number' ? sheet.pieces.money : null)
  const places = $derived(PLACES.map((p) => ({ p, n: all.filter((r) => r.place === p).length })).filter(({ p, n }) => n > 0 || p !== 'Keyring'))

  const COLUMNS = $derived<[Column, string][]>([
    ['name', t('items.table.columns.item')],
    ['type', t('items.table.columns.type')],
    ['place', t('items.table.columns.where')],
    ['n', t('items.table.columns.qty')],
    ['value', t('items.table.columns.value')],
    ...(listing ? [['auction', t('items.table.columns.auction')] as [Column, string]] : []),
  ])
  // The other characters' table: the same, with whose each row is after the item.
  const OTHER_COLUMNS = $derived<[Column | null, string][]>([COLUMNS[0]!, [null, t('items.table.columns.character')], ...COLUMNS.slice(1)])
  // Texts with coins or a key in the middle: what comes before and after them.
  const WORTH = around('items.page.worth', 'money'), AUCTION = around('items.page.auction', 'money'), MONEY = around('items.page.money', 'money')
  const KEY_HINT = around('items.doll.keyHint', 'key')
  // A click sorts by the column; another click turns it round. Names and types start from A, numbers from the most.
  function sortBy(c: Column): void {
    if (c === column) up = !up
    else ((column = c), (up = c === 'name' || c === 'type' || c === 'place'))
  }
  // The character's picture, taken off the game's character window (shared/portrait.ts): the address changes with each new one.
  const portrait = $derived(shown ? portraits.taken[shown.key] : undefined)
  const portraitUrl = $derived(shown && portrait ? `${TILES}/portraits/${encodeURIComponent(shown.key)}.png?${portrait.at}` : null)
  // The statistics of the game's character window, as the addon read them last.
  const stats = $derived(statsOf(sheet?.pieces.stats))
  const when = $derived.by(() => {
    if (!sheet || !shown) return ''
    const bags = shown.live ? t('items.table.bagsNow') : t('items.table.bagsAsOf', { ago: ago(shown.seen, now) })
    const bank = sheet.at.bank ? t('items.table.bankSeen', { ago: ago(sheet.at.bank, now) }) : t('items.table.bankUnseen')
    return `${bags} · ${bank}`
  })
</script>

{#snippet money_(copper: number)}
  {#each coins(copper) as [n, coin] (coin)}{n}<i class="coin {coin}"></i>{:else}<span class="none">-</span>{/each}
{/snippet}

{#snippet item(r: ItemRow)}
  <span class="it">
    <span class="ico"><img src="{TILES}/items/{r.id}.png" alt="" onerror={(e) => e.currentTarget.remove()} /></span>
    <span class="nm" style:color={QUALITY_TEXT[r.quality] ?? 'var(--text)'}>{r.name}</span>
  </span>
{/snippet}

<!-- A slot: an item with its picture, the edge in its quality's colour, how many, and its wear; or a free one, with the word of what goes there. -->
{#snippet cell(c: Cell, label = '', wear?: { now?: number; most?: number })}
  {#if c}
    {@const q = facts[c.item]?.[1] ?? 1}
    {@const name = facts[c.item]?.[0] ?? t('items.unknownItem', { id: c.item })}
    {@const left = wear?.most ? (wear.now ?? 0) / wear.most : 1}
    <span class="cell" use:itemTip={{ item: c.item, key: c.key, n: c.n, wear }} class:off={!itemMatches(c.item, facts, typed)} style:--q={q > 1 ? (QUALITY_COLORS[q] ?? null) : null}>
      <img src="{TILES}/items/{c.item}.png" alt={name} onerror={(e) => e.currentTarget.remove()} />
      {#if c.n > 1}<span class="n">{c.n}</span>{/if}
      {#if left < 0.5}<span class="wear" class:broken={left === 0} style:width="{Math.max(3, 36 * left)}px"></span>{/if}
    </span>
  {:else}
    <span class="cell free" class:off={!!typed.trim() && !label}>{#if label}<span class="slot">{label}</span>{/if}</span>
  {/if}
{/snippet}

{#snippet wornSlot([slot, label]: [number, Key])}
  {@const w = worn.get(slot)}
  {@render cell(w ? { item: w.item, n: 1, key: w.key } : null, t(label), w)}
{/snippet}

{#snippet grid(name: string, g: Grid)}
  <div class="box">
    <h3>{name}<small>{g.used ? t('items.held.used', { used: g.used, count: g.slots }) : t('items.held.empty', { count: g.slots })}</small></h3>
    {#if g.used}<div class="grid">{#each g.cells as c, i (i)}{@render cell(c)}{/each}</div>{/if}
  </div>
{/snippet}

{#snippet heads(columns: [Column | null, string][])}
  <thead>
    <tr>
      {#each columns as [c, label] (label)}
        <th class="c-{c ?? 'who'}" class:num={c === 'n' || c === 'value' || c === 'auction'} class:on={c === column} aria-sort={c === column ? (up ? 'ascending' : 'descending') : undefined}>
          {#if c}
            <button onclick={() => sortBy(c)}>{label}{#if c === column}<svg viewBox="0 0 10 10" aria-hidden="true"><path d={up ? 'M1 7h8L5 2z' : 'M1 3h8L5 8z'} /></svg>{/if}</button>
          {:else}{label}{/if}
        </th>
      {/each}
    </tr>
  </thead>
{/snippet}

<main class="surface">
  {#if !shown || !sheet || !grids}
    <p class="empty">{t('items.page.noCharacter')}</p>
  {:else if part === 'character'}
    <section class="doll" aria-label={t('items.doll.label')}>
      <header><span class="who" style:color={shown.color}>{shown.key}</span><span class="line">{shown.line}</span></header>
      <div class="body">
        <div class="col">{#each WORN_LEFT as s (s[0])}{@render wornSlot(s)}{/each}</div>
        <div>
          <div class="picture" style:background-image={portraitUrl ? `url("${portraitUrl}")` : null}>
            {#if portraits.retake === shown.key}
              <div class="wait">
                <p>{t('items.doll.open')}<br />{KEY_HINT[0]}<kbd>C</kbd>{KEY_HINT[1]}</p>
                <small>{t('items.doll.waitNote')}</small>
                <span><button class="pbtn" onclick={() => void window.twinmap.retakePortrait(null)}>{t('items.doll.cancel')}</button></span>
              </div>
            {:else if portrait && portraitUrl}
              <div class="under">
                <span class="when">{t('items.doll.taken', { ago: ago(portrait.at, now) })}</span>
                {#if inApp}
                  <button class="pbtn" onclick={() => void window.twinmap.savePortrait(shown.key)}>{t('items.doll.save')}</button>
                {:else}
                  <a class="pbtn" href={portraitUrl} download="{shown.key}.png">{t('items.doll.save')}</a>
                {/if}
                {#if shown.live}<button class="pbtn" onclick={() => void window.twinmap.retakePortrait(shown.key)}>{t('items.doll.retake')}</button>{/if}
              </div>
            {:else}
              <span>{t('items.doll.none', { name: shown.key.split(' ')[0] ?? '' })}</span>
              <small>{t('items.doll.noneNote')}</small>
            {/if}
          </div>
          <div class="weapons">{#each WORN_WEAPONS as s (s[0])}{@render wornSlot(s)}{/each}</div>
        </div>
        <div class="col">{#each WORN_RIGHT as s (s[0])}{@render wornSlot(s)}{/each}</div>
      </div>
      {#if stats.length}
        <div class="stats">
          {#each stats as group (group.name)}
            <h4>{group.name}</h4>
            {#each group.lines as line (line.label)}
              <div>{line.label} <b style:color={line.color}>{line.value}</b></div>
            {/each}
            {#if group.lines.length % 2}<div></div>{/if}
          {/each}
        </div>
      {/if}
    </section>
  {:else if part === 'bags'}
    <section aria-label={t('items.held.bags')}>
      <h2>{t('items.held.bags')}<span>{shown.live ? t('items.held.bagsNow') : t('items.held.bagsAsOf', { ago: ago(shown.seen, now) })}</span></h2>
      {@render grid(t('items.held.backpack'), grids.bags)}
      {#if grids.reagents.slots}{@render grid(t('items.held.reagents'), grids.reagents)}{/if}
      {#if grids.keyring.slots}{@render grid(t('items.held.keyring'), grids.keyring)}{/if}
    </section>
  {:else if part === 'bank'}
    {#if sheet.at.bank}
      <section aria-label={t('items.held.bank')}>
        <h2>{t('items.held.bank')}<span>{t('items.held.bankSeen', { ago: ago(sheet.at.bank, now) })}</span></h2>
        {#if grids.bank.slots}{@render grid(t('items.held.bankBags'), grids.bank)}{/if}
      </section>
    {:else}
      <p class="empty"><b>{t('items.bank.none')}</b>{t('items.bank.open')}<small>{t('items.bank.where')}</small></p>
    {/if}
  {:else}
    <div class="tools">
      <input type="search" placeholder={t('items.page.filter')} aria-label={t('items.page.filterLabel')} bind:value={filter.typed} />
      <div class="chips" role="group" aria-label={t('items.page.whereLabel')}>
        <button class="chip" aria-pressed={!place} onclick={() => (place = null)}>{t('items.page.all')} <b>{all.length}</b></button>
        {#each places as { p, n } (p)}
          <button class="chip" aria-pressed={place === p} onclick={() => (place = place === p ? null : p)}>{placeName(p)} <b>{n}</b></button>
        {/each}
      </div>
      <p class="sum">{WORTH[0]}{@render money_(worth)}{WORTH[1]}{#if listing}{' · '}{AUCTION[0]}{@render money_(auction)}{AUCTION[1]}{/if}{#if money !== null}{' · '}{MONEY[0]}{@render money_(money)}{MONEY[1]}{/if}</p>
    </div>
    <table use:columns={'items-table'}>
      {@render heads(COLUMNS)}
      <tbody>
        {#each rows as r (r.place + r.id)}
          <tr use:itemTip={{ item: r.id, n: r.n }}><td>{@render item(r)}</td><td class="dim c-type">{r.type}</td><td class="c-place">{placeName(r.place)}</td><td class="num">{r.n}</td><td class="num c-value">{@render money_(r.value)}</td>{#if listing}<td class="num">{@render money_(r.auction)}</td>{/if}</tr>
        {:else}
          <tr><td colspan={COLUMNS.length} class="none">{typed ? t('items.table.nothingLike', { name: shown.key, typed }) : t('items.table.nothing')}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="foot">{when}</p>

    {#if othersSorted.length}
      <h2>{t('items.others.title')}<span>{t('items.others.where')}</span></h2>
      <table use:columns={'items-others'}>
        {@render heads(OTHER_COLUMNS)}
        <tbody>
          {#each othersSorted as r (r.who?.key + r.place + r.id)}
            <tr class="other" onclick={() => r.who && onpick(r.who.key)} title={t('items.others.show', { name: r.who?.key ?? '' })}>
              <td>{@render item(r)}</td><td style:color={r.who?.color}>{r.who?.key}</td><td class="dim c-type">{r.type}</td><td class="c-place">{placeName(r.place)}</td><td class="num">{r.n}</td><td class="num c-value">{@render money_(r.value)}</td>{#if listing}<td class="num">{@render money_(r.auction)}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="foot">{[...new Set(othersSorted.map((r) => r.who))].map((k) => k && t('items.others.seen', { name: k.key, ago: ago(k.seen, now) })).filter(Boolean).join(' · ')}</p>
    {/if}
  {/if}
</main>

<style>
  /* Its narrow form follows the width of its place, not of the window: a panel beside the map is narrow too. */
  main {
    position: absolute;
    inset: 46px 0 0;
    overflow-y: auto;
    padding: 14px 20px 32px;
    font-variant-numeric: tabular-nums;
    container: items / inline-size;
  }
  .empty {
    max-width: 520px;
    margin: 64px auto;
    color: var(--text-dim);
    text-align: center;
  }
  /* A panel with nothing yet: what it is, then what to do in the game. */
  .empty b {
    display: block;
    margin-bottom: 8px;
    font: var(--t-title);
    color: var(--gold);
  }
  .empty small {
    display: block;
    margin-top: 8px;
    color: var(--text-off);
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 18px;
    margin: 0 0 12px;
  }
  input {
    width: min(280px, 100%);
    height: 30px;
    padding: 0 10px;
    border: 0;
    background: var(--stone-950);
    box-shadow: inset 0 0 0 1px var(--bronze-700);
    color: var(--text);
    font: var(--t-body);
  }
  input:focus {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--bronze-400);
  }
  .chips {
    display: flex;
    gap: 6px;
  }
  .chip {
    padding: 3px 10px;
    border: 0;
    border-radius: 13px;
    background: none;
    box-shadow: inset 0 0 0 1px var(--stone-500);
    color: var(--text-dim);
    font: var(--t-body);
    cursor: pointer;
  }
  .chip b {
    margin-left: 3px;
    font-weight: 500;
    color: var(--text-off);
  }
  .chip[aria-pressed='true'] {
    background: var(--stone-600);
    box-shadow: inset 0 0 0 1px var(--bronze-500);
    color: var(--gold);
  }
  .chip[aria-pressed='true'] b {
    color: var(--text-dim);
  }
  .doll {
    max-width: 470px;
  }
  .doll header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    padding: 0 2px 10px;
  }
  .doll .who {
    font: 400 19px/1 var(--display);
  }
  .doll .line {
    font: var(--t-small);
    color: var(--text-dim);
  }
  .body {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr) 46px;
    gap: 10px;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .picture {
    position: relative;
    display: grid;
    place-content: center;
    place-items: center;
    gap: 6px;
    height: 394px;
    padding: 0 16px;
    overflow: hidden;
    border-radius: 3px;
    background: radial-gradient(circle at 50% 40%, var(--stone-700), var(--stone-950)) center / cover;
    box-shadow: 0 0 0 1px #000, 0 0 0 2px var(--bronze-700);
    color: var(--text-off);
    font: var(--t-small);
    text-align: center;
  }
  .picture .under {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 18px 8px 7px;
    color: var(--text-dim);
    text-align: left;
    background: linear-gradient(transparent, #000d);
  }
  .picture .when {
    margin-right: auto;
  }
  .pbtn {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 9px;
    border: 0;
    border-radius: 2px;
    font: 500 13px/1 var(--font);
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
    background: linear-gradient(var(--stone-600), var(--stone-800));
    box-shadow: inset 0 1px 0 #ffffff1f, 0 0 0 1px #000, 0 0 0 2px var(--bronze-600);
  }
  .pbtn:hover {
    color: var(--gold);
  }
  .picture .wait {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 12px;
    padding: 24px;
    background: #0c0a08e6;
  }
  .picture .wait p {
    margin: 0;
    font: var(--t-body);
    color: var(--text);
  }
  .picture .wait kbd {
    display: inline-block;
    min-width: 22px;
    padding: 1px 6px;
    border-radius: 3px;
    font: 600 14px/20px var(--font);
    color: var(--gold);
    box-shadow: 0 0 0 1px var(--bronze-500);
  }
  .picture .wait small {
    color: var(--text-dim);
  }
  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 22px;
    margin-top: 14px;
    padding-top: 10px;
    box-shadow: 0 -1px 0 #ffffff14;
  }
  .stats h4 {
    grid-column: span 2;
    margin: 6px 0 2px;
    font: 600 12px/16px var(--font);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--gold);
  }
  .stats div {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 22px;
    color: var(--text-dim);
  }
  .stats b {
    font-weight: 500;
    color: var(--text);
  }
  .weapons {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 12px;
  }
  section > h2:first-child {
    margin-top: 0;
  }
  .box {
    margin-bottom: 12px;
  }
  h3 {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 0 0 6px;
    font: 600 13px/17px var(--font);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gold);
  }
  h3 small {
    font: var(--t-small);
    letter-spacing: 0;
    text-transform: none;
    color: var(--text-dim);
  }
  .grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .cell {
    position: relative;
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 4px;
    background: var(--stone-950);
    box-shadow: 0 0 0 1px #000, 0 0 0 2px var(--q, var(--stone-600));
    transition: opacity 0.12s;
  }
  .cell img {
    display: block;
    width: 40px;
    height: 40px;
    margin: 2px;
    border-radius: 3px;
  }
  .cell .n {
    position: absolute;
    right: 3px;
    bottom: 1px;
    font: 600 12px/1 var(--font);
    color: #fff;
    text-shadow: 0 0 2px #000, 0 0 2px #000, 0 0 2px #000;
  }
  .cell.free {
    box-shadow: 0 0 0 1px #000, 0 0 0 2px var(--stone-700);
  }
  .cell .slot {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font: 500 9.5px/1 var(--font);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-dim);
  }
  .cell .wear {
    position: absolute;
    left: 4px;
    bottom: 4px;
    height: 3px;
    background: #ffd200;
    box-shadow: 0 0 0 1px #000;
  }
  .cell .wear.broken {
    width: 36px !important;
    background: #ff3b30;
  }
  .cell.off {
    opacity: 0.22;
  }
  .sum {
    margin: 0 0 0 auto;
    color: var(--text-dim);
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  /* As the tables of the Auction House: the headings on a bar of their own that stays on top. */
  th {
    position: sticky;
    top: -14px; /* over the padding of the page */
    z-index: 1;
    padding: 8px 10px 6px;
    border-bottom: 1px solid var(--bronze-700);
    background: var(--stone-800);
    text-align: left;
    font: 600 12px/16px var(--font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-400);
    white-space: nowrap;
  }
  th button {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
    cursor: pointer;
  }
  th.on,
  th button:hover {
    color: var(--gold);
  }
  th svg {
    width: 9px;
    height: 9px;
    margin-left: 5px;
    fill: currentColor;
  }
  td {
    padding: 3px 10px;
    border-bottom: 1px solid #ffffff0a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tbody tr:hover td {
    background: #ffffff08;
  }
  .num {
    text-align: right;
  }
  .dim {
    color: var(--text-dim);
  }
  .none {
    color: var(--text-off);
  }
  .it {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ico {
    flex: none;
    width: 26px;
    height: 26px;
    border: 1px solid #000;
    background: #000;
    box-shadow: 0 0 0 1px var(--bronze-700);
  }
  .ico img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .nm {
    text-shadow: 0 1px 0 #000;
  }
  .other {
    cursor: pointer;
  }
  .other:hover td {
    background: #ffffff0d;
  }
  h2 {
    margin: 22px 0 6px;
    font: var(--t-title);
    color: var(--gold);
  }
  h2 span {
    margin-left: 8px;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .foot {
    margin: 10px 0 0;
    font: var(--t-small);
    color: var(--text-off);
  }
  /* The tables as wide as the place, whatever widths were dragged: the name gives first, then the columns that
     matter least go (the type, then what a vendor gives, then where it is). */
  @container items (max-width: 700px) {
    table {
      width: 100% !important;
      table-layout: auto !important;
    }
    th {
      width: auto !important;
    }
    td:first-child {
      max-width: 0;
      width: 100%;
    }
    .it {
      min-width: 0;
    }
    .nm {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .c-type {
      display: none;
    }
  }
  @container items (max-width: 480px) {
    .c-value {
      display: none;
    }
  }
  @container items (max-width: 340px) {
    .c-place {
      display: none;
    }
  }
  @container items (max-width: 440px) {
    main {
      padding: 12px 12px 24px;
    }
    .stats {
      grid-template-columns: minmax(0, 1fr);
    }
    .stats h4 {
      grid-column: auto;
    }
  }
</style>
