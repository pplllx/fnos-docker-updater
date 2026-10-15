<template>
  <header class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/80 sticky top-0 z-30 shadow-sm transition-colors">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <!-- Brand Logo -->
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16" />
          </svg>
        </div>
        <div>
          <span class="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center">
            fnOS Docker
            <span class="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 rounded">
              Updater
            </span>
          </span>
          <span class="text-[11px] text-slate-500 dark:text-slate-400 block -mt-1">飞牛容器更新面板</span>
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="hidden md:flex items-center space-x-1">
        <router-link
          v-for="link in navLinks"
          :key="link.path"
          :to="link.path"
          class="px-3 py-2 rounded-md text-sm font-medium transition-colors"
          :class="[
            $route.path === link.path
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
          ]"
        >
          <span class="flex items-center space-x-1.5">
            <component :is="link.icon" class="w-4 h-4" />
            <span>{{ link.label }}</span>
          </span>
        </router-link>
      </nav>

      <!-- Right Actions -->
      <div class="flex items-center space-x-3">
        <!-- Theme Switcher -->
        <button
          @click="appStore.toggleDark"
          class="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          title="切换明暗主题"
        >
          <svg v-if="appStore.isDark" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 9H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <svg v-else class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>

        <!-- Logout button -->
        <button
          v-if="!authStore.passwordless && authStore.token"
          @click="handleLogout"
          class="p-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          title="退出登录"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { h } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';

const appStore = useAppStore();
const authStore = useAuthStore();
const router = useRouter();

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

// Simple SVG icon render functions
const IconDashboard = () => h('svg', { class: 'w-4 h-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' })
]);

const IconContainers = () => h('svg', { class: 'w-4 h-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' })
]);

const IconCompose = () => h('svg', { class: 'w-4 h-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z' })
]);

const IconHistory = () => h('svg', { class: 'w-4 h-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' })
]);

const IconSettings = () => h('svg', { class: 'w-4 h-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', 'stroke-width': '2' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }),
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
]);

const navLinks = [
  { path: '/', label: '概览仪表盘', icon: IconDashboard },
  { path: '/containers', label: '单容器管理', icon: IconContainers },
  { path: '/compose', label: 'Compose 编排', icon: IconCompose },
  { path: '/history', label: '更新日志', icon: IconHistory },
  { path: '/settings', label: '系统设置', icon: IconSettings },
];
</script>
