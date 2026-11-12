<script lang="ts">
  // Settings: one column, four sections. What the app found is shown as it is, and what the
  // player can change is changed here.
  import licences from '../../../../THIRD-PARTY-LICENSES?raw'
  import { thirdParties } from '../../shared/licences'
  import type { LinkStatus } from '../../shared/link'
  import type { SetupStatus } from '../../shared/setup'
  import type { TilesStatus } from '../../shared/tiles-status'
  import Glyph from './Glyph.svelte'
  import Logo from './Logo.svelte'
  import qrcode from 'qrcode-generator'
  import { inApp } from './web'

  let { setup, tiles, link, onback, onfirstrun }: { setup: SetupStatus; tiles: TilesStatus | null; link: LinkStatus | null; onback: () => void; onfirstrun: () => void } = $props()

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
    !tiles || tiles.state === 'looking' ? 'Looking' : tiles.state === 'no-game' ? 'Waiting for the game folder' : tiles.state === 'converting' ? `Being built, ${tiles.percent}%` : tiles.state === 'failed' ? `Not built: ${tiles.message}` : `${tiles.tiles.toLocaleString('en-US')} tiles, from game version ${tiles.version}`,
  )
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onback()} />

<main class="surface">
  <div class="column">
    <button class="btn" onclick={onback}>Back to the map</button>
    <h1>Settings</h1>

    <h2 class="band">Game</h2>
    <dl>
      <dt>Game folder</dt>
      <dd>
        {setup.gameFolder ?? 'Not found'}
        {#if wrong}<span class="wrong">{wrong}</span>{/if}
        <button class="btn" onclick={choose}>{setup.gameFolder ? 'Change folder' : 'Choose the game folder'}</button>
      </dd>
      <dt>Link with the game</dt>
      <dd>{link?.word ?? 'Starting'}</dd>
      <dt>Twinmap Forever addon</dt>
      <dd>
        {setup.addon ? `Version ${setup.addon}, installed` : 'Not installed'}
        {#if !setup.addon}<button class="btn" onclick={() => window.twinmap.openCurseForge()}>Get it on CurseForge</button>{/if}
      </dd>
      <dt>Questie</dt>
      <dd>{setup.questie ? 'Installed' : 'Not installed (optional)'}</dd>
      <dt>Map</dt>
      <dd>{map}</dd>
      <dt>First run</dt>
      <dd><button class="btn" onclick={onfirstrun}>Go through the steps again</button></dd>
    </dl>

    <h2 class="band">Window</h2>
    <dl>
      <dt>Over other windows</dt>
      <dd>
        <label class="choice"><input type="checkbox" class="check" checked={setup.onTop} onchange={(e) => window.twinmap.setOnTop(e.currentTarget.checked)} />Keep Twinmap on top</label>
      </dd>
      <dt>Place and size</dt>
      <dd>Remembered when the window closes: monitor, place, size, and whether it was maximized.</dd>
      <dt>Full screen</dt>
      <dd>F11 turns it on and off.</dd>
    </dl>

    {#if inApp}
      <h2 class="band">Phone and tablet</h2>
      <dl>
        <dt>On the home network</dt>
        <dd>
          <label class="choice"><input type="checkbox" class="check" checked={!!setup.lan} onchange={(e) => window.twinmap.setLan(e.currentTarget.checked)} />Show the map to my other devices</label>
          {#if setup.lan && 'error' in setup.lan}<span class="wrong">{setup.lan.error}</span>{/if}
        </dd>
        {#if lanUrl && code}
          <dt>Code to scan</dt>
          <dd>
            <svg class="code" viewBox="-4 -4 {code.side + 8} {code.side + 8}" role="img" aria-label="The address below, as a code for the camera of a phone"><path d={code.path} /></svg>
          </dd>
          <dt>Address</dt>
          <dd class="address">{lanUrl}</dd>
        {/if}
        <dt>Who can open it</dt>
        <dd>A device on the same network as this computer that has this address, and no one from outside. The first time, Windows may ask whether Twinmap can be reached on private networks: allow it.</dd>
      </dl>
    {/if}

    <h2 class="band">Shortcuts</h2>
    <dl>
      <dt>L</dt>
      <dd>Opens and closes Layers.</dd>
      <dt>F</dt>
      <dd>Turns Follow on and off.</dd>
      <dt>Esc</dt>
      <dd>Closes the label on a point, then Layers, and these settings.</dd>
      <dt>Arrows, + and -</dt>
      <dd>Move and zoom the map, with the keyboard on it.</dd>
      <dt>Space</dt>
      <dd>Puts the label on the middle of the map, with the keyboard on it.</dd>
      <dt>F11</dt>
      <dd>Full screen.</dd>
    </dl>

    <h2 class="band">Updates</h2>
    <dl>
      <dt>Twinmap</dt>
      <dd>Version {setup.version}</dd>
      <dt>Checking for updates</dt>
      <dd>Not yet in this version. The addon updates through CurseForge.</dd>
    </dl>

    <h2 class="band">About</h2>
    <div class="about">
      <span class="mark"><Logo size={48} /></span>
      <p>Twinmap {setup.version}. A live map of World of Warcraft: Forever for your second screen.</p>
      <p>Free software under the GNU General Public License, version 3. It comes with no warranty.</p>
      <p>Not affiliated with or endorsed by Blizzard Entertainment. World of Warcraft is a trademark of Blizzard Entertainment, Inc.</p>
      <h3>Built with</h3>
      {#each parties as party (party.name)}
        {@const [, address = '', rest = ''] = /^(https?:\/\/\S+)?\s*(.*)$/.exec(party.about) ?? []}
        <details>
          <summary><Glyph name="menu" />{party.name}<span>{KIND.exec(party.licence)?.[0] ?? 'See the text'}</span></summary>
          {#if address}<p class="dim">{address}</p>{/if}
          {#if rest}<p class="dim">{rest}</p>{/if}
          <pre>{party.licence}</pre>
        </details>
      {/each}
    </div>
  </div>
</main>

<style>
  main {
    position: absolute;
    inset: 46px 0 0;
    overflow-y: auto;
  }
  .column {
    max-width: 640px;
    margin: 0 auto;
    padding: 24px 0 64px;
  }
  .column > .btn {
    margin-left: 16px;
  }
  h1 {
    margin: 0;
    padding: 20px 16px 16px;
    font: var(--t-zone);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }

  /* Name on the left in a fixed column, value on the right: the values change, the places do not. */
  dl {
    display: grid;
    grid-template-columns: 180px minmax(0, 1fr);
    gap: 10px 16px;
    margin: 0;
    padding: 14px 16px 28px;
  }
  dt {
    color: var(--text-dim);
  }
  dd {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    margin: 0;
    overflow-wrap: anywhere;
  }
  /* As tall as a button, so a row with one and a row without line up; a value on two lines keeps the text's own leading. */
  dt,
  dd {
    min-height: 28px;
    padding: 3.5px 0;
  }
  /* A button in a row does not make the row taller than its neighbours. */
  dd .btn {
    margin: -3.5px 0;
  }
  .wrong {
    flex-basis: 100%;
    color: var(--objective);
    line-height: 21px;
  }

  /* Dark on white with a clear edge around, whatever the app's own colors: that is what a camera reads. */
  .code {
    width: 176px;
    height: 176px;
    background: #fff;
    fill: #000;
    shape-rendering: crispEdges;
  }
  .address {
    user-select: text;
  }

  .about {
    padding: 18px 16px 0;
  }
  .mark {
    display: block;
    margin-bottom: 14px;
    color: var(--gold);
  }
  .about p {
    max-width: 65ch;
    text-wrap: pretty;
    margin: 0 0 8px;
  }
  h3 {
    margin: 22px 0 8px;
    font: var(--t-title);
    color: var(--gold);
    text-shadow: 0 1px 0 #000;
  }
  details {
    box-shadow: inset 0 -1px 0 #ffffff14;
  }
  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
    line-height: 30px;
    cursor: pointer;
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
  details[open] summary :global(svg) {
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
</style>
