<script lang="ts">
  // Auction House (M18-F7): the prices of the house the character sells at, as wide as the window,
  // as approved on design/ah/mock.html (design/ui.md, section 5). The game's categories on the left,
  // a row for each item with its kinds, the page of an item with what is on sale cheapest first, a
  // search that forgives a letter, and the line Blizzard's terms ask for. Data: shared/ah.ts.
  import { ahItems, categoriesOf, houseLine, houseNumber, nextPrices, priceOf, REGIONS, rulesetName, rulesetOf, RULESETS, search, SIDES, type AhItem, type AhNames, type Category, type House, type HouseHints, type Kind, type PricesTold, type Region, type Side } from '../../shared/ah'
  import { coins, typeOf, type ItemFacts } from '../../shared/items'
  import { columns } from './columns'
  import Glyph from './Glyph.svelte'
  import { TILES } from './web'

  let { house, chosen, hints, who, prices, now, onchoose }: { house: House | null; chosen: boolean; hints: HouseHints | null; who: string | null; prices: PricesTold | null; now: number; onchoose: (h: House | null) => void } = $props()

  // What the game says of each item and the names of its categories and kinds, made beside the map.
  let facts = $state.raw<ItemFacts>({})
  let names = $state.raw<AhNames>({ classes: {}, subs: {}, suffixes: {} })
  $effect(() => {
    void fetch(`${TILES}/items.json`).then((r) => (r.ok ? r.json() : {})).then((f: ItemFacts) => (facts = f)).catch(() => {})
    void fetch(`${TILES}/ah-names.json`).then((r) => (r.ok ? r.json() : null)).then((n: AhNames | null) => n && (names = n)).catch(() => {})
  })

  // The prices are of the house on show only: a house changed a moment ago has none until they come.
  const listing = $derived(house && prices?.house === houseNumber(house) && prices.region === house.region ? prices.listing : null)
  const items = $derived(listing ? ahItems(listing, facts, names) : [])
  const cats = $derived(categoriesOf(items, names))

  let typed = $state('')
  let category = $state<string | null>(null)
  let filtersOpen = $state(false)
  let minLevel = $state(''), maxLevel = $state(''), quality = $state(''), minPrice = $state(''), maxPrice = $state('')
  const level = (v: string): number | undefined => (/^\d+$/.test(v.trim()) ? Number(v) : undefined)
  const filters = $derived({ typed, category, minLevel: level(minLevel), maxLevel: level(maxLevel), quality: quality === '' ? undefined : Number(quality), minPrice: priceOf(minPrice), maxPrice: priceOf(maxPrice) })
  const active = $derived([minLevel, maxLevel, quality, minPrice, maxPrice].filter((v) => v.trim() !== '').length)
  const found = $derived(search(items, filters))
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

  const clock = (ms: number): string => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const snapshot = $derived(listing ? Date.parse(listing.snapshot) : 0)
  const old = $derived(listing ? now - snapshot : 0)
  const age = (ms: number): string => (ms < 2 * 3_600_000 ? `${Math.round(ms / 60_000)} minutes old` : ms < 48 * 3_600_000 ? `${Math.round(ms / 3_600_000)} hours old` : `${Math.round(ms / 86_400_000)} days old`)
  const category_ = (key: string | null): string => {
    if (!key) return 'All items'
    const parts = key.split('.')
    const top = cats.find((c) => c.key === parts[0]), mid = top?.kids.find((c) => c.key === parts.slice(0, 2).join('.')), low = mid?.kids.find((c) => c.key === key)
    return [top, mid, low].filter(Boolean).map((c) => c!.name).join(' · ')
  }
  // The colours of the qualities as text on the dark ground: the game's, its blue and purple lighter (design/ah/mock.html).
  const QUALITY_COLORS = ['#9d9d9d', '#ffffff', '#1eff00', '#3d9bff', '#b866f5', '#ff8000', '#e6cc80', '#00ccff']
  // After the name of a kind, as the game's list has it: the level the item asks for, between brackets.
  const levelOf = (it: AhItem): string => (it.level ? ` (${it.level})` : '')
  const kindName = (it: AhItem, k: Kind): string => (k.suffix ? `${it.name} ${k.suffix}` : it.name)
  let copied = $state(false)
  function copy(text: string): void {
    void navigator.clipboard.writeText(text).then(() => {
      copied = true
      setTimeout(() => (copied = false), 1500)
    })
  }
