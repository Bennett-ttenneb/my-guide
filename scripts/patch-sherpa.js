// react-native-sherpa-onnx 0.4.4 hard-codes modelType "zipformer" for every streaming transducer, but the
// Kroko speech model is a zipformer2; the native engine then aborts and the app closes as soon as live
// transcription starts. An empty modelType makes sherpa-onnx read the type from the model's own metadata.
// Runs on every install (postinstall) so EAS builds get it too. Safe to run twice.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'node_modules', 'react-native-sherpa-onnx', 'android', 'src', 'main', 'java', 'com', 'sherpaonnx', 'SherpaOnnxOnlineSttHelper.kt');
if (!fs.existsSync(file)) process.exit(0);

const s = fs.readFileSync(file, 'utf8');
const wrong = /(provider = provider \?: "cpu",\s*\n\s*)modelType = "zipformer"\n/;
if (wrong.test(s)) {
  fs.writeFileSync(file, s.replace(wrong, '$1modelType = ""\n'));
  console.log('patch-sherpa: streaming transducer now reads its model type from the model');
} else if (!s.includes('modelType = ""')) {
  throw new Error('patch-sherpa: SherpaOnnxOnlineSttHelper.kt changed; check whether the zipformer2 fix is still needed');
}
