<script module lang="ts">
  let alertsTaken = 0 // the last asking of Now for the Alerts view that was answered, across openings of the tab
</script>

<script lang="ts">
  // Auction House (M18-F7): the prices of the house the character sells at, as wide as the window,
  // as approved on design/ah/mock.html (design/ui.md, section 5). The game's categories on the left,
  // a row for each item with its kinds, the page of an item with what is on sale cheapest first, a
  // search that forgives a letter, and the line Blizzard's terms ask for. Data: shared/ah.ts.
  import { afterCut, ahItems, ALERT_WHEN, alertLowest, type Alert, type AlertWhen, categoriesOf, disenchantOf, disenchantValue, houseLine, houseNumber, lowestOf, nextPrices, countsAt, ownedOf, priceOf, suffixOf, REGIONS, rulesetName, rulesetOf, RULESETS, search, sideName, type AhItem, type AhNames, type Category, type History, type Home, type House, type HouseHints, type Kind, type Listing, type Owned, type OwnedPlace, type PricesTold, type Region, type Side } from '../../shared/ah'
  import { coins, QUALITY_TEXT as QUALITY_COLORS, typeOf, type ItemFacts } from '../../shared/items'
  import type { Known } from '../../shared/characters'
  import type { Sheets } from '../../shared/sheet'
  import Chart, { placed } from './Chart.svelte'
  import { columns } from './columns'
  import { untrack } from 'svelte'
  import Glyph from './Glyph.svelte'
  import { TILES } from './web'
  import { around, clock, num, t, type Key } from '../../shared/i18n'

  // listing: the prices of the house on show (App.svelte). homes: each character's own house, as the game told it.
  // alerts: of every character (M18-F10); showAlerts: a number new each time Now asks for the Alerts view.
  let { house, chosen, hints, who, prices, listing, sheets, known, homes, now, alerts, showAlerts, onchoose }: { house: House | null; chosen: boolean; hints: HouseHints | null; who: string | null; prices: PricesTold | null; listing: Listing | null; sheets: Sheets; known: Known[]; homes: Record<string, Home>; now: number; alerts: Alert[]; showAlerts: number; onchoose: (h: House | null) => void } = $props()

  // What the game says of each item and the names of its categories and kinds, made beside the map.
  let facts = $state.raw<ItemFacts>({})
  let names = $state.raw<AhNames>({ classes: {}, subs: {}, suffixes: {} })
  $effect(() => {
    void fetch(`${TILES}/items.json`).then((r) => (r.ok ? r.json() : {})).then((f: ItemFacts) => (facts = f)).catch(() => {})
    void fetch(`${TILES}/ah-names.json`).then((r) => (r.ok ? r.json() : null)).then((n: AhNames | null) => n && (names = n)).catch(() => {})
  })

  const items = $derived(listing ? ahItems(listing, facts, names) : [])
  const cats = $derived(categoriesOf(items, names))

  let typed = $state('')
  let category = $state<string | null>(null)
  let filtersOpen = $state(false)
  let minLevel = $state(''), maxLevel = $state(''), quality = $state(''), minPrice = $state(''), maxPrice = $state('')
  const level = (v: string): number | undefined => (/^\d+$/.test(v.trim()) ? Number(v) : undefined)
  const filters = $derived({ typed, category, minLevel: level(minLevel), maxLevel: level(maxLevel), quality: quality === '' ? undefined : Number(quality), minPrice: priceOf(minPrice), maxPrice: priceOf(maxPrice) })
  const active = $derived([minLevel, maxLevel, quality, minPrice, maxPrice].filter((v) => v.trim() !== '').length)
  // A click on a heading sorts by its column; another turns it round. Names from A, numbers from the most.
  type Sort = { by: string; up: boolean } | null
  let browseSort = $state<Sort>(null), mineSort = $state<Sort>(null)
  const turn = (now: Sort, by: string, text: boolean): Sort => (now?.by === by ? { by, up: !now.up } : { by, up: text })
  const order = <T,>(rows: T[], sort: Sort, value: (row: T, by: string) => string | number): T[] => {
    if (!sort) return rows
    const by = (a: T, b: T): number => {
      const x = value(a, sort.by), y = value(b, sort.by)
      return typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
    }
    return [...rows].sort((a, b) => (sort.up ? by(a, b) : by(b, a)))
  }
  const found = $derived(
    order(search(items, filters), browseSort, (it, by) => (by === 'name' ? it.name : by === 'lowest' ? it.lowest : by === 'typical' ? Math.min(...it.kinds.map((k) => k.typical)) : by === 'available' ? it.available : it.vendor)),
  )
  const SHOWN = 300 // rows drawn at once: more on asking
  let most = $state(SHOWN)
  $effect(() => {
    void filters
    most = SHOWN
  })
  let open = $state(new Set<number>())
  let perStack = $state(localStorage.getItem('ahStack') === 'yes')
  $effect(() => localStorage.setItem('ahStack', perStack ? 'yes' : 'no'))
  const times = (it: AhItem): number => (perStack ? it.stack : 1)

  // The page of an item, and which of its kinds.
  let page = $state<{ id: number; key: string } | null>(null)
  const pageItem = $derived(page ? items.find((it) => it.id === page!.id) : undefined)
  const pageKind = $derived(pageItem?.kinds.find((k) => k.key === page!.key) ?? pageItem?.kinds[0])

  // The history (M18-F9): the last 24 hours of the rows on show for their column, and the days too for the page's chart.
  let sparks = $state.raw<{ snapshot: string; of: Record<string, History> }>({ snapshot: '', of: {} })
  $effect(() => {
    const snapshot = listing?.snapshot ?? '', keys = page || yours ? [] : found.slice(0, most).map((it) => it.kinds[0]!.key)
    if (!snapshot || !keys.length) return
    let gone = false
    void window.twinmap.ahHistory(keys, false).then((of) => !gone && (sparks = { snapshot, of: sparks.snapshot === snapshot ? { ...sparks.of, ...of } : of }))
    return () => (gone = true)
  })
  let chartOf = $state.raw<{ key: string; snapshot: string; history: History | null } | null>(null)
  $effect(() => {
    const key = pageKind?.key, snapshot = listing?.snapshot
    if (!key || !snapshot) return
    let gone = false
    void window.twinmap.ahHistory([key], true).then((of) => !gone && (chartOf = { key, snapshot, history: of[key] ?? null }))
    return () => (gone = true)
  })

  // The house chooser: asked for, or shown by itself when the house is not known.
  let choosing = $state(false)
  const told = $derived(rulesetOf(hints?.rs))
  let region = $state<Region>('EU'), ruleset = $state(2), side = $state<'A' | 'H'>('A'), neutral = $state(false)
  function startChoosing(): void {
    const h = house
    region = h?.region ?? ((String(hints?.region ?? '').toUpperCase() as Region) || 'EU')
    if (!REGIONS.includes(region)) region = 'EU'
    ruleset = h?.ruleset ?? told ?? 2
    side = h?.side === 'H' || (!h && hints?.side === 'H') ? 'H' : 'A'
    neutral = h?.side === 'N'
    choosing = true
  }
  $effect(() => {
    if (!house && !choosing) startChoosing()
  })
  function choose(): void {
    onchoose({ region, ruleset, side: neutral ? 'N' : (side as Side) })
    choosing = false
    page = null
  }

  const snapshot = $derived(listing ? Date.parse(listing.snapshot) : 0)
  const old = $derived(listing ? now - snapshot : 0)
  const age = (ms: number): string => (ms < 2 * 3_600_000 ? t('auction.age.minutes', { count: Math.round(ms / 60_000) }) : ms < 48 * 3_600_000 ? t('auction.age.hours', { count: Math.round(ms / 3_600_000) }) : t('auction.age.days', { count: Math.round(ms / 86_400_000) }))
  // A text with two {names} cut around them, for the fields put in the middle of it: before, between, after.
  const cut2 = (key: Key, a: string, b: string): [string, string, string] => {
    const [before, rest] = around(key, a, { [b]: '' })
    const [between = '', after = ''] = rest.split('')
    return [before, between, after]
  }
  // Texts cut around a field or an element put in the middle of them, the same at every drawing.
  const lv = cut2('auction.filters.level', 'from', 'to'), pr = cut2('auction.filters.lowestPrice', 'from', 'to')
  const whenCut = around('auction.page.whenLowest', 'when'), foot = around('auction.foot.attribution', 'source')
  const category_ = (key: string | null): string => {
    if (!key) return t('auction.nav.all')
    const parts = key.split('.')
    const top = cats.find((c) => c.key === parts[0]), mid = top?.kids.find((c) => c.key === parts.slice(0, 2).join('.')), low = mid?.kids.find((c) => c.key === key)
    return [top, mid, low].filter(Boolean).map((c) => c!.name).join(' · ')
  }
  // After the name of a kind, as the game's list has it: the level the item asks for, between brackets.
  const levelOf = (it: AhItem): string => (it.level ? ` (${it.level})` : '')
  const kindName = (it: AhItem, k: Kind): string => (k.suffix ? `${it.name} ${k.suffix}` : it.name)
  // My items (M18-F8): what the characters of this house hold, each kind at its own lowest price.
  let yours = $state<'mine' | 'alerts' | null>(null) // My items or Alerts on show, instead of a category
  let from = $state<'mine' | 'alerts' | null>(null) // the page of an item was opened from there: Back goes there
  const YOURS = { mine: (): string => t('auction.nav.mine'), alerts: (): string => t('auction.nav.alerts') }
  let where = $state<OwnedPlace | null>(null)
  // The word shown of a place: auction.place.<it>, auction.held.<it>. The place itself stays the identifier, for the filter and the sort.
  const PLACE = { Bags: 'bags', Bank: 'bank', Worn: 'worn' } as const
  const race = (key: string): unknown => (sheets[key]?.pieces.who as { race?: unknown } | undefined)?.race
  const ours = $derived(house ? Object.keys(sheets).filter((key) => countsAt(homes[key], race(key), house!).counts) : [])
  // Counted by the side of their race: the game has not told their ruleset yet (an addon older than M18-F7 when they last played).
  const guessed = $derived(ours.filter((key) => !homes[key]))
  const owned = $derived(ours.flatMap((key) => ownedOf(key, sheets[key]!.pieces)))
  const ownedRows = $derived(
    owned
      .filter((o) => !where || o.place === where)
      .map((o) => {
        const f = facts[o.id], each = lowestOf(listing, o.key), vendor = (f?.[2] ?? 0) * o.n
        const at = each === undefined ? 0 : each * o.n
        return { ...o, name: f?.[0] ?? t('auction.unknownItem', { id: o.id }), suffix: suffixOf(o.key, names), quality: f?.[1] ?? 1, each, at, vendor, better: each === undefined && !vendor ? '' : afterCut(at) > vendor ? 'AH' : 'VENDOR' }
      })
      .sort((a, b) => ours.indexOf(a.who) - ours.indexOf(b.who) || b.at - a.at || b.vendor - a.vendor || a.name.localeCompare(b.name)),
  )
  // Sorted by the heading clicked, each character's items kept together.
  const ownedSorted = $derived(
    order(ownedRows, mineSort, (o, by) => (by === 'name' ? `${o.name} ${o.suffix}` : by === 'place' ? o.place : by === 'n' ? o.n : by === 'each' ? (o.each ?? -1) : by === 'at' ? o.at : by === 'vendor' ? o.vendor : o.better)).sort((a, b) => ours.indexOf(a.who) - ours.indexOf(b.who)),
  )
  const colorOf = (key: string): string | undefined => known.find((k) => k.key === key)?.color
  let copied = $state(false)
  function copy(text: string): void {
    void navigator.clipboard.writeText(text).then(() => {
      copied = true
      setTimeout(() => (copied = false), 1500)
    })
  }
  // Alerts (M18-F10): every character's at the house on show, the one in game first.
  const here = $derived(house ? alerts.filter((a) => a.region === house!.region && a.house === houseNumber(house!)).sort((a, b) => (a.who === b.who ? a.t - b.t : a.who === who ? -1 : b.who === who ? 1 : a.who.localeCompare(b.who))) : [])
  $effect(() => {
    if (showAlerts <= alertsTaken) return
    alertsTaken = showAlerts
    yours = 'alerts'
    page = null
  })
  let alertWhen = $state<AlertWhen>('below'), alertPrice = $state(''), alertKind = $state(true), alertGame = $state(true), alertSet = $state('')
  // The price asked for in silver, as the field says: "3.2" is 3 silver 20 copper.
  const silver = (typed: string): number | undefined => (/^\d+([.,]\d{1,2})?$/.test(typed.trim()) ? Math.round(Number(typed.trim().replace(',', '.')) * 100) : undefined)
  const alertPriceOk = $derived(alertWhen === 'appears' || !!silver(alertPrice))
  $effect(() => {
    const key = pageKind?.key
    if (key) untrack(() => ((alertPrice = (Math.round(pageKind!.lowest * 0.9) / 100).toFixed(2)), (alertSet = '')))
  })
  function setAlert(it: AhItem, k: Kind): void {
    const price = alertWhen === 'appears' ? 0 : silver(alertPrice)
    if (!house || !who || price === undefined || !alertPriceOk) return
    void window.twinmap.ahAlert({ who, region: house.region, house: houseNumber(house), item: it.id, key: alertKind ? k.key : null, name: alertKind ? kindName(it, k) : it.name, when: alertWhen, price, game: alertGame })
    alertSet = k.key
  }
