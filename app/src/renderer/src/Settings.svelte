<script lang="ts">
  // Settings: a window over the map, its categories in a column on the left, the rows of the one chosen on the right. On a
  // narrow window the column keeps its icons only. Closed with the cross or Escape; the category chosen is kept for the session.
  import licences from '../../../../THIRD-PARTY-LICENSES?raw'
  import { onMount } from 'svelte'
  import { thirdParties } from '../../shared/licences'
  import type { SetupStatus } from '../../shared/setup'
  import type { TilesStatus } from '../../shared/tiles-status'
  import Glyph from './Glyph.svelte'
  import Logo from './Logo.svelte'
  import type { GlyphName } from './marks'
  import qrcode from 'qrcode-generator'
  import { inApp } from './web'
  import { ZOOMS } from '../../shared/window'
  import { frame, layout, setMapRight } from './frame.svelte'
  import { arrow, setArrow } from './arrow.svelte'
  import { ARROW, ARROW_SIZES } from './look'
  import { objectiveLooks, objectives, packs, questieHere, setObjectiveLook, setPack } from './packs.svelte'
  import { DENSITY_NAMES, graphics, setGraphics } from './graphics.svelte'
  import { langNow, metresOn, metricOffered, num, t, type Key } from '../../shared/i18n'

  let { setup, tiles, onback, onfirstrun, onfeedback, onnews }: { setup: SetupStatus; tiles: TilesStatus | null; onback: () => void; onfirstrun: () => void; onfeedback: () => void; onnews: () => void } = $props()

  let dialog: HTMLDialogElement
  onMount(() => dialog.showModal())

  // The categories. What only the computer sets (the window, a phone, the programme) is not on a phone's page, and the keys
  // are not on a screen that is touched.
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  type Cat = 'general' | 'appearance' | 'graphics' | 'game' | 'phone' | 'privacy' | 'keys' | 'about'
  const CATS: { key: Cat; name: Key; glyph: GlyphName }[] = [
    { key: 'general', name: 'settings.categories.general', glyph: 'sliders' },
    { key: 'appearance', name: 'settings.categories.appearance', glyph: 'palette' },
    { key: 'graphics', name: 'settings.categories.graphics', glyph: 'cube' },
    { key: 'game', name: 'settings.categories.game', glyph: 'folder' },
    ...(inApp
      ? [
          { key: 'phone' as const, name: 'settings.phone.title' as const, glyph: 'phone' as const },
          { key: 'privacy' as const, name: 'settings.categories.privacy' as const, glyph: 'shield' as const },
        ]
      : []),
    ...(touch ? [] : [{ key: 'keys' as const, name: 'settings.keys.title' as const, glyph: 'keyboard' as const }]),
    { key: 'about', name: 'settings.categories.about', glyph: 'info' },
  ]
  const kept = sessionStorage.getItem('settings')
  let cat = $state<Cat>(CATS.find((c) => c.key === kept)?.key ?? 'general')
  const pick = (key: Cat): void => {
    cat = key
    sessionStorage.setItem('settings', key)
  }

  const parties = thirdParties(licences)
  // The licence of each, by its name where the text says it.
  const KIND = /MIT License|BSD 2-Clause License|SIL Open Font License|GNU General Public License/
  let wrong = $state('') // what was wrong with the folder the player picked
  async function choose(): Promise<void> {
    wrong = (await window.twinmap.chooseGameFolder()) ?? ''
  }
  // The address a phone opens, as a code its camera reads: one square of the path for each dark one of the code.
  const lanUrl = $derived(setup.lan && 'url' in setup.lan ? setup.lan.url : null)
  const code = $derived.by(() => {
    if (!lanUrl) return null
    const made = qrcode(0, 'M')
    made.addData(lanUrl)
    made.make()
    const side = made.getModuleCount()
    let path = ''
    for (let row = 0; row < side; row++) for (let column = 0; column < side; column++) if (made.isDark(row, column)) path += `M${column} ${row}h1v1h-1z`
    return { side, path }
  })
  // Metres or yards: kept by this window, as the side of the map; the page loads again in it (main.ts reads it).
  function setDistances(to: string): void {
    localStorage.setItem('distances', to)
    sessionStorage.setItem('view', 'settings') // it opens again where it was (App.svelte)
    location.reload()
  }
  const map = $derived(
    !tiles || tiles.state === 'looking' ? t('settings.found.mapLooking') : tiles.state === 'no-game' ? t('settings.found.mapNoGame') : tiles.state === 'converting' ? t('settings.found.mapBuilding', { percent: tiles.percent }) : tiles.state === 'failed' ? t('settings.found.mapFailed', { message: tiles.message }) : t('settings.found.mapReady', { version: tiles.version }),
  )
