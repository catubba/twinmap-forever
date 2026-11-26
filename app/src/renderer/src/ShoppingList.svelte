<script lang="ts">
  // The shopping list of the character picked (M10-F4, preview design/vendors/mockup/shopping.html), in the side panel above
  // Now: what it is making, the parts to make first, what is missing with where to get it (another character, the nearest
  // vendor and its price, a recipe not learned, who drops it) and what is ready. Its band folds it. Empty, it is not shown.
  // The logic is in shared/shopping.ts; the lists are kept for every screen (shared/kept.ts). Under it (M10-F19), the vendors of
  // what is missing, the nearest of each: their pins on the map, or the stops of the route in the order to walk them.
  import { untrack } from 'svelte'
  import { ago, firstName, type Known } from '../../shared/characters'
  import type { Position } from '../../shared/game'
  import { around, t } from '../../shared/i18n'
  import { unitsOfPlace } from '../../shared/geo'
  import { coins, ITEMS_FILE, QUALITY_COLORS, type ItemFacts } from '../../shared/items'
  import type { GameMap } from '../../shared/maps'
  import { whereIs } from '../../shared/now'
  import { PROFESSION_TRAINERS } from '../../shared/profession-trainers'
  import { inWalkOrder, type Stop } from '../../shared/route'
  import type { Sheets } from '../../shared/sheet'
  import { heldBy, planOf, recipeOf, recipesByItem, setGoal, type Goal, type Need, type Recipe, type ShoppingLists } from '../../shared/shopping'
  import { holdersOf, sellersOf, type ItemSources } from '../../shared/tips'
  import { trainerReads, type TrainerFacts } from '../../shared/trainers'
  import { TRAINERS_SEEN } from '../../shared/trainers-seen'
  import { itemTip } from './item-tip.svelte'
  import { TILES } from './web'

  // onvendors: the NPCs whose pins the map shows whatever its filters (none: the button is off); onroute: stops for the route.
  let { lists, onchange, sheets, shown, side, pos, now, onvendors, onroute }: { lists: ShoppingLists; onchange: (lists: ShoppingLists) => void; sheets: Sheets; shown: Known | null; side?: string; pos?: Position; now: number; onvendors?: (npcs: number[]) => void; onroute?: (stops: Stop[]) => void } = $props()

  // What the game says of the items, its recipes and its maps, made beside the map (tiles-worker.ts).
  let items = $state.raw<ItemFacts>({})
  let crafts = $state.raw<TrainerFacts['crafts']>({})
  let lines = $state.raw<TrainerFacts['lines']>({})
  let maps = $state.raw<GameMap[]>([])
  const key = $derived(shown?.key ?? '')
  const goals = $derived(lists[key] ?? [])
  // Read once there is a list; asked again every few seconds while one is missing (the map still being made: a first run, a new build).
  let tries = $state(0)
  $effect(() => {
    if (!goals.length || (Object.keys(items).length && Object.keys(crafts).length && maps.length)) return
    void tries
    const get = <T,>(file: string, set: (v: T) => void): void =>
      void fetch(`${TILES}/${file}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((v: T | null) => v && set(v))
        .catch(() => {})
    if (!Object.keys(items).length) get<ItemFacts>(ITEMS_FILE, (v) => (items = v))
    if (!Object.keys(crafts).length) get<TrainerFacts>('trainers.json', (v) => ((crafts = v.crafts ?? {}), (lines = v.lines ?? {})))
    if (!maps.length) get<GameMap[]>('maps.json', (v) => (maps = v))
    const again = setTimeout(() => tries++, 5000)
    return () => clearTimeout(again)
  })

  const sheet = $derived(sheets[key])
  const known = $derived.by(() => {
    const r = (sheet?.pieces.recipes ?? {}) as { known?: unknown }
    return new Set(Array.isArray(r.known) ? (r.known as number[]) : [])
  })
  // The professions whose window was open once: before that, the recipes known of it are not read (shared/npc-panel.ts, craftOf).
  const read = $derived.by(() => {
    const r = (sheet?.pieces.recipes ?? {}) as { seen?: unknown }
    return new Set(Array.isArray(r.seen) ? (r.seen as number[]) : [])
  })
  const skillOf = (line: number): number => {
    const skills = Array.isArray(sheet?.pieces.skills) ? (sheet.pieces.skills as unknown[][]) : []
    return Number(skills.find((s) => Array.isArray(s) && s[0] === line)?.[1]) || 0
  }
  // A profession the character has, its window not open yet: whether a recipe of it is known is not known.
  const unread = (line: number): boolean => skillOf(line) > 0 && !read.has(line)
  const holders = (item: number): ReturnType<typeof holdersOf> => holdersOf(sheets, item)
  const plan = $derived(planOf(goals, crafts, known, (item) => heldBy(holders(item), key)))
  const byItem = $derived(recipesByItem(crafts))
  // The skill a recipe asks at the trainer: as the addon read it at one, or the trainers' table.
  const reads = $derived(trainerReads(sheets, TRAINERS_SEEN))
  const skillFor = (r: Recipe): number => reads.lines.get(r.spell)?.[3] || (Object.values(PROFESSION_TRAINERS).find((p) => p.skill === r.line)?.fees[r.spell]?.[1] ?? 0)

  // Who sells each missing item, asked once; the nearest of the character's side first.
  let sources = $state.raw<Record<number, ItemSources>>({})
  $effect(() => {
    for (const m of plan.missing)
      if (!(m.item in sources)) {
        sources = { ...sources, [m.item]: { sold: [], drops: [], found: [] } }
        void window.twinmap.itemSources(m.item).then((s) => (sources = { ...sources, [m.item]: s }))
      }
  })
  const zones = $derived(new Map(maps.filter((m) => m.level === 'zone' && m.area).map((m) => [m.area, m])))
  const here = $derived(whereIs(maps, pos))
  const sellerOf = (item: number): ItemSources['sold'][number] | undefined => sellersOf(sources[item]?.sold ?? [], side, zones, here)[0]
  const zoneName = (area: number): string => zones.get(area)?.name ?? ''

  const name = (item: number): string => items[item]?.[0] ?? t('items.unknownItem', { id: item })
  // What a vendor asks for as many as are missing: a price for perBuy of them; none for an item of a holiday or without one.
  const cost = (m: Need): number => {
    const f = items[m.item]
    if (!f || !sellerOf(m.item) || !(f[5] > 0) || f[7]) return 0
    return Math.ceil((m.need - m.bags - m.bank) / Math.max(1, f[6])) * f[5]
  }
  const toBuy = $derived(plan.missing.reduce((n, m) => n + cost(m), 0))
  const amounts = (r: Recipe): string => {
    const list = r.takes.map(([item, n]) => t('items.shopping.amount', { count: n, item: name(item) })).join(', ')
    return r.makes > 1 ? t('items.shopping.takesFor', { items: list, count: r.makes }) : t('items.shopping.takes', { items: list })
  }
  const held = (bags: number, bank: number): string => [bags && t('items.popup.inBags', { count: bags }), bank && t('items.popup.inBank', { count: bank })].filter(Boolean).join(', ')

  const goalWhy = (g: Goal): { text: string; short: boolean } | null => {
    const r = g.spell ? recipeOf(crafts, g.spell) : null
    if (!r) return null
    const profession = lines[r.line] ?? ''
    if (known.has(r.spell)) return { text: t('items.shopping.youKnow', { profession }), short: false }
    if (unread(r.line)) return { text: t('items.shopping.unread', { profession }), short: false }
    const skill = skillFor(r), have = skillOf(r.line)
    return { text: skill > have ? t('items.shopping.needs', { profession, skill, have }) : t('items.shopping.notKnown', { profession }), short: true }
  }

  let folded = $state(localStorage.getItem('shoppingFolded') === '1')
  const fold = (): void => {
    folded = !folded
    localStorage.setItem('shoppingFolded', folded ? '1' : '')
  }
  let showReady = $state(false)

  // The vendors the missing lines name (another character holding one comes first there, and then no vendor is named), once each.
  const vendors = $derived.by(() => {
    const out = new Map<number, ItemSources['sold'][number]>()
    for (const m of plan.missing) {
      const seller = !holders(m.item).some((h) => h.key !== key && (h.bags || h.bank)) && sellerOf(m.item)
      if (seller && zones.get(seller.area)?.rect) out.set(seller.npc, seller)
    }
    return [...out.values()]
  })
  let onMap = $state(false)
  // Untracked: what the app does with them is no reason to say them again.
  $effect(() => {
    const npcs = onMap ? vendors.map((v) => v.npc) : []
    untrack(() => onvendors?.(npcs))
  })
  const toRoute = async (): Promise<void> => {
    const stops = vendors.flatMap((v): Stop[] => {
      const zone = zones.get(v.area)!
      return zone.continent === null ? [] : [{ name: v.name, continent: zone.continent, at: unitsOfPlace(zone.rect!, v.x, v.y), pin: { m: zone.id, x: v.x, y: v.y } }]
    })
    onroute?.(await inWalkOrder(here, stops, (from, to) => window.twinmap.walkFar({ continent: here!.continent, from: { ...from }, to: to.map((p) => ({ ...p })), reach: 2500 })))
  }
  const set = (g: Goal, n: number): void => onchange(setGoal(lists, key, g, n))
</script>

{#snippet money(copper: number)}
  {#each coins(copper) as [n, coin] (coin)}{n}<i class="coin {coin}"></i>{/each}
{/snippet}

<!-- A picture made again when its source changes: one that failed (the facts not read yet) is taken away, and its place stays empty. -->
{#snippet pic(item: number)}
  <span class="ico">{#key item}<img src="{TILES}/items/{item}.png" alt="" onerror={(e) => e.currentTarget.remove()} />{/key}</span>
{/snippet}

{#snippet from(m: Need)}
  {@const other = holders(m.item).find((h) => h.key !== key && (h.bags || h.bank))}
  {@const seller = sellerOf(m.item)}
  {@const f = items[m.item]}
  {@const recipe = byItem.get(m.item)?.[0]}
  {@const drop = sources[m.item]?.drops[0]}
  <span class="from">
    {#if other}
      <span class="alt">{firstName(other.key)}</span> {held(other.bags, other.bank)}
    {:else if seller}
      {@const by = zoneName(seller.area) ? around('items.popup.soldByIn', 'npc', { zone: zoneName(seller.area) }) : around('items.popup.soldBy', 'npc')}
      {by[0]}<span class="v">{seller.name}</span>{by[1]}{#if f && f[5] > 0}{' · '}{#if f[6] > 1}{@const pack = around('items.popup.perPack', 'price', { count: f[6] })}{pack[0]}{@render money(f[5])}{pack[1]}{:else}{@render money(f[5])}{/if}{/if}
    {:else if recipe}
      {unread(recipe.line) ? t('items.shopping.unread', { profession: lines[recipe.line] ?? '' }) : t('items.shopping.toLearn', { profession: lines[recipe.line] ?? '', skill: skillFor(recipe) || '?' })} · {amounts(recipe)}
    {:else if drop}
      {zoneName(drop.area) ? t('items.popup.dropsFromIn', { npc: drop.name, zone: zoneName(drop.area) }) : t('items.popup.dropsFrom', { npc: drop.name })}
    {/if}
  </span>
{/snippet}

{#if goals.length && shown}
  <section class="shopping" aria-label={t('items.shopping.title')}>
    <h2 class="band">
      <button class="fold" aria-expanded={!folded} title={folded ? t('items.shopping.unfold') : t('items.shopping.fold')} onclick={fold}>
        <span>{t('items.shopping.title')}</span>
        {#if folded}
          {@const buy = around('items.shopping.toBuy', 'price')}
          <span class="sum">{plan.missing.length ? t('items.shopping.folded', { count: plan.missing.length }) : t('items.shopping.foldedNone')}{#if toBuy}{' · '}{buy[0]}{@render money(toBuy)}{buy[1]}{/if}</span>
        {/if}
        <span class="chev" class:shut={folded} aria-hidden="true">▾</span>
      </button>
    </h2>
    {#if !folded}
      <p class="who">
        <span class="sub">{t('items.shopping.forWho', { name: firstName(key) })}</span>
        {#if typeof sheet?.pieces.money === 'number'}<span class="price">{@render money(sheet.pieces.money)}</span>{/if}
      </p>
      <div class="list">
        <h3 class="grp"><span>{t('items.shopping.making', { count: goals.length })}</span></h3>
        {#each goals as g (`${g.item} ${g.spell ?? ''}`)}
          {@const why = goalWhy(g)}
          <div class="row" use:itemTip={{ item: g.item }}>
            {@render pic(g.item)}
            <span class="name" style:color={QUALITY_COLORS[items[g.item]?.[1] ?? 1]}>{name(g.item)}{#if why}<span class="from" class:short={why.short}>{why.text}</span>{/if}</span>
            <span class="qty">
              <button class="plus" aria-label={t('items.shopping.fewer')} title={t('items.shopping.fewer')} onclick={() => set(g, g.n - 1)}>−</button>
              <b>{g.n}</b>
              <button class="plus" aria-label={t('items.shopping.more')} title={t('items.shopping.more')} onclick={() => set(g, g.n + 1)}>+</button>
            </span>
          </div>
        {/each}
        {#if plan.first.length}
          <h3 class="grp"><span>{t('items.shopping.makeFirst', { count: plan.first.length })}</span></h3>
          {#each plan.first as p (p.item)}
            {@const make = around('items.shopping.make', 'count')}
            <div class="row made" use:itemTip={{ item: p.item }}>
              {@render pic(p.item)}
              <span class="name">{name(p.item)}<span class="from">{amounts(p.recipe)}</span></span>
              <span class="count">{make[0]}<b>{p.make}</b>{make[1]}</span>
            </div>
          {/each}
        {/if}
        {#if plan.missing.length}
          {@const buy = around('items.shopping.toBuy', 'price')}
          <h3 class="grp"><span>{t('items.shopping.missing', { count: plan.missing.length })}</span>{#if toBuy}<span class="price">{buy[0]}{@render money(toBuy)}{buy[1]}</span>{/if}</h3>
          {#each plan.missing as m (m.item)}
            {@const of = around('items.shopping.of', 'missing', { count: m.need })}
            <div class="row" use:itemTip={{ item: m.item }}>
              {@render pic(m.item)}
              <span class="name">{name(m.item)}{@render from(m)}</span>
              <span class="count">{of[0]}<b class="miss">{m.need - m.bags - m.bank}</b>{of[1]}</span>
            </div>
          {/each}
        {/if}
        {#if plan.ready.length && (showReady || !plan.missing.length)}
          <h3 class="grp"><span>{t('items.shopping.ready', { count: plan.ready.length })}</span></h3>
          {#each plan.ready as r (r.item)}
            <div class="row done" use:itemTip={{ item: r.item }}>
              {@render pic(r.item)}
              <span class="name">{name(r.item)}<span class="from">{held(r.bags, r.bank)}</span></span>
              <span class="count"><b class="ok">{r.need}</b> ✓</span>
            </div>
          {/each}
        {/if}
      </div>
      {#if plan.ready.length && plan.missing.length}
        <button class="more" aria-expanded={showReady} onclick={() => (showReady = !showReady)}>
          <span>{t('items.shopping.ready', { count: plan.ready.length })}{#if !showReady}&nbsp; <span class="off">{plan.ready.map((r) => `${name(r.item)} ${r.need}`).join(', ')}</span>{/if}</span>
          <b>{showReady ? t('items.npc.hide') : t('items.npc.show')}</b>
        </button>
      {/if}
      {#if vendors.length && (onvendors || onroute)}
        <p class="go">
          {#if onvendors}<button class="btn" aria-pressed={onMap} onclick={() => (onMap = !onMap)}>{t('items.shopping.onMap')}</button>{/if}
          {#if onroute}<button class="btn" onclick={toRoute}>{t('items.shopping.toRoute')}</button>{/if}
        </p>
      {/if}
      <p class="foot">{sheet?.at.bank ? t('items.npc.bankSeen', { ago: ago(sheet.at.bank, now), name: firstName(key) }) : t('items.npc.bankUnseen', { name: firstName(key) })}</p>
    {/if}
  </section>
{/if}

<style>
  .shopping {
    display: flex;
    flex-direction: column;
    max-height: min(60vh, 560px);
    margin-bottom: 8px;
    font-variant-numeric: tabular-nums;
  }
  /* Alone in a panel (a block of Now taken out, App.svelte) it is as tall as the panel. */
  :global(.dv-host > .block) > .shopping {
    flex: 1;
    min-height: 0;
    max-height: none;
    margin-bottom: 0;
  }
  .band {
    flex: none;
    padding-right: 0;
  }
  .fold {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 100%;
    padding: 0 12px 0 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  .sum {
    margin-left: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--t-small);
    color: var(--text-dim);
    text-shadow: none;
  }
  .chev {
    margin-left: auto;
    font: 400 12px/1 var(--font);
    color: var(--text-dim);
    transition: transform 0.15s;
  }
  .sum + .chev {
    margin-left: 0;
  }
  .chev.shut {
    transform: rotate(-90deg);
  }
  .who {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin: 0;
    padding: 8px 16px 6px;
  }
  .who .sub {
    color: var(--text-dim);
  }
  .price {
    white-space: nowrap;
  }
  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .grp {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin: 0;
    padding: 10px 16px 3px;
    font: 600 13px/17px var(--font);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--gold);
    border-bottom: 1px solid #ffffff14;
  }
  .grp .price {
    font: var(--t-small);
    letter-spacing: 0;
    text-transform: none;
    color: var(--text);
  }
  .row {
    display: grid;
    grid-template-columns: 26px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    min-height: 40px;
    padding: 3px 16px;
  }
  .row:hover {
    background: #ffffff0f;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .from {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .from.short {
    color: var(--objective);
  }
  .from .v {
    color: var(--service);
  }
  .from .alt {
    color: var(--gold);
  }
  .qty {
    display: inline-flex;
    align-items: center;
  }
  .qty b {
    min-width: 26px;
    text-align: center;
    font-weight: 500;
  }
  .qty .plus {
    width: 18px;
    height: 18px;
    font-size: 14px;
  }
  .count {
    text-align: right;
    white-space: nowrap;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .count b {
    font: 500 15.5px/21px var(--font);
    color: var(--text);
  }
  .count b.miss {
    color: var(--objective);
  }
  .count b.ok {
    color: var(--done);
  }
  .ico {
    position: relative;
    width: 26px;
    height: 26px;
    border-radius: 3px;
    box-shadow:
      0 0 0 1px #000,
      0 0 0 2px var(--bronze-700);
  }
  .ico img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 3px;
  }
  .made .ico::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 4px;
    box-shadow: 0 0 0 1px var(--bronze-400);
  }
  .done .name,
  .done .from {
    color: var(--text-dim);
  }
  .done img {
    filter: grayscale(0.6) brightness(0.8);
  }
  .more {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    flex: none;
    width: 100%;
    padding: 9px 16px;
    border: 0;
    background: none;
    font: var(--t-body);
    color: var(--text-dim);
    text-align: left;
    box-shadow: 0 -1px 0 #ffffff14;
    cursor: pointer;
  }
  .more > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .more .off {
    color: var(--text-off);
  }
  .more b {
    flex: none;
    font-weight: 400;
    color: var(--gold);
  }
  .go {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    flex: none;
    margin: 0;
    padding: 8px 16px;
    box-shadow: 0 -1px 0 #ffffff14;
  }
  .foot {
    flex: none;
    margin: 0;
    padding: 8px 16px 10px;
    font: var(--t-small);
    color: var(--text-dim);
    box-shadow:
      0 -1px 0 var(--bronze-600),
      0 -2px 0 #000;
  }
</style>
