// npm run dist - builds the installer with a short public name:
//   0.1.0-beta.5 -> SortDeck-Setup-beta.5.exe     1.0.0 -> SortDeck-Setup-v1.0.0.exe
// Also electron-builder's afterPack hook (package.json build.afterPack): trims runtime files SortDeck never uses.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function artifactName(version) {
  const pre = String(version).split('-')[1];
  return pre ? `SortDeck-Setup-${pre}.exe` : `SortDeck-Setup-v${version}.exe`;
}

// The app draws in software (app.disableHardwareAcceleration), so the GPU shader compilers and the
// Vulkan/SwiftShader fallback (~37 MB) are dead weight. Everything inside app.asar stays integrity-checked.
const UNUSED = ['dxcompiler.dll', 'dxil.dll', 'd3dcompiler_47.dll', 'vk_swiftshader.dll', 'vk_swiftshader_icd.json', 'vulkan-1.dll'];

function afterPack({ appOutDir }) {
  for (const f of UNUSED) fs.rmSync(path.join(appOutDir, f), { force: true });
}

if (require.main === module) {
  const { version } = require('../package.json');
  const name = artifactName(version);
  console.log(`Building ${name}`);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // VS Code's terminal sets it and breaks electron-builder
  execFileSync(process.execPath, [require.resolve('electron-builder/cli.js'), '--win', '--publish', 'never', `-c.nsis.artifactName=${name}`], {
    stdio: 'inherit', env, cwd: path.join(__dirname, '..'),
  });
}

module.exports = { artifactName, default: afterPack };
