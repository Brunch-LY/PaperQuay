const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { BrowserWindow, clipboard, dialog, shell } = require('electron');
const {
  cleanString,
  ensureFile,
  pathExists,
  safeFileName,
  now,
} = require('./utils.cjs');

function createFileCommands(context) {
  const { appPaths, approvedWritePaths, store } = context;

  function assertWriteAllowed(filePath) {
    const absolute = path.resolve(filePath);
    const library = store.load();
    const roots = [
      path.resolve(appPaths.dataDir),
      path.resolve(library.settings.storageDir || appPaths.storageDefaultDir),
    ];

    if (roots.some((root) => absolute === root || absolute.startsWith(`${root}${path.sep}`))) return;
    if (approvedWritePaths.has(absolute)) return;

    throw new Error(`Writing to this path is not allowed until approved: ${filePath}`);
  }

  async function selectFiles(properties, filters, event) {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win, { properties, filters });
    return result.canceled ? null : result.filePaths;
  }

  return {
    async get_app_default_paths() {
      for (const dir of [appPaths.mineruCacheDir, appPaths.storageDefaultDir, appPaths.paperRepoDefaultDir, appPaths.remotePdfDownloadDir]) {
        try { await fsp.mkdir(dir, { recursive: true }); } catch {}
      }

      return {
        executableDir: appPaths.dataDir,
        configPath: appPaths.configPath,
        mineruCacheDir: appPaths.mineruCacheDir,
        remotePdfDownloadDir: appPaths.remotePdfDownloadDir,
        storageDefaultDir: appPaths.storageDefaultDir,
        paperRepoDefaultDir: appPaths.paperRepoDefaultDir,
      };
    },

    async select_pdf_file(_args, event) {
      const paths = await selectFiles(['openFile'], [{ name: 'PDF', extensions: ['pdf'] }], event);
      return paths?.[0] ?? null;
    },

    async select_json_file(_args, event) {
      const paths = await selectFiles(['openFile'], [{ name: 'JSON', extensions: ['json'] }], event);
      return paths?.[0] ?? null;
    },

    async select_attachment_files({ kind }, event) {
      const filters =
        kind === 'image'
          ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'] }]
          : [{ name: 'Attachments', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'txt', 'md', 'json', 'csv', 'yaml', 'yml', 'xml', 'html', 'pdf'] }];
      return (await selectFiles(['openFile', 'multiSelections'], filters, event)) ?? [];
    },

    async capture_system_screenshot() {
      await fsp.mkdir(appPaths.screenshotDir, { recursive: true });
      const outputPath = path.join(appPaths.screenshotDir, `system-screenshot-${now()}.png`);

      if (process.platform !== 'win32') {
        return null;
      }

      const previousImage = clipboard.readImage().toPNG();
      spawn('cmd', ['/C', 'start', '', 'ms-screenclip:'], { windowsHide: true, detached: true });

      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const image = clipboard.readImage();

        if (!image.isEmpty()) {
          const bytes = image.toPNG();
          if (!Buffer.from(bytes).equals(Buffer.from(previousImage))) {
            await fsp.writeFile(outputPath, bytes);
            const stat = await fsp.stat(outputPath);
            return {
              path: outputPath,
              name: path.basename(outputPath),
              mimeType: 'image/png',
              size: stat.size,
            };
          }
        }
      }

      return null;
    },

    async open_external_url({ url }) {
      const trimmed = cleanString(url);
      if (!/^https?:\/\//i.test(trimmed)) {
        throw new Error('Only http and https URLs can be opened');
      }
      await shell.openExternal(trimmed);
    },

    async select_directory({ title }, event) {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(win, { title, properties: ['openDirectory'] });
      return result.canceled ? null : result.filePaths[0] ?? null;
    },

    async list_directory_files({ directory, extensionFilter }) {
      try {
        const entries = await fsp.readdir(directory, { withFileTypes: true });
        const extension = cleanString(extensionFilter).replace(/^\./, '').toLowerCase();
        const output = [];

        for (const entry of entries) {
          if (!entry.isFile()) continue;
          const filePath = path.join(directory, entry.name);
          if (extension && path.extname(filePath).slice(1).toLowerCase() !== extension) continue;
          const stat = await fsp.stat(filePath);
          output.push({ path: filePath, name: entry.name, size: stat.size, modifiedAtMs: stat.mtimeMs });
        }

        return output.sort((left, right) => right.modifiedAtMs - left.modifiedAtMs || left.name.localeCompare(right.name));
      } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
      }
    },

    async select_save_pdf_path({ suggestedFileName, initialDirectory }, event) {
      const win = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showSaveDialog(win, {
        defaultPath: path.join(initialDirectory || appPaths.remotePdfDownloadDir, safeFileName(suggestedFileName)),
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (result.canceled || !result.filePath) return null;

      approvedWritePaths.add(path.resolve(result.filePath));
      return result.filePath;
    },

    async approve_write_path({ path: filePath }) {
      approvedWritePaths.add(path.resolve(filePath));
    },

    async test_embedding_connection({ request }) {
      const { baseUrl, apiKey, model } = request ?? {};
      if (!baseUrl || !apiKey || !model) return { ok: false, error: 'Missing params' };
      try {
        const url = baseUrl.replace(/\/+$/, '') + '/embeddings';
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({ input: 'test', model, encoding_format: 'float' }),
          signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (!response.ok) return { ok: false, error: data.error?.message || `HTTP ${response.status}` };
        const dims = data.data?.[0]?.embedding?.length;
        return { ok: true, dimensions: dims, model: data.model || model };
      } catch (e) {
        return { ok: false, error: e.message || String(e) };
      }
    },

    async path_exists({ path: filePath }) {
      return pathExists(filePath);
    },

    async read_text_file({ path: filePath }) {
      await ensureFile(filePath);
      return fsp.readFile(filePath, 'utf8');
    },

    async read_text_file_if_exists({ path: filePath }) {
      try {
        const stat = await fsp.stat(filePath);
        if (!stat.isFile()) return null;
        return fsp.readFile(filePath, 'utf8');
      } catch (error) {
        if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null;
        throw error;
      }
    },

    async write_text_file({ path: filePath, content }) {
      assertWriteAllowed(filePath);
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, String(content ?? ''), 'utf8');
    },

    async read_binary_file_base64({ path: filePath }) {
      await ensureFile(filePath);
      return (await fsp.readFile(filePath)).toString('base64');
    },

    async write_binary_file_base64({ path: filePath, contentBase64 }) {
      assertWriteAllowed(filePath);
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, Buffer.from(contentBase64, 'base64'));
    },

    async download_remote_file_to_path({ url, path: filePath, headers }) {
      assertWriteAllowed(filePath);
      const response = await fetch(url, { headers: headers ?? undefined });
      if (!response.ok) throw new Error(`Remote download returned HTTP ${response.status}`);

      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    },

    library_select_pdf_files(_args, event) {
      return selectFiles(['openFile', 'multiSelections'], [{ name: 'PDF', extensions: ['pdf'] }], event).then((paths) => paths ?? []);
    },
  };
}

module.exports = { createFileCommands };
