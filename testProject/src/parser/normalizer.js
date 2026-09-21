/**
 * Normalizer — 标准化模块
 *
 * 输入：BMSParser.parse 的输出
 * 输出：标准化 ChartData {
 *   meta: { title, artist, bpm, playLevel, totalBars, totalSeconds },
 *   notes: [{ time, bar, positionInBar, channel, lane, isLN, isScratch, value }, ...],
 *   bgmNotes: [{ time, bar, positionInBar, value }, ...],
 *   barTimes: [{ bar, startTime, duration, ratio }, ...]  // 每小节起止时间
 * }
 *
 * 主要工作：
 *   1. 计算每小节的实际时长（应用 02 通道倍率，4/4 拍小节默认 4 拍）
 *   2. 把通道事件换算成绝对时间（秒）
 *   3. LN 处理：
 *      · 51~59 通道：成对出现，第 1 个为开始，第 2 个为结束。仅保留开始（标记 isLN=true）。
 *      · LNOBJ：11~19 通道中值等于 #LNOBJ 的音符是 LN 的结束；它之前最近的同轨道音符是开始。
 *        结束音符被丢弃；开始音符标记 isLN=true。
 *   4. 7K 谱面音符按 lane 排序输出
 *
 * 暴露：window.Normalizer
 */
(function (global) {
    'use strict';

    /**
     * 一个 BMS 小节默认 4 拍，时长（秒）= 60 / BPM * 4 * ratio
     */
    function calcBarDuration(bpm, ratio) {
        return (60 / bpm) * 4 * (ratio || 1);
    }

    /**
     * 计算所有小节的起止时间。
     * @returns {Array<{bar, startTime, duration, ratio}>}
     */
    function buildBarTimes(maxBar, bpm, barRatios) {
        var arr = [];
        var t = 0;
        for (var b = 0; b <= maxBar; b++) {
            var r = barRatios[b] != null ? barRatios[b] : 1;
            var d = calcBarDuration(bpm, r);
            arr.push({ bar: b, startTime: t, duration: d, ratio: r });
            t += d;
        }
        return arr;
    }

    /**
     * 根据 (bar, positionInBar) 计算绝对时间秒。
     */
    function calcTime(barTimes, bar, positionInBar) {
        var bt = barTimes[bar];
        if (!bt) return 0;
        return bt.startTime + bt.duration * positionInBar;
    }

    /**
     * 主标准化入口。
     */
    function normalize(parsed) {
        var header = parsed.header;
        var barRatios = parsed.barRatios;
        var rawEvents = parsed.rawEvents;

        var bpm = header.bpm;
        var lnObj = header.lnObj; // 可能为 null

        // 找出最大 bar 编号
        var maxBar = 0;
        for (var i = 0; i < rawEvents.length; i++) {
            if (rawEvents[i].bar > maxBar) maxBar = rawEvents[i].bar;
        }
        var barTimes = buildBarTimes(maxBar, bpm, barRatios);
        var totalSeconds = 0;
        if (barTimes.length > 0) {
            var last = barTimes[barTimes.length - 1];
            totalSeconds = last.startTime + last.duration;
        }

        // 分离事件
        var noteEvents = [];  // 谱面音符（11~19, 51~59）
        var bgmEvents = [];   // 01 通道
        for (var j = 0; j < rawEvents.length; j++) {
            var ev = rawEvents[j];
            ev.time = calcTime(barTimes, ev.bar, ev.positionInBar);
            if (ev.type === 'bgm') {
                bgmEvents.push(ev);
            } else if (ev.type === 'note') {
                noteEvents.push(ev);
            }
        }

        // 按时间排序
        noteEvents.sort(function (a, b) {
            if (a.time !== b.time) return a.time - b.time;
            return a.lane - b.lane;
        });
        bgmEvents.sort(function (a, b) {
            return a.time - b.time;
        });

        // ---------- LN 处理 ----------
        // 1) 51~59 通道型：按 lane 分组，配对成 (开始, 结束)，仅保留开始
        // 2) LNOBJ：11~19 中 value === lnObj 的音符是 LN 结束
        //          其前一个同 lane 的 11~19 音符是 LN 开始
        var notes = [];
        var lnPairBuffer = {}; // lane → 是否在等待"结束"音符

        // 先把 51~59 与 11~19 分别处理
        // 为了维持时间顺序，我们对 noteEvents 按 lane 各自处理后再合并

        // 按 lane 分组
        var byLane = {};
        for (var k = 0; k < noteEvents.length; k++) {
            var n = noteEvents[k];
            if (!byLane[n.lane]) byLane[n.lane] = [];
            byLane[n.lane].push(n);
        }

        Object.keys(byLane).forEach(function (laneKey) {
            var laneEvents = byLane[laneKey]; // 已按时间排序
            // 51~59 通道型：成对配对
            var pending51 = false; // 当前 lane 是否处于"51~59 LN 进行中"
            for (var idx = 0; idx < laneEvents.length; idx++) {
                var ev = laneEvents[idx];
                if (ev.lnByChannel) {
                    // 51~59 通道
                    if (!pending51) {
                        // 开始
                        notes.push({
                            time: ev.time,
                            bar: ev.bar,
                            positionInBar: ev.positionInBar,
                            channel: ev.channel,
                            lane: ev.lane,
                            isLN: true,
                            isScratch: ev.isScratch,
                            value: ev.value
                        });
                        pending51 = true;
                    } else {
                        // 结束，丢弃
                        pending51 = false;
                    }
                } else {
                    // 11~19 通道
                    if (lnObj && ev.value === lnObj) {
                        // 这是 LNOBJ 结束音符
                        // 把"它之前最近的同 lane 普通音符"标记为 LN（也即修改 notes 中已经 push 的最近一个同 lane 普通音符）
                        for (var p = notes.length - 1; p >= 0; p--) {
                            if (notes[p].lane === ev.lane) {
                                notes[p].isLN = true;
                                break;
                            }
                        }
                        // 结束音符本身丢弃
                    } else {
                        notes.push({
                            time: ev.time,
                            bar: ev.bar,
                            positionInBar: ev.positionInBar,
                            channel: ev.channel,
                            lane: ev.lane,
                            isLN: false,
                            isScratch: ev.isScratch,
                            value: ev.value
                        });
                    }
                }
            }
        });

        // 重新按时间排序（合并 lane 后）
        notes.sort(function (a, b) {
            if (a.time !== b.time) return a.time - b.time;
            return a.lane - b.lane;
        });

        // BGM 音符
        var bgmNotes = bgmEvents.map(function (ev) {
            return {
                time: ev.time,
                bar: ev.bar,
                positionInBar: ev.positionInBar,
                value: ev.value
            };
        });

        return {
            meta: {
                title: header.title,
                artist: header.artist,
                bpm: bpm,
                playLevel: header.playLevel,
                totalBars: maxBar + 1,
                totalSeconds: totalSeconds
            },
            notes: notes,
            bgmNotes: bgmNotes,
            barTimes: barTimes
        };
    }

    global.Normalizer = {
        normalize: normalize,
        calcBarDuration: calcBarDuration
    };

})(typeof window !== 'undefined' ? window : this);
