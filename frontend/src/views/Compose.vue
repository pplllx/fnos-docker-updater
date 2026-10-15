<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
      <div>
        <div class="flex items-center space-x-3">
          <h1 class="text-xl font-bold text-slate-900 dark:text-white">Compose 项目编排</h1>
          <span
            v-if="updatableCount > 0"
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs animate-pulse"
          >
            ⚡ 发现 {{ updatableCount }} 个项目可更新
          </span>
          <span
            v-else-if="!loading && projects.length > 0"
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
          >
            ✓ 全部项目为最新
          </span>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          自动聚合管理飞牛 NAS 上的 Docker Compose 项目，支持一键检测远端镜像与编排拉取重建
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Filter Tabs -->
        <el-radio-group v-model="filterMode" size="default">
          <el-radio-button label="all">全部 ({{ projects.length }})</el-radio-button>
          <el-radio-button label="updates">
            <span class="flex items-center space-x-1">
              <span>待更新</span>
              <span
                v-if="updatableCount > 0"
                class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-white font-bold"
              >
                {{ updatableCount }}
              </span>
            </span>
          </el-radio-button>
        </el-radio-group>

        <!-- Search Input -->
        <el-input
          v-model="searchQuery"
          placeholder="搜索项目或服务..."
          clearable
          class="!w-48 sm:!w-56"
        >
          <template #prefix>
            <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </template>
        </el-input>

        <!-- Check All Updates Button -->
        <el-button
          type="warning"
          :loading="checkingAll"
          @click="checkAllUpdates"
          class="!rounded-lg !bg-amber-500 !border-amber-500 hover:!bg-amber-600 !text-white font-medium"
        >
          <template #icon>
            <svg class="w-4 h-4 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </template>
          检查全部更新
        </el-button>

        <!-- Refresh Button -->
        <el-button
          :loading="loading"
          @click="loadProjects"
          class="!rounded-lg"
        >
          刷新
        </el-button>
      </div>
    </div>

    <!-- Targeted project notice banner -->
    <div
      v-if="targetedProject"
      class="bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
    >
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold shrink-0 text-base">
          🎯
        </div>
        <div>
          <h4 class="text-sm font-bold text-purple-950 dark:text-purple-200">
            已为您精准定位至 Compose 编排项目【{{ targetedProject }}】
          </h4>
          <p class="text-xs text-purple-700 dark:text-purple-300/80 mt-0.5">
            在此处点击「立即拉取更新」将采用原生 Docker Compose 执行多服务依赖校验与网络重启，保障服务稳定运行。
          </p>
        </div>
      </div>
      <el-button size="small" @click="clearTargetedProject" class="shrink-0">
        显示全部项目 ({{ projects.length }})
      </el-button>
    </div>

    <!-- Projects Grid -->
    <div v-loading="loading" class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div v-if="filteredProjects.length === 0 && !loading" class="col-span-full bg-white dark:bg-slate-800 p-12 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
        <svg class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
        <p class="text-slate-500 dark:text-slate-400 font-medium">
          {{ filterMode === 'updates' ? '当前暂无可更新的 Compose 项目' : '未找到匹配的 Docker Compose 项目' }}
        </p>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
          可在“系统设置 -> Compose 扫描目录”中添加飞牛存储路径（如 /vol1/1000/docker 等）扫描离线项目
        </p>
      </div>

      <div
        v-for="proj in filteredProjects"
        :key="proj.name"
        :id="'project-' + proj.name"
        :class="[
          'bg-white dark:bg-slate-800 rounded-xl border p-5 flex flex-col justify-between space-y-4 transition-all duration-300 relative overflow-hidden',
          isTargeted(proj.name)
            ? 'border-purple-500 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/10'
            : proj.updateAvailable
              ? 'border-amber-400 dark:border-amber-500/80 ring-2 ring-amber-400/20 shadow-md shadow-amber-500/5 bg-gradient-to-b from-amber-500/[0.03] to-transparent'
              : 'border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md'
        ]"
      >
        <!-- Update Ribbon corner (optional decorative hint) -->
        <div
          v-if="proj.updateAvailable"
          class="absolute -top-6 -right-6 w-12 h-12 bg-amber-500/10 dark:bg-amber-500/20 rounded-full blur-md pointer-events-none"
        ></div>

        <!-- Top bar -->
        <div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center space-x-2.5 min-w-0">
              <div
                :class="[
                  'w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0',
                  isTargeted(proj.name)
                    ? 'bg-purple-600 text-white shadow-sm'
                    : proj.updateAvailable
                      ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400'
                      : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                ]"
              >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </div>
              <div class="min-w-0">
                <div class="flex items-center space-x-2">
                  <h3 class="font-bold text-slate-900 dark:text-white text-base truncate">{{ proj.name }}</h3>
                  <span v-if="isTargeted(proj.name)" class="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 px-1.5 py-0.5 rounded font-medium shrink-0">
                    当前定位
                  </span>
                </div>
                <span class="text-xs text-slate-400 font-mono block truncate max-w-xs" :title="proj.path">
                  {{ proj.path || '通过容器标签发现' }}
                </span>
              </div>
            </div>

            <!-- Badges: State + Highly Visible Update Badge -->
            <div class="flex items-center space-x-2 shrink-0">
              <StatusBadge :state="proj.status" />
              <span
                v-if="proj.updateAvailable"
                class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs animate-pulse tracking-wide"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-ping"></span>
                ⚡ {{ proj.updateCount && proj.updateCount > 0 ? `${proj.updateCount}个组件可更新` : '有新版本' }}
              </span>
            </div>
          </div>

          <!-- Services tags with highlight on updated components -->
          <div class="mt-4">
            <span class="text-xs text-slate-400 block mb-1.5 font-medium">包含服务组件 ({{ proj.services.length }})：</span>
            <div class="flex flex-wrap gap-1.5">
              <template v-for="svc in proj.services" :key="svc">
                <!-- Highlighted tag for updated service -->
                <span
                  v-if="isServiceUpdated(proj, svc)"
                  class="px-2 py-0.5 rounded text-xs font-mono font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 flex items-center space-x-1 shadow-2xs"
                  title="该服务关联的镜像在远端仓库有新版本"
                >
                  <span>{{ svc }}</span>
                  <span class="text-[9px] bg-amber-500 text-white dark:text-slate-950 rounded px-1 font-bold">可更新</span>
                </span>

                <!-- Normal tag for up-to-date service -->
                <span
                  v-else
                  class="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600/50"
                >
                  {{ svc }}
                </span>
              </template>

              <span v-if="proj.services.length === 0" class="text-xs text-slate-400">
                (扫描离线项目，启动时生成)
              </span>
            </div>
          </div>
        </div>

        <!-- Bottom action bar -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-2">
          <div class="flex items-center space-x-2 text-xs text-slate-400">
            <span>关联容器: {{ proj.containers.length }} 个</span>
            <span class="text-slate-300 dark:text-slate-600">|</span>
            <el-tooltip content="检查该项目是否有新版本" placement="top">
              <button
                @click="checkSingleProject(proj)"
                :disabled="checkingProjects[proj.name]"
                class="hover:text-amber-600 dark:hover:text-amber-400 flex items-center space-x-1 transition cursor-pointer"
              >
                <svg
                  :class="['w-3.5 h-3.5', checkingProjects[proj.name] ? 'animate-spin text-amber-500' : '']"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{{ checkingProjects[proj.name] ? '检查中...' : '检查更新' }}</span>
              </button>
            </el-tooltip>
          </div>

          <div class="flex items-center space-x-2 shrink-0">
            <el-button
              v-if="proj.path"
              size="small"
              @click="openEditor(proj)"
            >
              查看配置
            </el-button>

            <!-- Dynamic Button based on Update Status -->
            <el-button
              v-if="proj.updateAvailable"
              size="small"
              type="warning"
              :disabled="!proj.path"
              @click="updateProject(proj)"
              class="!bg-gradient-to-r !from-amber-500 !to-orange-500 !border-0 hover:!opacity-95 !text-white font-medium shadow-xs"
            >
              <template #icon>
                <span class="mr-0.5">⚡</span>
              </template>
              立即拉取更新
            </el-button>

            <el-button
              v-else
              size="small"
              type="primary"
              :class="isTargeted(proj.name) ? '!bg-purple-600 !border-purple-600 hover:!bg-purple-700' : ''"
              :disabled="!proj.path"
              @click="updateProject(proj)"
            >
              拉取并更新编排
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- Compose File Editor Dialog -->
    <el-dialog
      v-model="editorVisible"
      :title="`Compose 配置 - ${currentProject?.name}`"
      width="750px"
      destroy-on-close
    >
      <div class="space-y-3">
        <div class="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-900 p-2 rounded truncate">
          {{ currentProject?.path }}
        </div>
        <el-input
          v-model="composeContent"
          type="textarea"
          :rows="18"
          class="font-mono text-xs"
          placeholder="正在读取 compose.yaml 内容..."
        />
      </div>
      <template #footer>
        <div class="flex justify-between items-center">
          <span class="text-xs text-slate-400">保存修改会自动生成 .bak 历史备份文件</span>
          <div class="space-x-2">
            <el-button @click="editorVisible = false">取消</el-button>
            <el-button type="primary" :loading="saving" @click="saveComposeFile">保存配置</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '../api/client';
