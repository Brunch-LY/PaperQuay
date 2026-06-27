const { cleanString } = require('./utils.cjs');

function splitRemotePath(value) {
  return cleanString(value)
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeRemoteRoot(value) {
  const parts = splitRemotePath(value || 'paperquay');

  if (parts.length === 0) throw new Error('WebDAV remote root cannot be empty');
  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error('WebDAV remote root cannot contain "." or ".."');
  }

  return parts.join('/');
}

function parentRemotePath(remotePath) {
  const parts = splitRemotePath(remotePath);
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('/');
}

function tempUploadPath(remotePath, backupId) {
  return `${remotePath}.uploading-${encodeURIComponent(backupId)}`;
}

function toBasicAuth(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

function truncateBody(text) {
  const value = cleanString(text);
  return value.length > 300 ? `${value.slice(0, 300)}...` : value;
}

class WebdavClient {
  constructor(settings) {
    this.endpointUrl = cleanString(settings.endpointUrl).replace(/\/+$/, '');
    this.remoteRoot = normalizeRemoteRoot(settings.remoteRoot);
    this.username = cleanString(settings.username);
    this.password = String(settings.password ?? '');

    if (!/^https?:\/\//i.test(this.endpointUrl)) {
      throw new Error('WebDAV endpoint must start with http:// or https://');
    }
  }

  buildUrl(remotePath) {
    const parts = [...splitRemotePath(this.remoteRoot), ...splitRemotePath(remotePath)]
      .map((segment) => encodeURIComponent(segment));
    return `${this.endpointUrl}/${parts.join('/')}`;
  }

  async request(method, remotePath, options = {}) {
    const headers = { ...(options.headers ?? {}) };

    if (this.username || this.password) {
      headers.Authorization = toBasicAuth(this.username, this.password);
    }

    const response = await fetch(this.buildUrl(remotePath), {
      method,
      headers,
      body: options.body,
      signal: AbortSignal.timeout(options.timeoutMs ?? 180000),
    });

    return response;
  }

  async ensureCollection(remotePath) {
    const response = await this.request('MKCOL', remotePath);

    if (response.ok || response.status === 405 || response.status === 409) {
      return;
    }

    throw new Error(`Failed to create WebDAV collection ${remotePath || '<root>'}: HTTP ${response.status} ${truncateBody(await response.text().catch(() => ''))}`);
  }

  async ensureParentCollections(remotePath) {
    await this.ensureCollection('');

    const parent = parentRemotePath(remotePath);
    let current = '';

    for (const segment of splitRemotePath(parent)) {
      current = current ? `${current}/${segment}` : segment;
      await this.ensureCollection(current);
    }
  }

  async test() {
    await this.ensureCollection('');
    const response = await this.request('PROPFIND', '', { headers: { Depth: '0' } });

    if (response.ok || response.status === 207) return;
    throw new Error(`WebDAV PROPFIND failed: HTTP ${response.status} ${truncateBody(await response.text().catch(() => ''))}`);
  }

  async head(remotePath) {
    const response = await this.request('HEAD', remotePath);

    if (response.status === 404 || response.status === 405) return null;
    if (!response.ok) throw new Error(`WebDAV HEAD failed for ${remotePath}: HTTP ${response.status}`);

    const length = response.headers.get('content-length');
    return length ? Number(length) : null;
  }

  async putBytes(remotePath, bytes) {
    await this.ensureParentCollections(remotePath);
    const response = await this.request('PUT', remotePath, {
      body: Buffer.from(bytes),
      headers: { 'Content-Type': 'application/octet-stream' },
    });

    if (!response.ok) {
      throw new Error(`WebDAV PUT failed for ${remotePath}: HTTP ${response.status} ${truncateBody(await response.text().catch(() => ''))}`);
    }
  }

  async move(sourcePath, destinationPath) {
    const response = await this.request('MOVE', sourcePath, {
      headers: {
        Destination: this.buildUrl(destinationPath),
        Overwrite: 'T',
      },
    });

    if (!response.ok) {
      throw new Error(`WebDAV MOVE failed for ${sourcePath}: HTTP ${response.status} ${truncateBody(await response.text().catch(() => ''))}`);
    }
  }

  async delete(remotePath) {
    await this.request('DELETE', remotePath).catch(() => undefined);
  }

  async atomicUploadBytes(remotePath, backupId, bytes) {
    const tempPath = tempUploadPath(remotePath, backupId);
    await this.putBytes(tempPath, bytes);

    const remoteSize = await this.head(tempPath);
    if (typeof remoteSize === 'number' && remoteSize !== bytes.length) {
      await this.delete(tempPath);
      throw new Error(`WebDAV temp object size mismatch for ${tempPath}: local=${bytes.length} remote=${remoteSize}`);
    }

    try {
      await this.move(tempPath, remotePath);
    } catch (error) {
      await this.delete(tempPath);
      await this.putBytes(remotePath, bytes);
      if (!/MOVE failed/.test(error instanceof Error ? error.message : String(error))) {
        throw error;
      }
    }
  }

  async getBytes(remotePath) {
    const response = await this.request('GET', remotePath);

    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`WebDAV GET failed for ${remotePath}: HTTP ${response.status}`);

    return Buffer.from(await response.arrayBuffer());
  }

  async getText(remotePath) {
    const bytes = await this.getBytes(remotePath);
    return bytes ? bytes.toString('utf8') : null;
  }
}

module.exports = {
  WebdavClient,
  normalizeRemoteRoot,
  parentRemotePath,
  splitRemotePath,
};