</script>

{#snippet money(copper: number | null | undefined)}
  {#if copper}{#each coins(Math.round(copper)) as [n, coin] (coin)}{n}<i class="coin {coin}"></i>{/each}{:else}<span class="off">-</span>{/if}
{/snippet}

{#snippet icon(id: number, big = false)}
  <span class="ico" class:big><img src="{TILES}/items/{id}.png" alt="" onerror={(e) => e.currentTarget.remove()} /></span>
{/snippet}

{#snippet tree(list: Category[], depth: number)}
  {#each list as c (c.key)}
    <button class="cat" class:on={category === c.key} style:padding-left="{16 + depth * 16}px" onclick={() => ((category = category === c.key && !c.kids.length ? null : c.key), (page = null))}>{c.name} <small>{c.n}</small></button>
    {#if c.kids.length && category?.split('.').slice(0, depth + 1).join('.') === c.key}{@render tree(c.kids, depth + 1)}{/if}
  {/each}
{/snippet}

<main class="surface">
  <div class="bar">
    <span class="srch"><span class="glass"><Glyph name="search" /></span><input class="field" type="search" placeholder={'Search the auction house: a name, or "an exact name"'} aria-label="Search the auction house" bind:value={typed} oninput={() => (page = null)} /></span>
    <button class="btn" aria-pressed={filtersOpen} onclick={() => (filtersOpen = !filtersOpen)}>Filters{active ? ` · ${active}` : ''}</button>
    <span class="seg" role="group" aria-label="Prices"><button aria-pressed={!perStack} onclick={() => (perStack = false)}>Per unit</button><button aria-pressed={perStack} onclick={() => (perStack = true)}>Per stack</button></span>
    <div class="house">
      {#if listing}
        <div class="when">
          <b>Prices of {clock(snapshot)}</b>
          {#if prices?.error}<span class="bad" title={prices.error}>{age(old)}, not updated</span>{:else if now < nextPrices(listing.snapshot)}next around {clock(snapshot + 3_600_000)}{:else}{age(old)}{/if}
        </div>
      {/if}
      {#if house}<button class="pickhouse" aria-expanded={choosing} onclick={() => (choosing ? (choosing = false) : startChoosing())}>{houseLine(house)}</button>{/if}
    </div>
  </div>
  {#if filtersOpen}
    <div class="filters">
      <label>Level <input class="field num" inputmode="numeric" placeholder="from" bind:value={minLevel} /> to <input class="field num" inputmode="numeric" placeholder="to" bind:value={maxLevel} /></label>
      <label>Quality <select class="field sel" bind:value={quality}><option value="">Any</option>{#each ['Poor', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'] as q, i (q)}<option value={String(i)}>{q} and better</option>{/each}</select></label>
      <label>Lowest price <input class="field price" placeholder="from" aria-invalid={!!minPrice.trim() && priceOf(minPrice) === undefined} bind:value={minPrice} /> to <input class="field price" placeholder="e.g. 1g 50s" aria-invalid={!!maxPrice.trim() && priceOf(maxPrice) === undefined} bind:value={maxPrice} /></label>
      {#if active}<button class="link" onclick={() => (minLevel = maxLevel = quality = minPrice = maxPrice = '')}>Clear</button>{/if}
    </div>
  {/if}

  <div class="body">
    {#if choosing || !house}
      <div class="center">
        <div class="ask">
          <h2>Which auction house?</h2>
          <p>Twinmap shows the prices of the house your character sells at.{#if told && who}{' '}The game says {who} plays on <b>{rulesetName(told)}</b>{hints?.side === 'A' || hints?.side === 'H' ? `, ${SIDES[hints.side]}` : ''}.{/if}</p>
          <div class="choices">
            <label class="line">Region <select class="field sel" bind:value={region}>{#each REGIONS as r (r)}<option value={r}>{r}</option>{/each}</select></label>
            {#each RULESETS as r (r.id)}
              <label><input type="radio" name="ruleset" value={r.id} bind:group={ruleset} /> {r.name}{#if r.id === told}<span class="dim"> (read from the game)</span>{/if}</label>
            {/each}
            <span class="line">
              <label><input type="radio" name="side" value="A" bind:group={side} disabled={neutral} /> Alliance</label>
              <label><input type="radio" name="side" value="H" bind:group={side} disabled={neutral} /> Horde</label>
            </span>
            <label><input type="checkbox" bind:checked={neutral} /> The neutral house (Booty Bay, Gadgetzan, Everlook)</label>
          </div>
          <p class="note">Prices come once an hour from Blizzard. Twinmap downloads about 350 KB for your house; nothing about you is sent.</p>
          <div class="line">
            <button class="btn" onclick={choose}>Show prices</button>
            {#if chosen}<button class="link" onclick={() => ((choosing = false), onchoose(null))}>Follow my character</button>{/if}
            {#if house}<button class="link" onclick={() => (choosing = false)}>Cancel</button>{/if}
          </div>
        </div>
      </div>
    {:else if !listing}
      <div class="center">
        <div class="ask">
          {#if prices?.error}
            <h2>No prices yet</h2>
            <p>{prices.error} {prices.error.includes('reach') ? 'Twinmap has no earlier prices of this house to show.' : ''}</p>
            <p class="note">Everything else in Twinmap works as before.</p>
            <button class="btn" onclick={() => window.twinmap.ahAgain()}>Try again</button>
          {:else}
            <h2>Getting the prices</h2>
            <p>Of {houseLine(house)}, from prices.twinmap.app.</p>
          {/if}
        </div>
      </div>
    {:else}
      <nav class="cats" aria-label="Categories">
        <h4>CATEGORIES</h4>
        <button class="cat" class:on={!category} onclick={() => ((category = null), (page = null))}>All items <small>{items.length}</small></button>
        {@render tree(cats, 0)}
      </nav>
      {#if page && pageItem && pageKind}
        {@const it = pageItem}
        {@const k = pageKind}
        <div class="itempage">
          <div class="kinds">
            <button class="back" onclick={() => (page = null)}>‹ Back to {typed.trim() ? 'the search' : category_(category)}</button>
            {#each it.kinds as x (x.key)}
              <button class="kind" class:on={x.key === k.key} onclick={() => (page = { id: it.id, key: x.key })}><span style:color={QUALITY_COLORS[it.quality]}>{x.suffix || it.name}{levelOf(it)}</span><span>{@render money(x.lowest)}</span></button>
            {/each}
          </div>
          <div class="mid">
            <div class="head">
              {@render icon(it.id, true)}
              <div><h2 style:color={QUALITY_COLORS[it.quality]}>{kindName(it, k)}</h2><span class="dim">{names.subs[`${it.cls}.${it.sub}`] ? `${names.classes[it.cls]} · ${names.subs[`${it.cls}.${it.sub}`]}` : typeOf(it.cls, it.sub)}{it.level ? ` · requires level ${it.level}` : ''}{it.itemLevel ? ` · item level ${it.itemLevel}` : ''}</span></div>
            </div>
            <div class="facts">
              <div><small>LOWEST</small><span>{@render money(k.lowest)}</span></div>
              <div><small>TYPICAL</small><span>{@render money(k.typical)}</span></div>
              <div><small>AVAILABLE</small><span>{k.available.toLocaleString('en')}</span></div>
              <div><small>VENDOR GIVES</small><span>{@render money(it.vendor)}</span></div>
            </div>
            <h5>On sale now, cheapest first</h5>
            <table class="list" use:columns={'ah-ladder'}>
              <thead><tr><th>PRICE EACH</th><th>HOW MANY</th><th>UP TO HERE</th><th>COST UP TO HERE</th></tr></thead>
              <tbody>
                {#each k.ladder.reduce<[number, number, number, number][]>((rows, [p, q]) => [...rows, [p, q, (rows.at(-1)?.[2] ?? 0) + q, (rows.at(-1)?.[3] ?? 0) + p * q]], []) as [p, q, upTo, cost], i (i)}
                  <tr><td>{@render money(p)}</td><td>{q.toLocaleString('en')}</td><td>{upTo.toLocaleString('en')}</td><td>{@render money(cost)}</td></tr>
                {/each}
              </tbody>
            </table>
            <p class="note">As the house was at {clock(snapshot)}. Prices are per unit; what is on sale now may differ.</p>
          </div>
          <div class="side">
            <h5>Find it in the game</h5>
            <div class="dim">"{it.name}" · <button class="link" onclick={() => copy(it.name)}>{copied ? 'Copied' : 'Copy'}</button></div>
          </div>
        </div>
      {:else}
        <div class="main">
          <table class="list" use:columns={'ah-browse'}>
            <thead><tr><th>NAME</th><th>LOWEST</th><th>TYPICAL</th><th>AVAILABLE</th><th>VENDOR</th></tr></thead>
            <tbody>
              {#each found.slice(0, most) as it (it.id)}
                {@const many = it.kinds.length > 1}
                {@const k = it.kinds[0]!}
                <tr class="item" onclick={() => (many ? ((open = new Set(open.has(it.id) ? [...open].filter((x) => x !== it.id) : [...open, it.id]))) : (page = { id: it.id, key: k.key }))}>
                  <td><span class="nm">{@render icon(it.id)}<span class="n" style:color={QUALITY_COLORS[it.quality]}>{it.name}</span>{#if many}<span class="more">{open.has(it.id) ? '▾' : '▸'} {it.kinds.length} kinds</span>{/if}</span></td>
                  <td>{#if many}<span class="dim">from&nbsp;</span>{/if}{@render money(it.lowest * times(it))}</td>
                  <td>{#if !many}{@render money(k.typical * times(it))}{/if}</td>
                  <td>{it.available.toLocaleString('en')}</td>
                  <td>{@render money(it.vendor * times(it))}</td>
                </tr>
                {#if many && open.has(it.id)}
                  {#each it.kinds as x (x.key)}
                    <tr class="item kind" onclick={() => (page = { id: it.id, key: x.key })}><td style:color={QUALITY_COLORS[it.quality]}>{x.suffix || '(plain)'}{levelOf(it)}</td><td>{@render money(x.lowest * times(it))}</td><td>{@render money(x.typical * times(it))}</td><td>{x.available.toLocaleString('en')}</td><td></td></tr>
                  {/each}
                {/if}
              {/each}
            </tbody>
          </table>
          {#if !found.length}<p class="none">Nothing on sale answers {typed.trim() ? `"${typed.trim()}"` : 'these filters'}{category ? ` in ${category_(category)}` : ''}.</p>{/if}
          {#if found.length > most}<p class="none"><button class="btn" onclick={() => (most += SHOWN)}>Show {Math.min(SHOWN, found.length - most)} more of {found.length.toLocaleString('en')}</button></p>{/if}
        </div>
      {/if}
    {/if}
  </div>
  <div class="foot">
    <span><b>Auction data: Blizzard Entertainment</b>, through the Battle.net API. Twinmap is not affiliated with or endorsed by Blizzard.</span>
    <span class="right">Quantities are approximate</span>
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
  .bar {
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
    color: var(--bronze-400);
    padding: 8px 10px 6px;
    background: var(--stone-800);
    border-bottom: 1px solid var(--bronze-700);
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
  /* The line at the edge of a heading: dragged, the column is wider or narrower (columns.ts). */
  th :global(.grip) {
    position: absolute;
    right: -4px;
    top: 0;
    bottom: 0;
    width: 9px;
    cursor: col-resize;
    z-index: 2;
  }
  th :global(.grip)::after {
    content: '';
    position: absolute;
    left: 4px;
    top: 7px;
    bottom: 7px;
    width: 1px;
    background: var(--bronze-700);
  }
  th:last-child :global(.grip) {
    right: 0;
  }
  th:hover :global(.grip)::after {
    background: var(--bronze-300);
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
  /* A narrow window: the bar wraps, the categories go over the list, the page of an item is one column. */
  @media (max-width: 900px) {
    .bar {
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
