// A Worker of its own, twinmap-prices-cron, with no address and nothing it answers: once an hour (the cron of
// wrangler.toml beside it) it asks GitHub to run the Action that writes the prices (.github/workflows/prices.yml),
// because GitHub's own schedule never ran it (21 November 2026). It holds one secret, ACTIONS_TOKEN: a fine-grained
// token that may run the workflows of twinmap-forever (Actions, read and write) and nothing else.
//   test:    node --test server/prices/prices.test.ts
//   publish: npx wrangler@4 deploy                      (from this folder)
//   secret:  npx wrangler@4 secret put ACTIONS_TOKEN
export const WORKFLOW = 'https://api.github.com/repos/catubba/twinmap-forever/actions/workflows/prices.yml/dispatches'

export default {
  async scheduled(_controller: unknown, env: { ACTIONS_TOKEN?: string }): Promise<void> {
    if (!env.ACTIONS_TOKEN) return void console.error('no ACTIONS_TOKEN')
    const r = await fetch(WORKFLOW, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.ACTIONS_TOKEN}`, accept: 'application/vnd.github+json', 'user-agent': 'twinmap-prices-cron' },
      body: JSON.stringify({ ref: 'main' }),
    })
    if (r.status !== 204) console.error(`GitHub answered ${r.status} ${await r.text()}`)
  },
}
