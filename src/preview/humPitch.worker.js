import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import * as tf from '@tensorflow/tfjs';
import { cleanHumNotes } from './humArrangement.js';
import { humPitchCenter } from './humPitchCorrection.js';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import modelUrl from '@spotify/basic-pitch/model/model.json?url&no-inline';
import weightsUrl from '@spotify/basic-pitch/model/group1-shard1of1.bin?url&no-inline';
import wasm from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm?url';
import simd from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-simd.wasm?url';
import threaded from '@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm-threaded-simd.wasm?url';

// Basic Pitch frames the final chunk with an untyped Fill. TFJS 3.21's
// WASM kernel needs the public operation's default supplied explicitly.
const wasmFill = tf.getKernel('Fill', 'wasm');
tf.unregisterKernel('Fill', 'wasm');
tf.registerKernel({
  ...wasmFill,
  kernelFunc: args => wasmFill.kernelFunc({ ...args, attrs: { ...args.attrs, dtype: args.attrs.dtype ?? 'float32' } }),
});

let loading;
function loadModel() {
  loading ??= (async () => {
    setWasmPaths({ 'tfjs-backend-wasm.wasm': wasm, 'tfjs-backend-wasm-simd.wasm': simd, 'tfjs-backend-wasm-threaded-simd.wasm': threaded });
    try {
      if (!await tf.setBackend('wasm')) await tf.setBackend('cpu');
    } catch {
      await tf.setBackend('cpu');
    }
    const graph = await tf.loadGraphModel(modelUrl, { weightUrlConverter: async () => weightsUrl });
    return new BasicPitch(Promise.resolve(graph));
  })().catch(error => { loading = null; throw error; });
  return loading;
}

self.onmessage = async ({ data }) => {
  if (data.type === 'warmup') {
    void loadModel().catch(() => {});
    return;
  }
  try {
    const model = await loadModel();
    // Only one job runs in this worker. Keep model weights outside this scope.
    tf.engine().startScope();
    try {
      const frames = [], onsets = [], contours = [];
      await model.evaluateModel(data.samples, (frameBatch, onsetBatch, contourBatch) => {
        frames.push(...frameBatch);
        onsets.push(...onsetBatch);
        contours.push(...contourBatch);
      }, progress => self.postMessage({ type: 'progress', progress }));
      // Prefer actual model onsets. Inferring extra ones can split held vocal notes.
      const attacks = outputToNotesPoly(frames, onsets, 0.38, 0.3, 6, false, 1320, 65, false);
      const detected = attacks.length ? attacks : outputToNotesPoly(frames, onsets, 0.38, 0.3, 6, false, 1320, 65, true);
      const notes = noteFramesToTime(detected).map((note, index) => ({
        ...note, pitchCenter: humPitchCenter(contours, detected[index]),
      }));
      self.postMessage({ type: 'result', notes: cleanHumNotes(notes, data.samples.length / 22050, data.samples) });
    } finally {
      tf.engine().endScope();
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
};
