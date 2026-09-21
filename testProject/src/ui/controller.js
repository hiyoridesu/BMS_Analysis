/**
 * UIController — 页面交互与流程编排
 *
 * 流程：
 *   文件上传/拖拽 → 读取文本 → BMSParser → Normalizer
 *     → DensityAnalyzer / PatternDetector → SegmentAnalyzer → DifficultyCalculator
 *     → DensityChartView / RadarChartView / DashboardView 渲染
 *     → 等待用户点击"导出 PDF"
 *
 * 暴露：window.UIController
 */
(function (global) {
    'use strict';

    var elements = {};
    var charts = { barDensity: null, segmentDensity: null, radar: null };
    var lastResult = null;
    var lastFileName = null;
    var lastText = null;
    var lastFileInfo = null;

    function $(id) { return document.getElementById(id); }

    function showError(msg) {
        elements.errorMessage.textContent = msg || '';
    }
    function clearError() { showError(''); }

    function showFileInfo(file) {
        if (!file) {
            elements.fileInfo.textContent = '';
            return;
        }
        elements.fileInfo.textContent =
            '已加载：' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
    }

    function readFileAsText(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(reader.error); };
            // BMS 文件可能是 Shift_JIS 或 UTF-8。先尝试 UTF-8，失败再用 Shift_JIS。
            reader.readAsText(file, 'utf-8');
        }).then(function (text) {
            // 简单乱码检测：若包含大量 U+FFFD 替换字符，改用 shift_jis
            var replacementCount = (text.match(/�/g) || []).length;
            if (replacementCount > 10) {
                return new Promise(function (resolve, reject) {
                    var r2 = new FileReader();
                    r2.onload = function () { resolve(r2.result); };
                    r2.onerror = function () { reject(r2.error); };
                    r2.readAsText(file, 'shift_jis');
                });
            }
            return text;
        });
    }

    /**
     * 读取页面上的个人偏好
     */
    function readPreference() {
        var bestEl = $('best-pattern');
        var worstEl = $('worst-pattern');
        return {
            best:  bestEl  ? bestEl.value  : 'none',
            worst: worstEl ? worstEl.value : 'none'
        };
    }

    /**
     * 主分析流水线
     */
    function analyze(text, fileInfo) {
        var parsed = BMSParser.parse(text);
        var chart = Normalizer.normalize(parsed);
        if (!chart.notes || chart.notes.length === 0) {
            throw new Error('谱面中未检测到任何音符（通道 11~19 / 51~59）');
        }
        var density  = DensityAnalyzer.analyze(chart);
        var patterns = PatternDetector.detect(chart);
        var segment  = SegmentAnalyzer.analyze(chart, patterns);
        var preference = readPreference();
        var difficulty = DifficultyCalculator.calculate(chart, density, patterns, preference);
        var barStack     = DifficultyCalculator.buildBarStack(density, patterns);
        var segmentStack = DifficultyCalculator.buildSegmentStack(segment.segments);

        return {
            fileInfo: fileInfo,
            chart: chart,
            density: density,
            patterns: patterns,
            segment: segment,
            difficulty: difficulty,
            barStack: barStack,
            segmentStack: segmentStack,
            preference: preference
        };
    }

    function destroyOldCharts() {
        Object.keys(charts).forEach(function (k) {
            if (charts[k]) {
                try { charts[k].destroy(); } catch (e) { /* ignore */ }
                charts[k] = null;
            }
        });
    }

    function renderAll(result) {
        destroyOldCharts();
        DashboardView.renderMeta($('meta-info'), result);
        charts.barDensity     = DensityChartView.renderBarChart    ($('density-chart-bar'),     result);
        charts.segmentDensity = DensityChartView.renderSegmentChart($('density-chart-segment'), result);
        charts.radar          = RadarChartView.render($('radar-chart'), result.difficulty);
        DashboardView.renderDashboard($('dashboard'), result);
        DashboardView.renderDataList($('data-list'), result);
        $('result-section').style.display = '';
    }

    function handleFile(file) {
        clearError();
        if (!file) return;
        if (!/\.(bms|bme|pms)$/i.test(file.name)) {
            showError('请选择 .bms / .bme / .pms 文件');
            return;
        }
        showFileInfo(file);
        readFileAsText(file)
            .then(function (text) {
                var result = analyze(text, { name: file.name, size: file.size });
                lastResult = result;
                lastFileName = file.name;
                lastText = text;
                lastFileInfo = { name: file.name, size: file.size };
                renderAll(result);
            })
            .catch(function (err) {
                console.error(err);
                showError('分析失败：' + (err && err.message ? err.message : err));
                $('result-section').style.display = 'none';
            });
    }

    /**
     * 偏好选项变化时：若已分析过谱面，则重新分析并重绘
     */
    function onPreferenceChange() {
        if (!lastText) return;
        try {
            var result = analyze(lastText, lastFileInfo);
            lastResult = result;
            renderAll(result);
            clearError();
        } catch (err) {
            console.error(err);
            showError('应用偏好失败：' + (err && err.message ? err.message : err));
        }
    }

    function bindEvents() {
        elements.browseBtn.addEventListener('click', function () {
            elements.fileInput.click();
        });
        elements.fileInput.addEventListener('change', function (e) {
            handleFile(e.target.files[0]);
            elements.fileInput.value = ''; // 允许重复上传同一文件
        });

        // 偏好变化时，若已有分析结果，立即重算并重渲染（仅雷达图会变化）
        ['best-pattern', 'worst-pattern'].forEach(function (id) {
            var el = $(id);
            if (el) el.addEventListener('change', onPreferenceChange);
        });

        var dz = elements.dropZone;
        ['dragenter', 'dragover'].forEach(function (evt) {
            dz.addEventListener(evt, function (e) {
                e.preventDefault();
                e.stopPropagation();
                dz.classList.add('drag-over');
            });
        });
        ['dragleave', 'drop'].forEach(function (evt) {
            dz.addEventListener(evt, function (e) {
                e.preventDefault();
                e.stopPropagation();
                dz.classList.remove('drag-over');
            });
        });
        dz.addEventListener('drop', function (e) {
            var f = e.dataTransfer.files && e.dataTransfer.files[0];
            handleFile(f);
        });
        dz.addEventListener('click', function (e) {
            // 点击 dropZone 空白处（不是 button）也触发选择
            if (e.target.tagName !== 'BUTTON') {
                elements.fileInput.click();
            }
        });

        elements.exportBtn.addEventListener('click', function () {
            if (!lastResult) {
                showError('请先上传并分析谱面');
                return;
            }
            elements.exportBtn.disabled = true;
            var name = PDFExporter.defaultFileName(lastFileName);
            PDFExporter.exportPDF($('report'), name, function (msg) {
                elements.exportStatus.textContent = msg;
            }).catch(function (err) {
                console.error(err);
                showError('导出失败：' + (err && err.message ? err.message : err));
            }).then(function () {
                elements.exportBtn.disabled = false;
            });
        });
    }

    /**
     * 初始化语言切换下拉框
     */
    function setupLangSwitcher() {
        if (typeof I18n === 'undefined') return;
        I18n.init();
        var sel = $('lang-select');
        if (sel) {
            // 填充选项
            sel.innerHTML = '';
            I18n.langs.forEach(function (code) {
                var opt = document.createElement('option');
                opt.value = code;
                opt.textContent = I18n.languageNames[code] || code;
                if (code === I18n.getLang()) opt.selected = true;
                sel.appendChild(opt);
            });
            sel.addEventListener('change', function () {
                I18n.setLang(sel.value);
            });
        }
        // 启动时立即应用一次翻译
        I18n.applyAll(document.body);
        // 语言变化时，若已有分析结果，重新渲染（图表/仪表盘/数据列表中的文字会跟随语言变化）
        I18n.onChange(function () {
            if (lastResult) renderAll(lastResult);
        });
    }

    function init() {
        elements = {
            fileInput:    $('file-input'),
            browseBtn:    $('browse-btn'),
            dropZone:     $('drop-zone'),
            fileInfo:     $('file-info'),
            errorMessage: $('error-message'),
            exportBtn:    $('export-pdf-btn'),
            exportStatus: $('export-status')
        };
        setupLangSwitcher();
        bindEvents();
    }

    global.UIController = { init: init };

})(typeof window !== 'undefined' ? window : this);
