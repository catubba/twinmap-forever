<script lang="ts">
  // Settings: on the left what the player chooses, on the right what the app found, shown as it
  // is; the keys and the licences under both. One column on a narrow screen.
  import licences from '../../../../THIRD-PARTY-LICENSES?raw'
  import { thirdParties } from '../../shared/licences'
  import type { SetupStatus } from '../../shared/setup'
  import type { TilesStatus } from '../../shared/tiles-status'
  import Glyph from './Glyph.svelte'
  import Logo from './Logo.svelte'
  import qrcode from 'qrcode-generator'
  import { inApp } from './web'
  import { ZOOMS } from '../../shared/window'
  import { layout, setMapRight } from './layout.svelte'

  let { setup, tiles, onback, onfirstrun, onfeedback }: { setup: SetupStatus; tiles: TilesStatus | null; onback: () => void; onfirstrun: () => void; onfeedback: () => void } = $props()

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
  const map = $derived(
    !tiles || tiles.state === 'looking' ? 'Looking' : tiles.state === 'no-game' ? 'Waiting for the game folder' : tiles.state === 'converting' ? `Being built, ${tiles.percent}%` : tiles.state === 'failed' ? `Not built: ${tiles.message}` : `Ready, game ${tiles.version}`,
  )
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onback()} />

