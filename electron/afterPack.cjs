const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function assertFile(filePath, label) {
  try {
    await fs.access(filePath);
  } catch {
    throw new Error(`${label} not found: ${filePath}`);
  }
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const projectDir = context.packager.projectDir;
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const iconPath = path.join(projectDir, 'public', 'icon.ico');
  const rceditPath = path.join(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');

  await assertFile(exePath, 'Windows executable');
  await assertFile(iconPath, 'Windows icon');
  await assertFile(rceditPath, 'rcedit executable');

  await execFileAsync(rceditPath, [exePath, '--set-icon', iconPath], {
    windowsHide: true,
  });

  console.log(`[afterPack] updated Windows executable icon: ${exeName}`);
};
