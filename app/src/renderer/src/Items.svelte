<script lang="ts">
  // Items: bags, bank, keyring and what is worn by the character shown, as wide as the window, from
  // the sheet the app keeps (shared/items.ts). It reads the same with the game closed, and says how
  // old it is. What is typed in the filter is looked for in every other character's sheet too.
  // Two views (M10-F14, mockup design/vendors/mockup/items2.html): Slots, what is worn as the game's
  // character window lays it and the bags and the bank as grids; Table, a row for each item.
  import { ago, type Known } from '../../shared/characters'
  import { coins, filterRows, gridsOf, itemMatches, itemRows, othersHolding, PLACES, QUALITY_COLORS, sortRows, wornOf, WORN_LEFT, WORN_RIGHT, WORN_WEAPONS, type Cell, type Column, type Grid, type ItemFacts, type ItemRow, type Place } from '../../shared/items'
  import type { Sheets } from '../../shared/sheet'
  import { TILES } from './web'

  let { sheets, shown, known, now, onpick }: { sheets: Sheets; shown: Known | null; known: Known[]; now: number; onpick: (key: string) => void } = $props()

  // What the game says of each item, made beside the map (tiles-worker.ts). Without it the items have their numbers and no prices.
  let facts = $state.raw<ItemFacts>({})
  $effect(() => {
    void fetch(`${TILES}/items.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((read: ItemFacts) => (facts = read))
      .catch(() => {})
  })

  let typed = $state('')
  let view = $state<'slots' | 'table'>(localStorage.getItem('itemsView') === 'table' ? 'table' : 'slots')
  $effect(() => localStorage.setItem('itemsView', view))
  let place = $state<Place | null>(null)
  let column = $state<Column>('value')
  let up = $state(false)
  const sheet = $derived(shown ? sheets[shown.key] : undefined)
  const all = $derived(sheet ? itemRows(sheet, facts) : [])
  const rows = $derived(sortRows(filterRows(all, typed).filter((r) => !place || r.place === place), column, up))
  const others = $derived(shown ? othersHolding(sheets, shown.key, facts, typed).flatMap((o) => o.rows.map((r) => ({ ...r, who: known.find((k) => k.key === o.key) }))) : [])
  const othersSorted = $derived(sortRows(others, column, up) as typeof others)
  const worn = $derived(sheet ? wornOf(sheet) : new Map())
  const grids = $derived(sheet ? gridsOf(sheet) : null)
  const worth = $derived(all.reduce((n, r) => n + r.value, 0))
  const money = $derived(typeof sheet?.pieces.money === 'number' ? sheet.pieces.money : null)
  const places = $derived(PLACES.map((p) => ({ p, n: all.filter((r) => r.place === p).length })).filter(({ p, n }) => n > 0 || p !== 'Keyring'))

  const COLUMNS: [Column, string][] = [['name', 'Item'], ['type', 'Type'], ['place', 'Where'], ['n', 'Qty'], ['value', 'Value']]
  // A click sorts by the column; another click turns it round. Names and types start from A, numbers from the most.
  function sortBy(c: Column): void {
    if (c === column) up = !up
    else ((column = c), (up = c === 'name' || c === 'type' || c === 'place'))
  }
  const when = $derived.by(() => {
    if (!sheet || !shown) return ''
    const bags = shown.live ? 'Bags as they are now' : `Bags as of ${ago(shown.seen, now)}`
    const bank = sheet.at.bank ? `bank ${ago(sheet.at.bank, now)}, when it was last open` : 'bank not seen yet: open it in game once'
    return `${bags} · ${bank[0]!.toUpperCase()}${bank.slice(1)}`
  })
</script>

{#snippet money_(copper: number)}
  {#each coins(copper) as [n, coin] (coin)}{n}<i class="coin {coin}"></i>{:else}<span class="none">-</span>{/each}
{/snippet}

{#snippet item(r: ItemRow)}
  <span class="it">
    <span class="ico"><img src="{TILES}/items/{r.id}.png" alt="" onerror={(e) => e.currentTarget.remove()} /></span>
    <span class="nm" style:color={QUALITY_COLORS[r.quality] ?? 'var(--text)'}>{r.name}</span>
  </span>
{/snippet}

<!-- A slot: an item with its picture, the edge in its quality's colour, how many, and its wear; or a free one, with the word of what goes there. -->
{#snippet cell(c: Cell, label = '', wear?: { now?: number; most?: number })}
  {#if c}
    {@const q = facts[c.item]?.[1] ?? 1}
    {@const name = facts[c.item]?.[0] ?? `Item ${c.item}`}
    {@const left = wear?.most ? (wear.now ?? 0) / wear.most : 1}
    <span class="cell" class:off={!itemMatches(c.item, facts, typed)} style:--q={q > 1 ? (QUALITY_COLORS[q] ?? null) : null} title={wear?.most ? `${name} · durability ${wear.now} / ${wear.most}` : name}>
      <img src="{TILES}/items/{c.item}.png" alt={name} onerror={(e) => e.currentTarget.remove()} />
      {#if c.n > 1}<span class="n">{c.n}</span>{/if}
      {#if left < 0.5}<span class="wear" class:broken={left === 0} style:width="{Math.max(3, 36 * left)}px"></span>{/if}
    </span>
  {:else}
    <span class="cell free" class:off={!!typed.trim() && !label}>{#if label}<span class="slot">{label}</span>{/if}</span>
  {/if}
{/snippet}

{#snippet wornSlot([slot, label]: [number, string])}
  {@const w = worn.get(slot)}
  {@render cell(w ? { item: w.item, n: 1 } : null, label, w)}
{/snippet}

{#snippet grid(name: string, g: Grid)}
  <div class="box">
    <h3>{name}<small>{g.used ? `${g.used} of ${g.slots} used` : `empty · ${g.slots} slots`}</small></h3>
    {#if g.used}<div class="grid">{#each g.cells as c, i (i)}{@render cell(c)}{/each}</div>{/if}
  </div>
{/snippet}

{#snippet heads(columns: [Column | null, string][])}
  <thead>
    <tr>
      {#each columns as [c, label] (label)}
        <th class:num={c === 'n' || c === 'value'} class:on={c === column} aria-sort={c === column ? (up ? 'ascending' : 'descending') : undefined}>
          {#if c}
            <button onclick={() => sortBy(c)}>{label}{#if c === column}<svg viewBox="0 0 10 10" aria-hidden="true"><path d={up ? 'M1 7h8L5 2z' : 'M1 3h8L5 8z'} /></svg>{/if}</button>
          {:else}{label}{/if}
        </th>
      {/each}
    </tr>
  </thead>
{/snippet}

<main class="surface">
  {#if !shown || !sheet}
    <p class="empty">No character yet. Play one with the Twinmap Forever addon on and its bags show here, also when the game is closed.</p>
  {:else}
    <div class="tools">
      <input type="search" placeholder="Filter by name or type" aria-label="Filter items" bind:value={typed} />
      <div class="views" role="group" aria-label="View">
        <button aria-pressed={view === 'slots'} onclick={() => (view = 'slots')}>Slots</button>
        <button aria-pressed={view === 'table'} onclick={() => (view = 'table')}>Table</button>
      </div>
      {#if view === 'table'}
        <div class="chips" role="group" aria-label="Where">
          <button class="chip" aria-pressed={!place} onclick={() => (place = null)}>All <b>{all.length}</b></button>
          {#each places as { p, n } (p)}
            <button class="chip" aria-pressed={place === p} onclick={() => (place = place === p ? null : p)}>{p} <b>{n}</b></button>
          {/each}
        </div>
      {/if}
      <p class="sum">Worth {@render money_(worth)} at a vendor{#if money !== null}{' · '}Money {@render money_(money)}{/if}</p>
    </div>
    {#if view === 'slots' && grids}
      <div class="page">
        <section class="doll" aria-label="Worn">
          <header><span class="who" style:color={shown.color}>{shown.key}</span><span class="line">{shown.line}</span></header>
          <div class="body">
            <div class="col">{#each WORN_LEFT as s (s[0])}{@render wornSlot(s)}{/each}</div>
            <div>
              <div class="picture"><span>No picture of {shown.key.split(' ')[0]} yet</span></div>
              <div class="weapons">{#each WORN_WEAPONS as s (s[0])}{@render wornSlot(s)}{/each}</div>
            </div>
            <div class="col">{#each WORN_RIGHT as s (s[0])}{@render wornSlot(s)}{/each}</div>
          </div>
        </section>
        <section class="held" aria-label="Bags and bank">
          <h2>Bags<span>{shown.live ? 'as they are now' : `as of ${ago(shown.seen, now)}`}</span></h2>
          {@render grid('Backpack and bags', grids.bags)}
          {#if grids.reagents.slots}{@render grid('Reagent bag', grids.reagents)}{/if}
          {#if grids.keyring.slots}{@render grid('Keyring', grids.keyring)}{/if}
          <h2>Bank<span>{sheet.at.bank ? `seen ${ago(sheet.at.bank, now)}` : 'not seen yet: open it in game once'}</span></h2>
          {#if grids.bank.slots}{@render grid('Bank and its bags', grids.bank)}{/if}
        </section>
      </div>
    {:else}
    <table>
      {@render heads(COLUMNS)}
      <tbody>
        {#each rows as r (r.place + r.id)}
          <tr><td>{@render item(r)}</td><td class="dim">{r.type}</td><td>{r.place}</td><td class="num">{r.n}</td><td class="num">{@render money_(r.value)}</td></tr>
        {:else}
          <tr><td colspan="5" class="none">{typed ? `${shown.key} has nothing like "${typed}".` : 'Nothing here.'}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="foot">{when}</p>
    {/if}

    {#if othersSorted.length}
      <h2>Other characters<span>kept on this PC</span></h2>
      <table>
        {@render heads([['name', 'Item'], [null, 'Character'], ['type', 'Type'], ['place', 'Where'], ['n', 'Qty'], ['value', 'Value']])}
        <tbody>
          {#each othersSorted as r (r.who?.key + r.place + r.id)}
            <tr class="other" onclick={() => r.who && onpick(r.who.key)} title="Show {r.who?.key}">
              <td>{@render item(r)}</td><td style:color={r.who?.color}>{r.who?.key}</td><td class="dim">{r.type}</td><td>{r.place}</td><td class="num">{r.n}</td><td class="num">{@render money_(r.value)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="foot">{[...new Set(othersSorted.map((r) => r.who))].map((k) => k && `${k.key}: seen ${ago(k.seen, now)}`).filter(Boolean).join(' · ')}</p>
    {/if}
  {/if}
</main>

<style>
  main {
    position: absolute;
    inset: 46px 0 0;
    overflow-y: auto;
    padding: 14px 20px 32px;
    font-variant-numeric: tabular-nums;
  }
  .empty {
    max-width: 520px;
    margin: 64px auto;
    color: var(--text-dim);
    text-align: center;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 18px;
    margin: 0 0 12px;
  }
  input {
    width: 280px;
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
  .views {
    display: inline-flex;
    border-radius: 15px;
    box-shadow: inset 0 0 0 1px var(--bronze-600);
    overflow: hidden;
  }
  .views button {
    padding: 4px 13px;
    border: 0;
    background: none;
    color: var(--text-dim);
    font: var(--t-body);
    cursor: pointer;
  }
  .views button[aria-pressed='true'] {
    background: var(--bronze-700);
    color: var(--text);
  }
  .page {
    display: grid;
    grid-template-columns: 470px minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }
  .doll {
    padding: 12px 14px 14px;
    border-radius: 3px;
    background: linear-gradient(#ffffff08, #00000030);
    box-shadow: inset 0 0 0 1px #ffffff12, 0 0 0 1px #000;
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
    display: grid;
    place-items: center;
    height: 394px;
    border-radius: 3px;
    background: radial-gradient(circle at 50% 40%, var(--stone-700), var(--stone-950));
    box-shadow: 0 0 0 1px #000, 0 0 0 2px var(--bronze-700);
    color: var(--text-off);
    font: var(--t-small);
  }
  .weapons {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 12px;
  }
  .held h2:first-child {
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
  th {
    padding: 6px 10px;
    border-bottom: 1px solid var(--bronze-700);
    text-align: left;
    font: 500 13px/17px var(--font);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--text-dim);
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
  }
  tr:nth-child(even) td {
    background: #ffffff05;
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
    background: var(--stone-950);
    box-shadow: 0 0 0 1px #000;
  }
  .ico img {
    display: block;
    width: 26px;
    height: 26px;
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
</style>
