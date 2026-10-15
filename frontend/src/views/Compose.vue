<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
      <div>
        <h1 class="text-xl font-bold text-slate-900 dark:text-white">Compose 项目编排</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
          自动聚合管理飞牛 NAS 上的 Docker Compose 项目，支持直接查看编辑配置文件与一键拉取重建
        </p>
      </div>
      <div>
        <el-button
          type="primary"
          :loading="loading"
          @click="loadProjects"
          class="!rounded-lg"
        >
          刷新项目列表
        </el-button>
      </div>
    </div>

    <!-- Projects Grid -->
    <div v-loading="loading" class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div v-if="projects.length === 0 && !loading" class="col-span-full bg-white dark:bg-slate-800 p-12 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
        <svg class="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
        <p class="text-slate-500 dark:text-slate-400 font-medium">未发现运行中的 Docker Compose 项目</p>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">
          可在“系统设置 -> Compose 扫描目录”中添加飞牛存储路径（如 /vol1/1000/docker 等）扫描离线项目
        </p>
      </div>

      <div
        v-for="proj in projects"
        :key="proj.name"
        class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm hover:shadow-md transition p-5 flex flex-col justify-between space-y-4"
      >
        <!-- Top bar -->
        <div>
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2.5">
              <div class="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </div>
              <div>
                <h3 class="font-bold text-slate-900 dark:text-white text-base">{{ proj.name }}</h3>
                <span class="text-xs text-slate-400 font-mono block truncate max-w-xs" :title="proj.path">
                  {{ proj.path || '通过容器标签发现' }}
                </span>
              </div>
            </div>
            <div>
              <StatusBadge :state="proj.status" :update-available="proj.updateAvailable" />
            </div>
          </div>

          <!-- Services tags -->
          <div class="mt-4">
            <span class="text-xs text-slate-400 block mb-1.5 font-medium">包含服务组件 ({{ proj.services.length }})：</span>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="svc in proj.services"
                :key="svc"
                class="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600/50"
              >
                {{ svc }}
              </span>
              <span v-if="proj.services.length === 0" class="text-xs text-slate-400">
                (扫描离线项目，启动时生成)
              </span>
            </div>
          </div>
        </div>

        <!-- Bottom action bar -->
        <div class="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
          <div class="text-xs text-slate-400">
            关联容器: {{ proj.containers.length }} 个
          </div>
          <div class="flex items-center space-x-2">
            <el-button
              v-if="proj.path"
              size="small"
              @click="openEditor(proj)"
            >
              查看配置
            </el-button>

            <el-button
              size="small"
              type="primary"
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
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api/client';
import { useAppStore } from '../stores/app';
import StatusBadge from '../components/StatusBadge.vue';

const appStore = useAppStore();
const projects = ref<any[]>([]);
const loading = ref(false);

const editorVisible = ref(false);
const currentProject = ref<any>(null);
const composeContent = ref('');
const saving = ref(false);

async function loadProjects() {
  loading.value = true;
  try {
    const res: any = await api.get('/compose');
    projects.value = res.data || [];
  } catch (err: any) {
  } finally {
    loading.value = false;
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

onMounted(() => {
  loadProjects();
});
</script>
