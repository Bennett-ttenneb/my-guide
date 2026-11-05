// onnxruntime-react-native 1.24.3 still uses Gradle APIs that current Gradle/AGP removed, which fails the EAS build.
// Runs on every install (postinstall) so the cloud build gets the same fix. Safe to run twice.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'node_modules', 'onnxruntime-react-native', 'android', 'build.gradle');
if (!fs.existsSync(file)) process.exit(0);

let s = fs.readFileSync(file, 'utf8');
const before = s;
// Only needed for React Native < 0.71; this app is far newer, and VersionNumber no longer exists in Gradle.
s = s.replace(/\n\s*if \(VersionNumber\.parse\(REACT_NATIVE_VERSION\) < VersionNumber\.parse\("0\.71"\)\) \{[^}]*\}\n/, '\n');
s = s.replace(/\blintOptions \{/, 'lint {').replace(/\bpackagingOptions \{/, 'packaging {');
if (s.includes('VersionNumber')) throw new Error('fix-onnxruntime: VersionNumber still present, check build.gradle');
if (s !== before) {
  fs.writeFileSync(file, s);
  console.log('fix-onnxruntime: patched', file);
}
