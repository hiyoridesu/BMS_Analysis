/**
 * DifficultyCalculator — 难度计算
 *
 * 公式（最终）：
 *   总难度 = 0.60·D_avg
 *          + 0.20·P_op
 *          + 0.05·C_chord
 *          + 0.05·C_stair
 *          + 0.05·C_jack
 *          + 0.05·C_scratch
 *
 *   D_avg     = 加权平均密度（来自 DensityAnalyzer）
 *   P_op      = Σ 高密度区间(密度 × 时长) = Σ 高密度区间内音符数
 *   C_X       = Σ_小节 (小节密度 × 该小节中 X 键型音符占比)
 *
 * 雷达图归一化：
 *   设 raw 为该维度原始值，base 为基准值；
 *   x = raw / base * 100
 *   norm(x) = x                          (x ≤ 100)
 *   norm(x) = 100 + 50 · log10(x / 100)  (x > 100)
 *
 *   基准值：D_avg=20, P_op=450, 各 C_X=300
 *
 * 暴露：window.DifficultyCalculator
 */
(function (global) {
    'use strict';

    var WEIGHTS = {
        dAvg:     0.60,
        pOp:      0.20,
        cChord:   0.05,
        cStair:   0.05,
        cJack:    0.05,
        cScratch: 0.05
    };

    var RADAR_BASE = {
        dAvg:     20,
        pOp:      100,
        cChord:   300,
        cStair:   300,
        cJack:    300,
        cScratch: 360
    };

    // 雷达图各维度的初始值偏移：归一化前给每个原始值 +RADAR_OFFSET，
    // 避免某维度为 0 时雷达图塌缩为单点。
    var RADAR_OFFSET = 10;

    // 个人偏好对雷达图键型 4 项的调整系数（仅影响雷达图显示，不影响总难度）
    var PREF_BEST_MULTIPLIER  = 0.8;   // 擅长：降低 20%
    var PREF_WORST_MULTIPLIER = 1.3;   // 不擅长：增加 30%
    var PATTERN_KEYS = ['chord', 'stair', 'jack', 'scratch'];

    /**
     * 根据个人偏好计算各键型的雷达倍率。
     * @param {object} pref — { best: 'none'|'chord'|'stair'|'jack'|'scratch',
     *                          worst: 'none'|'chord'|'stair'|'jack'|'scratch' }
     * @returns {{chord:number, stair:number, jack:number, scratch:number}}
     */
    function buildPrefMultipliers(pref) {
        var m = { chord: 1, stair: 1, jack: 1, scratch: 1 };
        if (!pref) return m;
        if (pref.best && m.hasOwnProperty(pref.best)) {
            m[pref.best] *= PREF_BEST_MULTIPLIER;
        }
        if (pref.worst && m.hasOwnProperty(pref.worst)) {
            m[pref.worst] *= PREF_WORST_MULTIPLIER;
        }
        return m;
    }

    /**
     * P_op = Σ 高密度区间贡献 = Σ (区间内音符数)
     * （与"区间平均密度 × 持续时间"等价 = 区间音符数）
     */
    function calcPOp(densityResult) {
        var regions = densityResult.highDensityRegions || [];
        var sum = 0;
        for (var i = 0; i < regions.length; i++) {
            sum += regions[i].noteCount;
        }
        return sum;
    }

    /**
     * C_X = Σ_小节 (小节密度 × 该小节中 X 键型音符占比)
     */
    function calcPatternComplexity(barDensity, perBarRatio) {
        var sum = 0;
        for (var i = 0; i < barDensity.length; i++) {
            var d = barDensity[i].density;
            var r = perBarRatio[i] ? perBarRatio[i].ratio : 0;
            sum += d * r;
        }
        return sum;
    }

    /**
     * 雷达图归一化
     */
    function normalizeForRadar(raw, base) {
        if (base <= 0) return 0;
        var x = (raw / base) * 100;
        if (x <= 100) return x;
        return 100 + 50 * Math.log10(x / 100);
    }

    /**
     * 主计算入口
     * @param {object} chart         — Normalizer 输出
     * @param {object} densityResult — DensityAnalyzer 输出
     * @param {object} patterns      — PatternDetector 输出
     * @param {object} [preference]  — 个人偏好 { best, worst }；仅影响雷达图键型 4 项
     */
    function calculate(chart, densityResult, patterns, preference) {
        var dAvg = densityResult.weightedAvgDensity;
        var pOp = calcPOp(densityResult);
        var cChord   = calcPatternComplexity(densityResult.barDensity, patterns.perBarRatio.chord);
        var cStair   = calcPatternComplexity(densityResult.barDensity, patterns.perBarRatio.stair);
        var cJack    = calcPatternComplexity(densityResult.barDensity, patterns.perBarRatio.jack);
        var cScratch = calcPatternComplexity(densityResult.barDensity, patterns.perBarRatio.scratch);

        var total =
            WEIGHTS.dAvg     * dAvg     +
            WEIGHTS.pOp      * pOp      +
            WEIGHTS.cChord   * cChord   +
            WEIGHTS.cStair   * cStair   +
            WEIGHTS.cJack    * cJack    +
            WEIGHTS.cScratch * cScratch;

        // 雷达图：先 +offset 再归一化，再乘以个人偏好倍率（仅影响 4 个键型项）
        var prefMul = buildPrefMultipliers(preference);
        var radar = {
            dAvg:     normalizeForRadar(dAvg     + RADAR_OFFSET, RADAR_BASE.dAvg),
            pOp:      normalizeForRadar(pOp      + RADAR_OFFSET, RADAR_BASE.pOp),
            cChord:   normalizeForRadar(cChord   + RADAR_OFFSET, RADAR_BASE.cChord)   * prefMul.chord,
            cStair:   normalizeForRadar(cStair   + RADAR_OFFSET, RADAR_BASE.cStair)   * prefMul.stair,
            cJack:    normalizeForRadar(cJack    + RADAR_OFFSET, RADAR_BASE.cJack)    * prefMul.jack,
            cScratch: normalizeForRadar(cScratch + RADAR_OFFSET, RADAR_BASE.cScratch) * prefMul.scratch
        };

        return {
            total: total,
            components: {
                dAvg:     dAvg,
                pOp:      pOp,
                cChord:   cChord,
                cStair:   cStair,
                cJack:    cJack,
                cScratch: cScratch
            },
            weighted: {
                dAvg:     WEIGHTS.dAvg     * dAvg,
                pOp:      WEIGHTS.pOp      * pOp,
                cChord:   WEIGHTS.cChord   * cChord,
                cStair:   WEIGHTS.cStair   * cStair,
                cJack:    WEIGHTS.cJack    * cJack,
                cScratch: WEIGHTS.cScratch * cScratch
            },
            radarNormalized: radar,
            radarOffset: RADAR_OFFSET,
            radarPrefMultipliers: prefMul,
            preference: preference || { best: 'none', worst: 'none' },
            weights: WEIGHTS,
            radarBase: RADAR_BASE
        };
    }

    /**
     * 给定一组小节难度堆叠（用于难度曲线柱状图）。
     * 每个小节的"难度堆叠条" = 该小节密度按 4 种键型占比拆分（剩余部分为"基础"）。
     * 这样柱高 ≈ 小节密度。
     */
    function buildBarStack(densityResult, patterns) {
        var bars = densityResult.barDensity;
        return bars.map(function (b, i) {
            var rJack    = patterns.perBarRatio.jack[i]    ? patterns.perBarRatio.jack[i].ratio    : 0;
            var rChord   = patterns.perBarRatio.chord[i]   ? patterns.perBarRatio.chord[i].ratio   : 0;
            var rStair   = patterns.perBarRatio.stair[i]   ? patterns.perBarRatio.stair[i].ratio   : 0;
            var rScratch = patterns.perBarRatio.scratch[i] ? patterns.perBarRatio.scratch[i].ratio : 0;
            // 注：占比之和可能 >1（多键型重叠），保持原始占比即可，由可视化决定如何呈现
            return {
                bar: b.bar,
                density: b.density,
                jack:    b.density * rJack,
                chord:   b.density * rChord,
                stair:   b.density * rStair,
                scratch: b.density * rScratch
            };
        });
    }

    /**
     * 给定 15 秒分段的难度堆叠（柱状图按 15 秒段）
     */
    function buildSegmentStack(segments) {
        return segments.map(function (s) {
            var totalNotes = s.noteCount || 1;
            var d = s.density;
            // 按段内音符的键型计数比例分摊密度
            return {
                index: s.index,
                startTime: s.startTime,
                endTime: s.endTime,
                density: d,
                jack:    d * (s.patternCounts.jack    / totalNotes),
                chord:   d * (s.patternCounts.chord   / totalNotes),
                stair:   d * (s.patternCounts.stair   / totalNotes),
                scratch: d * (s.patternCounts.scratch / totalNotes)
            };
        });
    }

    global.DifficultyCalculator = {
        calculate: calculate,
        buildBarStack: buildBarStack,
        buildSegmentStack: buildSegmentStack,
        normalizeForRadar: normalizeForRadar,
        buildPrefMultipliers: buildPrefMultipliers,
        WEIGHTS: WEIGHTS,
        RADAR_BASE: RADAR_BASE,
        RADAR_OFFSET: RADAR_OFFSET,
        PREF_BEST_MULTIPLIER: PREF_BEST_MULTIPLIER,
        PREF_WORST_MULTIPLIER: PREF_WORST_MULTIPLIER,
        PATTERN_KEYS: PATTERN_KEYS
    };

})(typeof window !== 'undefined' ? window : this);
