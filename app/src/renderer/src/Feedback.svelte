<script lang="ts">
  // Feedback: a small window over the app with the ways to tell us something. The app sends
  // nothing by itself: it opens an issue on GitHub or a letter in the player's mail program, with
  // what it knows about itself already written, shown here first.
  import { onMount } from 'svelte'
  import { FEEDBACK, type FeedbackWay } from '../../shared/feedback'

  let { details, onclose }: { details: string; onclose: () => void } = $props()

  // The browser's own dialog: it keeps the keyboard inside, closes on Escape, and dims what is under it.
  let dialog: HTMLDialogElement
  onMount(() => dialog.showModal())
  const open = (way: FeedbackWay): void => void window.twinmap.openFeedback(way, details)
  // Copying asks for a page the browser trusts: the app's window is one, a phone on the home network is not.
  const canCopy = !!navigator.clipboard
  let copied = $state<'details' | 'log' | null>(null)
  async function copy(what: 'details' | 'log'): Promise<void> {
    await navigator.clipboard.writeText(what === 'details' ? details : await window.twinmap.readLog())
    copied = what
  }
</script>

<dialog bind:this={dialog} class="surface" aria-labelledby="feedback-title" {onclose} onclick={(e) => e.target === dialog && dialog.close()}>
  <h1 id="feedback-title">Feedback</h1>
  <p>Found a bug, or have an idea? Tell us. Twinmap sends nothing by itself: you choose where to write, and you see every word before it leaves.</p>
  <div class="ways">
    <button class="btn" onclick={() => open('github')}>Open an issue on GitHub</button>
    <button class="btn" onclick={() => open('email')}>Write an email</button>
  </div>
  <p class="dim">No GitHub account? Write to {FEEDBACK.email}, in English or in Italian.</p>
  <h2>What Twinmap adds to your message</h2>
  <pre>{details}</pre>
  {#if canCopy}<p class="dim log">For a bug, the log helps: it is Twinmap's own record of what happened to it (started, game found, map, link). Copy it and paste it into your message.</p>{/if}
  <div class="foot">
    {#if canCopy}
      <button class="btn" onclick={() => copy('details')}>{copied === 'details' ? 'Copied' : 'Copy details'}</button>
      <button class="btn" onclick={() => copy('log')}>{copied === 'log' ? 'Copied' : 'Copy log'}</button>
    {/if}
    <button class="btn" onclick={() => dialog.close()}>Close</button>
  </div>
</dialog>

<style>
  dialog {
    width: min(480px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    padding: 24px;
    border: 1px solid var(--bronze-600);
    box-shadow: 0 0 0 1px #000, 0 12px 40px #000c;
    overflow: auto;
    color: var(--text);
  }
  dialog::backdrop {
    background: #000a;
  }
  h1 {
    margin: 0 0 12px;
    font: var(--t-title, inherit);
    color: var(--gold);
  }
  h2 {
    margin: 20px 0 8px;
    font: inherit;
    color: var(--text-dim);
  }
  p {
    margin: 0 0 12px;
  }
  .dim {
    color: var(--text-dim);
  }
  .log {
    margin: 12px 0 0;
  }
  .ways,
  .foot {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ways {
    margin-bottom: 12px;
  }
  .foot {
    justify-content: flex-end;
    margin-top: 16px;
  }
  pre {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--bronze-700);
    background: var(--stone-950);
    font: inherit;
    font-size: 0.9em;
    color: var(--text-dim);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    user-select: text;
  }
</style>
