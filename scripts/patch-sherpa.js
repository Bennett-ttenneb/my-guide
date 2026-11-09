// Patches react-native-sherpa-onnx 0.4.4 on every install (postinstall), so EAS builds get them too. Safe to run twice.
// 1. It hard-codes modelType "zipformer" for every streaming transducer, but the Kroko speech model is a
//    zipformer2; the native engine then aborts as soon as live transcription starts. An empty modelType makes
//    sherpa-onnx read the type from the model's own metadata.
// 2. generateTts always returns every audio sample to JavaScript (100k+ numbers per verse), which the app then
//    sent straight back to save as a WAV. With an "outputPath" option it now saves the file natively instead,
//    which removes most of the pause between verses read by the natural voices.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', 'react-native-sherpa-onnx', 'android', 'src', 'main', 'java', 'com', 'sherpaonnx');

function patch(file, done, apply) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) return;
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes(done)) return;
  const next = apply(s);
  if (next === s) throw new Error(`patch-sherpa: ${file} changed upstream; check whether the patch is still needed`);
  fs.writeFileSync(p, next);
  console.log(`patch-sherpa: patched ${file}`);
}

patch('SherpaOnnxOnlineSttHelper.kt', 'modelType = ""', (s) =>
  s.replace(/(provider = provider \?: "cpu",\s*\n\s*)modelType = "zipformer"\n/, '$1modelType = ""\n'));

patch('SherpaOnnxTtsHelper.kt', 'options.getString("outputPath")', (s) =>
  s.replace(
    /(\n(\s*)val map = Arguments\.createMap\(\)\n\s*val samplesArray = Arguments\.createArray\(\)\n\s*for \(sample in audio\.samples\) \{\n\s*samplesArray\.pushDouble\(sample\.toDouble\(\)\)\n\s*\}\n\s*map\.putArray\("samples", samplesArray\)\n\s*map\.putInt\("sampleRate", audio\.sampleRate\)\n\s*promise\.resolve\(map\)\n\s*\} catch \(e: Exception\) \{\n\s*Log\.e\("SherpaOnnxTts", "generateTts error)/,
    (m, rest, ind) => `
${ind}val outputPath = if (options?.hasKey("outputPath") == true) options.getString("outputPath") else null
${ind}if (outputPath != null) {
${ind}  if (!audio.save(outputPath)) throw RuntimeException("Could not save speech to $outputPath")
${ind}  val saved = Arguments.createMap()
${ind}  saved.putString("path", outputPath)
${ind}  saved.putInt("sampleRate", audio.sampleRate)
${ind}  promise.resolve(saved)
${ind}  return
${ind}}${rest}`,
  ));
