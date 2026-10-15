<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">单容器管理</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          管理飞牛 NAS 上的所有 Docker 独立容器与 Compose 实例，支持版本锁定与自动容灾回滚
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <el-button
          type="primary"
          :loading="checkingAll"
          @click="checkAll"
          class="!rounded-lg"
        >
          检测全部更新
        </el-button>
        <el-button
          :disabled="selectedContainers.length === 0"
          type="warning"
          plain
          @click="batchUpdate"
          class="!rounded-lg"
        >
          批量更新 ({{ selectedContainers.length }})
        </el-button>
      </div>
    </div>

    <!-- Filters & Search -->
    <div class="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
      <div class="flex items-center space-x-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
        <el-radio-group v-model="filterTab" size="default">
          <el-radio-button label="all">全部 ({{ containers.length }})</el-radio-button>
          <el-radio-button label="standalone">纯独立容器 ({{ standaloneCount }})</el-radio-button>
          <el-radio-button label="compose">Compose 关联 ({{ composeCount }})</el-radio-button>
          <el-radio-button label="updates">可更新 ({{ updateCount }})</el-radio-button>
          <el-radio-button label="running">运行中 ({{ runningCount }})</el-radio-button>
        </el-radio-group>
      </div>

      <div class="w-full md:w-72">
        <el-input
          v-model="searchQuery"
          placeholder="搜索容器名或镜像..."
          clearable
        >
          <template #prefix>
            <svg class="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </template>
        </el-input>
      </div>
    </div>

    <!-- Container Table -->
    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm overflow-hidden">
      <el-table
        :data="filteredContainers"
        v-loading="loading"
        @selection-change="handleSelectionChange"
        row-key="id"
        style="width: 100%"
      >
        <el-table-column type="selection" width="48" />

        <!-- Name & ID -->
        <el-table-column label="容器名称 / 所属编排" min-width="220">
          <template #default="{ row }">
            <div class="flex items-center flex-wrap gap-1.5">
              <span class="font-semibold text-slate-900 dark:text-white">{{ row.name }}</span>

              <!-- Compose Exclusive Badge -->
              <span
                v-if="row.isCompose"
                @click.stop="goToComposeProject(row.composeProject)"
                class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800/80 hover:shadow-xs transition-all"
                title="该容器属于 Compose 编排项目，点击直达项目卡片"
              >
                <svg class="w-3 h-3 text-purple-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
                <span>Compose: {{ row.composeProject || '编排关联' }}</span>
                <svg class="w-2.5 h-2.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </span>

              <!-- Standalone Badge -->
              <span
                v-else
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              >
                独立容器
              </span>

              <span v-if="row.isPinned" class="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono">
                锁定
              </span>
              <span v-if="row.isIgnored" class="text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 px-1.5 py-0.5 rounded">
                已忽略
              </span>
            </div>
            <div class="text-xs text-slate-400 font-mono mt-0.5 flex items-center space-x-2">
              <span>{{ row.id.substring(0, 12) }}</span>
              <span v-if="row.composeFile" class="text-slate-400 truncate max-w-xs text-[11px]" :title="row.composeFile">
                📁 {{ row.composeFile }}
              </span>
            </div>
          </template>
        </el-table-column>

        <!-- Image & Tag -->
        <el-table-column label="镜像仓库与标签" min-width="200">
          <template #default="{ row }">
            <div class="font-mono text-xs text-slate-700 dark:text-slate-200 truncate">{{ row.image }}</div>
            <span class="inline-block mt-0.5 text-[11px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.2 rounded font-mono">
              {{ row.tag }}
            </span>
          </template>
        </el-table-column>

        <!-- State & Update Status -->
        <el-table-column label="状态 / 更新标记" width="160">
          <template #default="{ row }">
            <div class="space-y-1">
              <div><StatusBadge :state="row.state" /></div>
              <div v-if="row.updateAvailable">
                <StatusBadge :update-available="true" />
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- Ports -->
        <el-table-column label="端口映射" min-width="160">
          <template #default="{ row }">
            <div v-if="row.ports && row.ports.length > 0" class="flex flex-wrap gap-1">
              <span
                v-for="p in row.ports.slice(0, 3)"
                :key="p"
                class="text-[11px] font-mono bg-slate-100 dark:bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300"
              >
                {{ p }}
              </span>
              <span v-if="row.ports.length > 3" class="text-[11px] text-slate-400">
                +{{ row.ports.length - 3 }}
              </span>
            </div>
            <span v-else class="text-xs text-slate-400">-</span>
          </template>
        </el-table-column>

        <!-- Digest info -->
        <el-table-column label="最后检查时间" min-width="150">
          <template #default="{ row }">
            <div class="text-xs text-slate-500 dark:text-slate-400">
              {{ row.lastCheckedAt ? formatDate(row.lastCheckedAt) : '未检测' }}
            </div>
          </template>
        </el-table-column>

        <!-- Operations -->
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="flex items-center space-x-2">
              <el-button
                size="small"
                :loading="checkingId === row.id"
                @click="checkSingle(row)"
              >
                检查
              </el-button>

              <el-button
                size="small"
                :type="row.updateAvailable ? 'warning' : 'primary'"
                plain
                @click="handleUpdateClick(row)"
              >
                升级
              </el-button>

              <el-dropdown trigger="click">
                <el-button size="small" class="!px-2">
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="togglePin(row)">
                      {{ row.isPinned ? '取消锁定版本' : '锁定此版本 (不更新)' }}
                    </el-dropdown-item>
                    <el-dropdown-item @click="toggleIgnore(row)">
                      {{ row.isIgnored ? '取消忽略更新' : '忽略此容器更新' }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Compose Update Interception Dialog -->
    <el-dialog
      v-model="interceptDialogVisible"
      title="🛡️ 安全防呆拦截：检测到 Compose 编排项目容器"
      width="600px"
      destroy-on-close
      class="!rounded-2xl"
    >
      <div class="space-y-4">
        <!-- Alert Banner -->
        <div class="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex items-start space-x-3">
          <div class="p-2 bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 rounded-lg shrink-0 mt-0.5">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h4 class="text-sm font-bold text-amber-900 dark:text-amber-200">
              容器【{{ interceptContainer?.name }}】由 Docker Compose 统一管理
            </h4>
            <p class="text-xs text-amber-700 dark:text-amber-300/90 mt-1 leading-relaxed">
              若直接作为单容器执行升级，Docker 会生成独立的孤立容器，可能导致<strong>脱离原 Compose 编排管辖</strong>，并<strong>断开项目内部局域网</strong>（例如无法通过服务名连接同编排的数据库、Redis 或网关）。
            </p>
          </div>
        </div>

        <!-- Meta info -->
        <div class="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700/60 text-xs space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-slate-500 dark:text-slate-400">所属编排项目：</span>
            <span class="font-bold text-purple-600 dark:text-purple-400 flex items-center space-x-1.5 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800/50">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              <span>{{ interceptContainer?.composeProject }}</span>
            </span>
          </div>

          <div v-if="interceptContainer?.composeFile" class="flex items-center justify-between">
            <span class="text-slate-500 dark:text-slate-400 shrink-0 mr-2">Compose 配置文件：</span>
            <span class="font-mono text-slate-700 dark:text-slate-200 truncate max-w-sm" :title="interceptContainer?.composeFile">
              {{ interceptContainer?.composeFile }}
            </span>
          </div>

          <div class="flex items-center justify-between">
            <span class="text-slate-500 dark:text-slate-400">当前镜像版本：</span>
            <span class="font-mono text-slate-700 dark:text-slate-200">
              {{ interceptContainer?.image }}:{{ interceptContainer?.tag }}
            </span>
          </div>
        </div>

        <!-- Recommendation -->
        <div class="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 p-3.5 rounded-xl leading-relaxed flex items-start space-x-2">
          <span class="text-base leading-none">💡</span>
          <div>
            <strong>强烈推荐操作：</strong>
            前往【Compose 编排管理】页面，直接点击该项目的「拉取并更新编排」按钮。系统将通过原生 <code>docker compose pull && up -d</code> 安全升级，完好保留所有网络拓扑和多容器依赖。
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between pt-2">
          <el-button
            type="danger"
            text
            size="small"
            @click="forceUpdateSingle"
          >
            仍按单容器强制更新
          </el-button>
          <div class="space-x-2">
            <el-button @click="interceptDialogVisible = false">取消</el-button>
            <el-button
              type="primary"
              class="!bg-purple-600 !border-purple-600 hover:!bg-purple-700"
              @click="goToComposeFromModal"
            >
              👉 前往 Compose 编排安全更新 (推荐)
            </el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { api } from '../api/client';
import { useAppStore } from '../stores/app';
import StatusBadge from '../components/StatusBadge.vue';

const router = useRouter();
const appStore = useAppStore();
const containers = ref<any[]>([]);
const loading = ref(false);
const checkingAll = ref(false);
const checkingId = ref<string | null>(null);
const selectedContainers = ref<any[]>([]);
const filterTab = ref('all');
const searchQuery = ref('');

// Interception dialog state
const interceptDialogVisible = ref(false);
const interceptContainer = ref<any>(null);

const updateCount = computed(() => containers.value.filter(c => c.updateAvailable).length);
const standaloneCount = computed(() => containers.value.filter(c => !c.isCompose).length);
const composeCount = computed(() => containers.value.filter(c => c.isCompose).length);
const runningCount = computed(() => containers.value.filter(c => c.state === 'running').length);

const filteredContainers = computed(() => {
  return containers.value.filter(c => {
    // Tab filter
    if (filterTab.value === 'updates' && !c.updateAvailable) return false;
    if (filterTab.value === 'running' && c.state !== 'running') return false;
    if (filterTab.value === 'standalone' && c.isCompose) return false;
    if (filterTab.value === 'compose' && !c.isCompose) return false;

    // Search query
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      const matchName = c.name?.toLowerCase().includes(q);
      const matchImage = c.image?.toLowerCase().includes(q);
      const matchProject = c.composeProject?.toLowerCase().includes(q);
      return matchName || matchImage || matchProject;
    }
    return true;
  });
});

