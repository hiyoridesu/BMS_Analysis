/**
 * DensityChartView — 难度曲线图
 *
 * 单图同时呈现：
 *   - 密度折线（主曲线，左轴 notes/秒）
 *   - 难度堆叠柱状（4 键型堆叠，左轴）
 *   - 高密度区间在密度线上用红色标记
 *
 * 提供两种粒度：
 *   - 小节粒度（横轴：小节序号）
 *   - 15 秒段粒度（横轴：段起始时间）
 *
 * 暴露：window.DensityChartView
 */
(function (global) {
    'use strict';

    function _t(key, fallback) {
        if (typeof I18n !== 'undefined' && I18n.tt) return I18n.tt(key, fallback);
        return fallback != null ? fallback : key;
    }

    var COLOR = {
        density:    'rgba(74, 95, 193, 1)',
        densityBg:  'rgba(74, 95, 193, 0.15)',
        jack:       'rgba(231, 76, 60, 0.85)',
        chord:      'rgba(241, 196, 15, 0.85)',
        stair:      'rgba(46, 204, 113, 0.85)',
        scratch:    'rgba(155, 89, 182, 0.85)',
        peakPoint:  'rgba(231, 76, 60, 1)'
    };

    /**
     * 渲染小节粒度的难度曲线图
     * @param {HTMLCanvasElement} canvas
     * @param {object} result — 完整分析结果（包含 density / barStack / highDensityRegions）
     */
    function renderBarChart(canvas, result) {
        var barStack = result.barStack;
        var labels = barStack.map(function (b) { return '#' + b.bar; });
        var densities = barStack.map(function (b) { return b.density; });

        // 在密度折线上标出"高密度区间所覆盖的小节"
        var bars = result.density.barDensity;
        var regions = result.density.highDensityRegions;
        var peakPointStyle = bars.map(function (b) {
            var hit = regions.some(function (r) {
                return r.startTime < b.startTime + b.duration && r.endTime > b.startTime;
            });
            return {
                radius: hit ? 4 : 2,
                backgroundColor: hit ? COLOR.peakPoint : COLOR.density,
                borderColor: hit ? COLOR.peakPoint : COLOR.density
            };
        });

        var datasets = [
            {
                type: 'bar',
                label: _t('chart.legend.jack', '纵连'),
                data: barStack.map(function (b) { return b.jack; }),
                backgroundColor: COLOR.jack,
                stack: 'pattern',
                order: 2
            },
            {
                type: 'bar',
                label: _t('chart.legend.chord', '多押'),
                data: barStack.map(function (b) { return b.chord; }),
                backgroundColor: COLOR.chord,
                stack: 'pattern',
                order: 2
            },
            {
                type: 'bar',
                label: _t('chart.legend.stair', '楼梯'),
                data: barStack.map(function (b) { return b.stair; }),
                backgroundColor: COLOR.stair,
                stack: 'pattern',
                order: 2
            },
            {
                type: 'bar',
                label: _t('chart.legend.scratch', '皿复合'),
                data: barStack.map(function (b) { return b.scratch; }),
                backgroundColor: COLOR.scratch,
                stack: 'pattern',
                order: 2
            },
            {
                type: 'line',
                label: _t('chart.legend.density', '密度 (notes/秒)'),
                data: densities,
                borderColor: COLOR.density,
                backgroundColor: COLOR.densityBg,
                fill: false,
                tension: 0.25,
                pointRadius: peakPointStyle.map(function (s) { return s.radius; }),
                pointBackgroundColor: peakPointStyle.map(function (s) { return s.backgroundColor; }),
                pointBorderColor: peakPointStyle.map(function (s) { return s.borderColor; }),
                yAxisID: 'y',
                order: 1
            }
        ];

        return new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: makeOptions(_t('chart.xaxis.bar', '小节'), _t('chart.yaxis', '密度 / 键型贡献 (notes/秒)'))
        });
    }

    /**
     * 渲染 15 秒段粒度
     */
    function renderSegmentChart(canvas, result) {
        var segStack = result.segmentStack;
        var labels = segStack.map(function (s) {
            return formatTime(s.startTime) + '~' + formatTime(s.endTime);
        });
        var densities = segStack.map(function (s) { return s.density; });

        // 15 秒段中是否含高密度区间
        var regions = result.density.highDensityRegions;
        var pointStyle = segStack.map(function (s) {
            var hit = regions.some(function (r) {
                return r.startTime < s.endTime && r.endTime > s.startTime;
            });
            return {
                radius: hit ? 5 : 3,
                color: hit ? COLOR.peakPoint : COLOR.density
            };
        });

        var datasets = [
            { type: 'bar', label: _t('chart.legend.jack',    '纵连'),   data: segStack.map(function (s) { return s.jack; }),    backgroundColor: COLOR.jack,    stack: 'pattern', order: 2 },
            { type: 'bar', label: _t('chart.legend.chord',   '多押'),   data: segStack.map(function (s) { return s.chord; }),   backgroundColor: COLOR.chord,   stack: 'pattern', order: 2 },
            { type: 'bar', label: _t('chart.legend.stair',   '楼梯'),   data: segStack.map(function (s) { return s.stair; }),   backgroundColor: COLOR.stair,   stack: 'pattern', order: 2 },
            { type: 'bar', label: _t('chart.legend.scratch', '皿复合'), data: segStack.map(function (s) { return s.scratch; }), backgroundColor: COLOR.scratch, stack: 'pattern', order: 2 },
            {
                type: 'line',
                label: _t('chart.legend.density', '密度 (notes/秒)'),
                data: densities,
                borderColor: COLOR.density,
                backgroundColor: COLOR.densityBg,
                fill: false,
                tension: 0.25,
                pointRadius: pointStyle.map(function (p) { return p.radius; }),
                pointBackgroundColor: pointStyle.map(function (p) { return p.color; }),
                pointBorderColor: pointStyle.map(function (p) { return p.color; }),
                yAxisID: 'y',
                order: 1
            }
        ];

        return new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: { labels: labels, datasets: datasets },
            options: makeOptions(_t('chart.xaxis.segment', '15 秒段（时间区间）'), _t('chart.yaxis', '密度 / 键型贡献 (notes/秒)'))
        });
    }

    function makeOptions(xLabel, yLabel) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    stacked: true,
                    title: { display: true, text: xLabel },
                    ticks: { autoSkip: true, maxRotation: 60, minRotation: 0 }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: { display: true, text: yLabel }
                }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(2);
                        }
                    }
                }
            }
        };
    }

    function formatTime(t) {
        var m = Math.floor(t / 60);
        var s = Math.floor(t % 60);
        return m + ':' + (s < 10 ? '0' + s : s);
    }

    global.DensityChartView = {
        renderBarChart: renderBarChart,
        renderSegmentChart: renderSegmentChart
    };

})(typeof window !== 'undefined' ? window : this);
