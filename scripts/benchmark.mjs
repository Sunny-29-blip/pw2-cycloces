import { createServer } from "vite";

const BENCHMARK_TARGETS = [
  { label: "64 KB", bytes: 64 * 1024 },
  { label: "256 KB", bytes: 256 * 1024 },
  { label: "1 MB", bytes: 1024 * 1024 },
  { label: "2 MB", bytes: 2 * 1024 * 1024 },
];

const SYNTHETIC_LINE =
  "Log entry: alice@example.com from 192.168.1.10 called +91 98765 43210 PAN ABCPD1234F card 4111 1111 1111 1111 aadhaar 2345 6789 0124.\n";

function buildSyntheticPayload(targetBytes) {
  const repeats = Math.ceil(targetBytes / SYNTHETIC_LINE.length);
  return SYNTHETIC_LINE.repeat(repeats).slice(0, targetBytes);
}

async function runBenchmark() {
  const server = await createServer({
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });

  try {
    const detectors = await server.ssrLoadModule("/src/lib/detectors/index.ts");
    const redaction = await server.ssrLoadModule("/src/lib/redaction/index.ts");

    const {
      detectCreditCards,
      detectAadhaars,
      detectPans,
      detectIpv4s,
      detectEmails,
      detectPhones,
      resolveOverlaps,
    } = detectors;
    const { redactText } = redaction;

    const results = [];

    for (const target of BENCHMARK_TARGETS) {
      const text = buildSyntheticPayload(target.bytes);

      const tDetectStart = performance.now();
      const candidates = [
        ...detectCreditCards(text),
        ...detectAadhaars(text),
        ...detectPans(text),
        ...detectIpv4s(text),
        ...detectEmails(text),
        ...detectPhones(text),
      ];
      const tDetectEnd = performance.now();

      const tOverlapStart = performance.now();
      const detections = resolveOverlaps(candidates);
      const tOverlapEnd = performance.now();

      const tRedactStart = performance.now();
      redactText(text, detections, "FULL");
      redactText(text, detections, "PARTIAL");
      redactText(text, detections, "PSEUDONYMIZE");
      const tRedactEnd = performance.now();

      const detectorMs = tDetectEnd - tDetectStart;
      const overlapMs = tOverlapEnd - tOverlapStart;
      const redactionMs = tRedactEnd - tRedactStart;
      const totalMs = detectorMs + overlapMs + redactionMs;

      results.push({
        label: target.label,
        bytes: text.length,
        candidates: candidates.length,
        detections: detections.length,
        detectorMs: Number(detectorMs.toFixed(2)),
        overlapMs: Number(overlapMs.toFixed(2)),
        redactionMs: Number(redactionMs.toFixed(2)),
        totalMs: Number(totalMs.toFixed(2)),
      });
    }

    process.stdout.write(`${JSON.stringify({ benchmarks: results }, null, 2)}\n`);
  } finally {
    await server.close();
  }
}

await runBenchmark();
