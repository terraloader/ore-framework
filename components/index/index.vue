<template>
  <main class="page">
    <img src="/images/ore-logo.png" alt="Ore logo" class="logo" />
    <h1>{{ title }}</h1>
    <p>Your Ore app is running. Visit <a href="/test">/test</a> to see the example component.</p>

    <!-- SampleCounter component -->
    <div class="sample-counter">
      <h2>Sample Counter</h2>
      <p class="counter-value">{{ count }}</p>
      <button class="counter-btn" @click="count++">Count Up</button>
    </div>
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

.sample-counter {
  border: 2px solid #4f46e5;
  border-radius: 12px;
  padding: 2rem;
  margin-top: 2rem;
  text-align: center;
}

.counter-value {
  font-size: 3rem;
  font-weight: bold;
  color: #4f46e5;
  margin: 1rem 0;
}

.counter-btn {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.counter-btn:hover {
  background: #3730a3;
}
</style>
