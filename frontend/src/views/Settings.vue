<template>
  <div class="space-y-6 max-w-5xl">
    <div class="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm">
      <h1 class="text-xl font-bold text-slate-900 dark:text-white">系统设置</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
        配置 Docker 镜像源加速、HTTP 代理、定时巡检任务、Compose 扫描目录及多渠道通知推送
      </p>
    </div>

    <div class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-6">
      <el-tabs v-model="activeTab" class="settings-tabs">
        <!-- Tab 1: 镜像加速与网络代理 -->
        <el-tab-pane label="镜像源与代理" name="mirrors">
          <div class="space-y-6 max-w-2xl pt-2">
            <div>
              <label class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                Docker 镜像加速源 (Registry Mirrors)
              </label>
              <p class="text-xs text-slate-500 mb-3">
                针对 Docker Hub 镜像的国内加速地址，每行一个。面板在进行 Remote Registry API 检查时会优先使用这些镜像源。
              </p>
              <el-input
                v-model="mirrorsText"
                type="textarea"
                :rows="4"
                placeholder="https://docker.m.daocloud.io&#10;https://dockerproxy.com"
                class="font-mono text-xs"
              />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                HTTP / HTTPS 网络代理
              </label>
              <p class="text-xs text-slate-500 mb-2">
                如果宿主机有 Clash/v2ray 等代理服务，可填写代理地址（如 http://192.168.1.100:7890），用于请求 GitHub Container Registry (ghcr.io) 等受限站点。
              </p>
              <el-input
                v-model="settings.httpProxy"
                placeholder="http://127.0.0.1:10808 或 http://192.168.x.x:7890"
              />
            </div>

            <el-button type="primary" :loading="saving" @click="saveSettings">
              保存镜像与网络设置
            </el-button>
          </div>
        </el-tab-pane>

        <!-- Tab 2: 定时巡检与自动更新 -->
        <el-tab-pane label="定时任务与更新策略" name="cron">
          <div class="space-y-6 max-w-2xl pt-2">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <div>
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">开启后台定时巡检</span>
                <span class="text-xs text-slate-500">按照指定的时间周期在后台自动检查所有容器与 Compose 的最新镜像版本</span>
              </div>
              <el-switch v-model="settings.cronEnabled" />
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                巡检周期设置 (后台自动检测)
              </label>
              <p class="text-xs text-slate-500 mb-2">
                选择常用巡检间隔。系统将在后台自动检查所有容器与 Compose 项目并保存状态，无需手动点击全部检查
              </p>
              <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <el-select
                  v-model="cronPreset"
                  @change="handlePresetChange"
                  class="!w-64"
                  placeholder="选择常用预设"
                >
                  <el-option label="每 1 小时自动检查" value="0 * * * *" />
                  <el-option label="每 2 小时自动检查" value="0 */2 * * *" />
                  <el-option label="每 6 小时自动检查 (推荐)" value="0 */6 * * *" />
                  <el-option label="每 12 小时自动检查" value="0 */12 * * *" />
                  <el-option label="每天凌晨 3:00 自动检查" value="0 3 * * *" />
                  <el-option label="自定义 Cron 表达式" value="custom" />
                </el-select>
                <el-input
                  v-model="settings.cronSchedule"
                  placeholder="0 */6 * * *"
                  class="font-mono flex-1"
                />
              </div>
            </div>

            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <div>
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">巡检发现新版时自动升级 (Auto-Update)</span>
                <span class="text-xs text-slate-500 text-amber-600 dark:text-amber-400">
                  开启后定时任务发现新版将自动触发拉取升级与安全回滚（未开启则仅推送通知）
                </span>
              </div>
              <el-switch v-model="settings.autoUpdateEnabled" />
            </div>

            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <div>
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">升级成功后自动清理旧镜像 (Prune)</span>
                <span class="text-xs text-slate-500">容器升级成功并验证存活后，自动删除孤立的旧版本悬空镜像以节省 NAS 空间</span>
              </div>
              <el-switch v-model="settings.autoPruneImages" />
            </div>

            <div class="flex space-x-3">
              <el-button type="primary" :loading="saving" @click="saveSettings">
                保存任务配置
              </el-button>
              <el-button :loading="runningCron" @click="triggerRunCron">
                立即执行一次巡检
              </el-button>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 3: Compose 扫描目录 -->
        <el-tab-pane label="Compose 扫描目录" name="composeScan">
          <div class="space-y-5 max-w-2xl pt-2">
            <div>
              <label class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                飞牛存储卷扫描路径
              </label>
              <p class="text-xs text-slate-500 mb-3">
                配置面板在飞牛 NAS 宿主机中扫描 docker-compose.yml 文件的目录路径，每行一个。
              </p>
              <el-input
                v-model="scanPathsText"
                type="textarea"
                :rows="4"
                placeholder="/vol1/1000/docker&#10;/volume1/docker"
                class="font-mono text-xs"
              />
            </div>

            <el-button type="primary" :loading="saving" @click="saveSettings">
              保存扫描路径
            </el-button>
          </div>
        </el-tab-pane>

        <!-- Tab 4: 消息推送通知渠道 -->
        <el-tab-pane label="推送通知渠道" name="notifications">
          <div class="space-y-5 pt-2">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">已配置的通知渠道</h3>
                <p class="text-xs text-slate-500">当巡检发现新镜像或升级完成/失败时，自动通过这些通道发送卡片通知</p>
              </div>
              <el-button type="primary" size="small" @click="openChannelModal()">
                + 添加通知渠道
              </el-button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-if="channels.length === 0" class="col-span-full text-center py-8 text-slate-400 text-sm">
                暂未配置任何通知渠道，点击上方按钮添加（支持企业微信、钉钉、飞书、Bark、Telegram、自定义 Webhook）
              </div>

              <div
                v-for="ch in channels"
                :key="ch.id"
                class="border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex items-center justify-between"
              >
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="font-semibold text-slate-800 dark:text-white text-sm">{{ ch.name }}</span>
                    <span class="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.2 rounded uppercase">
                      {{ ch.type }}
                    </span>
                    <span :class="['text-[10px] px-1.5 py-0.2 rounded', ch.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500']">
                      {{ ch.enabled ? '已启用' : '已停用' }}
                    </span>
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <el-button size="small" @click="testChannel(ch)">测试</el-button>
                  <el-button size="small" @click="openChannelModal(ch)">编辑</el-button>
                  <el-button size="small" type="danger" plain @click="deleteChannel(ch.id)">删除</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <!-- Tab 5: 免密模式 -->
        <el-tab-pane label="安全与免密" name="security">
          <div class="space-y-6 max-w-2xl pt-2">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-4">
              <div>
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-200 block">内网免密直接访问模式</span>
                <span class="text-xs text-slate-500">开启后局域网用户无需输入密码即可直接进入面板。若面板暴露在外网，强烈建议关闭免密并设置复杂密码。</span>
              </div>
              <el-switch v-model="settings.passwordless" />
            </div>

            <el-button type="primary" :loading="saving" @click="saveSettings">
              保存安全设置
            </el-button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <!-- Notification Channel Edit Modal -->
    <el-dialog
      v-model="channelModalVisible"
      :title="editingChannel?.id ? '编辑通知渠道' : '添加通知渠道'"
      width="520px"
    >
      <el-form label-position="top" class="space-y-3">
        <el-form-item label="渠道类型">
          <el-select v-model="formChannel.type" class="w-full">
            <el-option label="企业微信机器人 (WeCom)" value="wecom" />
            <el-option label="钉钉群机器人 (DingTalk)" value="dingtalk" />
            <el-option label="飞书群机器人 (Feishu)" value="feishu" />
            <el-option label="Bark (iOS 推送)" value="bark" />
            <el-option label="Telegram Bot" value="telegram" />
            <el-option label="自定义通用 Webhook" value="webhook" />
          </el-select>
        </el-form-item>

        <el-form-item label="渠道名称">
          <el-input v-model="formChannel.name" placeholder="如：家庭群推送 / 个人手机" />
        </el-form-item>

        <div v-if="['wecom', 'dingtalk', 'feishu'].includes(formChannel.type)">
          <el-form-item label="Webhook URL">
            <el-input v-model="formChannel.config.webhookUrl" placeholder="https://qyapi.weixin.qq.com/..." />
          </el-form-item>
        </div>

        <div v-if="formChannel.type === 'bark'">
          <el-form-item label="Bark 服务器地址">
            <el-input v-model="formChannel.config.serverUrl" placeholder="https://api.day.app (可填自建服务器)" />
          </el-form-item>
          <el-form-item label="Device Key">
            <el-input v-model="formChannel.config.deviceKey" placeholder="Bark 客户端提供的 Key" />
          </el-form-item>
        </div>

        <div v-if="formChannel.type === 'telegram'">
          <el-form-item label="Bot Token">
            <el-input v-model="formChannel.config.botToken" placeholder="123456:ABC-DEF..." />
          </el-form-item>
          <el-form-item label="Chat ID">
            <el-input v-model="formChannel.config.chatId" placeholder="@channel 或数字 ID" />
          </el-form-item>
        </div>

        <div v-if="formChannel.type === 'webhook'">
          <el-form-item label="POST 请求 URL">
            <el-input v-model="formChannel.config.url" placeholder="https://..." />
          </el-form-item>
        </div>

        <div class="flex items-center space-x-2 pt-2">
          <el-checkbox v-model="formChannel.enabled">启用此通知渠道</el-checkbox>
        </div>
      </el-form>

      <template #footer>
        <div class="space-x-2">
          <el-button @click="channelModalVisible = false">取消</el-button>
          <el-button type="primary" @click="saveChannel">保存渠道</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api/client';

