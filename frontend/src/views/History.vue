<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-slate-800/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
      <div>
        <div class="flex items-center space-x-2.5">
          <h1 class="text-xl font-bold text-slate-900 dark:text-white">更新历史与操作审计</h1>
          <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
            <History class="w-3 h-3" />
            <span>执行日志</span>
          </span>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          记录所有容器与 Compose 项目的升级执行结果、错误告警与容灾回退历史
        </p>
      </div>
      <div>
        <el-button
          :loading="loading"
          @click="loadHistory"
          class="!rounded-xl shadow-xs"
        >
          <template #icon>
            <RefreshCw class="w-4 h-4 mr-1 text-slate-400" :class="{ 'animate-spin': loading }" />
          </template>
          刷新记录
        </el-button>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs overflow-hidden">
      <div v-if="loading && historyList.length === 0" class="p-6">
        <el-skeleton :rows="5" animated />
      </div>

      <el-table
        v-else
        :data="historyList"
        v-loading="loading"
        style="width: 100%"
      >
        <el-table-column label="升级目标" min-width="180">
          <template #default="{ row }">
            <div class="font-semibold text-slate-900 dark:text-white">{{ row.target_name }}</div>
            <span class="text-xs text-slate-400">
              {{ row.target_type === 'compose' ? 'Docker Compose 项目' : '独立单容器' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="执行状态" width="140">
          <template #default="{ row }">
            <span
              v-if="row.status === 'success'"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              升级成功
            </span>
            <span
              v-else-if="row.status === 'rolled_back'"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
              已安全回滚
            </span>
            <span
              v-else
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
              执行失败
            </span>
          </template>
        </el-table-column>

        <el-table-column label="详情与错误输出" min-width="260">
          <template #default="{ row }">
            <div class="font-mono text-xs text-slate-600 dark:text-slate-300 truncate" :title="row.log_text">
              {{ row.log_text || '-' }}
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">
            <div class="text-xs text-slate-500 font-mono">
              {{ formatDate(row.created_at) }}
            </div>
          </template>
        </el-table-column>

        <template #empty>
          <div class="py-12">
            <el-empty description="暂无历史更新或审计记录" :image-size="80" />
          </div>
        </template>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { History, RefreshCw } from 'lucide-vue-next';
import { api } from '../api/client';

const historyList = ref<any[]>([]);
const loading = ref(false);

async function loadHistory() {
  loading.value = true;
  try {
    const res: any = await api.get('/system/history');
    historyList.value = res.data || [];
  } catch {
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString();
}

onMounted(() => {
  loadHistory();
});
</script>