import { useAppStore } from '../stores/app';
import StatusBadge from '../components/StatusBadge.vue';

const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

const projects = ref<any[]>([]);
const loading = ref(false);
const checkingAll = ref(false);
const checkingProjects = ref<Record<string, boolean>>({});
const filterMode = ref<'all' | 'updates'>('all');
const searchQuery = ref('');
const targetedProject = ref<string | null>(null);

const editorVisible = ref(false);
const currentProject = ref<any>(null);
const composeContent = ref('');
const saving = ref(false);

const updatableCount = computed(() => {
  return projects.value.filter(p => p.updateAvailable).length;
});

const filteredProjects = computed(() => {
  let list = projects.value;

  if (filterMode.value === 'updates') {
    list = list.filter(p => p.updateAvailable);
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.services?.some((s: string) => s.toLowerCase().includes(q)) ||
      p.path?.toLowerCase().includes(q)
    );
  }
  return list;
});

function isTargeted(name: string) {
  return targetedProject.value && targetedProject.value.toLowerCase() === name.toLowerCase();
}

function isServiceUpdated(proj: any, svc: string): boolean {
  if (proj.updatedServices && proj.updatedServices.length > 0) {
    return proj.updatedServices.includes(svc);
  }
  // Fallback: if project has updateAvailable and only 1 service, mark that service
  return !!proj.updateAvailable && proj.services && proj.services.length === 1;
}