const activeTab = ref('mirrors');
const saving = ref(false);
const runningCron = ref(false);

const settings = reactive<any>({
  registryMirrors: [],
  httpProxy: '',
  cronSchedule: '0 3 * * *',
  cronEnabled: true,
  autoUpdateEnabled: false,
  autoPruneImages: true,
  composeScanPaths: [],
  passwordless: false
});

const mirrorsText = ref('');
const scanPathsText = ref('');
const channels = ref<any[]>([]);
const cronPreset = ref('0 */6 * * *');

function updatePresetFromSchedule(schedule: string) {
  const common = ['0 * * * *', '0 */2 * * *', '0 */6 * * *', '0 */12 * * *', '0 3 * * *'];
  if (common.includes(schedule)) {
    cronPreset.value = schedule;
  } else {
    cronPreset.value = 'custom';
  }
}

function handlePresetChange(val: string) {
  if (val !== 'custom') {
    settings.cronSchedule = val;
  }
}

const channelModalVisible = ref(false);
const editingChannel = ref<any>(null);
const formChannel = reactive<any>({
  id: '',
  type: 'wecom',
  name: '',
  enabled: true,
  config: {}
});

async function loadSettings() {
  try {
    const res: any = await api.get('/system/settings');
    Object.assign(settings, res);
    mirrorsText.value = (res.registryMirrors || []).join('\n');
    scanPathsText.value = (res.composeScanPaths || []).join('\n');
    updatePresetFromSchedule(res.cronSchedule || '0 3 * * *');

    const chRes: any = await api.get('/system/notifications');
    channels.value = chRes.data || [];
  } catch {}
}

