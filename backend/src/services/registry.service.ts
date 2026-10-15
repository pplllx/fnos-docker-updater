import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { getSetting } from '../db/database';

export interface ParsedImage {
  registry: string;
  repository: string;
  tag: string;
  original: string;
}

export function parseImageName(imageStr: string): ParsedImage {
  let cleaned = imageStr.trim();
  // Remove sha256 suffix if present: e.g. image:tag@sha256:...
  if (cleaned.includes('@')) {
    cleaned = cleaned.split('@')[0];
  }

  let tag = 'latest';
  const lastColon = cleaned.lastIndexOf(':');
  const lastSlash = cleaned.lastIndexOf('/');

  if (lastColon > lastSlash) {
    tag = cleaned.substring(lastColon + 1);
    cleaned = cleaned.substring(0, lastColon);
  }

  let registry = 'registry-1.docker.io';
  let repository = cleaned;

  const parts = cleaned.split('/');
  if (parts.length > 1 && (parts[0].includes('.') || parts[0].includes(':') || parts[0] === 'localhost')) {
    registry = parts[0];
    repository = parts.slice(1).join('/');
  } else if (parts.length === 1) {
    repository = `library/${parts[0]}`;
  }

  return {
    registry,
    repository,
    tag,
    original: imageStr
  };
}

export interface RemoteDigestInfo {
  digest: string;
  allDigests: string[];
}

export class RegistryService {
  /**
   * Fetches remote digest info (primary manifest digest, platform digest, and config digest)
   */
  public static async getRemoteDigestInfo(imageStr: string): Promise<RemoteDigestInfo | null> {
    const parsed = parseImageName(imageStr);
    const proxyUrl = getSetting<string>('httpProxy', '');
    const mirrors = getSetting<string[]>('registryMirrors', []);

    // Try primary registry first
    const endpointsToTry: string[] = [];
    if (parsed.registry === 'registry-1.docker.io' || parsed.registry === 'docker.io') {
      // Add configured mirrors first if available
      for (const mirror of mirrors) {
        if (mirror) {
          const cleanMirror = mirror.replace(/\/+$/, '');
          endpointsToTry.push(cleanMirror);
        }
      }
      endpointsToTry.push('https://registry-1.docker.io');
    } else {
      const protocol = parsed.registry.startsWith('http') ? '' : 'https://';
      endpointsToTry.push(`${protocol}${parsed.registry}`);
    }

    let lastError: any = null;
    for (const endpoint of endpointsToTry) {
      try {
        const info = await this.queryRegistryDigest(endpoint, parsed.repository, parsed.tag, proxyUrl);
        if (info) {
          return info;
        }
      } catch (err: any) {
        lastError = err;
        // Continue to next mirror/endpoint
      }
    }

    console.warn(`[Registry] Failed to fetch remote digest for ${imageStr}:`, lastError?.message || lastError);
    return null;
  }

  public static async getRemoteDigest(imageStr: string): Promise<string | null> {
    const info = await this.getRemoteDigestInfo(imageStr);
    return info ? info.digest : null;
  }

