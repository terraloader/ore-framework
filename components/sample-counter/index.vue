<template>
  <div class="sample-counter">
    <h2>Sample Counter</h2>
    <p class="counter-value">{{ count }}</p>
    <button class="counter-btn" @click="count++">Count Up</button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  initialCount: {
    type: Number,
    default: 0,
  },
})

const count = ref(props.initialCount)
</script>

<style scoped>
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