async function saveSettings() {
  saving.value = true;
  try {
    const payload = {
      ...settings,
      registryMirrors: mirrorsText.value.split('\n').map(s => s.trim()).filter(Boolean),
      composeScanPaths: scanPathsText.value.split('\n').map(s => s.trim()).filter(Boolean)
    };
    await api.put('/system/settings', payload);
    ElMessage.success('设置已成功保存');
  } catch {
  } finally {
    saving.value = false;
  }
}

async function triggerRunCron() {
  runningCron.value = true;
  try {
    const res: any = await api.post('/system/cron/run-now');
    const cCount = res.result?.containersChecked || 0;
    const pCount = res.result?.composeChecked || 0;
    const uCount = (res.result?.containersWithUpdates?.length || 0) + (res.result?.composeWithUpdates?.length || 0);
    ElMessage.success(`巡检完成: 检查了 ${pCount} 个 Compose 项目及 ${cCount} 个容器，发现 ${uCount} 处可更新`);
  } catch {
  } finally {
    runningCron.value = false;
  }
}

function openChannelModal(ch?: any) {
  if (ch) {
    editingChannel.value = ch;
    formChannel.id = ch.id;
    formChannel.type = ch.type;
    formChannel.name = ch.name;
    formChannel.enabled = ch.enabled;
    formChannel.config = { ...ch.config };
  } else {
    editingChannel.value = null;
    formChannel.id = `channel-${Date.now()}`;
    formChannel.type = 'wecom';
    formChannel.name = '';
    formChannel.enabled = true;
    formChannel.config = {};
  }
  channelModalVisible.value = true;
}

async function saveChannel() {
  if (!formChannel.name) {
    ElMessage.error('请输入渠道名称');
    return;
  }
  try {
    await api.post('/system/notifications', formChannel);
    ElMessage.success('通知渠道已保存');
    channelModalVisible.value = false;
    await loadSettings();
  } catch {}
}

async function testChannel(ch: any) {
  try {
    await api.post('/system/notifications/test', { channel: ch });
    ElMessage.success('测试消息发送成功，请在目标客户端查收！');
  } catch {}
}

async function deleteChannel(id: string) {
  try {
    await api.delete(`/system/notifications/${id}`);
    ElMessage.success('已删除通知渠道');
    await loadSettings();
  } catch {}
}

onMounted(() => {
  loadSettings();
});
</script>
