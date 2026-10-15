import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../api/client';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const initialized = ref<boolean>(true);
  const passwordless = ref<boolean>(false);
  const user = ref<{ username: string } | null>(null);

  async function checkStatus() {
    try {
      const res: any = await api.get('/auth/status');
      initialized.value = res.initialized;
      passwordless.value = res.passwordless;
      return res;
    } catch {
      return { initialized: true, passwordless: false };
    }
  }

  async function login(username: string, password: string) {
    const res: any = await api.post('/auth/login', { username, password });
    if (res.token) {
      token.value = res.token;
      localStorage.setItem('token', res.token);
    }
    return res;
  }

  async function setup(payload: { username?: string; password?: string; passwordless?: boolean }) {
    const res: any = await api.post('/auth/setup', payload);
    if (res.token) {
      token.value = res.token;
      localStorage.setItem('token', res.token);
    }
    initialized.value = true;
    passwordless.value = !!payload.passwordless;
    return res;
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
  }

  return {
    token,
    initialized,
    passwordless,
    user,
    checkStatus,
    login,
    setup,
    logout
  };
});