async function loadContainers() {
  loading.value = true;
  try {
    const res: any = await api.get('/containers');
    containers.value = res.data || [];
  } catch (err: any) {
  } finally {
    loading.value = false;
  }
}

async function checkSingle(c: any) {
  checkingId.value = c.id;
  try {
    const res: any = await api.post(`/containers/${c.id}/check`);
    c.updateAvailable = res.updateAvailable;
    c.lastCheckedAt = new Date().toISOString();
    if (res.updateAvailable) {
      ElMessage.warning(`${c.name} 发现远端新版本！`);
    } else {
      ElMessage.success(`${c.name} 已经是最新版本`);
    }
  } catch {
  } finally {
    checkingId.value = null;
  }
}

async function checkAll() {
  checkingAll.value = true;
  try {
    await api.post('/containers/check-all');
    ElMessage.success('全量检测完成');
    await loadContainers();
  } catch {
  } finally {
    checkingAll.value = false;
  }
}

function handleUpdateClick(c: any) {
  if (c.isCompose) {
    interceptContainer.value = c;
    interceptDialogVisible.value = true;
    return;
  }
  executeSingleUpdate(c);
}

function forceUpdateSingle() {
  if (!interceptContainer.value) return;
  const target = interceptContainer.value;
  interceptDialogVisible.value = false;
  executeSingleUpdate(target);
}

