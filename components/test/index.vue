<template>
  <main class="page">
    <h1>{{ title }}</h1>

    <section class="card">
      <p><strong>mytest:</strong> {{ mytest }}</p>
    </section>

    <section class="card">
      <h2>Items</h2>
      <ul>
        <li v-for="item in items" :key="item">{{ item }}</li>
      </ul>
    </section>

    <section v-if="query && Object.keys(query).length" class="card">
      <h2>Query params</h2>
      <dl>
        <template v-for="(val, key) in query" :key="key">
          <dt>{{ key }}</dt>
          <dd>{{ val }}</dd>
        </template>
      </dl>
    </section>
  </main>
</template>

<script setup>
</script>

<style>
.page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  font-size: 2rem;
  margin-bottom: 1.5rem;
}

h2 {
  font-size: 1.25rem;
  margin-top: 0;
}

.card {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1rem;
}

ul {
  margin: 0;
  padding-left: 1.25rem;
}

dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin: 0;
}

dt { font-weight: 600; }
</style>
