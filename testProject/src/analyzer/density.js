/**
 * DensityAnalyzer — 密度分析模块
 *
 * 计算：
 *   - 按小节密度（notes/秒）
 *   - 按秒密度（notes/秒，1 秒滑动窗口）
 *   - 加权平均密度（期望值）：各小节密度按时长加权平均，并忽略个位数级别差值（先取整后加权）
 *   - 瞬时峰值密度：每秒操作数的最大值（1 秒固定窗口扫描）
 *   - 持续峰值密度：最高的连续 5 秒平均密度
 *   - 高密度区间：≥ 加权平均密度 × 3，相邻间隔 <1 秒合并
 *
 * 数据流：
 *   normalizedChart → analyzeDensity → 返回密度分析结果对象
 *
 * 暴露：window.DensityAnalyzer
 */
(function (global) {
    'use strict';

    var HIGH_DENSITY_THRESHOLD_RATIO = 1.5;
    var HIGH_DENSITY_GAP_MERGE = 1.0;   // 相邻区间间隔 < 1 秒合并
    var SUSTAINED_WINDOW = 2;           // 持续峰值密度窗口 2 秒
    var INSTANT_WINDOW = 1;             // 瞬时峰值窗口 1 秒

    /**
     * 按小节统计密度（notes/秒）。
     * 只统计谱面音符（不含 BGM）。
     */
    function calcBarDensity(chart) {
        var bars = chart.barTimes;
        var notes = chart.notes;
        var counts = new Array(bars.length).fill(0);
        for (var i = 0; i < notes.length; i++) {
            var b = notes[i].bar;
            if (b >= 0 && b < bars.length) counts[b]++;
        }
        return bars.map(function (bt, idx) {
            return {
                bar: bt.bar,
                startTime: bt.startTime,
                duration: bt.duration,
                noteCount: counts[idx],
                density: bt.duration > 0 ? counts[idx] / bt.duration : 0
            };
        });
    }

    /**
     * 按秒密度：以 1 秒为窗口扫描整曲，每秒内的音符数 = 该秒的密度（notes/s）。
     * 返回 [{ second, density }, ...]，second 是窗口起始时间整秒。
     */
    function calcSecondDensity(chart) {
        var notes = chart.notes;
        var total = Math.max(1, Math.ceil(chart.meta.totalSeconds));
        var arr = new Array(total).fill(0);
        for (var i = 0; i < notes.length; i++) {
            var t = notes[i].time;
            var idx = Math.floor(t);
            if (idx >= 0 && idx < total) arr[idx]++;
        }
        return arr.map(function (count, i) {
            return { second: i, density: count };
        });
    }

    /**
     * 1 秒滑动窗口的瞬时密度（精度更高，用于峰值识别）。
     * 步进 0.1 秒。返回 [{ time, density }, ...]，density 为该窗口内 notes 数（即 notes/秒）。
     */
    function calcSlidingDensityCurve(chart, step) {
        step = step || 0.1;
        var notes = chart.notes;
        var total = chart.meta.totalSeconds;
        if (total <= 0) return [];
        var times = notes.map(function (n) { return n.time; });
        // 二分查找 helper
        function lowerBound(arr, x) {
            var lo = 0, hi = arr.length;
            while (lo < hi) {
                var mid = (lo + hi) >> 1;
                if (arr[mid] < x) lo = mid + 1;
                else hi = mid;
            }
            return lo;
        }
        var result = [];
        for (var t = 0; t <= total; t += step) {
            var lo = lowerBound(times, t);
            var hi = lowerBound(times, t + INSTANT_WINDOW);
            result.push({ time: t, density: hi - lo });
        }
        return result;
    }

    /**
     * 加权平均密度（按小节时长加权）。
     * 方案：先对各小节密度按个位数级别取整（即四舍五入到整数），再按时长加权平均。
     */
    function calcWeightedAvgDensity(barDensity) {
        var totalTime = 0;
        var sum = 0;
        for (var i = 0; i < barDensity.length; i++) {
            var d = Math.round(barDensity[i].density); // 忽略个位数级别差值
            sum += d * barDensity[i].duration;
            totalTime += barDensity[i].duration;
        }
        return totalTime > 0 ? sum / totalTime : 0;
    }

    /**
     * 瞬时峰值密度：1 秒滑动窗口内 notes 数的最大值。
     */
    function calcPeakDensity(slidingCurve) {
        var peak = 0;
        for (var i = 0; i < slidingCurve.length; i++) {
            if (slidingCurve[i].density > peak) peak = slidingCurve[i].density;
        }
        return peak;
    }

    /**
     * 持续峰值密度：最高的连续 5 秒平均密度。
     * 通过对滑动密度曲线做 5 秒窗口平均，取最大。
     */
    function calcSustainedPeak(chart) {
        var notes = chart.notes;
        var total = chart.meta.totalSeconds;
        if (total < SUSTAINED_WINDOW) return 0;
        var times = notes.map(function (n) { return n.time; });
        function lowerBound(arr, x) {
            var lo = 0, hi = arr.length;
            while (lo < hi) {
                var mid = (lo + hi) >> 1;
                if (arr[mid] < x) lo = mid + 1;
                else hi = mid;
            }
            return lo;
        }
        var step = 0.1;
        var peak = 0;
        for (var t = 0; t + SUSTAINED_WINDOW <= total; t += step) {
            var lo = lowerBound(times, t);
            var hi = lowerBound(times, t + SUSTAINED_WINDOW);
            var avg = (hi - lo) / SUSTAINED_WINDOW;
            if (avg > peak) peak = avg;
        }
        return peak;
    }

    /**
     * 高密度区间识别。
     * 输入：滑动密度曲线 + 阈值
     * 流程：扫描曲线，连续超阈值的部分形成原始区间；相邻区间间隔 <1 秒合并。
     * 输出：[{ startTime, endTime, duration, avgDensity, noteCount }]
     */
    function findHighDensityRegions(slidingCurve, threshold, chart) {
        var regions = [];
        var inRegion = false;
        var regionStart = 0;

        for (var i = 0; i < slidingCurve.length; i++) {
            var pt = slidingCurve[i];
            if (!inRegion && pt.density >= threshold) {
                inRegion = true;
                regionStart = pt.time;
            } else if (inRegion && pt.density < threshold) {
                inRegion = false;
                regions.push({ startTime: regionStart, endTime: pt.time });
            }
        }
        if (inRegion) {
            var lastPt = slidingCurve[slidingCurve.length - 1];
            regions.push({ startTime: regionStart, endTime: lastPt.time });
        }

        // 合并相邻间隔 <1 秒的区间
        var merged = [];
        for (var j = 0; j < regions.length; j++) {
            var r = regions[j];
            if (merged.length === 0) {
                merged.push({ startTime: r.startTime, endTime: r.endTime });
            } else {
                var last = merged[merged.length - 1];
                if (r.startTime - last.endTime < HIGH_DENSITY_GAP_MERGE) {
                    last.endTime = r.endTime;
                } else {
                    merged.push({ startTime: r.startTime, endTime: r.endTime });
                }
            }
        }

        // 给每个区间计算 noteCount 和 avgDensity
        var notes = chart.notes;
        var times = notes.map(function (n) { return n.time; });
        function lowerBound(arr, x) {
            var lo = 0, hi = arr.length;
            while (lo < hi) {
                var mid = (lo + hi) >> 1;
                if (arr[mid] < x) lo = mid + 1;
                else hi = mid;
            }
            return lo;
        }
        merged.forEach(function (r) {
            r.duration = r.endTime - r.startTime;
            var lo = lowerBound(times, r.startTime);
            var hi = lowerBound(times, r.endTime);
            r.noteCount = hi - lo;
            r.avgDensity = r.duration > 0 ? r.noteCount / r.duration : 0;
        });

        return merged;
    }

    /**
     * 主分析入口
     */
    function analyze(chart) {
        var barDensity = calcBarDensity(chart);
        var secondDensity = calcSecondDensity(chart);
        var slidingCurve = calcSlidingDensityCurve(chart, 0.1);
        var weightedAvgDensity = calcWeightedAvgDensity(barDensity);
        var peakDensity = calcPeakDensity(slidingCurve);
        var sustainedPeak2s = calcSustainedPeak(chart);
        var threshold = weightedAvgDensity * HIGH_DENSITY_THRESHOLD_RATIO;
        var highDensityRegions = findHighDensityRegions(slidingCurve, threshold, chart);

        return {
            barDensity: barDensity,
            secondDensity: secondDensity,
            slidingCurve: slidingCurve,
            weightedAvgDensity: weightedAvgDensity,
            peakDensity: peakDensity,
            sustainedPeak2s: sustainedPeak2s,
            highDensityThreshold: threshold,
            highDensityRegions: highDensityRegions
        };
    }

    global.DensityAnalyzer = {
        analyze: analyze,
        calcBarDensity: calcBarDensity,
        HIGH_DENSITY_THRESHOLD_RATIO: HIGH_DENSITY_THRESHOLD_RATIO
    };

})(typeof window !== 'undefined' ? window : this);
