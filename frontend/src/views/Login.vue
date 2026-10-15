<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center">
      <div class="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-500/30">
        <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7M4 7c0-2 1-3 3-3h10c2 0 3 1 3 3M4 7h16" />
        </svg>
      </div>
      <h2 class="mt-4 text-2xl font-extrabold text-slate-900 dark:text-white">
        登录 fnOS 更新面板
      </h2>
      <p class="mt-1 text-xs text-slate-500">请输入管理员凭据以访问面板</p>
    </div>

    <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-white dark:bg-slate-800 py-8 px-6 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-700/60 sm:px-10 space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">用户名</label>
          <el-input v-model="username" placeholder="请输入用户名" size="large" />
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">密码</label>
          <el-input
            v-model="password"
            type="password"
            show-password
            placeholder="请输入密码"
            size="large"
            @keyup.enter="handleLogin"
          />
        </div>

        <el-button
          type="primary"
          size="large"
          class="w-full !rounded-xl !font-semibold !mt-6 shadow-lg shadow-blue-500/20"
          :loading="loading"
          @click="handleLogin"
        >
          立即登录
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const router = useRouter();

const username = ref('admin');
const password = ref('');
const loading = ref(false);

async function handleLogin() {
  if (!username.value || !password.value) {
    ElMessage.error('请输入用户名与密码');
    return;
  }
  loading.value = true;
  try {
    await authStore.login(username.value, password.value);
    ElMessage.success('登录成功');
    router.push('/');
  } catch {
  } finally {
    loading.value = false;
  }
}
</script>
