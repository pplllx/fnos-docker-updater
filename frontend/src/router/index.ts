import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import Dashboard from '../views/Dashboard.vue';
import Containers from '../views/Containers.vue';
import Compose from '../views/Compose.vue';
import History from '../views/History.vue';
import Settings from '../views/Settings.vue';
import Setup from '../views/Setup.vue';
import Login from '../views/Login.vue';

const routes = [
  { path: '/', name: 'Dashboard', component: Dashboard },
  { path: '/containers', name: 'Containers', component: Containers },
  { path: '/compose', name: 'Compose', component: Compose },
  { path: '/history', name: 'History', component: History },
  { path: '/settings', name: 'Settings', component: Settings },
  { path: '/setup', name: 'Setup', component: Setup },
  { path: '/login', name: 'Login', component: Login }
];

export const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();
  const status = await authStore.checkStatus();

  // If system is not initialized, force go to /setup
  if (!status.initialized && to.path !== '/setup') {
    return next('/setup');
  }

  // If already initialized and tries to go to /setup, redirect to /
  if (status.initialized && to.path === '/setup') {
    return next('/');
  }

  // If not passwordless and has no token, force login
  if (!status.passwordless && !authStore.token && to.path !== '/login' && to.path !== '/setup') {
    return next('/login');
  }

  // If already logged in or passwordless, prevent going to /login
  if ((authStore.token || status.passwordless) && to.path === '/login') {
    return next('/');
  }

  next();
});
