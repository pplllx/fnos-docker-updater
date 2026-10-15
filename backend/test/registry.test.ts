import { parseImageName, RegistryService } from '../src/services/registry.service';

async function runTests() {
  console.log('🧪 开始 Registry 镜像解析测试...');

  // Test 1: Image name parsing
  const t1 = parseImageName('nginx');
  console.assert(t1.registry === 'registry-1.docker.io', 'nginx registry should be registry-1.docker.io');
  console.assert(t1.repository === 'library/nginx', 'nginx repo should be library/nginx');
  console.assert(t1.tag === 'latest', 'nginx tag should be latest');
  console.log('  ✓ 标准官方镜像解析通过');

  const t2 = parseImageName('portainer/portainer-ce:2.21.0');
  console.assert(t2.registry === 'registry-1.docker.io', 'portainer registry should be registry-1.docker.io');
  console.assert(t2.repository === 'portainer/portainer-ce', 'portainer repo should be portainer/portainer-ce');
  console.assert(t2.tag === '2.21.0', 'portainer tag should be 2.21.0');
  console.log('  ✓ 命名空间与自定义标签解析通过');

  const t3 = parseImageName('ghcr.io/home-assistant/home-assistant:2024.10.0');
  console.assert(t3.registry === 'ghcr.io', 'ghcr registry should be ghcr.io');
  console.assert(t3.repository === 'home-assistant/home-assistant', 'repo should match');
  console.assert(t3.tag === '2024.10.0', 'tag should be 2024.10.0');
  console.log('  ✓ 第三方 Registry (ghcr.io) 解析通过');

  console.log('🎉 所有镜像解析单元测试通过！');
}

runTests().catch(err => {
  console.error('❌ 测试失败:', err);
  process.exit(1);
});
