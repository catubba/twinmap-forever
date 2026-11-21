<script lang="ts" module>
  // Where the points of a history go: a slot an hour (24 hours) or a day (7 days), the last slot the
  // snapshot shown. Only points really collected; two are joined only when their slots touch.
  import type { History } from '../../shared/ah'

  export const HOUR = 3_600_000
  export const DAY = 86_400_000

  export interface Placed {
    i: number
    at: string
    low: number
    typ: number
    n: number
  }

  export function placed(h: History | null | undefined, range: '24h' | '7d', snapshot: string): Placed[] {
    if (!h) return []
    const slots = range === '24h' ? 24 : 7
    const last = range === '24h' ? Date.parse(snapshot) : Date.parse(snapshot.slice(0, 10))
    const out =
      range === '24h'
        ? h.hours.map(({ at, p }) => ({ i: slots - 1 - Math.round((last - Date.parse(at)) / HOUR), at, low: p[0], typ: p[1], n: p[2] }))
        : h.days.map(({ day, p }) => ({ i: slots - 1 - Math.round((last - Date.parse(day)) / DAY), at: day, low: p[0], typ: p[1], n: p[2] }))
    return out.filter((x) => x.i >= 0 && x.i < slots).sort((a, b) => a.i - b.i)
  }

  /** The runs of points in touching slots, each drawn as one line. */
  export const runs = (pts: Placed[]): Placed[][] => pts.reduce<Placed[][]>((all, x, j) => (j && x.i === pts[j - 1]!.i + 1 ? all.at(-1)!.push(x) : all.push([x]), all), [])
</script>

<script lang="ts">
  // The chart of the page of an item (M18-F9), as approved on design/ah/mock.html: typical and lowest
  // price, how many on sale as bars, over 24 hours or 7 days. Slots with nothing collected stay empty.
  import { coins } from '../../shared/items'

  let { history, snapshot, now }: { history: History | null; snapshot: string; now: number } = $props()
  let range = $state<'24h' | '7d'>('24h')

  const W = 640, H = 230, L = 52, B = 22, TOP = 10
  const slots = $derived(range === '24h' ? 24 : 7)
  const pts = $derived(placed(history, range, snapshot))
  const hi = $derived(Math.max(...pts.map((x) => Math.max(x.low, x.typ)), 0) * 1.25 || 1)
  const most = $derived(Math.max(...pts.map((x) => x.n), 1))
  const X = (i: number): number => L + (i / (slots - 1)) * (W - L - 10)
  const Y = (y: number): number => TOP + (1 - y / hi) * (H - TOP - B - 40)
  const short = (c: number): string => (c >= 10000 ? `${(c / 10000).toFixed(1)}g` : c >= 100 ? `${(c / 100).toFixed(1)}s` : `${Math.round(c)}c`)
  const money = (c: number): string => coins(Math.round(c)).map(([n, coin]) => `${n}${coin[0]}`).join(' ')
  const clock = (ms: number): string => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dayName = (ms: number): string => (new Date(ms).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10) ? 'today' : new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }))
  const ticks = $derived(
    range === '24h'
      ? [0, 6, 12, 18, 23].map((i) => [i, clock(Date.parse(snapshot) - (23 - i) * HOUR)] as const)
      : [0, 2, 4, 6].map((i) => [i, dayName(Date.parse(snapshot.slice(0, 10)) - (6 - i) * DAY)] as const),
  )
  const said = (x: Placed): string => `${range === '24h' ? clock(Date.parse(x.at)) : dayName(Date.parse(x.at))}: typical ${money(x.typ)}, lowest ${money(x.low)}, ${x.n.toLocaleString('en')} on sale${range === '7d' ? ' (mean of its hours)' : ''}`
  // The slots before the first point: nothing collected yet.
  const emptyTo = $derived(pts.length ? X(pts[0]!.i) - 14 : W - 10)
</script>

<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label="Prices over the last {range === '24h' ? '24 hours' : '7 days'}">
  {#each [0, 1, 2, 3, 4] as t (t)}
    <line x1={L} x2={W - 10} y1={Y((hi / 4) * t)} y2={Y((hi / 4) * t)} stroke="#ffffff12" />
    <text x={L - 6} y={Y((hi / 4) * t) + 4} fill="#b9a88c" font-size="11" text-anchor="end">{short((hi / 4) * t)}</text>
  {/each}
  {#if emptyTo > L + 20}
    <rect x={L} y={TOP} width={emptyTo - L} height={H - TOP - B - 40} fill="#ffffff05" />
    {#if emptyTo - L > 250}<text x={(L + emptyTo) / 2} y={(H - B - 40) / 2 + TOP} fill="#7d705c" font-size="12" text-anchor="middle">no prices collected yet for these {range === '24h' ? 'hours' : 'days'}</text>{/if}
  {/if}
  {#each pts as x (x.i)}
    <rect x={X(x.i) - 6} y={H - B - (x.n / most) * 34} width="12" height={(x.n / most) * 34} fill="#4e4033" />
  {/each}
  {#each [['low', '#eacba4', 1.5], ['typ', '#7fc8ff', 2.5]] as const as [field, color, width] (field)}
    {#each runs(pts) as run (run[0]!.i)}
      {#if run.length > 1}<polyline fill="none" stroke={color} stroke-width={width} points={run.map((x) => `${X(x.i)},${Y(x[field])}`).join(' ')} />{/if}
    {/each}
    {#each pts as x (x.i)}
      <circle class={field} cx={X(x.i)} cy={Y(x[field])} r={width + 1.5} fill={color} data-at={x.at} data-low={x.low} data-typ={x.typ} data-n={x.n}><title>{said(x)}</title></circle>
    {/each}
  {/each}
  {#each ticks as [i, label] (i)}
    <text x={X(i)} y={H - 6} fill="#b9a88c" font-size="11" text-anchor={i === slots - 1 ? 'end' : 'middle'}>{label}</text>
  {/each}
</svg>
<div class="legend">
  <span><i style="background:#7fc8ff"></i>Typical price (median)</span>
  <span><i style="background:#eacba4"></i>Lowest</span>
  <span><i style="background:#4e4033;height:8px"></i>Available</span>
  <span class="seg" role="group" aria-label="Chart range"><button aria-pressed={range === '24h'} onclick={() => (range = '24h')}>24 hours</button><button aria-pressed={range === '7d'} onclick={() => (range = '7d')}>7 days</button></span>
</div>
<p class="note">Only prices really collected are drawn: {range === '24h' ? 'one point an hour' : 'one point a day, the lowest of the day and the mean of its hours'}. The lines grow from there.</p>

<style>
  .chart {
    width: 100%;
    height: 230px;
    display: block;
  }
  .legend {
    display: flex;
    align-items: center;
    gap: 18px;
    color: var(--text-dim);
    font: var(--t-small);
  }
  .legend i {
    display: inline-block;
    width: 14px;
    height: 3px;
    vertical-align: middle;
    margin-right: 6px;
  }
  .seg {
    margin-left: auto;
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
  .note {
    color: var(--text-dim);
    font: var(--t-small);
  }
</style>
