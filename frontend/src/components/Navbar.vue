<template>
  <header class="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-30 shadow-xs transition-colors">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <!-- Brand Logo -->
      <router-link to="/" class="flex items-center space-x-3 group">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16" />
          </svg>
        </div>
        <div>
          <span class="font-bold text-base tracking-tight text-slate-900 dark:text-white flex items-center">
            fnOS Docker
            <span class="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 rounded-md">
              Updater
            </span>
          </span>
          <span class="text-[11px] text-slate-500 dark:text-slate-400 block -mt-0.5">飞牛容器更新面板</span>
        </div>
      </router-link>

      <!-- Desktop Navigation Links -->
      <nav class="hidden md:flex items-center space-x-1">
        <router-link
          v-for="link in navLinks"
          :key="link.path"
          :to="link.path"
          class="px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
          :class="[
            $route.path === link.path
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-900/30 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
          ]"
        >
          <span class="flex items-center space-x-1.5">
            <component :is="link.icon" class="w-4 h-4" />
            <span>{{ link.label }}</span>
          </span>
        </router-link>
      </nav>

      <!-- Right Actions -->
      <div class="flex items-center space-x-2.5">
        <!-- Docker Socket Status Indicator -->
        <div
          class="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs border"
          :class="dockerStatusClass"
          :title="dockerStatusTooltip"
        >
          <span class="w-2 h-2 rounded-full" :class="dockerDotClass"></span>
          <span class="font-medium text-[11px]">{{ dockerStatusText }}</span>
        </div>

        <!-- Theme Switcher -->
        <button
          @click="appStore.toggleDark"
          class="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="切换明暗主题"
        >
          <Moon v-if="appStore.isDark" class="w-4 h-4" />
          <Sun v-else class="w-4 h-4" />
        </button>

        <!-- Logout button -->
        <button
          v-if="!authStore.passwordless && authStore.token"
          @click="handleLogout"
          class="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          title="退出登录"
        >
          <LogOut class="w-4 h-4" />
        </button>

        <!-- Mobile Menu Toggle Button -->
        <button
          @click="mobileMenuOpen = !mobileMenuOpen"
          class="md:hidden p-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="打开导航菜单"
        >
          <X v-if="mobileMenuOpen" class="w-5 h-5" />
          <Menu v-else class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Mobile Drawer / Dropdown Navigation -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform opacity-0 -translate-y-2"
      enter-to-class="transform opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform opacity-100 translate-y-0"
      leave-to-class="transform opacity-0 -translate-y-2"
    >
      <div
        v-if="mobileMenuOpen"
        class="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 pt-3 pb-5 space-y-2 shadow-lg"
      >
        <!-- Mobile Docker Status Indicator -->
        <div class="sm:hidden flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 mb-2">
          <span class="text-xs text-slate-500 dark:text-slate-400">Docker 运行状态</span>
          <span class="inline-flex items-center space-x-1 text-xs font-medium" :class="dockerTextClass">
            <span class="w-2 h-2 rounded-full" :class="dockerDotClass"></span>
            <span>{{ dockerStatusText }}</span>
          </span>
        </div>

        <router-link
          v-for="link in navLinks"
          :key="link.path"
          :to="link.path"
          @click="mobileMenuOpen = false"
          class="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition"
          :class="[
            $route.path === link.path
              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          ]"
        >
          <component :is="link.icon" class="w-5 h-5" />
          <span>{{ link.label }}</span>
        </router-link>
      </div>
    </transition>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  LayoutDashboard,
  Box,
  Layers,
  History,
  Settings,
  Sun,
  Moon,
  LogOut,
  Menu,
  X
} from 'lucide-vue-next';
import { useAppStore } from '../stores/app';
import { useAuthStore } from '../stores/auth';

const appStore = useAppStore();
const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const mobileMenuOpen = ref(false);

// Auto close mobile menu on route change
watch(() => route.path, () => {
  mobileMenuOpen.value = false;
});

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

const navLinks = [
  { path: '/', label: '概览仪表盘', icon: LayoutDashboard },
  { path: '/containers', label: '单容器管理', icon: Box },
  { path: '/compose', label: 'Compose 编排', icon: Layers },
  { path: '/history', label: '更新日志', icon: History },
  { path: '/settings', label: '系统设置', icon: Settings },
];

const dockerConnected = computed(() => appStore.dockerConnected);
const demoMode = computed(() => appStore.demoMode);

const dockerStatusText = computed(() => {
  if (demoMode.value) return '演示模式';
  if (dockerConnected.value === true) return 'Docker 在线';
  if (dockerConnected.value === false) return 'Docker 未连接';
  return '检测中...';
});

const dockerStatusTooltip = computed(() => {
  if (demoMode.value) return '当前正在使用演示模拟数据体验 UI';
  if (dockerConnected.value === true) return '已成功连接宿主机 Docker Socket (/var/run/docker.sock)';
  if (dockerConnected.value === false) return '未检测到 Docker Socket，需挂载 /var/run/docker.sock';
  return '正在检测 Docker 连通性';
});

const dockerStatusClass = computed(() => {
  if (demoMode.value) {
    return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60';
  }
  if (dockerConnected.value === true) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60';
  }
  if (dockerConnected.value === false) {
    return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60';
  }
  return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';
});

const dockerDotClass = computed(() => {
  if (demoMode.value) return 'bg-amber-500 animate-pulse';
  if (dockerConnected.value === true) return 'bg-emerald-500';
  if (dockerConnected.value === false) return 'bg-rose-500 animate-ping';
  return 'bg-slate-400';
});

const dockerTextClass = computed(() => {
  if (demoMode.value) return 'text-amber-600 dark:text-amber-400';
  if (dockerConnected.value === true) return 'text-emerald-600 dark:text-emerald-400';
  if (dockerConnected.value === false) return 'text-rose-600 dark:text-rose-400';
  return 'text-slate-500';
});
</script>
