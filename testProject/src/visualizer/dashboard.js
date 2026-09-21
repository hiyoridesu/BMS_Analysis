/**
 * DashboardView — 总览仪表盘 + 元信息 + 数据列表
 *
 * - renderMeta(el, result)         → 渲染标题/艺术家/BPM 等元数据
 * - renderDashboard(el, result)    → 卡片式整曲指标
 * - renderDataList(el, result)     → 完整原始数据列表
 *
 * 所有静态文字均经 I18n 翻译（若 I18n 未加载，回退到原中文）。
 *
 * 暴露：window.DashboardView
 */
(function (global) {
    'use strict';

    function _t(key, fallback) {
        if (typeof I18n !== 'undefined' && I18n.tt) {
            return I18n.tt(key, fallback);
        }
        return fallback != null ? fallback : key;
    }

    function fmt(num, digits) {
        if (num == null || isNaN(num)) return '—';
        if (typeof num !== 'number') return num;
        return num.toFixed(digits != null ? digits : 2);
    }
    function fmtInt(num) {
        if (num == null || isNaN(num)) return '—';
        return Math.round(num).toString();
    }
    function fmtTime(t) {
        if (t == null || isNaN(t)) return '—';
        var m = Math.floor(t / 60);
        var s = Math.floor(t % 60);
        return m + ':' + (s < 10 ? '0' + s : s);
    }
    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function renderMeta(el, result) {
        var m = result.chart.meta;
        var fileInfo = result.fileInfo || {};
        var sec = _t('unit.seconds', ' 秒');
        var items = [
            [_t('meta.filename', '文件名'),  esc(fileInfo.name || '—')],
            [_t('meta.title', '曲目标题'),   esc(m.title || '—')],
            [_t('meta.artist', '艺术家'),    esc(m.artist || '—')],
            [_t('meta.bpm', 'BPM'),         fmt(m.bpm, 2)],
            [_t('meta.playlevel', '#PLAYLEVEL'), m.playLevel != null ? m.playLevel : '—'],
            [_t('meta.totalBars', '总小节数'), m.totalBars],
            [_t('meta.duration', '曲目时长'), fmtTime(m.totalSeconds) + ' (' + fmt(m.totalSeconds, 2) + sec + ')'],
            [_t('meta.notes', '总音符数'),   result.chart.notes.length],
            [_t('meta.bgmNotes', 'BGM 音符数'), result.chart.bgmNotes.length]
        ];
        el.innerHTML = items.map(function (it) {
            return '<div class="meta-item"><span class="meta-label">' + it[0] +
                   '：</span><span class="meta-value">' + it[1] + '</span></div>';
        }).join('');
    }

    function dashCard(label, value, unit, highlight) {
        return '<div class="dash-card' + (highlight ? ' highlight' : '') + '">' +
                   '<div class="dash-label">' + label + '</div>' +
                   '<div class="dash-value">' + value +
                       (unit ? '<span class="dash-unit"> ' + unit + '</span>' : '') +
                   '</div>' +
               '</div>';
    }

    function renderDashboard(el, result) {
        var d = result.density;
        var df = result.difficulty;
        var hb = result.segment.handBalance;
        var nps = _t('unit.notesPerSec', 'notes/秒');
        var secU = _t('unit.sec', '秒');
        var cards = [];

        cards.push(dashCard(_t('dash.total', '总难度'), fmt(df.total, 2), '', true));
        cards.push(dashCard(_t('dash.dAvg', '加权平均密度'), fmt(df.components.dAvg, 2), nps));
        cards.push(dashCard(_t('dash.pOp', '峰值操作要求'), fmt(df.components.pOp, 1), ''));
        cards.push(dashCard(_t('dash.peakDensity', '瞬时峰值密度'), fmtInt(d.peakDensity), nps));
        cards.push(dashCard(_t('dash.sustainedPeak', '持续峰值密度') + ' (2' + secU + ')', fmt(d.sustainedPeak2s, 2), nps));
        cards.push(dashCard(_t('dash.threshold', '高密度区间阈值'), fmt(d.highDensityThreshold, 2), nps));
        cards.push(dashCard(_t('dash.regions', '高密度区间数'), d.highDensityRegions.length, ''));
        cards.push(dashCard(_t('dash.cChord', '多押复杂度'), fmt(df.components.cChord, 2), ''));
        cards.push(dashCard(_t('dash.cStair', '楼梯复杂度'), fmt(df.components.cStair, 2), ''));
        cards.push(dashCard(_t('dash.cJack', '纵连复杂度'), fmt(df.components.cJack, 2), ''));
        cards.push(dashCard(_t('dash.cScratch', '皿复合复杂度'), fmt(df.components.cScratch, 2), ''));
        cards.push(dashCard(_t('dash.handBalance', '左右手压力不均段数'), hb.unbalancedCount + ' / ' + hb.totalGroupCount, ''));

        el.innerHTML = cards.join('');
    }

    function renderDataList(el, result) {
        var df = result.difficulty;
        var d = result.density;
        var hb = result.segment.handBalance;
        var patterns = result.patterns;
        var nps = _t('unit.notesPerSec', 'notes/秒');
        var secU = _t('unit.sec', '秒');

        var html = '';

        // 1) 难度计算明细
        html += '<h4>' + _t('list.h.difficulty', '难度计算明细（加权和）') + '</h4>';
        html += '<table><thead><tr>' +
                '<th>' + _t('list.col.dim', '维度') + '</th>' +
                '<th>' + _t('list.col.raw', '原始值') + '</th>' +
                '<th>' + _t('list.col.weight', '权重') + '</th>' +
                '<th>' + _t('list.col.weighted', '加权值') + '</th>' +
                '</tr></thead><tbody>';
        var rows = [
            [_t('list.row.dAvg',    '加权平均密度 (D_avg)'),    df.components.dAvg,     df.weights.dAvg,     df.weighted.dAvg],
            [_t('list.row.pOp',     '峰值操作要求 (P_op)'),     df.components.pOp,      df.weights.pOp,      df.weighted.pOp],
            [_t('list.row.cChord',  '多押复杂度 (C_chord)'),    df.components.cChord,   df.weights.cChord,   df.weighted.cChord],
            [_t('list.row.cStair',  '楼梯复杂度 (C_stair)'),    df.components.cStair,   df.weights.cStair,   df.weighted.cStair],
            [_t('list.row.cJack',   '纵连复杂度 (C_jack)'),     df.components.cJack,    df.weights.cJack,    df.weighted.cJack],
            [_t('list.row.cScratch', '皿复合复杂度 (C_scratch)'), df.components.cScratch, df.weights.cScratch, df.weighted.cScratch]
        ];
        rows.forEach(function (r) {
            html += '<tr><td>' + r[0] + '</td>' +
                    '<td>' + fmt(r[1], 4) + '</td>' +
                    '<td>' + fmt(r[2], 2) + '</td>' +
                    '<td>' + fmt(r[3], 4) + '</td></tr>';
        });
        html += '<tr><td><b>' + _t('list.row.total', '总难度') + '</b></td>' +
                '<td colspan="3"><b>' + fmt(df.total, 4) + '</b></td></tr>';
        html += '</tbody></table>';

        // 2) 雷达归一化值
        var prefMul = df.radarPrefMultipliers || { chord: 1, stair: 1, jack: 1, scratch: 1 };
        var prefLabel = function (key) {
            var m = prefMul[key];
            if (m == null || m === 1) return '—';
            return '×' + m.toFixed(2);
        };
        html += '<h4>' + _t('list.h.radar', '雷达图归一化值') + '（' + _t('list.h.radarRange', '0~200，每维度先 +10 偏移再归一化，键型项再乘偏好倍率') + '）</h4>';
        var prefPref = df.preference || { best: 'none', worst: 'none' };
        var prefNameMap = {
            none:    _t('pref.opt.none',    '无'),
            chord:   _t('pref.opt.chord',   '多押'),
            stair:   _t('pref.opt.stair',   '楼梯'),
            jack:    _t('pref.opt.jack',    '纵连'),
            scratch: _t('pref.opt.scratch', '皿复合')
        };
        html += '<div class="data-row"><span class="data-key">' + _t('list.balance.best', '最擅长') + '</span>' +
                '<span class="data-val">' + (prefNameMap[prefPref.best] || prefPref.best) + '（' + _t('pref.factor.best', '×0.80') + '）</span></div>';
        html += '<div class="data-row"><span class="data-key">' + _t('list.balance.worst', '最不擅长') + '</span>' +
                '<span class="data-val">' + (prefNameMap[prefPref.worst] || prefPref.worst) + '（' + _t('pref.factor.worst', '×1.30') + '）</span></div>';
        html += '<table><thead><tr>' +
                '<th>' + _t('list.col.dim', '维度') + '</th>' +
                '<th>' + _t('list.col.raw', '原始值') + '</th>' +
                '<th>' + _t('list.col.offset', '偏移后') + '</th>' +
                '<th>' + _t('list.col.base', '基准值') + '</th>' +
                '<th>' + _t('list.col.prefMul', '偏好倍率') + '</th>' +
                '<th>' + _t('list.col.normalized', '归一化') + '</th>' +
                '</tr></thead><tbody>';
        var radarRows = [
            [_t('list.r.dAvg',     '平均密度'), df.components.dAvg,     df.radarBase.dAvg,     df.radarNormalized.dAvg,     null],
            [_t('list.r.pOp',      '峰值操作'), df.components.pOp,      df.radarBase.pOp,      df.radarNormalized.pOp,      null],
            [_t('list.r.cChord',   '多押'),     df.components.cChord,   df.radarBase.cChord,   df.radarNormalized.cChord,   'chord'],
            [_t('list.r.cStair',   '楼梯'),     df.components.cStair,   df.radarBase.cStair,   df.radarNormalized.cStair,   'stair'],
            [_t('list.r.cJack',    '纵连'),     df.components.cJack,    df.radarBase.cJack,    df.radarNormalized.cJack,    'jack'],
            [_t('list.r.cScratch', '皿复合'),   df.components.cScratch, df.radarBase.cScratch, df.radarNormalized.cScratch, 'scratch']
        ];
        radarRows.forEach(function (r) {
            html += '<tr><td>' + r[0] + '</td>' +
                    '<td>' + fmt(r[1], 2) + '</td>' +
                    '<td>' + fmt(r[1] + df.radarOffset, 2) + '</td>' +
                    '<td>' + r[2] + '</td>' +
                    '<td>' + (r[4] ? prefLabel(r[4]) : '—') + '</td>' +
                    '<td>' + fmt(r[3], 2) + '</td></tr>';
        });
        html += '</tbody></table>';

        // 3) 键型实例统计
        html += '<h4>' + _t('list.h.patterns', '键型实例统计') + '</h4>';
        html += '<div class="data-row"><span class="data-key">' + _t('list.pattern.jacks', '纵连组数') + '</span><span class="data-val">' + patterns.jacks.length + '</span></div>';
        html += '<div class="data-row"><span class="data-key">' + _t('list.pattern.chords', '多押组数') + '</span><span class="data-val">' + patterns.chords.length + '</span></div>';
        html += '<div class="data-row"><span class="data-key">' + _t('list.pattern.stairs', '楼梯组数') + '</span><span class="data-val">' + patterns.stairs.length + '</span></div>';
        html += '<div class="data-row"><span class="data-key">' + _t('list.pattern.scratch', '皿复合小节数') + '</span><span class="data-val">' + patterns.scratchSegments.length + '</span></div>';

        // 4) 高密度区间明细
        html += '<h4>' + _t('list.h.regions', '高密度区间明细') +
                '（' + _t('list.h.regionsThresh', '阈值') + ' ' + fmt(d.highDensityThreshold, 2) + ' ' + nps + '）</h4>';
        if (d.highDensityRegions.length === 0) {
            html += '<p>' + _t('list.none', '无') + '</p>';
        } else {
            html += '<table><thead><tr>' +
                    '<th>' + _t('list.col.index', '#') + '</th>' +
                    '<th>' + _t('list.col.start', '起始') + '</th>' +
                    '<th>' + _t('list.col.end', '结束') + '</th>' +
                    '<th>' + _t('list.col.duration', '时长(秒)') + '</th>' +
                    '<th>' + _t('list.col.noteCount', '音符数') + '</th>' +
                    '<th>' + _t('list.col.avgDensity', '平均密度') + '</th>' +
                    '</tr></thead><tbody>';
            d.highDensityRegions.forEach(function (r, i) {
                html += '<tr><td>' + (i + 1) + '</td>' +
                        '<td>' + fmtTime(r.startTime) + ' (' + fmt(r.startTime, 2) + 's)</td>' +
                        '<td>' + fmtTime(r.endTime)   + ' (' + fmt(r.endTime,   2) + 's)</td>' +
                        '<td>' + fmt(r.duration, 2) + '</td>' +
                        '<td>' + r.noteCount + '</td>' +
                        '<td>' + fmt(r.avgDensity, 2) + '</td></tr>';
            });
            html += '</tbody></table>';
        }

        // 5) 左右手压力分配
        html += '<h4>' + _t('list.h.balance', '左右手压力分配（2 小节单位）') + '</h4>';
        html += '<div class="data-row"><span class="data-key">' + _t('list.balance.count', '压力不均段数') +
                '</span><span class="data-val">' + hb.unbalancedCount + ' / ' + hb.totalGroupCount + '</span></div>';
        if (hb.unbalancedRegions.length > 0) {
            html += '<table><thead><tr>' +
                    '<th>' + _t('list.col.section', '段') + '</th>' +
                    '<th>' + _t('list.col.barRange', '小节范围') + '</th>' +
                    '<th>' + _t('list.col.leftNotes', '左手音符') + '</th>' +
                    '<th>' + _t('list.col.rightNotes', '右手音符') + '</th>' +
                    '<th>' + _t('list.col.bias', '偏向') + '</th>' +
                    '</tr></thead><tbody>';
            hb.unbalancedRegions.forEach(function (g) {
                html += '<tr><td>' + (g.index + 1) + '</td>' +
                        '<td>#' + g.startBar + ' ~ #' + g.endBar + '</td>' +
                        '<td>' + g.leftCount + '</td>' +
                        '<td>' + g.rightCount + '</td>' +
                        '<td>' + (g.heavySide === 'left'
                            ? _t('list.bias.left', '偏左手')
                            : _t('list.bias.right', '偏右手')) + '</td></tr>';
            });
            html += '</tbody></table>';
        }

        el.innerHTML = html;
    }

    global.DashboardView = {
        renderMeta: renderMeta,
        renderDashboard: renderDashboard,
        renderDataList: renderDataList
    };

})(typeof window !== 'undefined' ? window : this);
