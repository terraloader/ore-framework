<div align="center">
  <img src="www/images/ore-logo.png" alt="Ore" width="200">
  <br><br>
  <strong>A backend framework that pre-calculates data and serves fully server-rendered Vue apps.</strong>
  <br><br>

  ![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js&logoColor=white)
  ![Vue 3](https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vue.js&logoColor=white)
  ![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
</div>

---

## What is Ore?

Ore is a lightweight Node.js backend framework built around one idea: **run all your logic on the server, assign the results to a Vue template, and ship a fully rendered HTML page** — no client-side data fetching, no loading spinners, no hydration mismatches.

Every URL maps to a component directory. The component's JavaScript file runs server-side, pushes data through `Ore.vue.assign()`, and Ore handles the rest — compiling the Vue SFC, rendering it to HTML, and sending a complete page to the browser.

---

## Project structure

```
ore-framework/
├── classes/
│   ├── Ore.js          Global singleton — lazy entry point for all classes
│   ├── Router.js       Maps URL paths to component directories
│   ├── Vue.js          Server-side assignment store + SSR renderer
│   └── Db.js           Lazy-connected database helper
│
├── components/         One subdirectory per route
│   └── test/
│       ├── index.js    Component logic (runs server-side)
│       └── index.vue   Vue 3 SFC template
│
├── www/                Web server entry point + public assets
│   ├── index.js        HTTP server
│   ├── css/
│   │   └── main.css
│   └── images/
│
└── package.json
```

---

## Quick start

```bash
npm install
node www/index.js
```

The server starts on `http://localhost:3000` by default.
Visit `http://localhost:3000/test` to see the example component in action.

| Environment variable | Default     | Description              |
|----------------------|-------------|--------------------------|
| `PORT`               | `3000`      | HTTP listen port         |
| `DB_HOST`            | `localhost` | Database host            |
| `DB_PORT`            | `3306`      | Database port            |
| `DB_USER`            | `root`      | Database user            |
| `DB_PASSWORD`        | *(empty)*   | Database password        |
| `DB_NAME`            | `ore`       | Database name            |

---

## How a request flows

```
GET /test
  │
  ├─▶  www/index.js          static? → serve directly from www/
  │
  ├─▶  Router.js             resolves /test → components/test/
  │
  ├─▶  components/test/index.js   runs server-side
  │       Ore.vue.assign('title', 'Test Page')
  │       Ore.vue.assign('rows',  await Ore.db.fetchAllRows('SELECT …'))
  │
  ├─▶  Vue.js                compiles index.vue, injects assignments,
  │                          SSR-renders to HTML string
  │
  └─▶  browser               receives a complete HTML document
                             + window.__ORE_STATE__ for hydration
```

---

## Creating a route

Add a new directory under `components/` — no registration or config needed. The Router resolves routes by filesystem path.

**`components/hello/index.js`**
```js
module.exports = async function (req, res) {
  Ore.vue.assign('greeting', 'Hello, world!')
  Ore.vue.assign('time', new Date().toLocaleTimeString())
}
```

**`components/hello/index.vue`**
```vue
<template>
  <main>
    <h1>{{ greeting }}</h1>
    <p>Server time: {{ time }}</p>
  </main>
</template>

<script>
export default { name: 'HelloPage' }
</script>
```

That's it. `GET /hello` now renders this page with the assigned data baked in.

---

## The `Ore` global

`Ore` is available everywhere — no `require` needed. Every property is **lazy**: the underlying class is instantiated only when first accessed, so unused features (like the database) cost nothing at startup.

| Property | Class | Description |
|---|---|---|
| `Ore.vue` | `classes/Vue.js` | Assign data · render SFCs |
| `Ore.db` | `classes/Db.js` | Query the database (connects on first use) |
| `Ore.router` | `classes/Router.js` | Route requests to components |

### `Ore.vue`

```js
Ore.vue.assign('key', value)   // set a template variable (chainable)
Ore.vue.assign('a', 1).assign('b', 2)

Ore.vue.get('key')             // read a single value
Ore.vue.getAll()               // { key: value, … }
Ore.vue.reset()                // clear all assignments (done automatically per request)
await Ore.vue.render('/path/to/component.vue')  // returns full HTML string
```

### `Ore.db`

```js
const rows = await Ore.db.fetchAllRows('SELECT * FROM posts WHERE active = ?', [1])
const row  = await Ore.db.fetchRow('SELECT * FROM users WHERE id = ?', [42])
const res  = await Ore.db.execute('INSERT INTO logs (msg) VALUES (?)', ['hello'])
```

The database connection is opened the first time any of these methods is called.
To configure the driver, replace `_connect()` in `classes/Db.js` with your preferred library (`mysql2`, `pg`, `better-sqlite3`, etc.).

---

## Static assets

Files under `www/css/` and `www/images/` are served directly by the HTTP server without going through the router.

```
www/css/main.css          →  /css/main.css
www/images/ore-logo.png   →  /images/ore-logo.png
```

---

## License

MIT