</script>

<dialog bind:this={dialog} class="surface" aria-labelledby="settings-title" onclose={onback}>
  <nav aria-label={t('settings.categories.label')}>
    <h1 id="settings-title">{t('settings.title')}</h1>
    {#each CATS as c (c.key)}
      <button class:on={cat === c.key} aria-current={cat === c.key ? 'page' : undefined} title={t(c.name)} onclick={() => pick(c.key)}><Glyph name={c.glyph} size={16} /><span class="word">{t(c.name)}</span></button>
    {/each}
  </nav>
  <button class="x" aria-label={t('common.close')} onclick={() => dialog.close()}><Glyph name="close" size={14} /></button>
  <div class="body">
    <h2 class="title">{t(CATS.find((c) => c.key === cat)!.name)}</h2>
    <!-- No cards: one column of rows, a label and its control, the notes small under their row. -->
    {#if cat === 'general'}
      <!-- The language is the computer's: a phone's page follows it. A pick is spoken at once, the page loads again in it. -->
      {#if inApp}
        <div class="setting">
          <label class="choice">{t('language.label')} <select class="field" value={langNow()} onchange={(e) => void window.twinmap.setLang(e.currentTarget.value)}>{#each setup.langs ?? [] as lang (lang.code)}<option value={lang.code} disabled={!lang.ready}>{lang.ready ? lang.name : lang.soon}</option>{/each}</select></label>
          <p class="hint">{t('language.hint')}</p>
        </div>
      {/if}
      <!-- Only where the game counts in yards (English, Chinese): its other languages already write m. The page loads
           again in the choice, as for the language, so that every distance on it changes at once. -->
      {#if metricOffered()}
        <label class="choice">{t('settings.distances.label')} <select class="field size" value={metresOn() ? 'metres' : 'yards'} onchange={(e) => setDistances(e.currentTarget.value)}><option value="yards">{t('settings.distances.yards')}</option><option value="metres">{t('settings.distances.metres')}</option></select></label>
      {/if}
      <!-- The window is the computer's: a phone on the home network has none to set. -->
      {#if inApp}
        <label class="choice">{t('settings.window.textSize')} <select class="field size" value={setup.zoom ?? 1} onchange={(e) => window.twinmap.setZoom(Number(e.currentTarget.value))}>{#each ZOOMS as z (z)}<option value={z}>{num(z, { style: 'percent' })}</option>{/each}</select></label>
        <label class="choice"><input type="checkbox" class="check" checked={setup.onTop} onchange={(e) => window.twinmap.setOnTop(e.currentTarget.checked)} />{t('settings.window.onTop')}</label>
      {/if}
    {:else if cat === 'appearance'}
      <!-- The side of the map holds only where a workspace lays the map and Now side by side as at first (frame.svelte.ts). -->
      <div class="setting">
        <label class="choice">{t('settings.layout.label')} <select class="field size" disabled={!layout.sided} value={layout.mapRight ? 'right' : 'left'} onchange={(e) => setMapRight(e.currentTarget.value === 'right')}><option value="left">{t('settings.layout.left')}</option><option value="right">{t('settings.layout.right')}</option></select></label>
        {#if !layout.sided}<p class="hint">{t('settings.layout.custom', { edit: t('app.layout.editKey') })}</p>
        {:else if !touch}<p class="hint">{t('settings.layout.hint')}</p>{/if}
      </div>
      <!-- The character's arrow, on the 2D map and on the 3D view: any colour, and a size of the one first drawn. -->
      <div class="setting">
        <h3 class="sub">{t('settings.arrow.title')}</h3>
        <div class="line">
          <label class="choice">{t('settings.arrow.colour')} <input type="color" class="field colour" value={arrow.colour} oninput={(e) => setArrow({ colour: e.currentTarget.value })} /></label>
          {#if arrow.colour !== ARROW.colour}<button class="btn" onclick={() => setArrow({ colour: ARROW.colour })}>{t('settings.arrow.default')}</button>{/if}
        </div>
        <label class="choice">{t('settings.arrow.size')} <select class="field size" value={arrow.size} onchange={(e) => setArrow({ size: Number(e.currentTarget.value) })}>{#each ARROW_SIZES as z (z)}<option value={z}>{num(z, { style: 'percent' })}</option>{/each}</select></label>
      </div>
      <!-- The icons of the quest pins (M21-F4): Twinmap's, the game's, or Questie's where Questie is installed. Twinmap and Questie are names: never translated. -->
      <div class="setting">
        <label class="choice">{t('settings.icons.label')} <select class="field size" value={packs.chosen === 'questie' && !questieHere() ? 'twinmap' : packs.chosen} onchange={(e) => setPack(e.currentTarget.value as typeof packs.chosen)}><option value="twinmap">Twinmap</option><option value="game">{t('settings.icons.game')}</option>{#if questieHere()}<option value="questie">Questie</option>{/if}</select></label>
        <p class="hint">{t('settings.icons.hint')}</p>
      </div>
      <!-- The objectives of quests (M21-F5): as icons, or as areas in the style of the game's map. -->
      <div class="setting">
        <label class="choice">{t('settings.objectives.label')} <select class="field size" value={objectives.look} onchange={(e) => setObjectiveLook(e.currentTarget.value as typeof objectives.look)}>{#each objectiveLooks as look (look)}<option value={look}>{t(`settings.objectives.${look}`)}</option>{/each}</select></label>
        <p class="hint">{t('settings.objectives.hint')}</p>
      </div>
    {:else if cat === 'graphics'}
      <!-- What the 3D view draws (M23, design/ui.md section 6): a switch each, kept by this window (graphics.svelte.ts). -->
      <div class="setting">
        <h3 class="sub">{t('settings.graphics.view3d')}</h3>
        <label class="choice"><input type="checkbox" class="check" checked={graphics.buildings} onchange={(e) => setGraphics({ buildings: e.currentTarget.checked })} />{t('settings.graphics.buildings')}</label>
        <!-- Trees and objects (M23-F7): trees thinned and without leaves round the character, as many as chosen. -->
        <div class="line">
          <label class="choice"><input type="checkbox" class="check" checked={graphics.trees} onchange={(e) => setGraphics({ trees: e.currentTarget.checked })} />{t('settings.graphics.trees')}</label>
          <select class="field size" aria-label={t('settings.graphics.density')} value={graphics.density} disabled={!graphics.trees} onchange={(e) => setGraphics({ density: e.currentTarget.value as typeof graphics.density })}>{#each DENSITY_NAMES as d (d)}<option value={d}>{t(`settings.graphics.${d}`)}</option>{/each}</select>
        </div>
        <p class="hint">{t('settings.graphics.treesHint')}</p>
        <label class="choice"><input type="checkbox" class="check" checked={graphics.objects} onchange={(e) => setGraphics({ objects: e.currentTarget.checked })} />{t('settings.graphics.objects')}</label>
        <p class="hint">{t('settings.graphics.objectsHint')}</p>
        <p class="hint">{t('settings.graphics.cost')}</p>
      </div>
      <!-- The graphics card is the computer's: a phone on the home network has none to set. -->
      {#if inApp}
        <div class="setting">
          <h3 class="sub">{t('settings.graphics.card')}</h3>
          <label class="choice"><input type="checkbox" class="check" checked={setup.gpu?.chosen ?? true} onchange={(e) => window.twinmap.setGpu(e.currentTarget.checked)} />{t('settings.window.gpu')}</label>
          <p class="hint">{t('settings.window.gpuHint')}</p>
          {#if setup.gpu && setup.gpu.chosen !== setup.gpu.running}
            <div class="line"><span class="hint">{t('settings.window.restartNeeded')}</span><button class="btn" onclick={() => window.twinmap.restart()}>{t('settings.window.restartNow')}</button></div>
          {/if}
        </div>
      {/if}
    {:else if cat === 'game'}
      <div class="setting">
        <h3 class="sub">{t('settings.gameFolder.title')}</h3>
        <div class="line">
          <span class="path" title={setup.gameFolder ?? undefined}>{setup.gameFolder ?? t('settings.gameFolder.notFound')}</span>
          <!-- The folder is chosen on the computer it is on. -->
          {#if inApp}<button class="btn" onclick={choose}>{setup.gameFolder ? t('settings.gameFolder.change') : t('settings.gameFolder.choose')}</button>{/if}
        </div>
        {#if wrong}<p class="wrong">{wrong}</p>{/if}
      </div>
      <div class="setting">
        <h3 class="sub">{t('settings.found.inFolder')}</h3>
        <!-- A light, the name, what was found; a button only where something is missing. -->
        <dl class="found">
          <div>
            <dt><i class:off={!setup.addon}></i>{t('settings.found.addon')}</dt>
            <dd>{#if setup.addon}{setup.addon}{:else}<button class="btn" onclick={() => window.twinmap.openCurseForge()}>{t('settings.found.get')}</button>{/if}</dd>
          </div>
          <div>
            <dt><i class:off={!setup.questie}></i>QuestieDB <small>{t('settings.found.questie')}</small></dt>
            <dd>{#if setup.questie}{t('settings.found.installed')}{:else}<button class="btn" onclick={() => window.twinmap.openCurseForge('questie')}>{t('settings.found.get')}</button>{/if}</dd>
          </div>
          <div>
            <dt><i class:off={!setup.shortestPath}></i>Shortest Path <small>{t('settings.found.optional')}</small></dt>
            <dd>{#if setup.shortestPath}{t('settings.found.installed')}{:else}<button class="btn" onclick={() => window.twinmap.openCurseForge('shortestPath')}>{t('settings.found.get')}</button>{/if}</dd>
          </div>
          <div>
            <dt><i class:off={tiles?.state !== 'ready'} class:bad={tiles?.state === 'failed'}></i>{t('settings.found.map')}</dt>
            <dd>{map}</dd>
          </div>
        </dl>
      </div>
    {:else if cat === 'phone'}
      <div class="setting">
        <label class="choice"><input type="checkbox" class="check" checked={!!setup.lan} onchange={(e) => window.twinmap.setLan(e.currentTarget.checked)} />{t('settings.phone.share')}</label>
        {#if setup.lan && 'error' in setup.lan}<p class="wrong">{setup.lan.error}</p>{/if}
        {#if lanUrl && code}
          <div class="phone">
            <svg class="code" viewBox="-4 -4 {code.side + 8} {code.side + 8}" role="img" aria-label={t('settings.phone.codeLabel')}><path d={code.path} /></svg>
            <div>
              <span class="hint">{t('settings.phone.scan')}</span>
              <span class="address">{lanUrl}</span>
              <p class="hint">{t('settings.phone.homeOnly')}</p>
            </div>
          </div>
        {/if}
      </div>
    {:else if cat === 'privacy'}
      <!-- The participation programme: the words approved with its notice (site/privacy.html, "participation"). -->
      <div class="setting">
        <h3 class="sub">{t('participate.title')}</h3>
        <label class="choice"><input type="checkbox" class="check" checked={setup.participate === true} onchange={(e) => window.twinmap.setParticipate(e.currentTarget.checked)} />{t('settings.participate.share')}</label>
        <p class="hint">{t('settings.participate.what')} <button class="link" onclick={() => void window.twinmap.openFeedback('participation', '')}>{t('participate.full')}</button></p>
      </div>
    {:else if cat === 'keys'}
      <dl class="keys">
        <div><dt><kbd>L</kbd></dt><dd>{t('settings.keys.layers')}</dd></div>
        <div><dt><kbd>F</kbd></dt><dd>{t('settings.keys.follow')}</dd></div>
        <div><dt><kbd>N</kbd></dt><dd>{t('settings.keys.north')}</dd></div>
        <div><dt><kbd>M</kbd></dt><dd>{t('settings.keys.side')}</dd></div>
        <div><dt><kbd>{t('settings.keys.ctrl')}</kbd><kbd>1</kbd>{#if frame.spaces.length > 1}<kbd>{frame.spaces.length}</kbd>{/if}</dt><dd>{t('settings.keys.spaces')}</dd></div>
        <div><dt><kbd>{t('settings.keys.ctrl')}</kbd><kbd>E</kbd></dt><dd>{t('app.layout.editKey')}</dd></div>
        {#if inApp}<div><dt><kbd>F11</kbd></dt><dd>{t('settings.keys.fullScreen')}</dd></div>{/if}
        {#if inApp}<div><dt><kbd>{t('settings.keys.ctrl')}</kbd><kbd>+</kbd><kbd>-</kbd><kbd>0</kbd></dt><dd>{t('settings.keys.zoom')}</dd></div>{/if}
        <div><dt><kbd>Esc</kbd></dt><dd>{t('settings.keys.close')}</dd></div>
        <div><dt><kbd>{t('settings.keys.arrows')}</kbd><kbd>+</kbd><kbd>-</kbd></dt><dd>{t('settings.keys.move')}</dd></div>
        <div><dt><kbd>{t('settings.keys.rightDrag')}</kbd></dt><dd>{t('settings.keys.turn')}</dd></div>
        <div><dt><kbd>{t('settings.keys.space')}</kbd></dt><dd>{t('settings.keys.label')}</dd></div>
      </dl>
    {:else}
      <div class="setting">
        <h3 class="sub">Twinmap {setup.version}</h3>
        <p class="hint">{t('settings.version.updates')}</p>
        <div class="buttons">
          <button class="btn" onclick={onnews}>{t('news.button')}</button>
          <button class="btn" onclick={onfeedback}>{t('settings.version.report')}</button>
          {#if inApp}<button class="btn" onclick={onfirstrun}>{t('settings.version.firstRun')}</button>{/if}
        </div>
      </div>
      <div class="about">
        <span class="mark"><Logo size={36} word={false} /></span>
        <div>
          <p>{t('settings.about.what')}</p>
          <p>{t('settings.about.notAffiliated')}</p>
          <details class="built">
            <summary><Glyph name="menu" />{t('settings.about.built', { count: parties.length })}</summary>
            {#each parties as party (party.name)}
              {@const [, address = '', rest = ''] = /^(https?:\/\/\S+)?\s*(.*)$/.exec(party.about) ?? []}
              <details>
                <summary><Glyph name="menu" />{party.name}<span>{KIND.exec(party.licence)?.[0] ?? t('settings.about.seeText')}</span></summary>
                {#if address}<p class="dim">{address}</p>{/if}
                {#if rest}<p class="dim">{rest}</p>{/if}
                <pre>{party.licence}</pre>
              </details>
            {/each}
          </details>
        </div>
      </div>
    {/if}
  </div>
</dialog>

<style>
  /* The window: the column of the categories, then the rows of the one chosen, which scroll on their own. */
  dialog {
    width: min(920px, calc(100vw - 32px));
    height: min(640px, calc(100vh - 32px));
    padding: 0;
    border: 1px solid var(--bronze-600);
    box-shadow: 0 0 0 1px #000, 0 12px 40px #000c;
    overflow: hidden;
    color: var(--text);
  }
  dialog[open] {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
  }
  dialog::backdrop {
    background: #000a;
  }
  nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    padding: 16px 8px;
    border-right: 1px solid #0008;
    background: #0003;
    overflow-y: auto;
  }
  h1 {
    margin: 0 12px 14px;
    font: var(--t-title);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }
  nav button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border: 0;
    border-left: 2px solid transparent;
    background: none;
    font: inherit;
    color: var(--text-dim);
    text-align: left;
    white-space: nowrap;
    cursor: pointer;
  }
  nav button:hover {
    color: var(--text);
    background: #ffffff08;
  }
  nav button.on {
    border-left-color: var(--gold);
    background: #ffffff0d;
    color: var(--gold);
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
  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr); /* a long folder is cut, it does not widen the window */
    align-content: start;
    gap: 16px;
    padding: 16px 24px 24px;
    overflow-y: auto;
  }
  .title {
    margin: 0 32px 0 0;
    font: var(--t-title);
    color: var(--gold);
  }
  /* A row: its label and control, or its subtitle, then the notes small under it. */
  .setting {
    display: grid;
    justify-items: start;
    gap: 4px;
    min-width: 0;
  }
  .sub {
    margin: 0;
    font: inherit;
    line-height: 26px;
    color: var(--text);
  }
  .line {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 100%;
    min-height: 28px;
  }
  .line .btn {
    flex: none;
  }
  .path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    display: block;
    max-width: 64ch;
    margin: 0;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .link {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: var(--gold);
    text-decoration: underline;
    cursor: pointer;
  }
  .wrong {
    margin: 0;
    color: var(--objective);
  }
  .buttons {
    display: flex;
    margin-top: 8px;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* The code and the address stand under the words of their choice. */
  .phone {
    display: flex;
    align-items: center;
    gap: 14px;
    padding-left: 30px;
  }
  /* Dark on white with a clear edge around, whatever the app's own colors: that is what a camera reads. */
  .code {
    flex: none;
    width: 104px;
    height: 104px;
    background: #fff;
    fill: #000;
    shape-rendering: crispEdges;
  }
  .address {
    display: block;
    overflow-wrap: anywhere;
    user-select: text;
  }
  .phone p {
    margin-top: 8px;
  }

  dt,
  dd {
    margin: 0;
  }
  .found {
    width: min(520px, 100%);
    margin: 0;
  }
  .found div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 36px;
  }
  .found div + div {
    box-shadow: inset 0 1px 0 #ffffff12;
  }
  .found dt {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .found small {
    font: var(--t-small);
    color: var(--text-dim);
  }
  .found dd {
    color: var(--text-dim);
    text-align: right;
  }
  /* The light of an entry: lit when found, out when not, red when it went wrong. */
  .found i {
    flex: none;
    align-self: center;
    width: 8px;
    height: 8px;
    margin-right: 2px;
    border-radius: 50%;
    background: var(--done);
    box-shadow: 0 0 0 1px #000;
  }
  .found i.off {
    background: var(--text-off);
  }
  .found i.bad {
    background: var(--objective);
  }

  dl.keys {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 24px;
    margin: 0;
  }
  .keys div {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .keys dt {
    display: flex;
    flex: none;
    gap: 6px;
  }
  .keys dd {
    color: var(--text-dim);
  }
  .field.size {
    width: auto;
    padding: 0 4px;
  }
  .field.colour {
    width: 44px;
    padding: 3px;
    cursor: pointer;
  }
  .field.colour::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .field.colour::-webkit-color-swatch {
    border: 1px solid #000;
    border-radius: 2px;
  }
  kbd {
    min-width: 26px;
    padding: 1px 7px;
    border-radius: 3px;
    background: linear-gradient(var(--stone-500), var(--stone-700));
    box-shadow:
      0 0 0 1px var(--bronze-600),
      0 0 0 2px #000,
      inset 0 1px 0 #ffffff2e;
    font: 500 13px/20px var(--font);
    color: var(--gold);
    text-align: center;
  }

  .about {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 0 2px;
    font: var(--t-small);
    color: var(--text-dim);
  }
  .about > div {
    flex: 1;
    min-width: 0;
  }
  .mark {
    flex: none;
    color: var(--gold);
  }
  .about p {
    max-width: 80ch;
    margin: 0 0 4px;
    text-wrap: pretty;
  }
  details details {
    box-shadow: inset 0 -1px 0 #ffffff14;
    color: var(--text);
  }
  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
    line-height: 30px;
    cursor: pointer;
  }
  .built > summary {
    padding: 0;
    color: var(--gold);
  }
  summary:hover {
    background-color: #ffffff0f;
  }
  summary span,
  .dim {
    color: var(--text-dim);
  }
  summary span {
    margin-left: auto;
  }
  /* The arrow points right on a closed entry and down on an open one. */
  summary :global(svg) {
    transform: rotate(-90deg); /* the glyph sets its own rotate; this one adds to it */
    color: var(--text-dim);
    transition: transform var(--quick);
  }
  details[open] > summary :global(svg) {
    transform: none;
  }
  details .dim {
    padding: 4px 4px 0;
  }
  pre {
    max-height: 260px;
    margin: 6px 0 12px;
    padding: 10px 12px;
    overflow: auto;
    background: var(--stone-950);
    border: 1px solid var(--bronze-700);
    font: 12px/17px Consolas, monospace;
    color: var(--text-dim);
    white-space: pre-wrap;
  }

  /* On a narrow window the column keeps the icons, each named on hover and read aloud; the window takes the whole screen. */
  @media (max-width: 900px) {
    nav h1,
    nav .word {
      display: none;
    }
    nav button {
      padding: 10px 12px;
    }
  }
  @media (max-width: 560px) {
    dialog {
      width: 100vw;
      max-width: none;
      height: 100vh;
      max-height: none;
    }
    .body {
      padding: 12px 12px 20px;
    }
  }
  @media (max-width: 480px) {
    .phone {
      flex-direction: column;
      align-items: flex-start;
      padding-left: 0;
    }
    dl.keys {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  /* The keys are for a keyboard: a screen that is touched has none. */
  @media (pointer: coarse) {
    .keys {
      display: none;
    }
    summary {
      min-height: 44px;
    }
  }
</style>
