<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
      <div class="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30">
        <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16" />
        </svg>
      </div>
      <h2 class="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">
        欢迎使用 fnOS Docker 更新面板
      </h2>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        首次运行初始化：请选择您的访问认证方式以保护 NAS 安全
      </p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white dark:bg-slate-800 py-8 px-6 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-700/60 sm:px-10 space-y-6">
        <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <div>
            <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">内网免密模式</span>
            <span class="text-xs text-slate-400">仅限纯内网安全环境使用，无需设置账户密码</span>
          </div>
          <el-switch v-model="isPasswordless" />
        </div>

        <div v-if="!isPasswordless" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">管理员用户名</label>
            <el-input v-model="form.username" placeholder="admin" size="large" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">设置登录密码</label>
            <el-input v-model="form.password" type="password" show-password placeholder="至少 6 位字符" size="large" />
          </div>
        </div>

        <el-button
          type="primary"
          size="large"
          class="w-full !rounded-xl !font-semibold !mt-6 shadow-lg shadow-blue-500/20"
          :loading="loading"
          @click="handleComplete"
        >
          完成初始化并进入面板
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();
const isPasswordless = ref(false);
const loading = ref(false);

const form = reactive({
  username: 'admin',
  password: ''
});

async function handleComplete() {
  if (!isPasswordless.value) {
    if (!form.username || !form.password) {
      ElMessage.error('请填写管理员用户名和密码');
      return;
    }
    if (form.password.length < 6) {
      ElMessage.error('密码长度至少需要 6 个字符');
      return;
    }
  }

  loading.value = true;
  try {
    await authStore.setup({
      username: form.username,
      password: form.password,
      passwordless: isPasswordless.value
    });
    ElMessage.success('初始化成功！已进入飞牛更新面板');
    router.push('/');
  } catch (err: any) {
  } finally {
    loading.value = false;
  }
}
</script>
