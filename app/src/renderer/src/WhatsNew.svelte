<script lang="ts">
  // What's new: the news of the versions the player updated past (shared/news.ts), drawn as LangAsk.svelte draws its question.
  // As the app starts after an update it shows once: closed, its version is seen (news-seen) and it shows again only from Settings,
  // where it has every version. In a version its new things first, then what changed, then the fixes, smaller and dimmer.
  import { onMount } from 'svelte'
  import type { Go, Kind, Release } from '../../shared/news'
  import Glyph from './Glyph.svelte'
  import { day, t } from '../../shared/i18n'

  let { releases, since, all = false, onclose, ongo }: { releases: Release[]; since?: string; all?: boolean; onclose: () => void; ongo: (go: Go) => void } = $props()
  let dialog: HTMLDialogElement
  let going: Go | null = null
  onMount(() => dialog.showModal())

  const name = (go: Go): string => (go === 'now' ? t('app.top.map') : go === 'items' ? t('app.top.character') : go === 'ah' ? t('app.top.auctionHouse') : go === 'settings' ? t('app.top.settings') : t('map.layers.button'))
  const dated = (date: string): string => day(Date.parse(date + 'T00:00:00Z'), { dateStyle: 'long', timeZone: 'UTC' })
  const of = (release: Release, kind: Kind) => release.entries.filter((e) => e.kind === kind)
  const closed = (): void => {
    const then = (): void => {
      onclose()
      if (going) ongo(going)
    }
    if (all) then()
    else void window.twinmap.newsSeen().then(then)
  }
</script>

{#snippet entries(list: Release['entries'])}
  <ul>
    {#each list as entry (entry.title)}
      <li><b>{entry.title}</b> {entry.text}{#if entry.go}{' '}<button class="link" onclick={() => ((going = entry.go!), dialog.close())}>{t('news.goTo', { name: name(entry.go) })}</button>{/if}</li>
    {/each}
  </ul>
{/snippet}

<dialog bind:this={dialog} class="surface" aria-labelledby="news-title" onclose={closed}>
  <button class="x" aria-label={t('common.close')} onclick={() => dialog.close()}><Glyph name="close" size={14} /></button>
  <h1 id="news-title">{t('news.title')}</h1>
  {#if !all}
    <p class="intro">{since ? t('news.updatedFrom', { version: since }) + ' ' : ''}{t('news.again', { settings: t('app.top.settings'), button: t('news.button') })}</p>
  {/if}
  {#each releases as release (release.version)}
    <h2>{release.version} <span>{dated(release.date)}</span></h2>
    {@render entries(of(release, 'New'))}
    {#if of(release, 'Changed').length}
      <h3>{t('news.changed')}</h3>
      {@render entries(of(release, 'Changed'))}
    {/if}
    {#if of(release, 'Fixed').length}
      <h3>{t('news.fixed')}</h3>
      <div class="fixed">{@render entries(of(release, 'Fixed'))}</div>
    {/if}
    {#each release.notes as note, i (i)}
      <p class="note">{note}</p>
    {/each}
  {/each}
  <div class="foot">
    <!-- svelte-ignore a11y_autofocus -->
    <button class="btn" autofocus onclick={() => dialog.close()}>{t('news.done')}</button>
  </div>
</dialog>

<style>
  dialog {
    position: relative;
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    padding: 24px 24px 0;
    border: 1px solid var(--bronze-600);
    box-shadow: 0 0 0 1px #000, 0 12px 40px #000c;
    overflow: auto;
    color: var(--text);
  }
  dialog::backdrop {
    background: #000a;
  }
  h1 {
    margin: 0 24px 4px 0;
    font: var(--t-title, inherit);
    color: var(--gold);
  }
  .intro {
    margin: 0 0 16px;
    color: var(--text-dim);
  }
  h2 {
    display: flex;
    justify-content: space-between;
    margin: 18px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--bronze-700, #0006);
    font-size: 13px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--bronze-400, var(--gold));
  }
  h2 span {
    font-weight: normal;
    letter-spacing: 0;
    text-transform: none;
    color: var(--text-dim);
  }
  h3 {
    margin: 4px 0 6px;
    font-size: 12px;
    font-weight: normal;
    color: var(--text-dim);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    margin: 0 0 12px;
    line-height: 1.45;
  }
  .fixed li,
  .note {
    margin: 0 0 8px;
    font-size: 12.5px;
    color: var(--text-dim);
  }
  .fixed li b {
    color: var(--text-dim);
  }
  .link {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: var(--gold);
    text-decoration: underline;
    white-space: nowrap;
    cursor: pointer;
  }
  .x {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 4px;
    border: 0;
    background: none;
    color: var(--text-dim);
    cursor: pointer;
  }
  .x:hover {
    color: var(--text);
  }
  .foot {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: flex-end;
    padding: 12px 0 20px;
    background: inherit;
  }
</style>
