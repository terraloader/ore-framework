/**
 * Db — lazy-connected database class.
 *
 * The connection is NOT established in the constructor. It is opened the
 * first time any query method is called, keeping startup fast and ensuring
 * that simply requiring Ore does not trigger a DB connection.
 *
 *   const rows = await Ore.db.fetchAllRows('SELECT * FROM users')
 *   const row  = await Ore.db.fetchRow('SELECT * FROM users WHERE id = ?', [1])
 *   const res  = await Ore.db.execute('INSERT INTO …', […])
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
   * @param  {string}  query  SQL string with ? placeholders
   * @param  {Array}   params Positional parameter values
   * @returns {Promise<Array<object>>}
   */
  async fetchAllRows(query, params = []) {
    const conn = await this._ensureConnected()
    // Example (mysql2): return (await conn.execute(query, params))[0]
    console.log(`[Db] fetchAllRows: ${query}`, params)
    return []
  }

  /**
   * Execute a SELECT and return the first row (or null).
   * @param  {string} query
   * @param  {Array}  params
   * @returns {Promise<object|null>}
   */
  async fetchRow(query, params = []) {
    const rows = await this.fetchAllRows(query, params)
    return rows[0] ?? null
  }

  /**
   * Execute a non-SELECT statement (INSERT / UPDATE / DELETE).
   * @param  {string} query
   * @param  {Array}  params
   * @returns {Promise<object>}  Result metadata (affectedRows, insertId, …)
   */
  async execute(query, params = []) {
    const conn = await this._ensureConnected()
    // Example (mysql2): return (await conn.execute(query, params))[0]
    console.log(`[Db] execute: ${query}`, params)
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

module.exports = Db
