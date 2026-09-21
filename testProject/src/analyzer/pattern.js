/**
 * PatternDetector — 键型识别
 *
 * 识别 4 类键型（依方案设计文档）：
 *
 *   1. 纵连 (Jack)
 *      · 同轨道两音符开始时间间隔 < 8 分音符（含切分音）
 *      · 最小 2 连击；LN 不计入
 *      · 注：8 分音符时长 = (60 / BPM) * 0.5
 *
 *   2. 多押 (Chord)
 *      · 同节拍点上 ≥2 个音符同时按下（同 time）
 *      · 最大 8；LN 仅开始点视作普通音符，Scratch 视作普通音符
 *      · 不细分押数
 *
 *   3. 楼梯 (Stair)
 *      · 连续相邻轨道（lane 差 = 1）
 *      · 时值间隔相等
 *      · 间隔 ≤ 8 分音符
 *      · ≥3 个音符且涉及 ≥3 个轨道
 *      · 不考虑方向；LN/Scratch 不计入
 *      · 结束条件：非相邻跳跃 / 重复轨道 / 时值间隔变化 / 间隔超 8 分音符
 *
 *   4. 皿复合 (Scratch Combo)
 *      · 单个小节内同时存在 Scratch 和键盘音符（不要求严格同时）
 *
 * 一个音符可属多种键型（不去重）。
 *
 * 输出（每种键型）：
 *   - 模式实例列表（含涉及的音符索引 / 时间范围 / 小节范围）
 *   - 每小节内该键型的音符占比（用于难度公式 C_X = Σ 小节密度 × 该小节中 X 占比）
 *
 * 暴露：window.PatternDetector
 */
