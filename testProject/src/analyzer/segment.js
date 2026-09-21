/**
 * SegmentAnalyzer — 15 秒分段统计 + 左右手协调统计
 *
 * 1) 15 秒分段：把整曲按 15 秒切片，对每段统计：
 *    - 谱面音符数 / BGM 音符数 / 段密度
 *    - 段内各键型音符数（多押 / 楼梯 / 纵连 / 皿复合）
 *
 * 2) 左右手协调：左 = lane 1,2,3；右 = lane 4,5,6,7（不含 lane 8/Scratch，方案规定）
 *    注：本项目 lane 1~7 是键盘，Scratch 通过 isScratch 字段标识。
 *    以 2 小节为单位统计两组音符数，当差异达"数量级"（≥10×）判定为压力不均。
 *
 * 暴露：window.SegmentAnalyzer
 */
(function (global) {
    'use strict';

    var SEGMENT_LENGTH = 15;       // 秒
    var HAND_GROUP_BARS = 2;       // 左右手统计单位：2 小节
    var ORDER_OF_MAGNITUDE = 10;   // 数量级阈值

    function segmentByTime(chart, patterns) {
        var total = chart.meta.totalSeconds;
        if (total <= 0) return [];

        var segCount = Math.ceil(total / SEGMENT_LENGTH);
        var segs = [];
        for (var i = 0; i < segCount; i++) {
            segs.push({
                index: i,
                startTime: i * SEGMENT_LENGTH,
                endTime: Math.min((i + 1) * SEGMENT_LENGTH, total),
                noteCount: 0,
                bgmCount: 0,
                density: 0,
                duration: 0,
                patternCounts: { jack: 0, chord: 0, stair: 0, scratch: 0 }
            });
        }

        // 谱面音符
        for (var ni = 0; ni < chart.notes.length; ni++) {
            var t = chart.notes[ni].time;
            var si = Math.min(segCount - 1, Math.floor(t / SEGMENT_LENGTH));
            if (si < 0) continue;
            segs[si].noteCount++;
            if (patterns.noteSets.jack.has(ni)) segs[si].patternCounts.jack++;
            if (patterns.noteSets.chord.has(ni)) segs[si].patternCounts.chord++;
            if (patterns.noteSets.stair.has(ni)) segs[si].patternCounts.stair++;
            if (patterns.noteSets.scratch.has(ni)) segs[si].patternCounts.scratch++;
        }

        // BGM 音符
        for (var bi = 0; bi < chart.bgmNotes.length; bi++) {
            var bt = chart.bgmNotes[bi].time;
            var bsi = Math.min(segCount - 1, Math.floor(bt / SEGMENT_LENGTH));
            if (bsi < 0) continue;
            segs[bsi].bgmCount++;
        }

        for (var si2 = 0; si2 < segs.length; si2++) {
            var s = segs[si2];
            s.duration = s.endTime - s.startTime;
            s.density = s.duration > 0 ? s.noteCount / s.duration : 0;
        }

        return segs;
    }

    /**
     * 左右手协调：每 2 小节为一个统计单位，输出各组音符数与差异判定。
     */
    function calcHandBalance(chart) {
        var bars = chart.barTimes;
        var groupCount = Math.ceil(bars.length / HAND_GROUP_BARS);
        var groups = [];
        for (var g = 0; g < groupCount; g++) {
            var startBar = g * HAND_GROUP_BARS;
            var endBar = Math.min(startBar + HAND_GROUP_BARS, bars.length);
            var startBt = bars[startBar];
            var endBt = bars[endBar - 1];
            groups.push({
                index: g,
                startBar: startBar,
                endBar: endBar - 1,
                startTime: startBt.startTime,
                endTime: endBt.startTime + endBt.duration,
                leftCount: 0,
                rightCount: 0,
                unbalanced: false
            });
        }

        for (var i = 0; i < chart.notes.length; i++) {
            var n = chart.notes[i];
            if (n.isScratch) continue;
            // 左：lane 1,2,3；右：lane 4,5,6,7
            var b = n.bar;
            if (b < 0 || b >= bars.length) continue;
            var gi = Math.floor(b / HAND_GROUP_BARS);
            if (gi >= groups.length) continue;
            if (n.lane >= 1 && n.lane <= 3) groups[gi].leftCount++;
            else if (n.lane >= 4 && n.lane <= 7) groups[gi].rightCount++;
        }

        var unbalancedCount = 0;
        groups.forEach(function (g2) {
            var l = g2.leftCount;
            var r = g2.rightCount;
            // 差异达"数量级" = 一方 ≥ 另一方 × 10（且较多方至少有一个音符）
            if (l >= r * ORDER_OF_MAGNITUDE && l > 0) {
                g2.unbalanced = true;
                g2.heavySide = 'left';
            } else if (r >= l * ORDER_OF_MAGNITUDE && r > 0) {
                g2.unbalanced = true;
                g2.heavySide = 'right';
            }
            if (g2.unbalanced) unbalancedCount++;
        });

        return {
            groups: groups,
            unbalancedRegions: groups.filter(function (g3) { return g3.unbalanced; }),
            unbalancedCount: unbalancedCount,
            totalGroupCount: groups.length
        };
    }

    function analyze(chart, patterns) {
        return {
            segments: segmentByTime(chart, patterns),
            handBalance: calcHandBalance(chart),
            segmentLength: SEGMENT_LENGTH
        };
    }

    global.SegmentAnalyzer = {
        analyze: analyze,
        SEGMENT_LENGTH: SEGMENT_LENGTH
    };

})(typeof window !== 'undefined' ? window : this);