function clearTargetedProject() {
  targetedProject.value = null;
  searchQuery.value = '';
  router.replace({ query: {} });
}

async function loadProjects() {
  loading.value = true;
  try {
    const res: any = await api.get('/compose');
    projects.value = res.data || [];

    // Check if routed with project query
    if (route.query.project) {
      targetedProject.value = route.query.project as string;
      searchQuery.value = route.query.project as string;
      setTimeout(() => {
        const el = document.getElementById(`project-${targetedProject.value}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
    }
  } catch (err: any) {
  } finally {
    loading.value = false;
  }
}

async function checkAllUpdates() {
  checkingAll.value = true;
  try {
    const res: any = await api.post('/compose/check-all');
    await loadProjects();
    const count = res.data?.withUpdates?.length || 0;
    if (count > 0) {
      ElMessage({
        type: 'warning',
        message: `巡检完成：发现 ${count} 个 Compose 项目有新版本可用！`,
        duration: 4000
      });
    } else {
      ElMessage.success('巡检完成：所有 Compose 项目均已是最新版本');
    }
  } catch (err: any) {
    ElMessage.error(`检查更新失败: ${err.message || '网络异常'}`);
  } finally {
    checkingAll.value = false;
  }
}

async function checkSingleProject(proj: any) {
  checkingProjects.value[proj.name] = true;
  try {
    const res: any = await api.post(`/compose/${proj.name}/check`);
    await loadProjects();
    if (res.updateAvailable) {
      ElMessage.warning(`项目【${proj.name}】检测到新版本更新！`);
    } else {
      ElMessage.success(`项目【${proj.name}】已是最新版本`);
    }
  } catch (err: any) {
    ElMessage.error(`检查项目【${proj.name}】更新失败: ${err.message || '未知错误'}`);
  } finally {
    checkingProjects.value[proj.name] = false;
  }
}

async function openEditor(proj: any) {
  currentProject.value = proj;
  editorVisible.value = true;
  composeContent.value = '正在加载...';
  try {
    const res: any = await api.get(`/compose/${proj.name}/file`, {
      params: { path: proj.path }
    });
    composeContent.value = res.content;
  } catch (err: any) {
    composeContent.value = `读取失败: ${err.message}`;
  }
}

async function saveComposeFile() {
  if (!currentProject.value) return;
  saving.value = true;
  try {
    await api.put(`/compose/${currentProject.value.name}/file`, {
      path: currentProject.value.path,
      content: composeContent.value
    });
    ElMessage.success('配置已保存并完成自动安全备份');
    editorVisible.value = false;
  } catch {
  } finally {
    saving.value = false;
  }
}

async function updateProject(proj: any) {
  const sessionId = `compose-update-${proj.name}-${Date.now()}`;
  appStore.openTerminal(sessionId, `正在更新 Compose 项目: ${proj.name}`);
  try {
    await api.post(`/compose/${proj.name}/update`, {
      path: proj.path,
      sessionId
    });
  } catch {}
}

// Watch terminal modal: refresh projects once terminal closes to clear update status smoothly
watch(
  () => appStore.terminalVisible,
  (visible) => {
    if (!visible) {
      loadProjects();
    }
  }
);

onMounted(() => {
  loadProjects();
});
</script>
