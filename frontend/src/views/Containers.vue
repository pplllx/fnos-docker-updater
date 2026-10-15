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
      <div class="flex items-center space-x-2 w-full md:w-auto">
        <el-radio-group v-model="filterTab" size="default">
          <el-radio-button label="all">全部 ({{ containers.length }})</el-radio-button>
          <el-radio-button label="updates">可更新 ({{ updateCount }})</el-radio-button>
          <el-radio-button label="running">运行中</el-radio-button>
          <el-radio-button label="standalone">独立容器</el-radio-button>
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
        <el-table-column label="容器名称" min-width="180">
          <template #default="{ row }">
            <div class="flex items-center space-x-2">
              <span class="font-semibold text-slate-900 dark:text-white">{{ row.name }}</span>
              <span v-if="row.isPinned" class="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono">
                锁定
              </span>
              <span v-if="row.isIgnored" class="text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 px-1.5 py-0.5 rounded">
                已忽略
              </span>
            </div>
            <div class="text-xs text-slate-400 font-mono mt-0.5">{{ row.id.substring(0, 12) }}</div>
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
                @click="updateSingle(row)"
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api/client';
import { useAppStore } from '../stores/app';
import StatusBadge from '../components/StatusBadge.vue';

const appStore = useAppStore();
const containers = ref<any[]>([]);
const loading = ref(false);
const checkingAll = ref(false);
const checkingId = ref<string | null>(null);
const selectedContainers = ref<any[]>([]);
const filterTab = ref('all');
const searchQuery = ref('');

const updateCount = computed(() => containers.value.filter(c => c.updateAvailable).length);

const filteredContainers = computed(() => {
  return containers.value.filter(c => {
    // Tab filter
    if (filterTab.value === 'updates' && !c.updateAvailable) return false;
    if (filterTab.value === 'running' && c.state !== 'running') return false;
    if (filterTab.value === 'standalone' && c.isCompose) return false;

    // Search query
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q);
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

async function updateSingle(c: any) {
  const sessionId = `update-${c.name}-${Date.now()}`;
  appStore.openTerminal(sessionId, `正在升级容器: ${c.name}`);
  try {
    await api.post(`/containers/${c.id}/update`, { sessionId });
  } catch {}
}

async function batchUpdate() {
  for (const c of selectedContainers.value) {
    await updateSingle(c);
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
