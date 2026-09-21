/**
 * BMSParser — BMS / BME / pms 文本解析器
 *
 * 输入：BMS 文本（string）
 * 输出：原始事件列表 + 头部信息
 *
 * 解析范围（依据方案设计文档）：
 *   - 头部指令：#TITLE / #ARTIST / #BPM / #PLAYLEVEL / #LNTYPE / #LNOBJ / #WAVxx
 *   - 通道事件行：#XXXYY:OBJECTS
 *     · 02      : 小节长度倍率（保留）
 *     · 01      : BGM 轨道
 *     · 11~19   : 1P 谱面音符
 *     · 51~59   : 1P 长押（LN）
 *   - 其他通道（视图、混音等）忽略
 *
 * 不处理：#RANDOM 等流程指令、变速、BMSON 格式。
 *
 * 暴露：window.BMSParser
 */
(function (global) {
    'use strict';

    // ---------- 配置 ----------
    var PLAYER_CHANNELS = {
        // BGM
        '01': { type: 'bgm', lane: 0, isScratch: false },
        // 1P 普通音符（11~19）
        '11': { type: 'note', lane: 1, isScratch: false },
        '12': { type: 'note', lane: 2, isScratch: false },
        '13': { type: 'note', lane: 3, isScratch: false },
        '14': { type: 'note', lane: 4, isScratch: false },
        '15': { type: 'note', lane: 5, isScratch: false },
        '16': { type: 'note', lane: 6, isScratch: false }, // 7K 配置：6=皿
        '18': { type: 'note', lane: 7, isScratch: false },
        '19': { type: 'note', lane: 8, isScratch: false },
        // BMS 7K 中 16 通常是 Scratch；这里以"通道号 16=皿"为准
        // 实际 7K 谱面：lane 1~7 为键盘，scratch 通常占用通道 16
        // 1P 长押（51~59，与 11~19 一一对应）
        '51': { type: 'note', lane: 1, isScratch: false, lnByChannel: true },
        '52': { type: 'note', lane: 2, isScratch: false, lnByChannel: true },
        '53': { type: 'note', lane: 3, isScratch: false, lnByChannel: true },
        '54': { type: 'note', lane: 4, isScratch: false, lnByChannel: true },
        '55': { type: 'note', lane: 5, isScratch: false, lnByChannel: true },
        '56': { type: 'note', lane: 6, isScratch: false, lnByChannel: true },
        '58': { type: 'note', lane: 7, isScratch: false, lnByChannel: true },
        '59': { type: 'note', lane: 8, isScratch: false, lnByChannel: true }
    };

    // 7K 模式中通道 16 / 56 默认为 Scratch（皿）
    // BMS 7K 标准：通道 11~15 = 键 1~5，16 = Scratch，18,19 = 键 6,7
    // 这里覆盖一下：
    PLAYER_CHANNELS['16'].isScratch = true;
    PLAYER_CHANNELS['56'].isScratch = true;

    // ---------- 工具 ----------
    function trimRight(s) {
        return s.replace(/\s+$/, '');
    }

    /**
     * 解析通道数据字符串为 (positionInBar, value) 对的数组。
     * BMS 中通道数据每 2 字符代表一个槽位，"00" 表示无事件。
     * 槽位均匀分布于小节内：position = i / N，N 为槽位数。
     */
    function parseChannelObjects(dataStr) {
        var result = [];
        var n = Math.floor(dataStr.length / 2);
        if (n === 0) return result;
        for (var i = 0; i < n; i++) {
            var token = dataStr.substr(i * 2, 2);
            if (token === '00') continue;
            result.push({
                indexInBar: i,
                slotsInBar: n,
                positionInBar: i / n,
                value: token.toUpperCase()
            });
        }
        return result;
    }

    // ---------- 主入口 ----------
    /**
     * 解析 BMS 文本。
     * @param {string} text — 完整文件文本
     * @returns {object} {
     *   header: { title, artist, bpm, playLevel, lnType, lnObj, wavTable },
     *   barRatios: { [barIndex]: ratio },  // 02 通道
     *   rawEvents: [
     *     { bar, positionInBar, slotsInBar, indexInBar, channel, value,
     *       type, lane, isScratch, lnByChannel }
     *   ]
     * }
     */
    function parse(text) {
        if (typeof text !== 'string') {
            throw new Error('BMSParser.parse: 输入必须是字符串');
        }

        var header = {
            title: '',
            artist: '',
            bpm: 130,         // 默认 BPM（BMS 规范默认值）
            playLevel: null,
            lnType: 1,        // 1=51~59 通道型，2=同通道夹击型（本项目主要用 1 与 LNOBJ）
            lnObj: null,      // LNOBJ 指定的 wav ID（大写）
            wavTable: {}      // wavId(大写) → 文件名
        };
        var barRatios = {};   // bar → 倍率
        var rawEvents = [];   // 所有事件

        var lines = text.split(/\r?\n/);

        for (var li = 0; li < lines.length; li++) {
            var line = trimRight(lines[li]);
            if (!line) continue;
            // BMS 注释一般以 ; 或 // 开头，或非 # 开头
            if (line.charAt(0) !== '#') continue;

            // 形如：#XXXYY:DATA  或  #COMMAND VALUE
            // 先尝试通道事件行（: 在第 7 个字符位置，#XXXYY:）
            // #(3 digit bar)(2 char channel):data
            var chanMatch = line.match(/^#(\d{3})([0-9A-Za-z]{2}):(.*)$/);
            if (chanMatch) {
                var barNum = parseInt(chanMatch[1], 10);
                var channel = chanMatch[2].toUpperCase();
                var data = chanMatch[3];

                if (channel === '02') {
                    // 小节长度倍率
                    var ratio = parseFloat(data);
                    if (!isNaN(ratio) && ratio > 0) {
                        barRatios[barNum] = ratio;
                    }
                    continue;
                }

                var meta = PLAYER_CHANNELS[channel];
                if (!meta) continue; // 忽略未关心通道

                var objs = parseChannelObjects(data);
                for (var oi = 0; oi < objs.length; oi++) {
                    var obj = objs[oi];
                    rawEvents.push({
                        bar: barNum,
                        positionInBar: obj.positionInBar,
                        slotsInBar: obj.slotsInBar,
                        indexInBar: obj.indexInBar,
                        channel: channel,
                        value: obj.value,
                        type: meta.type,
                        lane: meta.lane,
                        isScratch: !!meta.isScratch,
                        lnByChannel: !!meta.lnByChannel
                    });
                }
                continue;
            }

            // 头部指令行
            var cmdMatch = line.match(/^#([A-Za-z0-9]+)\s*(.*)$/);
            if (!cmdMatch) continue;
            var cmd = cmdMatch[1].toUpperCase();
            var val = cmdMatch[2].trim();

            switch (cmd) {
                case 'TITLE':
                    header.title = val;
                    break;
                case 'ARTIST':
                    header.artist = val;
                    break;
                case 'BPM':
                    // #BPM 130 或 #BPMxx 130（变速，本项目忽略变速）
                    var bpmVal = parseFloat(val);
                    if (!isNaN(bpmVal) && bpmVal > 0) {
                        header.bpm = bpmVal;
                    }
                    break;
                case 'PLAYLEVEL':
                    var lvl = parseInt(val, 10);
                    if (!isNaN(lvl)) header.playLevel = lvl;
                    break;
                case 'LNTYPE':
                    var lt = parseInt(val, 10);
                    if (!isNaN(lt)) header.lnType = lt;
                    break;
                case 'LNOBJ':
                    if (val) header.lnObj = val.toUpperCase();
                    break;
                default:
                    // #WAVxx 形式
                    var wavMatch = cmd.match(/^WAV([0-9A-Z]{2})$/);
                    if (wavMatch) {
                        header.wavTable[wavMatch[1]] = val;
                    }
                    break;
            }
        }

        return {
            header: header,
            barRatios: barRatios,
            rawEvents: rawEvents
        };
    }

    global.BMSParser = {
        parse: parse,
        PLAYER_CHANNELS: PLAYER_CHANNELS
    };

})(typeof window !== 'undefined' ? window : this);
