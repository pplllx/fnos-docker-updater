<template>
  <el-dialog
    v-model="appStore.terminalVisible"
    :title="appStore.terminalTitle"
    width="94%"
    class="terminal-dialog !rounded-2xl overflow-hidden"
    style="max-width: 860px;"
    destroy-on-close
    :before-close="handleClose"
  >
    <div class="bg-slate-950 text-slate-100 rounded-xl p-3.5 sm:p-4 font-mono text-xs h-[420px] sm:h-[500px] flex flex-col shadow-2xl border border-slate-800">
      <!-- Terminal Window Bar -->
      <div class="flex flex-wrap items-center justify-between pb-2.5 mb-2 border-b border-slate-800/80 text-slate-400 gap-2">
        <div class="flex items-center space-x-2">
          <span class="w-3 h-3 rounded-full bg-rose-500/90 inline-block shadow-xs"></span>
          <span class="w-3 h-3 rounded-full bg-amber-500/90 inline-block shadow-xs"></span>
          <span class="w-3 h-3 rounded-full bg-emerald-500/90 inline-block shadow-xs"></span>
          <span class="ml-2 font-sans font-semibold text-slate-300 text-xs hidden sm:inline">Live Execution Stream</span>
        </div>
        <div class="flex items-center space-x-3 text-xs">
          <span v-if="isConnected" class="flex items-center text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span>
            <span>已连接</span>
          </span>
          <span v-else class="text-slate-500 flex items-center">
            <span class="w-2 h-2 rounded-full bg-slate-600 mr-1.5"></span>
            <span>连接断开</span>
          </span>

          <button
            @click="copyLogs"
            class="flex items-center space-x-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 hover:text-white text-slate-300 transition border border-slate-800"
            title="复制终端全部日志"
          >
            <Copy class="w-3 h-3" />
            <span class="hidden sm:inline">复制</span>
          </button>

          <button
            @click="clearLogs"
            class="flex items-center space-x-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 hover:text-white text-slate-300 transition border border-slate-800"
            title="清空当前屏幕"
          >
            <Trash2 class="w-3 h-3" />
            <span class="hidden sm:inline">清屏</span>
          </button>
        </div>
      </div>

      <!-- Log Content Area -->
      <div ref="logContainer" class="flex-1 overflow-y-auto space-y-1.5 select-text pr-1 font-mono text-[11px] sm:text-xs">
        <div v-if="logs.length === 0" class="text-slate-500 py-8 text-center flex flex-col items-center justify-center space-y-2">
          <div class="w-6 h-6 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
          <span>正在建立日志推流连接，请稍候...</span>
        </div>
        <div
          v-for="(log, idx) in logs"
          :key="idx"
          :class="[
            'leading-relaxed break-all',
            log.level === 'error' ? 'text-rose-400 font-semibold' : '',
            log.level === 'warn' ? 'text-amber-300' : '',
            log.level === 'success' ? 'text-emerald-400 font-semibold' : '',
            log.level === 'info' ? 'text-slate-200' : ''
          ]"
        >
          <span class="text-slate-600 mr-2 select-none">[{{ formatTime(log.timestamp) }}]</span>
          <span>{{ log.text }}</span>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col sm:flex-row justify-between items-center gap-2 pt-1">
        <span class="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
          💡 操作在后台容器持续运行，关闭此弹窗不会中断升级或拉取任务
        </span>
        <el-button @click="handleClose" class="!rounded-lg w-full sm:w-auto">关闭窗口</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Copy, Trash2 } from 'lucide-vue-next';
import { useAppStore } from '../stores/app';

interface LogItem {
  text: string;
  level: string;
  timestamp: string;
}

const appStore = useAppStore();
const logs = ref<LogItem[]>([]);
const isConnected = ref(false);
const logContainer = ref<HTMLElement | null>(null);
let eventSource: EventSource | null = null;

watch(
  () => appStore.terminalVisible,
  (visible) => {
    if (visible && appStore.activeTerminalSession) {
      connectSSE(appStore.activeTerminalSession);
    } else {
      disconnectSSE();
    }
  }
);

function connectSSE(sessionId: string) {
  disconnectSSE();
  logs.value = [];
  isConnected.value = true;

  const url = `/api/sse?sessionId=${encodeURIComponent(sessionId)}`;
  eventSource = new EventSource(url);

  eventSource.addEventListener('connected', () => {
    isConnected.value = true;
  });

  eventSource.addEventListener('log', (event) => {
    try {
      const data = JSON.parse(event.data);
      logs.value.push(data);
      scrollToBottom();
    } catch {}
  });

  eventSource.addEventListener('status', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.status === 'completed') {
        logs.value.push({
          text: '=== 任务执行完成 ===',
          level: 'success',
          timestamp: new Date().toISOString()
        });
      } else if (data.status === 'failed') {
        logs.value.push({
          text: '=== 任务执行失败 ===',
          level: 'error',
          timestamp: new Date().toISOString()
        });
      }
      scrollToBottom();
    } catch {}
  });

  eventSource.onerror = () => {
    isConnected.value = false;
  };
}

function disconnectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  isConnected.value = false;
}

function scrollToBottom() {
  nextTick(() => {
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  });
}

function handleClose() {
  appStore.closeTerminal();
  disconnectSSE();
}

function clearLogs() {
  logs.value = [];
}

function copyLogs() {
  const fullText = logs.value.map(l => `[${l.timestamp}] ${l.text}`).join('\n');
  navigator.clipboard.writeText(fullText);
  ElMessage.success('日志已复制到剪贴板');
}

function formatTime(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString();
}

onUnmounted(() => {
  disconnectSSE();
});
</script>
