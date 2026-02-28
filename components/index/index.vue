<template>
  <main class="page">
    <img src="/images/ore-logo.png" alt="Ore logo" class="logo" />
    <h1>{{ title }}</h1>
    <p>Your Ore app is running. Visit <a href="/test">/test</a> to see the example component.</p>

    <SampleCounter :initial-count="sampleInitialCount" />
  </main>
</template>

<script setup>
</script>

<style>
.page {
  max-width: 600px;
  margin: 0 auto;
  padding: 3rem 2rem;
  font-family: sans-serif;
  text-align: center;
}

.logo {
  width: 80px;
  margin-bottom: 1.5rem;
}

h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
}

a {
  color: #4f46e5;
}
</style>
