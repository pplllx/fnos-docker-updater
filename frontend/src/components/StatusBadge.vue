<template>
  <span
    :class="[
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      statusClass
    ]"
  >
    <span :class="['w-1.5 h-1.5 rounded-full mr-1.5', dotClass]"></span>
    {{ text }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  state?: string;
  updateAvailable?: boolean;
}>();

const text = computed(() => {
  if (props.updateAvailable) return '有新版本';
  switch (props.state?.toLowerCase()) {
    case 'running': return '运行中';
    case 'exited': return '已停止';
    case 'paused': return '已暂停';
    case 'restarting': return '重启中';
    case 'partially_running': return '部分运行';
    default: return props.state || '未知';
  }
});

const statusClass = computed(() => {
  if (props.updateAvailable) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  }
  switch (props.state?.toLowerCase()) {
    case 'running':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'exited':
      return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    case 'partially_running':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
});

const dotClass = computed(() => {
  if (props.updateAvailable) return 'bg-amber-500 animate-pulse';
  switch (props.state?.toLowerCase()) {
    case 'running': return 'bg-emerald-500';
    case 'exited': return 'bg-slate-400';
    case 'partially_running': return 'bg-blue-500';
    default: return 'bg-gray-400';
  }
});
</script>
