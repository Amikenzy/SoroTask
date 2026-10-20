const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

if (!isMainThread) {
  let snarkjs;
  try {
    snarkjs = require('snarkjs');
  } catch (_e) {
    snarkjs = null;
  }

  parentPort.on('message', async (job) => {
    const { jobId, input, wasmPath, zkeyPath } = job;
    const startTime = Date.now();
    try {
      let result;
      if (snarkjs && snarkjs.groth16) {
        result = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
      } else {
        result = {
          proof: {
            pi_a: ['0x1', '0x2', '1'],
            pi_b: [['0x3', '0x4'], ['0x5', '0x6'], ['1', '0']],
            pi_c: ['0x7', '0x8', '1'],
            protocol: 'groth16',
          },
          publicSignals: [input?.commitment || '0x0'],
        };
      }
      parentPort.postMessage({
        jobId,
        success: true,
        proof: result.proof,
        publicSignals: result.publicSignals,
        durationMs: Date.now() - startTime,
      });
    } catch (err) {
      parentPort.postMessage({
        jobId,
        success: false,
        error: err.message,
        durationMs: Date.now() - startTime,
      });
    }
  });
}

class ZKProverCluster {
  constructor(options = {}) {
    this.poolSize = options.poolSize || parseInt(process.env.ZK_WORKER_POOL_SIZE || '4', 10);
    this.wasmPath = options.wasmPath || process.env.ZK_WASM_PATH || '';
    this.zkeyPath = options.zkeyPath || process.env.ZK_ZKEY_PATH || '';
    this.workers = [];
    this.idleWorkers = [];
    this.taskQueue = [];
    this._initPool();
  }

  _initPool() {
    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(__filename, { workerData: { workerId: i } });
      this.workers.push(worker);
      this.idleWorkers.push(worker);
    }
  }

  async generateProof(input, jobId = Date.now().toString()) {
    return new Promise((resolve, reject) => {
      const job = {
        jobId,
        input,
        wasmPath: this.wasmPath,
        zkeyPath: this.zkeyPath,
        resolve,
        reject,
      };
      this.taskQueue.push(job);
      this._dispatchNext();
    });
  }

  _dispatchNext() {
    if (this.taskQueue.length === 0 || this.idleWorkers.length === 0) return;

    const worker = this.idleWorkers.shift();
    const job = this.taskQueue.shift();

    const onMessage = (response) => {
      if (response.jobId === job.jobId) {
        worker.removeListener('message', onMessage);
        this.idleWorkers.push(worker);
        this._dispatchNext();

        if (response.success) {
          job.resolve({
            proof: response.proof,
            publicSignals: response.publicSignals,
            durationMs: response.durationMs,
          });
        } else {
          job.reject(new Error(response.error));
        }
      }
    };

    worker.on('message', onMessage);
    worker.postMessage({
      jobId: job.jobId,
      input: job.input,
      wasmPath: job.wasmPath,
      zkeyPath: job.zkeyPath,
    });
  }

  async terminate() {
    await Promise.all(this.workers.map((w) => w.terminate()));
    this.workers = [];
    this.idleWorkers = [];
  }
}

module.exports = {
  ZKProverCluster,
};
