<script lang="ts">
  // The languages to pick from, each in its own words, in two columns: the one spoken in gold with its tick, the game's
  // own said beside its name, the ones not written yet there but greyed and coming. A pick is spoken at once: the app
  // keeps it and the page loads again in it (App.svelte), this list included.
  import type { SetupStatus } from '../../shared/setup'
  import { langNow, t } from '../../shared/i18n'

  let { setup }: { setup: SetupStatus } = $props()
  const spoken = langNow()
</script>

<ul class="langs" role="radiogroup" aria-label={t('language.title')}>
  {#each setup.langs ?? [] as lang (lang.code)}
    <li>
      <button role="radio" aria-checked={lang.code === spoken} disabled={!lang.ready} onclick={() => lang.code !== spoken && void window.twinmap.setLang(lang.code)}>
        <span class="tick" aria-hidden="true">{lang.code === spoken ? '✓' : ''}</span>
        <span class="name"><span lang={lang.code.slice(0, 2)}>{lang.ready ? lang.name : t('language.soon', { name: lang.name })}</span>{#if lang.code === setup.gameLang && lang.ready}<small>{t('language.game')}</small>{/if}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .langs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  button {
    display: flex;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 6px 10px;
    border: 1px solid transparent;
    border-radius: 3px;
    background: none;
    font: var(--t-title);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    border-color: var(--bronze-600);
  }
  button[aria-checked='true'] {
    border-color: var(--gold);
    background: #0004;
    color: var(--gold);
  }
  button:disabled {
    color: var(--text-dim);
    cursor: default;
  }
  .tick {
    width: 12px;
    flex: none;
  }
  /* A long name goes on a second line under itself, not under the tick. */
  .name {
    flex: 1;
    min-width: 0;
  }
  small {
    margin-left: 8px;
    font: var(--t-small);
    color: var(--text-dim);
  }
  /* In a narrow window, one under the other. */
  @media (max-width: 560px) {
    .langs {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