(function (global) {
    'use strict';

    /**
     * 计算 8 分音符的时值（秒）。
     * 项目无变速：8 分音符时长 = 60 / BPM * 0.5
     */
    function eighthNoteDuration(bpm) {
        return (60 / bpm) * 0.5;
    }

    /**
     * 浮点近似相等
     */
    function approxEqual(a, b, eps) {
        return Math.abs(a - b) <= (eps != null ? eps : 1e-6);
    }

    // ---------- 1. 纵连 ----------
    /**
     * 检测同轨道相邻音符间隔 < 8 分音符的连续段（≥2 个音符）。
     * LN 不计入。
     */
    function detectJacks(chart) {
        var bpm = chart.meta.bpm;
        var eighth = eighthNoteDuration(bpm);
        var laneGroups = {}; // lane → 按时间排序的"非 LN、非 Scratch"音符索引

        // 注：方案规定 LN 不计入纵连；Scratch 是否算入纵连方案未明说，
        // 但纵连"同轨道"，scratch 自身也有轨道，可形成 scratch 连打。
        // 保守理解：纵连不限制 scratch（因为方案未明确排除）。这里把 LN 排除。
        for (var i = 0; i < chart.notes.length; i++) {
            var n = chart.notes[i];
            if (n.isLN) continue;
            if (!laneGroups[n.lane]) laneGroups[n.lane] = [];
            laneGroups[n.lane].push(i);
        }

        var jacks = [];
        var jackNoteSet = new Set();

        Object.keys(laneGroups).forEach(function (laneKey) {
            var idxList = laneGroups[laneKey];
            var run = [idxList[0]];
            for (var k = 1; k < idxList.length; k++) {
                var prevIdx = idxList[k - 1];
                var curIdx = idxList[k];
                var dt = chart.notes[curIdx].time - chart.notes[prevIdx].time;
                if (dt < eighth - 1e-9) {
                    run.push(curIdx);
                } else {
                    if (run.length >= 2) {
                        jacks.push({
                            lane: +laneKey,
                            noteIndices: run.slice(),
                            startTime: chart.notes[run[0]].time,
                            endTime: chart.notes[run[run.length - 1]].time,
                            length: run.length
                        });
                        run.forEach(function (idx) { jackNoteSet.add(idx); });
                    }
                    run = [curIdx];
                }
            }
            if (run.length >= 2) {
                jacks.push({
                    lane: +laneKey,
                    noteIndices: run.slice(),
                    startTime: chart.notes[run[0]].time,
                    endTime: chart.notes[run[run.length - 1]].time,
                    length: run.length
                });
                run.forEach(function (idx) { jackNoteSet.add(idx); });
            }
        });

        return { instances: jacks, noteSet: jackNoteSet };
    }

    // ---------- 2. 多押 ----------
    /**
     * 同 time 的音符 ≥ 2 个时构成多押。
     * LN（开始点）和 Scratch 都参与计数。
     */
    function detectChords(chart) {
        var groups = {}; // timeKey → noteIndices
        for (var i = 0; i < chart.notes.length; i++) {
            var t = chart.notes[i].time;
            var key = t.toFixed(6);
            if (!groups[key]) groups[key] = [];
            groups[key].push(i);
        }
        var chords = [];
        var chordNoteSet = new Set();
        Object.keys(groups).forEach(function (k) {
            var arr = groups[k];
            if (arr.length >= 2) {
                chords.push({
                    time: chart.notes[arr[0]].time,
                    noteIndices: arr.slice(),
                    size: arr.length
                });
                arr.forEach(function (idx) { chordNoteSet.add(idx); });
            }
        });
        chords.sort(function (a, b) { return a.time - b.time; });
        return { instances: chords, noteSet: chordNoteSet };
    }

    // ---------- 3. 楼梯 ----------
    /**
     * 楼梯识别：
     *   按时间扫描音符，维护一个候选序列。
     *   下一个音符若满足"相邻轨道（|Δlane|=1）"、"时值间隔等于前一对的间隔"、"间隔 ≤ 8 分音符"，
     *   且未出现轨道重复，则加入；否则结束当前序列。
     *   完成时若长度 ≥3 且涉及 ≥3 个轨道，确认为楼梯。
     *
     * LN / Scratch 不计入：跳过这些音符。
     * 注："时值间隔相等"使用近似相等（容差 1ms）。
     */
    function detectStairs(chart) {
        var bpm = chart.meta.bpm;
        var eighth = eighthNoteDuration(bpm);
        // 过滤可参与楼梯的音符索引
        var candIdx = [];
        for (var i = 0; i < chart.notes.length; i++) {
            var n = chart.notes[i];
            if (n.isLN) continue;
            if (n.isScratch) continue;
            candIdx.push(i);
        }

        // 候选必须按时间升序；同时间的多个音符（多押）会破坏楼梯结构，跳过
        // 实际策略：若两个候选音符 time 相同，视为楼梯断点
        // 因为楼梯要求"连续相邻轨道"，多押情况下没有"接下来一个轨道"的概念

        var stairs = [];
        var stairNoteSet = new Set();
        var n = candIdx.length;
        var i2 = 0;

        function tryConfirm(run) {
            // run: index 列表 (chart.notes 索引)
            if (run.length < 3) return;
            var lanesUsed = new Set();
            run.forEach(function (idx) { lanesUsed.add(chart.notes[idx].lane); });
            if (lanesUsed.size < 3) return;
            stairs.push({
                noteIndices: run.slice(),
                startTime: chart.notes[run[0]].time,
                endTime: chart.notes[run[run.length - 1]].time,
                length: run.length
            });
            run.forEach(function (idx) { stairNoteSet.add(idx); });
        }

        while (i2 < n) {
            var startIdx = candIdx[i2];
            var run = [startIdx];
            var seenLanes = new Set([chart.notes[startIdx].lane]);
            var fixedInterval = null;
            var j2 = i2 + 1;
            while (j2 < n) {
                var prev = chart.notes[candIdx[j2 - 1]];
                var cur = chart.notes[candIdx[j2]];
                var dt = cur.time - prev.time;
                if (dt <= 0) break; // 同时间，断开
                if (dt > eighth + 1e-9) break; // 超过 8 分
                if (Math.abs(cur.lane - prev.lane) !== 1) break; // 非相邻轨道
                if (seenLanes.has(cur.lane)) {
                    // 轨道重复 → 断点（方向变化时可能出现重复，按方案规定"出现重复"为结束条件）
                    break;
                }
                if (fixedInterval == null) {
                    fixedInterval = dt;
                } else if (!approxEqual(dt, fixedInterval, 0.002)) {
                    // 时值间隔变化
                    break;
                }
                run.push(candIdx[j2]);
                seenLanes.add(cur.lane);
                j2++;
            }
            tryConfirm(run);
            // 移动到下一个候选起点：从 j2 开始（保证不会重叠产生重复识别）
            i2 = run.length >= 3 ? j2 : i2 + 1;
        }

        return { instances: stairs, noteSet: stairNoteSet };
    }

    // ---------- 4. 皿复合 ----------
    /**
     * 单小节内同时存在 Scratch 和键盘音符 → 该小节为皿复合小节。
     * "属于皿复合"的音符 = 该小节内的所有谱面音符（包括 scratch 和键盘）。
     */
    function detectScratchCombo(chart) {
        var bars = chart.barTimes;
        var hasScratch = new Array(bars.length).fill(false);
        var hasKey = new Array(bars.length).fill(false);
        var barToNotes = {};
        for (var i = 0; i < chart.notes.length; i++) {
            var n = chart.notes[i];
            var b = n.bar;
            if (b < 0 || b >= bars.length) continue;
            if (n.isScratch) hasScratch[b] = true;
            else hasKey[b] = true;
            if (!barToNotes[b]) barToNotes[b] = [];
            barToNotes[b].push(i);
        }
        var scratchBars = [];
        var scratchNoteSet = new Set();
        for (var b2 = 0; b2 < bars.length; b2++) {
            if (hasScratch[b2] && hasKey[b2]) {
                scratchBars.push({
                    bar: b2,
                    startTime: bars[b2].startTime,
                    endTime: bars[b2].startTime + bars[b2].duration
                });
                (barToNotes[b2] || []).forEach(function (idx) { scratchNoteSet.add(idx); });
            }
        }
        return { instances: scratchBars, noteSet: scratchNoteSet };
    }

    // ---------- 占比统计（用于难度计算） ----------
    /**
     * 计算每小节中"属于某键型的音符数 / 该小节总音符数"。
     * @param chart
     * @param noteSet — 该键型涵盖的音符索引集合
     * @returns Array<{ bar, ratio, count, total }>
     */
    function calcPerBarRatio(chart, noteSet) {
        var bars = chart.barTimes;
        var totals = new Array(bars.length).fill(0);
        var matched = new Array(bars.length).fill(0);
        for (var i = 0; i < chart.notes.length; i++) {
            var b = chart.notes[i].bar;
            if (b < 0 || b >= bars.length) continue;
            totals[b]++;
            if (noteSet.has(i)) matched[b]++;
        }
        return bars.map(function (bt, idx) {
            return {
                bar: bt.bar,
                count: matched[idx],
                total: totals[idx],
                ratio: totals[idx] > 0 ? matched[idx] / totals[idx] : 0
            };
        });
    }

    // ---------- 主入口 ----------
    function detect(chart) {
        var jack = detectJacks(chart);
        var chord = detectChords(chart);
        var stair = detectStairs(chart);
        var scratch = detectScratchCombo(chart);

        return {
            jacks: jack.instances,
            chords: chord.instances,
            stairs: stair.instances,
            scratchSegments: scratch.instances,
            // 各键型音符索引集合（用于后续占比计算与堆叠染色）
            noteSets: {
                jack: jack.noteSet,
                chord: chord.noteSet,
                stair: stair.noteSet,
                scratch: scratch.noteSet
            },
            // 每小节内键型占比（用于难度公式）
            perBarRatio: {
                jack: calcPerBarRatio(chart, jack.noteSet),
                chord: calcPerBarRatio(chart, chord.noteSet),
                stair: calcPerBarRatio(chart, stair.noteSet),
                scratch: calcPerBarRatio(chart, scratch.noteSet)
            }
        };
    }

    global.PatternDetector = {
        detect: detect,
        eighthNoteDuration: eighthNoteDuration
    };

})(typeof window !== 'undefined' ? window : this);
