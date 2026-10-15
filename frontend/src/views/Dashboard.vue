<template>
  <div class="space-y-6">
    <!-- Top banner with quick actions -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">仪表盘概览</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          实时监控飞牛 NAS 容器运行状态，检测并一键升级 Docker 镜像与 Compose 编排服务
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <el-button
          type="primary"
          :loading="checkingAll"
          @click="handleCheckAll"
          class="!rounded-lg !px-4"
        >
          <span class="flex items-center space-x-1.5">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>一键全量检测更新</span>
          </span>
        </el-button>

        <el-button
          :loading="pruning"
          @click="handlePrune"
          class="!rounded-lg"
        >
          清理悬空镜像
        </el-button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <!-- Total containers -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">容器总数</span>
          <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ containers.length }}</div>
        </div>
        <div class="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
      </div>

      <!-- Running containers -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">运行中</span>
          <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ runningCount }}</div>
        </div>
        <div class="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <!-- Available updates -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">待更新镜像</span>
          <div class="text-2xl font-bold text-amber-500 mt-1">{{ updateCount }}</div>
        </div>
        <div class="w-12 h-12 rounded-lg bg-amber-50 dark:bg-amber-900/40 text-amber-500 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
      </div>

      <!-- Compose projects -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex items-center justify-between">
        <div>
          <span class="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Compose 项目</span>
          <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{{ composeList.length }}</div>
        </div>
        <div class="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Prominent Update Available Banner -->
    <div v-if="updateCount > 0" class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-5">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <svg class="w-5 h-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-semibold text-amber-900 dark:text-amber-200">
              发现 {{ updateCount }} 个待升级容器/服务
            </h3>
            <p class="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5">
              远端镜像仓库已发布最新版本 Digest，建议及时升级以获取安全补丁与新功能
            </p>
          </div>
        </div>
        <router-link to="/containers" class="text-sm font-medium text-amber-800 dark:text-amber-300 hover:underline">
          前往容器管理立即处理 &rarr;
        </router-link>
      </div>

      <!-- Quick update list -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        <div
          v-for="c in pendingUpdateContainers"
          :key="c.id"
          class="bg-white dark:bg-slate-800 p-3 rounded-lg border border-amber-200 dark:border-slate-700 shadow-sm flex items-center justify-between"
        >
          <div class="truncate mr-3">
            <div class="font-medium text-slate-800 dark:text-slate-100 truncate text-sm">{{ c.name }}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400 truncate">{{ c.image }}:{{ c.tag }}</div>
          </div>
          <el-button
            size="small"
            type="warning"
            plain
            @click="triggerUpdate(c)"
          >
            升级
          </el-button>
        </div>
      </div>
    </div>

    <!-- Container Table Preview -->
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
      <div class="p-5 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-900 dark:text-white">容器状态监控</h2>
        <router-link to="/containers" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          查看全部 {{ containers.length }} 个容器 &rarr;
        </router-link>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-800/80 text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700/60">
            <tr>
              <th class="px-5 py-3 font-medium">容器名称</th>
              <th class="px-5 py-3 font-medium">镜像及标签</th>
              <th class="px-5 py-3 font-medium">状态</th>
              <th class="px-5 py-3 font-medium">类型</th>
              <th class="px-5 py-3 font-medium text-right">快捷操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/40">
            <tr v-if="containers.length === 0">
              <td colspan="5" class="px-5 py-8 text-center text-slate-400">
                暂无容器运行数据或未连接 Docker Socket
              </td>
            </tr>
            <tr v-for="c in containers.slice(0, 8)" :key="c.id" class="hover:bg-slate-50/60 dark:hover:bg-slate-750 transition">
              <td class="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                <div class="flex items-center space-x-2">
                  <span>{{ c.name }}</span>
                  <span v-if="c.isPinned" class="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded">锁定</span>
                  <span v-if="c.isIgnored" class="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">忽略</span>
                </div>
              </td>
              <td class="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-xs">
                {{ c.image }}:{{ c.tag }}
              </td>
              <td class="px-5 py-3.5">
                <StatusBadge :state="c.state" :update-available="c.updateAvailable" />
              </td>
              <td class="px-5 py-3.5 text-xs text-slate-500">
                {{ c.isCompose ? `Compose (${c.composeProject})` : '独立容器' }}
              </td>
              <td class="px-5 py-3.5 text-right space-x-2">
                <el-button
                  size="small"
                  :type="c.updateAvailable ? 'warning' : 'default'"
                  @click="triggerUpdate(c)"
                >
                  {{ c.updateAvailable ? '升级' : '更新' }}
                </el-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api/client';
import { useAppStore } from '../stores/app';
import StatusBadge from '../components/StatusBadge.vue';

const appStore = useAppStore();
const containers = ref<any[]>([]);
const composeList = ref<any[]>([]);
const checkingAll = ref(false);
const pruning = ref(false);

const runningCount = computed(() => containers.value.filter(c => c.state === 'running').length);
const updateCount = computed(() => containers.value.filter(c => c.updateAvailable).length);
const pendingUpdateContainers = computed(() => containers.value.filter(c => c.updateAvailable));

async function loadData() {
  try {
    const cRes: any = await api.get('/containers');
    containers.value = cRes.data || [];
    const compRes: any = await api.get('/compose');
    composeList.value = compRes.data || [];
  } catch (err: any) {
    console.error('加载仪表盘数据失败', err);
  }
}

async function handleCheckAll() {
  checkingAll.value = true;
  try {
    await api.post('/containers/check-all');
    ElMessage.success('全量更新检测完成');
    await loadData();
  } catch {
  } finally {
    checkingAll.value = false;
  }
}

async function handlePrune() {
  try {
    await ElMessageBox.confirm('确定要清理宿主机上所有未使用的悬空镜像吗？', '提示', {
      type: 'warning'
    });
    pruning.value = true;
    await api.post('/system/prune-images');
    ElMessage.success('悬空镜像清理完成');
  } catch (e) {
  } finally {
    pruning.value = false;
  }
}

async function triggerUpdate(c: any) {
  const sessionId = `update-${c.name}-${Date.now()}`;
  appStore.openTerminal(sessionId, `正在升级容器: ${c.name}`);
  try {
    await api.post(`/containers/${c.id}/update`, { sessionId });
  } catch (e) {
  }
}

onMounted(() => {
  loadData();
});
</script>