</script>

{#snippet money(copper: number | null | undefined)}
  {#if copper}{#each coins(Math.round(copper)) as [n, coin] (coin)}{n}<i class="coin {coin}"></i>{/each}{:else}<span class="off">-</span>{/if}
{/snippet}

{#snippet icon(id: number, big = false)}
  <span class="ico" class:big><img src="{TILES}/items/{id}.png" alt="" onerror={(e) => e.currentTarget.remove()} /></span>
{/snippet}

{#snippet head(by: string, label: string, sort: Sort, set: (now: Sort) => void)}
  <th aria-sort={sort?.by === by ? (sort.up ? 'ascending' : 'descending') : undefined}><button class="sort" class:on={sort?.by === by} onclick={() => set(sort)}>{label}{#if sort?.by === by}<svg viewBox="0 0 10 10" aria-hidden="true"><path d={sort.up ? 'M1 7h8L5 2z' : 'M1 3h8L5 8z'} /></svg>{/if}</button></th>
{/snippet}

{#snippet spark(h: History | undefined)}
  {@const pts = placed(h, '24h', listing!.snapshot)}
  {@const lo = Math.min(...pts.map((x) => x.low))}
  {@const hi = Math.max(...pts.map((x) => x.low))}
  {@const Y = (y: number): number => (hi > lo ? 17 - ((y - lo) / (hi - lo)) * 14 : 10)}
  {@const X = (i: number): number => 2 + (i / 23) * 86}
  {@const color = pts.length < 2 ? '#b9a88c' : pts.at(-1)!.low >= pts[0]!.low ? '#8fe39a' : '#ff8a7a'}
  <svg class="spark" viewBox="0 0 90 20" aria-hidden="true">
    {#if pts.length > 1}<polyline fill="none" stroke={color} stroke-width="1.5" points={pts.map((x) => `${X(x.i)},${Y(x.low)}`).join(' ')} />{/if}
    {#if pts.length}<circle cx={X(pts.at(-1)!.i)} cy={Y(pts.at(-1)!.low)} r="2.5" fill={color} />{/if}
  </svg>
{/snippet}

{#snippet tree(list: Category[], depth: number)}
  {#each list as c (c.key)}
    <button class="cat" class:on={category === c.key} style:padding-left="{16 + depth * 16}px" onclick={() => ((category = category === c.key && !c.kids.length ? null : c.key), (page = null), (yours = null))}>{c.name} <small>{c.n}</small></button>
    {#if c.kids.length && category?.split('.').slice(0, depth + 1).join('.') === c.key}{@render tree(c.kids, depth + 1)}{/if}
  {/each}
{/snippet}

<main class="surface">
  <div class="tools">
    <span class="srch"><span class="glass"><Glyph name="search" /></span><input class="field" type="search" placeholder={t('auction.tools.searchPlaceholder')} aria-label={t('auction.tools.searchLabel')} bind:value={typed} oninput={() => (page = null)} /></span>
    <button class="btn" aria-pressed={filtersOpen} onclick={() => (filtersOpen = !filtersOpen)}>{active ? t('auction.tools.filtersOn', { count: active }) : t('auction.tools.filters')}</button>
    <span class="seg" role="group" aria-label={t('auction.tools.prices')}><button aria-pressed={!perStack} onclick={() => (perStack = false)}>{t('auction.tools.perUnit')}</button><button aria-pressed={perStack} onclick={() => (perStack = true)}>{t('auction.tools.perStack')}</button></span>
    <div class="house">
      {#if listing}
        <div class="when">
          <b>{t('auction.tools.pricesOf', { time: clock(snapshot) })}</b>
          {#if prices?.error}<span class="bad" title={prices.error}>{t('auction.tools.notUpdated', { age: age(old) })}</span>{:else if now < nextPrices(listing.snapshot)}{t('auction.tools.nextAround', { time: clock(snapshot + 3_600_000) })}{:else}{age(old)}{/if}
        </div>
      {/if}
      {#if house}<button class="pickhouse" aria-expanded={choosing} onclick={() => (choosing ? (choosing = false) : startChoosing())}>{houseLine(house)}</button>{/if}
    </div>
  </div>
  {#if filtersOpen}
    <div class="filters">
      <label>{lv[0]}<input class="field num" inputmode="numeric" placeholder={t('auction.filters.from')} bind:value={minLevel} />{lv[1]}<input class="field num" inputmode="numeric" placeholder={t('auction.filters.to')} bind:value={maxLevel} />{lv[2]}</label>
      <label>{t('auction.filters.quality')} <select class="field sel" bind:value={quality}><option value="">{t('auction.filters.any')}</option>{#each ['poor', 'common', 'uncommon', 'rare', 'epic', 'legendary'] as const as q, i (q)}<option value={String(i)}>{t(`auction.filters.atLeast.${q}`)}</option>{/each}</select></label>
      <label>{pr[0]}<input class="field price" placeholder={t('auction.filters.from')} aria-invalid={!!minPrice.trim() && priceOf(minPrice) === undefined} bind:value={minPrice} />{pr[1]}<input class="field price" placeholder={t('auction.filters.priceExample')} aria-invalid={!!maxPrice.trim() && priceOf(maxPrice) === undefined} bind:value={maxPrice} />{pr[2]}</label>
      {#if active}<button class="link" onclick={() => (minLevel = maxLevel = quality = minPrice = maxPrice = '')}>{t('auction.filters.clear')}</button>{/if}
    </div>
  {/if}

  <div class="body">
    {#if choosing || !house}
      <div class="center">
        <div class="ask">
          <h2>{t('auction.choose.title')}</h2>
          <p>{t('auction.choose.intro')}{#if told && who}{@const [before, after] = hints?.side === 'A' || hints?.side === 'H' ? around('auction.choose.toldSide', 'ruleset', { who, side: sideName(hints.side) }) : around('auction.choose.told', 'ruleset', { who })}{' '}{before}<b>{rulesetName(told)}</b>{after}{/if}</p>
          <div class="choices">
            <label class="line">{t('auction.choose.region')} <select class="field sel" bind:value={region}>{#each REGIONS as r (r)}<option value={r}>{r}</option>{/each}</select></label>
            {#each RULESETS as r (r.id)}
              <label><input type="radio" name="ruleset" value={r.id} bind:group={ruleset} /> {rulesetName(r.id)}{#if r.id === told}<span class="dim">{' '}{t('auction.choose.readFromGame')}</span>{/if}</label>
            {/each}
            <span class="line">
              <label><input type="radio" name="side" value="A" bind:group={side} disabled={neutral} /> {sideName('A')}</label>
              <label><input type="radio" name="side" value="H" bind:group={side} disabled={neutral} /> {sideName('H')}</label>
            </span>
            <label><input type="checkbox" bind:checked={neutral} /> {t('auction.choose.neutral')}</label>
          </div>
          <p class="note">{t('auction.choose.note')}</p>
          <div class="line">
            <button class="btn" onclick={choose}>{t('auction.choose.show')}</button>
            {#if chosen}<button class="link" onclick={() => ((choosing = false), onchoose(null))}>{t('auction.choose.follow')}</button>{/if}
            {#if house}<button class="link" onclick={() => (choosing = false)}>{t('auction.choose.cancel')}</button>{/if}
          </div>
        </div>
      </div>
    {:else if !listing}
      <div class="center">
        <div class="ask">
          {#if prices?.error}
            <h2>{t('auction.wait.noPrices')}</h2>
            <p>{prices.error} {prices.error === t('auction.errors.unreachable') ? t('auction.wait.noEarlier') : ''}</p>
            <p class="note">{t('auction.wait.worksAsBefore')}</p>
            <button class="btn" onclick={() => window.twinmap.ahAgain()}>{t('auction.wait.again')}</button>
          {:else}
            <h2>{t('auction.wait.getting')}</h2>
            <p>{t('auction.wait.of', { house: houseLine(house) })}</p>
          {/if}
        </div>
      </div>
    {:else}
      <nav class="cats" aria-label={t('auction.nav.categories')}>
        <h4>{t('auction.nav.yours')}</h4>
        <button class="cat" class:on={yours === 'mine'} onclick={() => ((yours = 'mine'), (page = null))}>{t('auction.nav.mine')} <small>{owned.length}</small></button>
        <button class="cat" class:on={yours === 'alerts'} onclick={() => ((yours = 'alerts'), (page = null))}>{t('auction.nav.alerts')} <small>{here.length}</small></button>
        <h4>{t('auction.nav.categories')}</h4>
        <button class="cat" class:on={!category && !yours} onclick={() => ((category = null), (page = null), (yours = null))}>{t('auction.nav.all')} <small>{items.length}</small></button>
        {@render tree(cats, 0)}
      </nav>
      {#if page && pageItem && pageKind}
        {@const it = pageItem}
        {@const k = pageKind}
        {@const have = owned.filter((o) => o.id === it.id)}
        {@const draws = disenchantOf(it)}
        <div class="itempage">
          <div class="kinds">
            <button class="back" onclick={() => ((page = null), (yours = from), (from = null))}>‹ {t('auction.page.back', { place: from ? YOURS[from]() : typed.trim() ? t('auction.page.theSearch') : category_(category) })}</button>
            {#each it.kinds as x (x.key)}
              <button class="kind" class:on={x.key === k.key} onclick={() => (page = { id: it.id, key: x.key })}><span style:color={QUALITY_COLORS[it.quality]}>{x.suffix || it.name}{levelOf(it)}</span><span>{@render money(x.lowest)}</span></button>
            {/each}
          </div>
          <div class="mid">
            <div class="head">
              {@render icon(it.id, true)}
              <div><h2 style:color={QUALITY_COLORS[it.quality]}>{kindName(it, k)}</h2><span class="dim">{names.subs[`${it.cls}.${it.sub}`] ? `${names.classes[it.cls]} · ${names.subs[`${it.cls}.${it.sub}`]}` : typeOf(it.cls, it.sub)}{it.level ? ` · ${t('auction.page.requiresLevel', { level: it.level })}` : ''}{it.itemLevel ? ` · ${t('auction.page.itemLevel', { level: it.itemLevel })}` : ''}</span></div>
            </div>
            <div class="facts">
              <div><small>{t('auction.page.lowest')}</small><span>{@render money(k.lowest)}</span></div>
              <div><small>{t('auction.page.typical')}</small><span>{@render money(k.typical)}</span></div>
              <div><small>{t('auction.page.available')}</small><span>{num(k.available)}</span></div>
              <div><small>{t('auction.page.vendorGives')}</small><span>{@render money(it.vendor)}</span></div>
            </div>
            <Chart history={chartOf?.key === k.key && chartOf.snapshot === listing.snapshot ? chartOf.history : null} snapshot={listing.snapshot} {now} />
            <h5>{t('auction.page.onSale')}</h5>
            <table class="list" use:columns={'ah-ladder'}>
              <thead><tr><th>{t('auction.page.priceEach')}</th><th>{t('auction.page.howMany')}</th><th>{t('auction.page.upToHere')}</th><th>{t('auction.page.costUpToHere')}</th></tr></thead>
              <tbody>
                {#each k.ladder.reduce<[number, number, number, number][]>((rows, [p, q]) => [...rows, [p, q, (rows.at(-1)?.[2] ?? 0) + q, (rows.at(-1)?.[3] ?? 0) + p * q]], []) as [p, q, upTo, cost], i (i)}
                  <tr><td>{@render money(p)}</td><td>{num(q)}</td><td>{num(upTo)}</td><td>{@render money(cost)}</td></tr>
                {/each}
              </tbody>
            </table>
            <p class="note">{t('auction.page.asAt', { time: clock(snapshot) })}</p>
          </div>
          <div class="side">
            <h5 class="first">{t('auction.page.youHave')}</h5>
            {#each have as o (o.who + o.place + o.key)}
              {@const [before, after] = around('auction.page.have', 'who', { count: o.n, place: t(`auction.held.${PLACE[o.place]}`) })}
              <div>{before}<span style:color={colorOf(o.who)}>{o.who}</span>{after}{#if o.key !== k.key}<span class="dim">{' '}{t('auction.page.otherKind', { kind: suffixOf(o.key, names) || t('auction.page.plain') })}</span>{/if}</div>
            {:else}
              <div class="dim">{t('auction.page.none')}</div>
            {/each}
            {#if draws}
              {@const worth = disenchantValue(draws, listing)}
              <h5>{t('auction.page.disenchant')}</h5>
              <div class="facts two">
                <div><small>{t('auction.page.expected')}</small><span>{#if worth !== null}{@render money(worth)}{:else}<span class="dim small">{t('auction.page.notAllOnSale')}</span>{/if}</span></div>
                <div><small>{t('auction.page.best')}</small><span class="dim small">{worth !== null && worth > afterCut(k.lowest) && worth > it.vendor ? t('auction.page.disenchantIt') : afterCut(k.lowest) >= it.vendor ? t('auction.page.sellIt') : t('auction.page.vendorIt')}</span></div>
              </div>
              <div class="note">{t('auction.page.draws', { draws: draws.map(([id, chance, least, most]) => t('auction.page.draw', { item: facts[id]?.[0] ?? t('auction.unknownItem', { id }), count: least === most ? least : `${least}-${most}`, chance: num(Math.round(chance * 1000) / 10) })).join(', '), time: clock(snapshot) })}</div>
            {/if}
            <h5>{t('auction.page.alert')}</h5>
            <div class="alert">
              <label class="line">{whenCut[0]}<select class="field sel" bind:value={alertWhen}>{#each ALERT_WHEN as w (w)}<option value={w}>{t(`auction.when.${w}`)}</option>{/each}</select>{whenCut[1]}</label>
              {#if alertWhen !== 'appears'}
                {@const [fieldBefore, fieldAfter] = around('auction.page.silver', 'field')}
                {@const [nowBefore, nowAfter] = around('auction.page.now', 'price')}
                <div class="line">{fieldBefore}<input class="field price" inputmode="decimal" aria-label={t('auction.page.priceLabel')} aria-invalid={!alertPriceOk} bind:value={alertPrice} />{fieldAfter} <span class="dim">{nowBefore}{@render money(k.lowest)}{nowAfter}</span></div>
              {:else}
                <div class="dim">{t('auction.page.appearsNote')}</div>
              {/if}
              <label class="opt"><input type="checkbox" bind:checked={alertKind} /> {t('auction.page.kindOnly', { kind: k.suffix || t('auction.page.plain') })}</label>
              <label class="opt"><input type="checkbox" bind:checked={alertGame} /> {t('auction.page.inGame')}</label>
              {#if alertSet === k.key}
                {@const [setBefore, setAfter] = around('auction.page.alertSet', 'see')}
                <div>{setBefore}<button class="link" onclick={() => ((page = null), (yours = 'alerts'), (from = null))}>{t('auction.page.seeAlerts')}</button>{setAfter}</div>
              {:else}
                <div><button class="btn" disabled={!who || !alertPriceOk} onclick={() => setAlert(it, k)}>{t('auction.page.setAlert')}</button></div>
              {/if}
              <div class="note">{who ? t('auction.page.checked') : t('auction.page.playFirst')}</div>
            </div>
            <h5>{t('auction.page.findInGame')}</h5>
            <div class="dim">{t('auction.page.quoted', { name: it.name })} · <button class="link" onclick={() => copy(it.name)}>{copied ? t('auction.page.copied') : t('auction.page.copy')}</button></div>
          </div>
        </div>
      {:else if yours === 'alerts'}
        <div class="main">
          <table class="list" use:columns={'ah-alerts'}>
            <thead><tr><th>{t('auction.alerts.item')}</th><th>{t('auction.alerts.whenLowest')}</th><th>{t('auction.alerts.now')}</th><th>{t('auction.alerts.state')}</th><th>{t('auction.alerts.inGame')}</th><th></th></tr></thead>
            <tbody>
              {#each here as a, i (a.t)}
                {@const f = facts[a.item]}
                {@const lowest = alertLowest(a, listing)}
                {#if a.who !== here[i - 1]?.who}<tr class="who"><td colspan="6" style:color={colorOf(a.who)}>{a.who}</td></tr>{/if}
                <tr data-alert={a.t} data-met={a.met ?? ''} class:item={lowest !== undefined} onclick={(e) => lowest !== undefined && !(e.target as Element).closest('button') && ((yours = null), (from = 'alerts'), (page = { id: a.item, key: a.key ?? items.find((it) => it.id === a.item)?.kinds[0]?.key ?? '' }))}>
                  <td><span class="nm">{@render icon(a.item)}<span class="n" style:color={QUALITY_COLORS[f?.[1] ?? 1]}>{a.name}</span>{#if a.key === null}<span class="more">{t('auction.alerts.anyKind')}</span>{/if}</span></td>
                  <td>{#if a.when === 'appears'}{t('auction.when.appears')}{:else}{@const [before, after] = around(`auction.alerts.${a.when}`, 'price')}{before}{@render money(a.price)}{after}{/if}</td>
                  <td>{#if lowest !== undefined}{@render money(lowest)}{:else}<span class="off">{t('auction.alerts.notOnSale')}</span>{/if}</td>
                  <td>{#if a.met}{@const time = clock(Date.parse(a.met))}{@const [before, after] = around('auction.alerts.metAt', 'price', { time })}<span class="met">● {#if a.at !== null}{before}{@render money(a.at)}{after}{:else}{t('auction.alerts.met', { time })}{/if}</span>{:else}<span class="dim">{t('auction.alerts.waiting')}</span>{/if}</td>
                  <td class="dim">{a.game ? (a.met ? t('auction.alerts.sent') : t('auction.alerts.on')) : t('auction.alerts.off')}</td>
                  <td><button class="btn small" onclick={() => window.twinmap.ahUnalert(a.t)}>{t('auction.alerts.remove')}</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if !here.length}<p class="none">{t('auction.alerts.none')}</p>{/if}
          <p class="note pad">{t('auction.alerts.note')}</p>
        </div>
      {:else if yours === 'mine'}
        {@const ah = ownedRows.reduce((n, o) => n + o.at, 0)}
        {@const vendor = ownedRows.reduce((n, o) => n + o.vendor, 0)}
        <div class="main">
          <div class="tot">
            <div><small>{t('auction.mine.worthAh')}</small><span>{@render money(ah)}</span></div>
            <div><small>{t('auction.mine.atVendor')}</small><span>{@render money(vendor)}</span></div>
            <div><small>{t('auction.mine.notOnSale')}</small><span>{t('auction.mine.items', { count: ownedRows.filter((o) => o.each === undefined).length })}</span></div>
            <span class="seg" role="group" aria-label={t('auction.mine.where')}>{#each [null, 'Bags', 'Bank', 'Worn'] as const as p (p)}<button aria-pressed={where === p} onclick={() => (where = p)}>{p ? t(`auction.place.${PLACE[p]}`) : t('auction.mine.everything')}</button>{/each}</span>
          </div>
          <table class="list" use:columns={'ah-mine'}>
            <thead><tr>{#each [['name', t('auction.mine.colItem'), true], ['place', t('auction.mine.colWhere'), true], ['n', t('auction.mine.colHowMany')], ['each', t('auction.mine.colLowestEach')], ['at', t('auction.mine.colAh')], ['vendor', t('auction.mine.colVendor')], ['better', t('auction.mine.colBetter'), true]] as [by, label, text] (by)}{@render head(by as string, label as string, mineSort, (s) => (mineSort = turn(s, by as string, !!text)))}{/each}</tr></thead>
            <tbody>
              {#each ownedSorted as o, i (o.who + o.place + o.key)}
                {#if o.who !== ownedSorted[i - 1]?.who}<tr class="who"><td colspan="7" style:color={colorOf(o.who)}>{o.who}</td></tr>{/if}
                <tr data-key={o.key} data-who={o.who} data-place={o.place} class:item={o.each !== undefined} onclick={() => o.each !== undefined && ((yours = null), (from = 'mine'), (page = { id: o.id, key: o.key }))}>
                  <td><span class="nm">{@render icon(o.id)}<span class="n" style:color={QUALITY_COLORS[o.quality]}>{o.name}{o.suffix ? ` ${o.suffix}` : ''}</span></span></td>
                  <td class="dim">{t(`auction.place.${PLACE[o.place]}`)}</td>
                  <td>{num(o.n)}</td>
                  <td>{#if o.each !== undefined}{@render money(o.each)}{:else}<span class="off">{t('auction.mine.notOnSaleRow')}</span>{/if}</td>
                  <td>{#if o.at}{@render money(o.at)}{/if}</td>
                  <td>{@render money(o.vendor)}</td>
                  <td>{#if o.better}<span class="tag {o.better.toLowerCase()}">{o.better === 'AH' ? t('auction.mine.better.ah') : t('auction.mine.better.vendor')}</span>{/if}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if !ours.length}<p class="none">{t('auction.mine.none')}</p>{/if}
          <p class="note pad">{t('auction.mine.betterNote')}{#if guessed.length && house}{' '}{t('auction.mine.guessed', { count: guessed.length, names: guessed.join(', '), region: house.region, ruleset: rulesetName(house.ruleset) })}{/if}</p>
        </div>
      {:else}
        <div class="main">
          <table class="list" use:columns={'ah-browse'}>
            <thead><tr>{#each [['name', t('auction.browse.name'), true], ['lowest', t('auction.browse.lowest')], ['typical', t('auction.browse.typical')], ['available', t('auction.browse.available')], ['vendor', t('auction.browse.vendor')]] as [by, label, text] (by)}{@render head(by as string, label as string, browseSort, (s) => (browseSort = turn(s, by as string, !!text)))}{/each}<th>{t('auction.browse.hours')}</th></tr></thead>
            <tbody>
              {#each found.slice(0, most) as it (it.id)}
                {@const many = it.kinds.length > 1}
                {@const k = it.kinds[0]!}
                <tr class="item" onclick={() => (many ? ((open = new Set(open.has(it.id) ? [...open].filter((x) => x !== it.id) : [...open, it.id]))) : (page = { id: it.id, key: k.key }))}>
                  <td><span class="nm">{@render icon(it.id)}<span class="n" style:color={QUALITY_COLORS[it.quality]}>{it.name}</span>{#if many}<span class="more">{open.has(it.id) ? '▾' : '▸'} {t('auction.browse.kinds', { count: it.kinds.length })}</span>{/if}</span></td>
                  <td>{#if many}<span class="dim">{t('auction.browse.from')}&nbsp;</span>{/if}{@render money(it.lowest * times(it))}</td>
                  <td>{#if !many}{@render money(k.typical * times(it))}{/if}</td>
                  <td>{num(it.available)}</td>
                  <td>{@render money(it.vendor * times(it))}</td>
                  <td class="sp">{#if sparks.snapshot === listing.snapshot && sparks.of[k.key]}{@render spark(sparks.of[k.key])}{/if}</td>
                </tr>
                {#if many && open.has(it.id)}
                  {#each it.kinds as x (x.key)}
                    <tr class="item kind" onclick={() => (page = { id: it.id, key: x.key })}><td style:color={QUALITY_COLORS[it.quality]}>{x.suffix || t('auction.browse.plainRow')}{levelOf(it)}</td><td>{@render money(x.lowest * times(it))}</td><td>{@render money(x.typical * times(it))}</td><td>{num(x.available)}</td><td></td><td></td></tr>
                  {/each}
                {/if}
              {/each}
            </tbody>
          </table>
          {#if !found.length}<p class="none">{t(`auction.browse.nothing.${typed.trim() ? 'typed' : 'filters'}${category ? 'In' : ''}`, { typed: typed.trim(), category: category_(category) })}</p>{/if}
          {#if found.length > most}<p class="none"><button class="btn" onclick={() => (most += SHOWN)}>{t('auction.browse.more', { count: num(Math.min(SHOWN, found.length - most)), total: num(found.length) })}</button></p>{/if}
        </div>
      {/if}
    {/if}
  </div>
  <div class="foot">
    <span>{foot[0]}<b>{t('auction.foot.source')}</b>{foot[1]}</span>
    <span class="right">{t('auction.foot.approximate')}</span>
  </div>
</main>

<style>
  main {
    position: absolute;
    inset: 46px 0 0;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) 28px;
    font-variant-numeric: tabular-nums;
  }
  /* Not .bar: that is the thin progress bar of ui.css, 6 px tall, which a wrapped row would spill out of. */
  .tools {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 12px 18px 10px;
  }
  .srch {
    position: relative;
    display: inline-flex;
  }
  .srch .field {
    width: 360px;
    padding-left: 28px;
  }
  .field::-webkit-search-cancel-button {
    display: none;
  }
  .glass {
    position: absolute;
    left: 7px;
    top: 5px;
    display: flex;
    color: var(--text-dim);
    pointer-events: none;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--bronze-700);
    border-radius: 14px;
    overflow: hidden;
  }
  .seg button {
    padding: 3px 12px;
    border: 0;
    background: none;
    font: var(--t-label);
    color: var(--text-dim);
    cursor: pointer;
  }
  .seg button[aria-pressed='true'] {
    color: var(--gold);
    background: var(--stone-600);
  }
  .house {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .when {
    color: var(--text-dim);
    font: var(--t-small);
    text-align: right;
  }
  .when b {
    display: block;
    color: var(--text);
    font: 500 15px/19px var(--font);
  }
  .when .bad {
    color: var(--objective);
  }
  .pickhouse {
    height: 30px;
    padding: 4px 12px;
    border: 1px solid var(--bronze-600);
    border-radius: 4px;
    background: linear-gradient(var(--stone-600), var(--stone-800));
    color: var(--gold);
    font: var(--t-label);
    cursor: pointer;
  }
  .pickhouse::after {
    content: ' ▾';
    color: var(--bronze-400);
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 22px;
    padding: 0 18px 10px;
    color: var(--text-dim);
  }
  .filters label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .field.num {
    width: 56px;
  }
  .field.price {
    width: 96px;
  }
  .field.sel {
    width: auto;
    padding: 0 4px;
  }
  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--gold);
    font: var(--t-body);
    cursor: pointer;
  }
  .body {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr);
    min-height: 0;
    border-top: 1px solid var(--bronze-700);
  }
  .center {
    grid-column: 1 / -1;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  .ask {
    max-width: 560px;
  }
  .ask h2 {
    margin: 0 0 8px;
    font: var(--t-name);
    color: var(--gold);
  }
  .ask b {
    color: var(--gold);
    font-weight: 400;
  }
  .choices {
    display: grid;
    gap: 6px;
    margin: 14px 0;
  }
  .choices label,
  .line {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  .line {
    gap: 18px;
  }
  .cats {
    overflow: auto;
    padding: 0 0 8px;
    background: #0c0a0866;
    border-right: 1px solid var(--bronze-900);
  }
  /* The heads of the columns on one line with the head of the list beside them: same height, same ground. */
  .cats h4,
  .back {
    text-transform: uppercase;
    position: sticky;
    top: 0;
    z-index: 1;
    box-sizing: border-box;
    height: 31px;
    margin: 0;
    padding: 8px 16px 6px;
    font: 600 12px/16px var(--font);
    letter-spacing: 0.06em;
    color: var(--bronze-400);
    background: var(--stone-800);
    border-bottom: 1px solid var(--bronze-700);
  }
  .cat {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: 3px 16px;
    border: 0;
    background: none;
    color: var(--text);
    font: var(--t-body);
    text-align: left;
    cursor: pointer;
  }
  .cat:hover {
    background: #ffffff08;
  }
  .cat small {
    color: var(--text-off);
  }
  .cat.on {
    color: var(--plate-ink);
    background: linear-gradient(var(--plate-top), var(--plate-mid));
  }
  .cat.on small {
    color: var(--plate-ink);
  }
  .main {
    overflow: auto;
    min-height: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    position: sticky;
    top: 0;
    z-index: 1;
    text-align: right;
    font: 600 12px/16px var(--font);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-400);
    padding: 8px 10px 6px;
    background: var(--stone-800);
    border-bottom: 1px solid var(--bronze-700);
  }
  /* The heading is a button that sorts: it reads as the heading, the arrow says which way. */
  .sort {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    color: inherit;
    cursor: pointer;
  }
  .sort:hover,
  .sort.on {
    color: var(--gold);
  }
  .sort svg {
    width: 9px;
    height: 9px;
    fill: currentColor;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  td {
    text-align: right;
    padding: 3px 10px;
    border-bottom: 1px solid #ffffff0a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  tr.item {
    cursor: pointer;
  }
  tr.item:hover td {
    background: #ffffff08;
  }
  tr.kind td {
    background: #0004;
    font-size: 14.5px;
  }
  tr.kind td:first-child {
    padding-left: 54px;
  }
  .nm {
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .n {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ico {
    flex: none;
    width: 26px;
    height: 26px;
    border: 1px solid #000;
    box-shadow: 0 0 0 1px var(--bronze-700);
    background: #000;
  }
  .ico img {
    width: 100%;
    height: 100%;
    display: block;
  }
  .ico.big {
    width: 52px;
    height: 52px;
  }
  .spark {
    width: 90px;
    height: 20px;
    vertical-align: middle;
  }
  td.sp {
    padding-top: 0;
    padding-bottom: 0;
  }
  .more {
    color: var(--text-dim);
    font-size: 13.5px;
  }
  .dim {
    color: var(--text-dim);
  }
  .off {
    color: var(--text-off);
  }
  .none {
    padding: 10px 18px;
    color: var(--text-dim);
  }
  .note {
    color: var(--text-dim);
    font: var(--t-small);
  }
  .itempage {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr) 280px;
    min-height: 0;
  }
  .itempage > div {
    overflow: auto;
    min-height: 0;
    padding: 12px 16px;
  }
  .itempage .kinds {
    padding: 0 0 8px;
    border-right: 1px solid var(--bronze-900);
  }
  button.kind {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 3px 14px;
    border: 0;
    background: none;
    color: var(--text-dim);
    font: var(--t-body);
    text-align: left;
    cursor: pointer;
  }
  .back {
    display: block;
    text-transform: uppercase;
    width: 100%;
    border-width: 0 0 1px;
    text-align: left;
    cursor: pointer;
  }
  .back:hover {
    color: var(--text);
  }
  button.kind.on {
    background: linear-gradient(var(--plate-top), var(--plate-mid));
  }
  button.kind.on span {
    color: var(--plate-ink) !important;
  }
  .side {
    border-left: 1px solid var(--bronze-900);
  }
  .head {
    display: flex;
    gap: 14px;
    align-items: center;
    margin-bottom: 10px;
  }
  .head h2 {
    margin: 0;
    font: var(--t-name);
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(4, auto);
    gap: 4px 28px;
    justify-content: start;
    margin: 8px 0 14px;
  }
  .facts small {
    display: block;
    text-transform: uppercase;
    font: 600 11.5px/14px var(--font);
    letter-spacing: 0.07em;
    color: var(--bronze-400);
  }
  .facts span {
    font: 500 20px/24px var(--font);
  }
  h5 {
    margin: 16px 0 6px;
    font: 600 12px/16px var(--font);
    letter-spacing: 0.08em;
    color: var(--bronze-400);
    text-transform: uppercase;
  }
  .body {
    grid-row: 3;
  }
  .tot {
    display: flex;
    align-items: flex-end;
    gap: 28px;
    padding: 10px 18px;
    border-bottom: 1px solid var(--bronze-900);
  }
  .tot small {
    display: block;
    text-transform: uppercase;
    font: 600 11.5px/14px var(--font);
    letter-spacing: 0.07em;
    color: var(--bronze-400);
  }
  .tot span {
    font: 500 20px/24px var(--font);
  }
  .tot .seg {
    margin-left: auto;
  }
  .tot .seg button {
    font: var(--t-label);
  }
  tr.who td {
    background: var(--stone-700);
    font: var(--t-label);
    text-align: left;
  }
  .tag {
    text-transform: uppercase;
    font: 600 11px/15px var(--font);
    letter-spacing: 0.06em;
    padding: 0 6px;
    border-radius: 3px;
  }
  .tag.ah {
    background: #1f4d2a;
    color: #8fe39a;
  }
  .tag.vendor {
    background: #4d3a1f;
    color: #e3c48f;
  }
  .facts.two {
    grid-template-columns: auto auto;
  }
  .facts span.small {
    font-size: 16px;
  }
  .side h5.first {
    margin-top: 4px;
  }
  .note.pad {
    padding: 0 18px;
  }
  .alert {
    display: grid;
    gap: 8px;
    padding: 4px 0 2px;
  }
  .alert .field.price {
    width: 110px;
  }
  /* In a longer language the words and the fields of a line go on to the next one, whole, rather than squeezed. */
  .alert .line {
    flex-wrap: wrap;
    row-gap: 6px;
  }
  .opt {
    display: flex;
    gap: 8px;
    align-items: center;
    cursor: pointer;
  }
  .met {
    color: var(--done);
  }
  .btn.small {
    height: 22px;
    padding: 0 8px;
  }
  .foot {
    grid-row: 4;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 18px;
    color: var(--text-dim);
    font: var(--t-small);
    border-top: 1px solid var(--bronze-900);
    overflow: hidden;
    white-space: nowrap;
  }
  .foot b {
    font-weight: 400;
  }
  .foot .right {
    margin-left: auto;
  }
  /* A narrow window: the tools wrap, the categories go over the list, the page of an item is one column. */
  @media (max-width: 900px) {
    .tools {
      flex-wrap: wrap;
    }
    .srch,
    .srch .field {
      width: 100%;
    }
    .house {
      margin-left: 0;
    }
    .body {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto minmax(0, 1fr);
    }
    .cats {
      max-height: 30vh;
      border-right: 0;
      border-bottom: 1px solid var(--bronze-900);
    }
    .itempage {
      grid-template-columns: minmax(0, 1fr);
      overflow: auto;
    }
    .itempage > div {
      overflow: visible;
    }
    .foot {
      white-space: normal;
      font-size: 11px;
      line-height: 13px;
    }
  }
</style>
