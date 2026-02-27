/**
 * Ore — central global singleton.
 *
 * Every class is lazy-instantiated on first access so no resource
 * (database connection, renderer, …) is created until it is actually needed.
 *
 * Usage anywhere in the project (no import needed — set as global):
 *
 *   Ore.vue.assign('key', value)
 *   Ore.db.fetchAllRows('SELECT …')
 *   Ore.router.route(req, res)
 */

import Vue    from './Vue.js'
import Db     from './Db.js'
import Router from './Router.js'

class OreClass {
  #vue    = null
  #db     = null
  #router = null

  get vue() {
    if (!this.#vue) this.#vue = new Vue()
    return this.#vue
  }

  get db() {
    if (!this.#db) this.#db = new Db()
    return this.#db
  }

  get router() {
    if (!this.#router) this.#router = new Router()
    return this.#router
  }
}

const Ore = new OreClass()

// Make available everywhere without import
global.Ore = Ore

export default Ore
