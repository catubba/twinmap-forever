<script lang="ts" module>
  // Where the points of a history go: a slot an hour (24 hours) or a day (7 days), the last slot the
  // snapshot shown. Only points really collected, joined by one line across the slots with nothing between them.
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

</script>

<script lang="ts">
  // The chart of the page of an item (M18-F9), as approved on design/ah/mock.html: typical and lowest
  // price, how many on sale as bars, over 24 hours or 7 days. Slots with nothing collected stay empty.
  import { coins } from '../../shared/items'
  import { clock, day, num, t } from '../../shared/i18n'

  let { history, snapshot, now }: { history: History | null; snapshot: string; now: number } = $props()
  let range = $state<'24h' | '7d'>('24h')

  const W = 640, H = 230, L = 52, B = 22, TOP = 10
  const slots = $derived(range === '24h' ? 24 : 7)
  const pts = $derived(placed(history, range, snapshot))
  const hi = $derived(Math.max(...pts.map((x) => Math.max(x.low, x.typ)), 0) * 1.25 || 1)
  const most = $derived(Math.max(...pts.map((x) => x.n), 1))
  const X = (i: number): number => L + (i / (slots - 1)) * (W - L - 10)
  const Y = (y: number): number => TOP + (1 - y / hi) * (H - TOP - B - 40)
  const ONE = { minimumFractionDigits: 1, maximumFractionDigits: 1 } // one decimal, written as the language writes it
  const COIN = { g: 'auction.chart.coin.gold', s: 'auction.chart.coin.silver', c: 'auction.chart.coin.copper' } as const
  const short = (c: number): string => (c >= 10000 ? t(COIN.g, { amount: num(c / 10000, ONE) }) : c >= 100 ? t(COIN.s, { amount: num(c / 100, ONE) }) : t(COIN.c, { amount: Math.round(c) }))
  const money = (c: number): string => coins(Math.round(c)).map(([n, coin]) => t(COIN[coin], { amount: n })).join(' ')
  const dayName = (ms: number): string => (new Date(ms).toISOString().slice(0, 10) === new Date(now).toISOString().slice(0, 10) ? t('auction.chart.today') : day(ms, { day: 'numeric', month: 'short', timeZone: 'UTC' }))
  const ticks = $derived(
    range === '24h'
      ? [0, 6, 12, 18, 23].map((i) => [i, clock(Date.parse(snapshot) - (23 - i) * HOUR)] as const)
      : [0, 2, 4, 6].map((i) => [i, dayName(Date.parse(snapshot.slice(0, 10)) - (6 - i) * DAY)] as const),
  )
  const said = (x: Placed): string =>
    range === '24h'
      ? t('auction.chart.pointHour', { time: clock(Date.parse(x.at)), typical: money(x.typ), lowest: money(x.low), count: num(x.n) })
      : t('auction.chart.pointDay', { time: dayName(Date.parse(x.at)), typical: money(x.typ), lowest: money(x.low), count: num(x.n) })
  // The slots before the first point: nothing collected yet.
  const emptyTo = $derived(pts.length ? X(pts[0]!.i) - 14 : W - 10)
</script>

<svg class="chart" viewBox="0 0 {W} {H}" role="img" aria-label={range === '24h' ? t('auction.chart.label24h') : t('auction.chart.label7d')}>
  {#each [0, 1, 2, 3, 4] as g (g)}
    <line x1={L} x2={W - 10} y1={Y((hi / 4) * g)} y2={Y((hi / 4) * g)} stroke="#ffffff12" />
    <text x={L - 6} y={Y((hi / 4) * g) + 4} fill="#b9a88c" font-size="11" text-anchor="end">{short((hi / 4) * g)}</text>
  {/each}
  {#if emptyTo > L + 20}
    <rect x={L} y={TOP} width={emptyTo - L} height={H - TOP - B - 40} fill="#ffffff05" />
    {#if emptyTo - L > 250}<text x={(L + emptyTo) / 2} y={(H - B - 40) / 2 + TOP} fill="#7d705c" font-size="12" text-anchor="middle">{range === '24h' ? t('auction.chart.emptyHours') : t('auction.chart.emptyDays')}</text>{/if}
  {/if}
  {#each pts as x (x.i)}
    <rect x={X(x.i) - 6} y={H - B - (x.n / most) * 34} width="12" height={(x.n / most) * 34} fill="#4e4033" />
  {/each}
  {#each [['low', '#eacba4', 1.5], ['typ', '#7fc8ff', 2.5]] as const as [field, color, width] (field)}
    {#if pts.length > 1}<polyline fill="none" stroke={color} stroke-width={width} points={pts.map((x) => `${X(x.i)},${Y(x[field])}`).join(' ')} />{/if}
    {#each pts as x (x.i)}
      <circle class={field} cx={X(x.i)} cy={Y(x[field])} r={width + 1.5} fill={color} data-at={x.at} data-low={x.low} data-typ={x.typ} data-n={x.n}><title>{said(x)}</title></circle>
    {/each}
  {/each}
  {#each ticks as [i, label] (i)}
    <text x={X(i)} y={H - 6} fill="#b9a88c" font-size="11" text-anchor={i === slots - 1 ? 'end' : 'middle'}>{label}</text>
  {/each}
</svg>
<div class="legend">
  <span><i style="background:#7fc8ff"></i>{t('auction.chart.typical')}</span>
  <span><i style="background:#eacba4"></i>{t('auction.chart.lowest')}</span>
  <span><i style="background:#4e4033;height:8px"></i>{t('auction.chart.available')}</span>
  <span class="seg" role="group" aria-label={t('auction.chart.range')}><button aria-pressed={range === '24h'} onclick={() => (range = '24h')}>{t('auction.chart.hours')}</button><button aria-pressed={range === '7d'} onclick={() => (range = '7d')}>{t('auction.chart.days')}</button></span>
</div>
<p class="note">{range === '24h' ? t('auction.chart.noteHours') : t('auction.chart.noteDays')}</p>

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
