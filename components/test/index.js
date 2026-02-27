/**
 * Component logic for GET /test
 *
 * This file runs server-side on every request to /test.
 * Use Ore.vue.assign(key, value) to pass data into the Vue template.
 * The function is async so you can await database calls, fetch, etc.
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse}  res
 */
export default async function (req, res) {

  // ── Static assignments ────────────────────────────────────────────────────
  Ore.vue.assign('title',   'Test Page')
  Ore.vue.assign('mytest',  'mytestcontent')
  Ore.vue.assign('items', ['Item 1', 'Item 2', 'Item 3'])

  // ── Database example (uncomment once a real driver is configured) ─────────
  // const users = await Ore.db.fetchAllRows('SELECT id, name FROM users')
  // Ore.vue.assign('users', users)

  // ── Request-aware example ─────────────────────────────────────────────────
  const params = new URL(req.url, 'http://localhost').searchParams
  Ore.vue.assign('query', Object.fromEntries(params))
}