  private static async queryRegistryDigest(
    baseUrl: string,
    repository: string,
    tag: string,
    proxyUrl?: string
  ): Promise<RemoteDigestInfo | null> {
    const manifestUrl = `${baseUrl}/v2/${repository}/manifests/${tag}`;
    const clientConfig: AxiosRequestConfig = {
      timeout: 8000,
      headers: {
        Accept: [
          'application/vnd.docker.distribution.manifest.v2+json',
          'application/vnd.docker.distribution.manifest.list.v2+json',
          'application/vnd.oci.image.index.v1+json',
          'application/vnd.oci.image.manifest.v1+json'
        ].join(', ')
      },
      validateStatus: status => (status >= 200 && status < 300) || status === 401
    };

    if (proxyUrl) {
      try {
        const url = new URL(proxyUrl);
        clientConfig.proxy = {
          protocol: url.protocol.replace(':', ''),
          host: url.hostname,
          port: parseInt(url.port || '80', 10)
        };
      } catch (e) {
        // invalid proxy url, ignore
      }
    }

    // Step 1: Initial probe (often returns 401 with Www-Authenticate header)
    let res = await axios.get(manifestUrl, clientConfig);

    // Step 2: Handle 401 Challenge (Bearer token auth)
    if (res.status === 401) {
      const authHeader = res.headers['www-authenticate'] || res.headers['Www-Authenticate'];
      if (!authHeader) {
        return null;
      }

      const token = await this.fetchBearerToken(authHeader, proxyUrl);
      if (!token) {
        return null;
      }

      // Retry manifest request with Bearer token
      clientConfig.headers = {
        ...clientConfig.headers,
        Authorization: `Bearer ${token}`
      };
      res = await axios.get(manifestUrl, clientConfig);
    }

    if (res.status !== 200) {
      return null;
    }

    // Extract Docker-Content-Digest header
    const digestHeader = res.headers['docker-content-digest'] || res.headers['Docker-Content-Digest'];
    let primaryDigest = digestHeader ? digestHeader.trim() : '';

    if (!primaryDigest && res.data) {
      const content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      primaryDigest = `sha256:${hash}`;
    }

    const allDigests: string[] = [];
    if (primaryDigest) allDigests.push(primaryDigest);

    // If this is a Manifest List / Index, look for the platform manifest and resolve image config digest
    if (res.data && Array.isArray(res.data.manifests)) {
      const targetArch = process.arch === 'arm64' ? 'arm64' : 'amd64';
      const platformItem = res.data.manifests.find((m: any) =>
        m.platform?.architecture === targetArch && m.platform?.os === 'linux'
      ) || res.data.manifests.find((m: any) => m.platform?.architecture === 'amd64') || res.data.manifests[0];

      if (platformItem && platformItem.digest) {
        allDigests.push(platformItem.digest);
        // Fetch the platform manifest to get the image config digest
        try {
          const pUrl = `${baseUrl}/v2/${repository}/manifests/${platformItem.digest}`;
          const pRes = await axios.get(pUrl, clientConfig);
          if (pRes.data && pRes.data.config?.digest) {
            allDigests.push(pRes.data.config.digest);
          }
        } catch {}
      }
    } else if (res.data && res.data.config?.digest) {
      allDigests.push(res.data.config.digest);
    }

    return {
      digest: primaryDigest,
      allDigests
    };
  }

  private static async fetchBearerToken(wwwAuthenticate: string, proxyUrl?: string): Promise<string | null> {
    try {
      // Example: Bearer realm="https://auth.docker.io/token",service="registry.docker.io",scope="repository:library/nginx:pull"
      const realmMatch = wwwAuthenticate.match(/realm="([^"]+)"/);
      const serviceMatch = wwwAuthenticate.match(/service="([^"]+)"/);
      const scopeMatch = wwwAuthenticate.match(/scope="([^"]+)"/);

      if (!realmMatch) return null;
      const realm = realmMatch[1];
      const service = serviceMatch ? serviceMatch[1] : '';
      const scope = scopeMatch ? scopeMatch[1] : '';

      const tokenUrl = new URL(realm);
      if (service) tokenUrl.searchParams.set('service', service);
      if (scope) tokenUrl.searchParams.set('scope', scope);

      const config: AxiosRequestConfig = { timeout: 6000 };
      if (proxyUrl) {
        try {
          const url = new URL(proxyUrl);
          config.proxy = {
            protocol: url.protocol.replace(':', ''),
            host: url.hostname,
            port: parseInt(url.port || '80', 10)
          };
        } catch (e) {}
      }

      const tokenRes = await axios.get(tokenUrl.toString(), config);
      return tokenRes.data.token || tokenRes.data.access_token || null;
    } catch (err) {
      return null;
    }
  }
}