<main class="surface">
  <div class="page">
    <div class="head">
      <h1>Settings</h1>
      <button class="btn" onclick={onback}>Back to the map</button>
    </div>
    <div class="columns">
      <div class="column">
        <section class="group">
          <h2 class="band">Game folder</h2>
          <div class="in">
            <div class="line">
              <span class="path" title={setup.gameFolder ?? undefined}>{setup.gameFolder ?? 'Not found'}</span>
              <!-- The folder is chosen on the computer it is on. -->
              {#if inApp}<button class="btn" onclick={choose}>{setup.gameFolder ? 'Change folder' : 'Choose the game folder'}</button>{/if}
            </div>
            {#if wrong}<p class="wrong">{wrong}</p>{/if}
          </div>
        </section>
        <section class="group">
          <h2 class="band">Layout</h2>
          <div class="in">
            <label class="choice"><input type="radio" class="check" name="map-side" checked={!layout.mapRight} onchange={() => setMapRight(false)} />Map on the left</label>
            <label class="choice"><input type="radio" class="check" name="map-side" checked={layout.mapRight} onchange={() => setMapRight(true)} />Map on the right</label>
          </div>
        </section>
        <!-- The window is the computer's, and so is what it shows to other devices: a phone on the home network has neither to set. -->
        {#if inApp}
          <section class="group">
            <h2 class="band">Window</h2>
            <div class="in">
              <label class="choice"><input type="checkbox" class="check" checked={setup.onTop} onchange={(e) => window.twinmap.setOnTop(e.currentTarget.checked)} />Keep Twinmap on top of other windows</label>
              <label class="choice">Text size <select class="field size" value={setup.zoom ?? 1} onchange={(e) => window.twinmap.setZoom(Number(e.currentTarget.value))}>{#each ZOOMS as z (z)}<option value={z}>{Math.round(z * 100)}%</option>{/each}</select></label>
            </div>
          </section>
          <section class="group">
            <h2 class="band">Phone and tablet</h2>
            <div class="in">
              <label class="choice"><input type="checkbox" class="check" checked={!!setup.lan} onchange={(e) => window.twinmap.setLan(e.currentTarget.checked)} />Show the map to my other devices</label>
              {#if setup.lan && 'error' in setup.lan}<p class="wrong">{setup.lan.error}</p>{/if}
              {#if lanUrl && code}
                <div class="phone">
                  <svg class="code" viewBox="-4 -4 {code.side + 8} {code.side + 8}" role="img" aria-label="The address beside, as a code for the camera of a phone"><path d={code.path} /></svg>
                  <div>
                    <span class="hint">Scan the code, or open</span>
                    <span class="address">{lanUrl}</span>
                    <p class="hint">For devices on your home network only. Windows may ask once to allow it.</p>
                  </div>
                </div>
              {/if}
            </div>
          </section>
          <!-- The participation programme: the words approved with its notice (site/privacy.html, "participation"). -->
          <section class="group">
            <h2 class="band">Help improve Twinmap</h2>
            <div class="in">
              <label class="choice"><input type="checkbox" class="check" checked={setup.participate === true} onchange={(e) => window.twinmap.setParticipate(e.currentTarget.checked)} />Share anonymous data about the world of Forever</label>
              <p class="hint">Off unless you turn it on. Twinmap sends what helps it find you better inside dungeons and fill in what the map lacks: the minimap inside dungeons, where bosses and rares die, the doors of dungeons, what trainers teach, the creatures, objects and quests that Questie does not know, and Twinmap's own errors. Never a name, a character, an account, the chat, or the rest of your screen. Turn it off and nothing more is sent. <button class="link" onclick={() => void window.twinmap.openFeedback('participation', '')}>What is sent, in full</button></p>
            </div>
          </section>
        {/if}
      </div>

      <div class="column">
        <section class="group">
          <h2 class="band">What Twinmap found</h2>
          <!-- A light, the name, what was found; a button only where something is missing. -->
          <dl class="in found">
            <div>
              <dt><i class:off={!setup.addon}></i>Twinmap Forever addon</dt>
              <dd>{#if setup.addon}{setup.addon}{:else}<button class="btn" onclick={() => window.twinmap.openCurseForge()}>Get it on CurseForge</button>{/if}</dd>
            </div>
            <div>
              <dt><i class:off={!setup.questie}></i>QuestieDB <small>NPCs, services and quests</small></dt>
              <dd>{#if setup.questie}Installed{:else}<button class="btn" onclick={() => window.twinmap.openCurseForge('questie')}>Get it on CurseForge</button>{/if}</dd>
            </div>
            <div>
              <dt><i class:off={!setup.shortestPath}></i>Shortest Path <small>optional</small></dt>
              <dd>{#if setup.shortestPath}Installed{:else}<button class="btn" onclick={() => window.twinmap.openCurseForge('shortestPath')}>Get it on CurseForge</button>{/if}</dd>
            </div>
            <div>
              <dt><i class:off={tiles?.state !== 'ready'} class:bad={tiles?.state === 'failed'}></i>Map</dt>
              <dd>{map}</dd>
            </div>
          </dl>
        </section>
        <section class="group">
          <h2 class="band">Twinmap {setup.version}</h2>
          <div class="in">
            <p class="hint">Updates itself when it starts. The addon updates through CurseForge.</p>
            <div class="buttons">
              <button class="btn" onclick={onfeedback}>Report a bug or an idea</button>
              {#if inApp}<button class="btn" onclick={onfirstrun}>Go through the first steps again</button>{/if}
            </div>
          </div>
        </section>
      </div>

      <section class="group wide keys">
        <h2 class="band">Shortcuts</h2>
        <dl class="in">
          <div><dt><kbd>L</kbd></dt><dd>Layers</dd></div>
          <div><dt><kbd>F</kbd></dt><dd>Follow on and off</dd></div>
          <div><dt><kbd>N</kbd></dt><dd>The map turns with your character, or north up</dd></div>
          <div><dt><kbd>M</kbd></dt><dd>Map on the other side of the panel</dd></div>
          {#if inApp}<div><dt><kbd>F11</kbd></dt><dd>Full screen</dd></div>{/if}
          {#if inApp}<div><dt><kbd>Ctrl</kbd><kbd>+</kbd><kbd>-</kbd><kbd>0</kbd></dt><dd>Text size, also Ctrl and the wheel outside the map</dd></div>{/if}
          <div><dt><kbd>Esc</kbd></dt><dd>Closes a label, Layers, these settings</dd></div>
          <div><dt><kbd>Arrows</kbd><kbd>+</kbd><kbd>-</kbd></dt><dd>Move and zoom the map</dd></div>
          <div><dt><kbd>Space</kbd></dt><dd>Label on the middle of the map</dd></div>
        </dl>
      </section>
    </div>

    <div class="about">
      <span class="mark"><Logo size={36} word={false} /></span>
      <div>
        <p>A live map of World of Warcraft: Forever for your second screen. Free software under the GNU General Public License, version 3. It comes with no warranty.</p>
        <p>Not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft is a trademark of Blizzard Entertainment, Inc.</p>
        <details class="built">
          <summary><Glyph name="menu" />Built with: the licences of the {parties.length} projects inside</summary>
          {#each parties as party (party.name)}
            {@const [, address = '', rest = ''] = /^(https?:\/\/\S+)?\s*(.*)$/.exec(party.about) ?? []}
            <details>
              <summary><Glyph name="menu" />{party.name}<span>{KIND.exec(party.licence)?.[0] ?? 'See the text'}</span></summary>
              {#if address}<p class="dim">{address}</p>{/if}
              {#if rest}<p class="dim">{rest}</p>{/if}
              <pre>{party.licence}</pre>
            </details>
          {/each}
        </details>
      </div>
    </div>
  </div>
</main>

<style>
  main {
    position: absolute;
    inset: 46px 0 0;
    overflow-y: auto;
  }
  .page {
    max-width: 1040px;
    margin: 0 auto;
    padding: 20px 24px 48px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }
  h1 {
    margin: 0;
    font: var(--t-zone);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }
  /* Two columns, each as tall as what it holds; the keys under both. */
  .columns {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }
  .column {
    display: grid;
    grid-template-columns: minmax(0, 1fr); /* a long folder is cut, it does not widen its column */
    gap: 20px;
  }
  .wide {
    grid-column: 1 / -1;
  }
  /* A group: its band, and what it holds on a darker ground with a thin edge. */
  .group {
    background: #0000002e;
    box-shadow:
      0 0 0 1px var(--bronze-700),
      0 0 0 2px #000;
  }
  .in {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    margin: 0;
    padding: 14px 16px 16px;
  }
  .line {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 28px;
  }
  .line .btn {
    flex: none;
    margin-left: auto;
  }
  .path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    display: block;
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
    gap: 0;
    padding-top: 8px;
    padding-bottom: 8px;
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

  .keys dl {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px 24px;
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
    margin-top: 24px;
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

  /* On a narrow screen the columns stand one under the other, in the same order. */
  @media (max-width: 760px) {
    .page {
      padding: 12px 12px 40px;
    }
    .columns {
      grid-template-columns: minmax(0, 1fr);
    }
    .keys dl {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 480px) {
    .phone {
      flex-direction: column;
      align-items: flex-start;
      padding-left: 0;
    }
    .keys dl {
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
