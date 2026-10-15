<template>
  <div class="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors">
    <Navbar v-if="!isAuthPage" />
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <router-view />
    </main>
    <TerminalModal />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import Navbar from './components/Navbar.vue';
import TerminalModal from './components/TerminalModal.vue';
import { useAppStore } from './stores/app';

const route = useRoute();
const appStore = useAppStore();

const isAuthPage = computed(() => {
  return route.path === '/login' || route.path === '/setup';
});

onMounted(() => {
  appStore.initTheme();
});
</script>
