/**
 * Ore — central global singleton.
 *
 * Every class is lazy-instantiated on first access so no resource
 * (database connection, renderer, …) is created until it is actually needed.
 *
 * Usage anywhere in the project (no require needed — set as global):
 *
 *   Ore.vue.assign('key', value)
 *   Ore.db.fetchAllRows('SELECT …')
 *   Ore.router.route(req, res)
 */

class OreClass {
  #vue    = null
  #db     = null
  #router = null

  get vue() {
    if (!this.#vue) this.#vue = new (require('./Vue'))()
    return this.#vue
  }

  get db() {
    if (!this.#db) this.#db = new (require('./Db'))()
    return this.#db
  }

  get router() {
    if (!this.#router) this.#router = new (require('./Router'))()
    return this.#router
  }
}

const Ore = new OreClass()

// Make available everywhere without require()
global.Ore = Ore

module.exports = Ore
