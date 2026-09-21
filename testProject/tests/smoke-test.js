// 临时测试脚本：模拟浏览器环境，加载所有 src/* 模块并对一段示例 BMS 做端到端分析
// 用法：node tests/smoke-test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 构造一个最简 window
const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);

function load(file) {
  const code = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInContext(code, sandbox, { filename: file });
}

[
  'src/parser/bms-parser.js',
  'src/parser/normalizer.js',
  'src/analyzer/density.js',
  'src/analyzer/pattern.js',
  'src/analyzer/segment.js',
  'src/analyzer/difficulty.js'
].forEach(load);

const win = sandbox.window;

// 构造一段示例 BMS（不含变速、7K）
// 4 个小节，BPM 120，每小节 4 秒
// 第 0 小节：单键 1 楼梯 1→2→3→4→5→6→7
// 第 1 小节：纵连 (lane 1 重复 4 次)
// 第 2 小节：多押 (lane 1+2+3 同时)
// 第 3 小节：scratch + 键盘 (皿复合)
const bms = `
#TITLE Smoke Test
#ARTIST Tester
#BPM 120
#PLAYLEVEL 5
#WAV01 a.wav

#00011:01010101
#00012:00010101
#00013:00000101
#00014:00000001
#00015:01000000
#00018:01010000
#00019:01010100

#00111:01010101
#00112:00000000

#00211:01000000
#00212:01000000
#00213:01000000

#00316:01010101
#00311:01010101
`;

try {
  const parsed = win.BMSParser.parse(bms);
  console.log('Parser OK. rawEvents:', parsed.rawEvents.length);
  console.log('Header:', parsed.header);

  const chart = win.Normalizer.normalize(parsed);
  console.log('\nNormalizer OK. notes:', chart.notes.length, 'bgmNotes:', chart.bgmNotes.length);
  console.log('Meta:', chart.meta);

  const density = win.DensityAnalyzer.analyze(chart);
  console.log('\nDensity OK.');
  console.log('  weightedAvgDensity =', density.weightedAvgDensity.toFixed(4));
  console.log('  peakDensity        =', density.peakDensity);
  console.log('  sustainedPeak2s    =', density.sustainedPeak2s.toFixed(4));
  console.log('  highDensityThresh  =', density.highDensityThreshold.toFixed(4));
  console.log('  highDensityRegions =', density.highDensityRegions.length);

  const patterns = win.PatternDetector.detect(chart);
  console.log('\nPatterns OK.');
  console.log('  jacks            =', patterns.jacks.length);
  console.log('  chords           =', patterns.chords.length);
  console.log('  stairs           =', patterns.stairs.length);
  console.log('  scratchSegments  =', patterns.scratchSegments.length);

  const segment = win.SegmentAnalyzer.analyze(chart, patterns);
  console.log('\nSegment OK.');
  console.log('  segments         =', segment.segments.length);
  console.log('  unbalanced       =', segment.handBalance.unbalancedCount, '/', segment.handBalance.totalGroupCount);

  const difficulty = win.DifficultyCalculator.calculate(chart, density, patterns);
  console.log('\nDifficulty OK.');
  console.log('  components:', difficulty.components);
  console.log('  weighted  :', difficulty.weighted);
  console.log('  total     =', difficulty.total.toFixed(4));
  console.log('  radarNorm :', difficulty.radarNormalized);

  // 偏好测试：擅长 chord，不擅长 scratch
  const diffPref = win.DifficultyCalculator.calculate(chart, density, patterns,
      { best: 'chord', worst: 'scratch' });
  console.log('\n--- With preference {best:chord, worst:scratch} ---');
  console.log('  radarPrefMultipliers:', diffPref.radarPrefMultipliers);
  console.log('  radarNorm (after pref):', diffPref.radarNormalized);
  console.log('  total (unchanged) =', diffPref.total.toFixed(4));

  console.log('\n=== End-to-end pipeline OK ===');
} catch (e) {
  console.error('ERROR:', e);
  process.exit(1);
}
