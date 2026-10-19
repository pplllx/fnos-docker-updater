<template>
  <div class="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b0f17] text-slate-800 dark:text-slate-100 transition-colors relative selection:bg-blue-500/20 selection:text-blue-600 font-sans">
    <!-- Ambient Glow Lighting Effects -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden z-0">
      <!-- Top Left Blue/Cyan Aura -->
      <div class="absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent blur-3xl dark:from-blue-600/15 dark:via-cyan-600/5"></div>
      <!-- Top Right Purple/Violet Aura -->
      <div class="absolute -top-[15%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent blur-3xl dark:from-indigo-600/15 dark:via-purple-600/5"></div>
      <!-- Center Bottom Subtle Glow -->
      <div class="absolute bottom-[5%] left-[25%] w-[40vw] h-[40vw] rounded-full bg-gradient-to-t from-emerald-500/5 via-teal-500/3 to-transparent blur-3xl dark:from-emerald-600/8 dark:via-transparent"></div>
    </div>

    <!-- Main Navigation Bar -->
    <Navbar v-if="!isAuthPage" class="relative z-20" />

    <!-- Content Area -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 relative z-10">
      <router-view />
    </main>

    <!-- Global Execution Terminal Modal -->
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
