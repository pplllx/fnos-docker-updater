<template>
  <div class="space-y-6">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">更新历史与操作审计</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          记录所有容器与 Compose 项目的升级执行结果、错误告警与容灾回退历史
        </p>
      </div>
      <div>
        <el-button :loading="loading" @click="loadHistory" class="!rounded-lg">
          刷新记录
        </el-button>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
      <el-table :data="historyList" v-loading="loading" style="width: 100%">
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
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            >
              升级成功
            </span>
            <span
              v-else-if="row.status === 'rolled_back'"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            >
              已安全回滚
            </span>
            <span
              v-else
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
            >
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
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
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
