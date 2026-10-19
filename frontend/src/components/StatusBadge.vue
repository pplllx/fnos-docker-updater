<template>
  <span
    :class="[
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border transition-colors',
      statusClass
    ]"
  >
    <span class="relative flex h-2 w-2 mr-1.5">
      <span
        v-if="props.updateAvailable || props.state?.toLowerCase() === 'running'"
        class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        :class="pingDotClass"
      ></span>
      <span class="relative inline-flex rounded-full h-2 w-2" :class="dotClass"></span>
    </span>
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
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
  }
  switch (props.state?.toLowerCase()) {
    case 'running':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 shadow-xs shadow-emerald-500/10';
    case 'exited':
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    case 'partially_running':
      return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';
    default:
      return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
  }
});

const dotClass = computed(() => {
  if (props.updateAvailable) return 'bg-amber-500';
  switch (props.state?.toLowerCase()) {
    case 'running': return 'bg-emerald-500';
    case 'exited': return 'bg-slate-400';
    case 'partially_running': return 'bg-blue-500';
    default: return 'bg-gray-400';
  }
});

const pingDotClass = computed(() => {
  if (props.updateAvailable) return 'bg-amber-400';
  switch (props.state?.toLowerCase()) {
    case 'running': return 'bg-emerald-400';
    default: return 'bg-blue-400';
  }
});
</script>
