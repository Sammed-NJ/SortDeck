// npm run dist - builds the installer with a short public name:
//   0.1.0-beta.5 -> SortDeck-Setup-beta.5.exe     1.0.0 -> SortDeck-Setup-v1.0.0.exe
const { execFileSync } = require('child_process');
const path = require('path');

function artifactName(version) {
  const pre = String(version).split('-')[1];
  return pre ? `SortDeck-Setup-${pre}.exe` : `SortDeck-Setup-v${version}.exe`;
}

if (require.main === module) {
  const { version } = require('../package.json');
  const name = artifactName(version);
  console.log(`Building ${name}`);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // VS Code's terminal sets it and breaks electron-builder
  execFileSync(process.execPath, [require.resolve('electron-builder/cli.js'), '--win', `-c.nsis.artifactName=${name}`], {
    stdio: 'inherit', env, cwd: path.join(__dirname, '..'),
  });
}

module.exports = { artifactName };
