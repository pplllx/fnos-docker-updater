<template>
  <div class="space-y-7">
    <!-- Top Hero Banner with Quick Actions -->
    <div class="glass-panel p-6 sm:p-7 rounded-3xl relative overflow-hidden transition-all">
      <!-- Subtle internal decorative glow -->
      <div class="absolute -right-20 -top-20 w-72 h-72 bg-gradient-to-br from-blue-500/10 to-indigo-500/0 rounded-full blur-2xl pointer-events-none"></div>

      <div class="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
        <div>
          <div class="flex flex-wrap items-center gap-2.5">
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              仪表盘概览
            </h1>
            <span class="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 shadow-2xs">
              <Sparkles class="w-3 h-3 animate-spin-slow" />
              <span>智能监控实时就绪</span>
            </span>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-2xl">
            已全面纳管飞牛 NAS 宿主机 <strong class="text-slate-700 dark:text-slate-200 font-semibold">{{ containers.length }}</strong> 个容器实例与 <strong class="text-slate-700 dark:text-slate-200 font-semibold">{{ composeList.length }}</strong> 个 Compose 服务栈，随时为您检测远端新版镜像并一键安全升级
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3 shrink-0">
          <button
            @click="handleCheckAll"
            :disabled="checkingAll"
            class="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-indigo-500 active:scale-95 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': checkingAll }" />
            <span>{{ checkingAll ? '全网检测中...' : '一键全量检测更新' }}</span>
          </button>

          <button
            @click="handlePrune"
            :disabled="pruning"
            class="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 transition-all hover:shadow-xs active:scale-95 cursor-pointer disabled:opacity-70"
          >
            <Trash2 class="w-4 h-4 text-slate-400" />
            <span>清理悬空镜像</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Docker Connection Alert Banner (if disconnected) -->
    <div
      v-if="!dockerConnected"
      class="bg-blue-500/10 border border-blue-500/30 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm backdrop-blur-md"
    >
      <div class="flex items-start space-x-3.5">
        <div class="p-2.5 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl shrink-0 mt-0.5">
          <AlertCircle class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">
            未检测到宿主机 Docker Socket (/var/run/docker.sock)
          </h3>
          <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
            当前运行在开发调试环境。部署到飞牛 NAS 并挂载 <code class="bg-blue-500/15 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-mono">/var/run/docker.sock</code> 后将自动识别所有容器与 Compose 项目。
          </p>
        </div>
      </div>
      <div class="flex items-center space-x-2 shrink-0">
        <el-button
          size="default"
          :type="demoMode ? 'default' : 'primary'"
          @click="handleToggleDemo"
          class="!rounded-xl"
        >
          {{ demoMode ? '关闭演示数据' : '开启演示数据体验 UI' }}
        </el-button>
      </div>
    </div>

    <!-- 4 Core High-Tech Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      <!-- Card 1: Total containers -->
      <div class="glass-panel hover-glow rounded-3xl p-6 relative overflow-hidden group">
        <!-- Background watermark icon -->
        <Box class="absolute -right-4 -bottom-4 w-24 h-24 text-blue-500/5 dark:text-blue-400/5 pointer-events-none group-hover:scale-110 transition-transform duration-300" />

        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-400 dark:text-slate-400 tracking-wider uppercase">容器总数</span>
          <div class="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shadow-xs shadow-blue-500/10">
            <Box class="w-5 h-5" />
          </div>
        </div>

        <div class="mt-3">
          <div class="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {{ containers.length }}
          </div>
          <div class="flex items-center text-xs text-slate-500 dark:text-slate-400 mt-1 space-x-1.5">
            <span>宿主机已纳管容器</span>
          </div>
        </div>
      </div>

      <!-- Card 2: Running containers (with live health progress bar) -->
      <div class="glass-panel hover-glow rounded-3xl p-6 relative overflow-hidden group">
        <PlayCircle class="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500/5 dark:text-emerald-400/5 pointer-events-none group-hover:scale-110 transition-transform duration-300" />

        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-emerald-600/80 dark:text-emerald-400/80 tracking-wider uppercase">健康运行中</span>
          <div class="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs shadow-emerald-500/10">
            <PlayCircle class="w-5 h-5" />
          </div>
        </div>

        <div class="mt-3">
          <div class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 tracking-tight">
            {{ runningCount }}
          </div>
          <!-- Micro Health Progress Bar -->
          <div class="mt-2.5">
            <div class="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              <span>运行健康率</span>
              <span class="text-emerald-600 dark:text-emerald-400 font-bold">{{ runningRatio }}%</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
              <div
                class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700"
                :style="{ width: runningRatio + '%' }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Card 3: Available updates -->
      <div class="glass-panel hover-glow rounded-3xl p-6 relative overflow-hidden group">
        <ArrowUpRight class="absolute -right-4 -bottom-4 w-24 h-24 text-amber-500/5 dark:text-amber-400/5 pointer-events-none group-hover:scale-110 transition-transform duration-300" />

        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-amber-600/80 dark:text-amber-400/80 tracking-wider uppercase">待更新镜像</span>
          <div class="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-xs shadow-amber-500/10">
            <ArrowUpRight class="w-5 h-5" />
          </div>
        </div>

        <div class="mt-3">
          <div class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500 tracking-tight">
            {{ updateCount }}
          </div>
          <div class="flex items-center text-xs mt-1.5">
            <span
              v-if="updateCount > 0"
              class="inline-flex items-center text-amber-600 dark:text-amber-400 font-semibold"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5"></span>
              发现远端新 Digest 可升级
            </span>
            <span v-else class="text-slate-400 dark:text-slate-500">所有容器均为最新</span>
          </div>
        </div>
      </div>

      <!-- Card 4: Compose projects -->
      <div class="glass-panel hover-glow rounded-3xl p-6 relative overflow-hidden group">
        <Layers class="absolute -right-4 -bottom-4 w-24 h-24 text-indigo-500/5 dark:text-indigo-400/5 pointer-events-none group-hover:scale-110 transition-transform duration-300" />

        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-indigo-600/80 dark:text-indigo-400/80 tracking-wider uppercase">Compose 编排</span>
          <div class="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-xs shadow-indigo-500/10">
            <Layers class="w-5 h-5" />
          </div>
        </div>

        <div class="mt-3">
          <div class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-500 dark:from-indigo-400 dark:to-purple-300 tracking-tight">
            {{ composeList.length }}
          </div>
          <div class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            多服务独立项目栈
          </div>
        </div>
      </div>
    </div>

    <!-- Prominent App Store-style Update Available Section -->
    <div
      v-if="updateCount > 0"
      class="glass-panel p-6 sm:p-7 rounded-3xl border border-amber-300/40 dark:border-amber-500/30 relative overflow-hidden"
    >
      <!-- Top aura -->
      <div class="absolute -top-16 -right-16 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div class="flex items-center space-x-3.5">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30 shrink-0">
            <ArrowUpRight class="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                发现 {{ updateCount }} 个待升级容器 / 编排服务
              </h3>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                UPDATE
              </span>
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              远端镜像仓库已发布最新版本 Digest，建议及时升级以获取安全补丁与新功能
            </p>
          </div>
        </div>

        <router-link
          to="/containers"
          class="inline-flex items-center text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition shrink-0 group"
        >
          <span>进入单容器管理批量更新</span>
          <ChevronRight class="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
        </router-link>
      </div>

      <!-- Quick update list: App Store Style Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5 relative z-10">
        <div
          v-for="c in pendingUpdateContainers"
          :key="c.id"
          class="glass-panel hover-glow p-4 rounded-2xl flex items-center justify-between group"
        >
          <div class="flex items-center space-x-3 min-w-0 mr-3">
            <!-- Container Avatar / Initial Badge -->
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500/10 to-indigo-500/15 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs uppercase shrink-0">
              {{ (c.name || 'C').substring(0, 2) }}
            </div>

            <div class="min-w-0">
              <div class="flex items-center space-x-1.5 truncate">
                <span class="font-bold text-slate-900 dark:text-white truncate text-sm">{{ c.name }}</span>
                <span
                  v-if="c.isCompose"
                  @click.stop="goToComposeProject(c.composeProject)"
                  class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 cursor-pointer hover:bg-purple-500/20 shrink-0"
                  title="Compose 编排项目，点击跳转"
                >
                  {{ c.composeProject }}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">
                {{ c.image }}:<span class="text-amber-600 dark:text-amber-400 font-semibold">{{ c.tag }}</span>
              </div>
            </div>
          </div>

          <button
            @click="triggerUpdate(c)"
            class="px-3.5 py-1.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 active:scale-95 transition-all shadow-md shadow-amber-500/25 shrink-0 cursor-pointer"
          >
            升级
          </button>
        </div>
      </div>
    </div>

    <!-- Container Table Section (Live Monitor Preview) -->
    <div class="glass-panel rounded-3xl overflow-hidden transition-all">
      <div class="p-6 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
        <div>
          <h2 class="text-base sm:text-lg font-black text-slate-900 dark:text-white">容器状态监控</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400">实时展示最近活跃的前 8 个容器实例</span>
        </div>
        <router-link
          to="/containers"
          class="inline-flex items-center text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition group"
        >
          <span>查看全部 {{ containers.length }} 个容器</span>
          <ChevronRight class="w-4 h-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
        </router-link>
      </div>

      <!-- Skeleton loading state -->
      <div v-if="loading" class="p-6">
        <el-skeleton :rows="5" animated />
      </div>

      <!-- Container list -->
      <div v-else-if="containers.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-200/60 dark:border-slate-800/60 font-bold">
            <tr>
              <th class="px-6 py-4">容器名称</th>
              <th class="px-6 py-4">镜像及标签</th>
              <th class="px-6 py-4">状态</th>
              <th class="px-6 py-4">类型</th>
              <th class="px-6 py-4 text-right">快捷操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800/50">
            <tr
              v-for="c in containers.slice(0, 8)"
              :key="c.id"
              class="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
            >
              <td class="px-6 py-4 font-medium text-slate-900 dark:text-white">
                <div class="flex items-center space-x-2">
                  <span class="font-bold text-sm">{{ c.name }}</span>
                  <span v-if="c.isPinned" class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded-md font-mono border border-slate-200/50 dark:border-slate-700/50">锁定</span>
                  <span v-if="c.isIgnored" class="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-mono">已忽略</span>
                </div>
              </td>
              <td class="px-6 py-4 text-slate-600 dark:text-slate-300 font-mono text-xs">
                {{ c.image }}:<span class="text-blue-600 dark:text-blue-400 font-semibold">{{ c.tag }}</span>
              </td>
              <td class="px-6 py-4">
                <StatusBadge :state="c.state" :update-available="c.updateAvailable" />
              </td>
              <td class="px-6 py-4 text-xs text-slate-500">
                <span
                  v-if="c.isCompose"
                  @click.stop="goToComposeProject(c.composeProject)"
                  class="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/25 cursor-pointer hover:bg-purple-500/20 transition-all shadow-2xs"
                  title="点击直达 Compose 编排项目"
                >
                  <Layers class="w-3 h-3 text-purple-500 shrink-0" />
                  <span>Compose: {{ c.composeProject }}</span>
                </span>
                <span v-else class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50">
                  独立容器
                </span>
              </td>
              <td class="px-6 py-4 text-right space-x-2">
                <button
                  @click="triggerUpdate(c)"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  :class="[
                    c.updateAvailable
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20 hover:scale-105'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80'
                  ]"
                >
                  {{ c.updateAvailable ? '⚡ 升级新版' : '检测更新' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty state -->
      <div v-else class="py-14">
        <el-empty
          description="暂无容器运行数据或未连接 Docker Socket"
          :image-size="90"
        >
          <template #extra>
            <el-button
              type="primary"
              size="default"
              @click="loadData"
              class="!rounded-xl font-bold"
            >
              刷新重新获取
            </el-button>
          </template>
        </el-empty>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Box,
  PlayCircle,
  ArrowUpRight,
  Layers,
  RefreshCw,
  Trash2,
  AlertCircle,
  ChevronRight,
  Sparkles
} from 'lucide-vue-next';
import { api } from '../api/client';
import { useAppStore } from '../stores/app';
import StatusBadge from '../components/StatusBadge.vue';

const router = useRouter();
const appStore = useAppStore();
const containers = ref<any[]>([]);
const composeList = ref<any[]>([]);
const loading = ref(false);
const checkingAll = ref(false);
const pruning = ref(false);
const dockerConnected = ref(true);
const demoMode = ref(false);

const runningCount = computed(() => containers.value.filter(c => c.state === 'running').length);
const updateCount = computed(() => containers.value.filter(c => c.updateAvailable).length);
const pendingUpdateContainers = computed(() => containers.value.filter(c => c.updateAvailable));

// Live running ratio percentage
const runningRatio = computed(() => {
  if (containers.value.length === 0) return 0;
  return Math.round((runningCount.value / containers.value.length) * 100);
});

function goToComposeProject(projectName?: string) {
  if (projectName) {
    router.push({ path: '/compose', query: { project: projectName } });
  } else {
    router.push('/compose');
  }
}

async function loadData() {
  loading.value = true;
  try {
    const cRes: any = await api.get('/containers');
    containers.value = cRes.data || [];
    dockerConnected.value = cRes.dockerConnected !== false;
    demoMode.value = !!cRes.demoMode;
    appStore.setDockerStatus(dockerConnected.value, demoMode.value);

    const compRes: any = await api.get('/compose');
    composeList.value = compRes.data || [];
  } catch (err: any) {
    console.error('加载仪表盘数据失败', err);
  } finally {
    loading.value = false;
  }
}

async function handleToggleDemo() {
  try {
    const res: any = await api.post('/containers/toggle-demo');
    demoMode.value = res.demoMode;
    appStore.setDockerStatus(dockerConnected.value, demoMode.value);
    ElMessage.success(res.demoMode ? '已开启演示数据' : '已关闭演示数据');
    await loadData();
  } catch {}
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
      type: 'warning',
      confirmButtonText: '确定清理',
      cancelButtonText: '取消'
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
  if (c.isCompose) {
    try {
      await ElMessageBox.confirm(
        `容器【${c.name}】由 Docker Compose 编排统一管理（所属项目：${c.composeProject}）。\n\n若直接作为单容器升级，可能导致容器脱离编排或断开内部网络连接。\n\n强烈推荐前往 Compose 页面使用原生安全模式拉取与更新。`,
        'Compose 容器更新防呆拦截',
        {
          distinguishCancelAndClose: true,
          confirmButtonText: '👉 前往 Compose 编排安全更新 (推荐)',
          cancelButtonText: '仍按单容器强制更新',
          type: 'warning'
        }
      );
      goToComposeProject(c.composeProject);
      return;
    } catch (action) {
      if (action !== 'cancel') {
        return;
      }
    }
  }

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
