// Performance Detection Utility
// Benchmarks device capability and provides adaptive quality settings

(function() {
  'use strict';

  // Run a quick canvas benchmark to determine device capability
  function runBenchmark() {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 200;
    testCanvas.height = 200;
    const testCtx = testCanvas.getContext('2d');

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      // Simulate typical animation work: gradients, arcs, fills
      const grad = testCtx.createRadialGradient(100, 100, 0, 100, 100, 100);
      grad.addColorStop(0, 'rgba(255,100,100,0.8)');
      grad.addColorStop(1, 'rgba(100,100,255,0)');
      testCtx.fillStyle = grad;
      testCtx.fillRect(0, 0, 200, 200);

      testCtx.beginPath();
      testCtx.arc(100, 100, 50, 0, Math.PI * 2);
      testCtx.fill();
    }

    const elapsed = performance.now() - start;
    const avgFrameTime = elapsed / iterations;

    // Determine quality level based on benchmark
    // < 2ms per iteration = high performance
    // 2-5ms = medium
    // > 5ms = low
    if (avgFrameTime < 2) {
      return 'high';
    } else if (avgFrameTime < 5) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Quality presets
  const qualityPresets = {
    high: {
      // Langston's Ant settings
      antCount: 18,
      antStepsPerFrame: 2,
      // Waves settings
      waveSamples: 400,
      particleCount: 180,
      // Shared
      targetFps: 30
    },
    medium: {
      antCount: 12,
      antStepsPerFrame: 1,
      waveSamples: 300,
      particleCount: 120,
      targetFps: 30
    },
    low: {
      antCount: 8,
      antStepsPerFrame: 1,
      waveSamples: 200,
      particleCount: 60,
      targetFps: 30
    }
  };

  // Detect quality level
  const qualityLevel = runBenchmark();
  const settings = qualityPresets[qualityLevel];

  // Frame rate limiter utility
  function createFrameLimiter(targetFps) {
    const frameInterval = 1000 / targetFps;
    let lastFrameTime = 0;

    return function shouldRender(now) {
      if (now - lastFrameTime < frameInterval) {
        return false;
      }
      lastFrameTime = now;
      return true;
    };
  }

  // Export to global scope
  window.PerfSettings = {
    level: qualityLevel,
    settings: settings,
    createFrameLimiter: createFrameLimiter
  };

  console.log(`[PerfDetect] Quality level: ${qualityLevel}`, settings);
})();
