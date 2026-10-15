import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAppStore = defineStore('app', () => {
  const isDark = ref(localStorage.getItem('theme') === 'dark');
  const activeTerminalSession = ref<string | null>(null);
  const terminalVisible = ref(false);
  const terminalTitle = ref('任务执行日志');

  function toggleDark() {
    isDark.value = !isDark.value;
    if (isDark.value) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  function initTheme() {
    if (isDark.value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function openTerminal(sessionId: string, title?: string) {
    activeTerminalSession.value = sessionId;
    if (title) terminalTitle.value = title;
    terminalVisible.value = true;
  }

  function closeTerminal() {
    terminalVisible.value = false;
  }

  return {
    isDark,
    toggleDark,
    initTheme,
    activeTerminalSession,
    terminalVisible,
    terminalTitle,
    openTerminal,
    closeTerminal
  };
});
