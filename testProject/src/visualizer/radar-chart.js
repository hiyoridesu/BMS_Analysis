/**
 * RadarChartView — 六维难度雷达图
 *
 * 维度（轴）：
 *   D_avg / P_op / C_chord / C_stair / C_jack / C_scratch
 *
 * 值已由 DifficultyCalculator 归一化，范围 0~200：
 *   ≤100 表示常规范围
 *   100~200 表示对数压缩的超规范围
 *
 * 暴露：window.RadarChartView
 */
(function (global) {
    'use strict';

    function render(canvas, difficulty) {
        var r = difficulty.radarNormalized;
        var labels = ['NOTES', 'PEAK', 'SCRATCH+', 'STAIRS', 'STAMINA', 'CHORD'];
        var values = [r.dAvg, r.pOp, r.cScratch, r.cStair, r.cJack, r.cChord];

        return new Chart(canvas.getContext('2d'), {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: '归一化难度',
                    data: values,
                    backgroundColor: 'rgba(74, 95, 193, 0.25)',
                    borderColor: 'rgba(74, 95, 193, 1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    r: {
                        min: 0,
                        max: 200,
                        ticks: {
                            stepSize: 50,
                            backdropColor: 'rgba(0,0,0,0)'
                        },
                        pointLabels: { font: { size: 13 } },
                        grid: {
                            // 100 的轮廓线高对比度（更深、更粗），其余圈保持淡色
                            color: function (ctx) {
                                return ctx.tick && ctx.tick.value === 100
                                    ? 'rgba(44, 62, 80, 0.85)'
                                    : 'rgba(0, 0, 0, 0.1)';
                            },
                            lineWidth: function (ctx) {
                                return ctx.tick && ctx.tick.value === 100 ? 2 : 1;
                            }
                        },
                        angleLines: { color: 'rgba(0,0,0,0.1)' }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ctx.label + ': ' + ctx.parsed.r.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    }

    global.RadarChartView = { render: render };

})(typeof window !== 'undefined' ? window : this);
