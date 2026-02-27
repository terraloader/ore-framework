/**
 * Db — lazy-connected database class.
 *
 * The connection is NOT established in the constructor. It is opened the
 * first time any query method is called, keeping startup fast and ensuring
 * that simply requiring Ore does not trigger a DB connection.
 *
 *   const rows = await Ore.db.fetchAllRows('SELECT * FROM users')
 *   const row  = await Ore.db.fetchRow('SELECT * FROM users WHERE id = :id', { id: 1 })
 *   const res  = await Ore.db.execute('INSERT INTO users (name, email) VALUES (:name, :email)', { name: 'Jo', email: 'jo@example.com' })
 *
 * Configuration is read from environment variables (see _config below).
 * Swap the placeholder _connect() body for your actual DB driver
 * (mysql2, pg, better-sqlite3, …).
 */

class Db {
  constructor() {
    this._connection = null   // set once connected
    this._pending    = null   // in-flight connect promise (prevents double-connect)

    this._config = {
      host:     process.env.DB_HOST     || 'localhost',
      port:     Number(process.env.DB_PORT) || 3306,
      user:     process.env.DB_USER     || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'ore',
    }
  }

  // ── Query API ──────────────────────────────────────────────────────────────

  /**
   * Execute a SELECT and return all matching rows as an array of objects.
   * @param  {string}  query  SQL string with :name placeholders
   * @param  {object}  params Named parameter values
   * @returns {Promise<Array<object>>}
   */
  async fetchAllRows(query, params = {}) {
    const conn = await this._ensureConnected()
    const { sql, values } = this._buildQuery(query, params)
    // Example (mysql2): return (await conn.execute(sql, values))[0]
    console.log(`[Db] fetchAllRows: ${sql}`, values)
    return []
  }

  /**
   * Execute a SELECT and return the first row (or null).
   * @param  {string} query
   * @param  {object} params
   * @returns {Promise<object|null>}
   */
  async fetchRow(query, params = {}) {
    const rows = await this.fetchAllRows(query, params)
    return rows[0] ?? null
  }

  /**
   * Execute a non-SELECT statement (INSERT / UPDATE / DELETE).
   * @param  {string} query
   * @param  {object} params
   * @returns {Promise<object>}  Result metadata (affectedRows, insertId, …)
   */
  async execute(query, params = {}) {
    const conn = await this._ensureConnected()
    const { sql, values } = this._buildQuery(query, params)
    // Example (mysql2): return (await conn.execute(sql, values))[0]
    console.log(`[Db] execute: ${sql}`, values)
    return { affectedRows: 0 }
  }

  /** Gracefully close the connection (call on server shutdown). */
  async disconnect() {
    if (this._connection && typeof this._connection.end === 'function') {
      await this._connection.end()
    }
    this._connection = null
    console.log('[Db] Disconnected')
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /**
   * Convert a query with :name placeholders into a positional (?) query
   * and an ordered values array, suitable for most SQL drivers.
   * @param  {string} query  SQL with :name placeholders
   * @param  {object} params Key-value pairs for the named parameters
   * @returns {{ sql: string, values: Array }}
   */
  _buildQuery(query, params) {
    const values = []
    const sql = query.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, name) => {
      if (!(name in params)) {
        throw new Error(`Missing named parameter :${name}`)
      }
      values.push(params[name])
      return '?'
    })
    return { sql, values }
  }

  async _ensureConnected() {
    if (this._connection) return this._connection

    // Guard against concurrent calls during the first connection attempt
    if (!this._pending) {
      this._pending = this._connect().then(conn => {
        this._connection = conn
        this._pending    = null
        return conn
      })
    }

    return this._pending
  }

  async _connect() {
    console.log(`[Db] Connecting to ${this._config.host}:${this._config.port}/${this._config.database} …`)

    // ── Replace this block with your actual driver ──────────────────────────
    //
    //   const mysql = require('mysql2/promise')
    //   const conn  = await mysql.createConnection(this._config)
    //   return conn
    //
    //   const { Pool } = require('pg')
    //   const pool = new Pool(this._config)
    //   return pool
    //
    // ───────────────────────────────────────────────────────────────────────

    console.log('[Db] Connected (mock — replace _connect() with a real driver)')
    return { mock: true }
  }
}

export default Db