function goToComposeFromModal() {
  if (!interceptContainer.value) return;
  const project = interceptContainer.value.composeProject;
  interceptDialogVisible.value = false;
  goToComposeProject(project);
}

function goToComposeProject(projectName?: string) {
  if (projectName) {
    router.push({ path: '/compose', query: { project: projectName } });
  } else {
    router.push('/compose');
  }
}

async function executeSingleUpdate(c: any) {
  const sessionId = `update-${c.name}-${Date.now()}`;
  appStore.openTerminal(sessionId, `正在升级容器: ${c.name}`);
  try {
    await api.post(`/containers/${c.id}/update`, { sessionId });
  } catch {}
}

async function batchUpdate() {
  const composeSelected = selectedContainers.value.filter(c => c.isCompose);
  const standaloneSelected = selectedContainers.value.filter(c => !c.isCompose);

  if (composeSelected.length > 0) {
    try {
      await ElMessageBox.confirm(
        `您选中的 ${selectedContainers.value.length} 个容器中，包含 ${composeSelected.length} 个由 Compose 编排管理的容器（如：${composeSelected.map(c => c.name).join('、')}）。\n\n为避免破坏 Compose 网络与编排完整性，推荐仅更新选中的独立容器。`,
        '批量更新防呆拦截',
        {
          distinguishCancelAndClose: true,
          confirmButtonText: `仅更新 ${standaloneSelected.length} 个独立容器 (推荐)`,
          cancelButtonText: '全部强制更新 (不推荐)',
          type: 'warning'
        }
      );
      // User picked "仅更新独立容器"
      if (standaloneSelected.length === 0) {
        ElMessage.info('选中的容器中无独立容器，已取消操作。建议前往 Compose 编排页面升级。');
        return;
      }
      for (const c of standaloneSelected) {
        await executeSingleUpdate(c);
      }
    } catch (action) {
      if (action === 'cancel') {
        // User confirmed all force update
        for (const c of selectedContainers.value) {
          await executeSingleUpdate(c);
        }
      }
    }
    return;
  }

  // Pure standalone containers
  for (const c of selectedContainers.value) {
    await executeSingleUpdate(c);
  }
}

async function togglePin(c: any) {
  try {
    const res: any = await api.post(`/containers/${c.id}/toggle-pin`);
    c.isPinned = res.isPinned;
    ElMessage.success(c.isPinned ? '已锁定版本' : '已解除锁定');
  } catch {}
}

async function toggleIgnore(c: any) {
  try {
    const res: any = await api.post(`/containers/${c.id}/toggle-ignore`);
    c.isIgnored = res.isIgnored;
    ElMessage.success(c.isIgnored ? '已忽略更新' : '已取消忽略');
  } catch {}
}

function handleSelectionChange(val: any[]) {
  selectedContainers.value = val;
}

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

onMounted(() => {
  loadContainers();
});
</script>
