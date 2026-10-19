<template>
  <div class="space-y-6">
    <!-- Top banner with quick actions -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-800/90 backdrop-blur-sm p-6 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
      <div>
        <div class="flex items-center space-x-2.5">
          <h1 class="text-xl font-bold text-slate-900 dark:text-white">仪表盘概览</h1>
          <span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50">
            <Sparkles class="w-3 h-3" />
            <span>实时监控</span>
          </span>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          实时监控飞牛 NAS 容器运行状态，检测并一键安全升级 Docker 镜像与 Compose 编排服务
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <el-button
          type="primary"
          :loading="checkingAll"
          @click="handleCheckAll"
          class="!rounded-xl !px-4 shadow-sm shadow-blue-500/20"
        >
          <template #icon>
            <RefreshCw class="w-4 h-4 mr-1" :class="{ 'animate-spin': checkingAll }" />
          </template>
          一键全量检测更新
        </el-button>

        <el-button
          :loading="pruning"
          @click="handlePrune"
          class="!rounded-xl"
        >
          <template #icon>
            <Trash2 class="w-4 h-4 mr-1 text-slate-400" />
          </template>
          清理悬空镜像
        </el-button>
      </div>
    </div>

    <!-- Docker Connection Banner -->
    <div
      v-if="!dockerConnected"
      class="bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
    >
      <div class="flex items-start space-x-3">
        <div class="p-2 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 rounded-xl shrink-0">
          <AlertCircle class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-blue-900 dark:text-blue-200">
            未检测到宿主机 Docker Socket (/var/run/docker.sock)
          </h3>
          <p class="text-xs text-blue-700 dark:text-blue-300/80 mt-0.5">
            当前运行在开发机环境。部署到飞牛 NAS 并挂载 <code class="bg-blue-100/80 dark:bg-blue-900/60 px-1 py-0.5 rounded font-mono">/var/run/docker.sock</code> 后将自动识别所有容器与 Compose 项目。
          </p>
        </div>
      </div>
      <div class="flex items-center space-x-2 shrink-0">
        <el-button
          size="small"
          :type="demoMode ? 'default' : 'primary'"
          @click="handleToggleDemo"
          class="!rounded-lg"
        >
          {{ demoMode ? '关闭演示数据' : '开启演示数据体验 UI' }}
        </el-button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      <!-- Total containers -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between">
        <div>
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">容器总数</span>
          <div class="text-2xl font-bold text-slate-900 dark:text-white mt-1">{{ containers.length }}</div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-900/40">
          <Box class="w-6 h-6" />
        </div>
      </div>

      <!-- Running containers -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between">
        <div>
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">运行中</span>
          <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ runningCount }}</div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/40">
          <PlayCircle class="w-6 h-6" />
        </div>
      </div>

      <!-- Available updates -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between">
        <div>
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">待更新镜像</span>
          <div class="text-2xl font-bold text-amber-500 mt-1">{{ updateCount }}</div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-500 flex items-center justify-center border border-amber-100 dark:border-amber-900/40">
          <ArrowUpRight class="w-6 h-6" />
        </div>
      </div>

      <!-- Compose projects -->
      <div class="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between">
        <div>
          <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Compose 项目</span>
          <div class="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{{ composeList.length }}</div>
        </div>
        <div class="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40">
          <Layers class="w-6 h-6" />
        </div>
      </div>
    </div>

    <!-- Prominent Update Available Banner -->
    <div v-if="updateCount > 0" class="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 shadow-xs">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/30 shrink-0">
            <ArrowUpRight class="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">
              发现 {{ updateCount }} 个待升级容器 / 编排服务
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              远端镜像仓库已发布最新版本 Digest，建议及时升级以获取安全补丁与新功能
            </p>
          </div>
        </div>
        <router-link
          to="/containers"
          class="inline-flex items-center text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition shrink-0"
        >
          <span>前往容器管理立即处理</span>
          <ChevronRight class="w-4 h-4 ml-0.5" />
        </router-link>
      </div>

      <!-- Quick update list cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
        <div
          v-for="c in pendingUpdateContainers"
          :key="c.id"
          class="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/70 shadow-2xs hover:shadow-xs transition flex items-center justify-between"
        >
          <div class="truncate mr-3">
            <div class="flex items-center space-x-1.5 truncate">
              <span class="font-semibold text-slate-900 dark:text-white truncate text-sm">{{ c.name }}</span>
              <span
                v-if="c.isCompose"
                @click.stop="goToComposeProject(c.composeProject)"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 cursor-pointer hover:bg-purple-200 shrink-0"
                title="Compose 编排项目，点击跳转"
              >
                {{ c.composeProject }}
              </span>
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-mono">{{ c.image }}:{{ c.tag }}</div>
          </div>
          <el-button
            size="small"
            type="warning"
            plain
            @click="triggerUpdate(c)"
            class="!rounded-lg shrink-0"
          >
            升级
          </el-button>
        </div>
      </div>
    </div>

    <!-- Container Table Preview -->
    <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs overflow-hidden">
      <div class="p-5 border-b border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
        <div>
          <h2 class="text-base font-bold text-slate-900 dark:text-white">容器状态监控</h2>
          <span class="text-xs text-slate-500 dark:text-slate-400">展示最近活跃的前 8 个容器实例</span>
        </div>
        <router-link
          to="/containers"
          class="inline-flex items-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
        >
          <span>查看全部 {{ containers.length }} 个容器</span>
          <ChevronRight class="w-4 h-4 ml-0.5" />
        </router-link>
      </div>

      <!-- Skeleton loading state -->
      <div v-if="loading" class="p-6">
        <el-skeleton :rows="5" animated />
      </div>

      <!-- Container list -->
      <div v-else-if="containers.length > 0" class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50/80 dark:bg-slate-800/80 text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700/60 font-semibold">
            <tr>
              <th class="px-5 py-3.5">容器名称</th>
              <th class="px-5 py-3.5">镜像及标签</th>
              <th class="px-5 py-3.5">状态</th>
              <th class="px-5 py-3.5">类型</th>
              <th class="px-5 py-3.5 text-right">快捷操作</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-700/40">
            <tr
              v-for="c in containers.slice(0, 8)"
              :key="c.id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors"
            >
              <td class="px-5 py-3.5 font-medium text-slate-900 dark:text-white">
                <div class="flex items-center space-x-2">
                  <span class="font-semibold">{{ c.name }}</span>
                  <span v-if="c.isPinned" class="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">锁定</span>
                  <span v-if="c.isIgnored" class="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded font-mono">已忽略</span>
                </div>
              </td>
              <td class="px-5 py-3.5 text-slate-600 dark:text-slate-300 font-mono text-xs">
                {{ c.image }}:{{ c.tag }}
              </td>
              <td class="px-5 py-3.5">
                <StatusBadge :state="c.state" :update-available="c.updateAvailable" />
              </td>
              <td class="px-5 py-3.5 text-xs text-slate-500">
                <span
                  v-if="c.isCompose"
                  @click.stop="goToComposeProject(c.composeProject)"
                  class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800/80 transition-all"
                  title="点击直达 Compose 编排项目"
                >
                  <Layers class="w-3 h-3 text-purple-500 shrink-0" />
                  <span>Compose: {{ c.composeProject }}</span>
                </span>
                <span v-else class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  独立容器
                </span>
              </td>
              <td class="px-5 py-3.5 text-right space-x-2">
                <el-button
                  size="small"
                  :type="c.updateAvailable ? 'warning' : 'default'"
                  @click="triggerUpdate(c)"
                  class="!rounded-lg"
                >
                  {{ c.updateAvailable ? '升级' : '更新' }}
                </el-button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty state -->
      <div v-else class="py-12">
        <el-empty
          description="暂无容器运行数据或未连接 Docker Socket"
          :image-size="80"
        >
          <template #extra>
            <el-button
              type="primary"
              size="small"
              @click="loadData"
              class="!rounded-lg"
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
    // Sync to appStore
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
      // Confirmed: go to compose page
      goToComposeProject(c.composeProject);
      return;
    } catch (action) {
      if (action !== 'cancel') {
        return; // Closed dialog
      }
      // User chose "仍按单容器强制更新"
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
