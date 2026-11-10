<script lang="ts">
  // Settings: one column, four sections. What the app found is shown as it is, and what the
  // player can change is changed here.
  import licences from '../../../../THIRD-PARTY-LICENSES?raw'
  import { thirdParties } from '../../shared/licences'
  import type { LinkStatus } from '../../shared/link'
  import type { SetupStatus } from '../../shared/setup'
  import type { TilesStatus } from '../../shared/tiles-status'
  import Logo from './Logo.svelte'

  let { setup, tiles, link, onback, onfirstrun }: { setup: SetupStatus; tiles: TilesStatus | null; link: LinkStatus | null; onback: () => void; onfirstrun: () => void } = $props()

  const parties = thirdParties(licences)
  // The licence of each, by its name where the text says it.
  const KIND = /MIT License|BSD 2-Clause License|SIL Open Font License|GNU General Public License/
  let wrong = $state('') // what was wrong with the folder the player picked
  async function choose(): Promise<void> {
    wrong = (await window.twinmap.chooseGameFolder()) ?? ''
  }
  const map = $derived(
    !tiles || tiles.state === 'looking' ? 'Looking' : tiles.state === 'no-game' ? 'Waiting for the game folder' : tiles.state === 'converting' ? `Being built, ${tiles.percent}%` : tiles.state === 'failed' ? `Not built: ${tiles.message}` : `${tiles.tiles.toLocaleString('en-US')} tiles, from game version ${tiles.version}`,
  )
</script>

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
        <details>
          <summary>{party.name}<span>{KIND.exec(party.licence)?.[0] ?? 'See the text'}</span></summary>
          {#if party.about}<p class="dim">{party.about}</p>{/if}
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
  dt,
  dd {
    min-height: 28px;
    line-height: 28px;
  }
  .wrong {
    flex-basis: 100%;
    color: var(--objective);
    line-height: 21px;
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
    justify-content: space-between;
    gap: 16px;
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
  details .dim {
    padding: 4px 4px 0;
  }
  pre {
    max-height: 260px;
    margin: 6px 0 12px;
    padding: 10px 12px;
    overflow: auto;
    background: var(--stone-950);
    border: 1px solid #5a4526;
    font: 12px/17px Consolas, monospace;
    color: var(--text-dim);
    white-space: pre-wrap;
  }
</style>
