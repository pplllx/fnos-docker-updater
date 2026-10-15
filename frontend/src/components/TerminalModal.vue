<template>
  <el-dialog
    v-model="appStore.terminalVisible"
    :title="appStore.terminalTitle"
    width="800px"
    destroy-on-close
    :before-close="handleClose"
    class="terminal-dialog rounded-xl overflow-hidden"
  >
    <div class="bg-slate-950 text-slate-100 rounded-lg p-4 font-mono text-xs h-[480px] flex flex-col shadow-inner">
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-slate-400">
        <div class="flex items-center space-x-2">
          <span class="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
          <span class="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
          <span class="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
          <span class="ml-2 font-sans font-semibold text-slate-300">Live Execution Terminal</span>
        </div>
        <div class="flex items-center space-x-3">
          <span v-if="isConnected" class="flex items-center text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1.5"></span> 已连接
          </span>
          <span v-else class="text-slate-500">连接已断开</span>
          <button @click="copyLogs" class="hover:text-white transition">复制日志</button>
          <button @click="clearLogs" class="hover:text-white transition">清屏</button>
        </div>
      </div>

      <div ref="logContainer" class="flex-1 overflow-y-auto space-y-1 select-text">
        <div v-if="logs.length === 0" class="text-slate-500 py-4 text-center">
          正在建立日志推流连接，请稍候...
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
      <div class="flex justify-between items-center">
        <span class="text-xs text-slate-500">操作正在后台执行，关闭窗口不会中断任务</span>
        <el-button @click="handleClose">关闭窗口</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
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
