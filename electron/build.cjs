const { spawn } = require('node:child_process');

const mirrorEnv = {
  ELECTRON_MIRROR: process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/',
  npm_config_electron_mirror: process.env.npm_config_electron_mirror || 'https://npmmirror.com/mirrors/electron/',
  CSC_IDENTITY_AUTO_DISCOVERY: process.env.CSC_IDENTITY_AUTO_DISCOVERY || 'false',
};

if (process.env.ELECTRON_BUILDER_BINARIES_MIRROR) {
  mirrorEnv.ELECTRON_BUILDER_BINARIES_MIRROR = process.env.ELECTRON_BUILDER_BINARIES_MIRROR;
}

function withNoDeprecationWarning(nodeOptions) {
  const value = (nodeOptions || '').trim();

  if (value.split(/\s+/).includes('--no-deprecation')) {
    return value;
  }

  return `${value} --no-deprecation`.trim();
}

const child = spawn(process.execPath, [require.resolve('electron-builder/out/cli/cli.js'), ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...mirrorEnv,
    NODE_OPTIONS: withNoDeprecationWarning(process.env.NODE_OPTIONS),
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
