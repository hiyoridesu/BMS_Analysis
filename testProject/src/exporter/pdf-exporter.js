/**
 * PDFExporter — 使用 html2pdf.js 导出 #report 区域为 PDF
 *
 * 本项目规定 PDF 仅包含 2/3/4 章（15秒难度曲线 / 雷达图 / 总览仪表盘），
 * 并使用紧凑排版（缩小 padding、字号、图表高度），尝试单页/双页内排完。
 *
 * 文件名默认基于谱面文件名（去掉扩展名）+ "-分析报告.pdf"。
 *
 * 暴露：window.PDFExporter
 */
(function (global) {
    'use strict';

    // 要导出到 PDF 的章节（data-chapter 属性值）
    var EXPORTED_CHAPTERS = ['2', '3'];

    function defaultFileName(originalFileName) {
        if (!originalFileName) return '谱面分析报告.pdf';
        var base = originalFileName.replace(/\.[^.]+$/, '');
        return base + '-分析报告.pdf';
    }

    /**
     * 紧凑样式：在克隆出的 PDF 容器内生效
     * 两个图各占一页（A4 纵向），页内垂直+水平居中。
     * 隐藏所有标题、说明、卡片装饰。
     */
    var COMPACT_STYLE = [
        // 容器自身：白底，无外边距
        '.pdf-compact { background: #ffffff; margin: 0; padding: 0; font-size: 12px; }',
        // 卡片：去边框/阴影/padding
        '.pdf-compact .card { padding: 0; margin: 0; box-shadow: none; border: none; border-radius: 0; background: transparent; }',
        // 隐藏所有标题与说明
        '.pdf-compact h1, .pdf-compact h2, .pdf-compact h3, .pdf-compact h4 { display: none; margin: 0; padding: 0; }',
        '.pdf-compact .note { display: none; }',
        // 章节：每章占一页，高度略小于 A4 内容区 (277mm) 避免溢出空页；内容居中
        '.pdf-compact .chapter {' +
            ' height: 270mm;' +              /* A4 297mm - 上下边距 10mm = 277mm，留 7mm 安全余量 */
            ' display: flex;' +
            ' align-items: center;' +
            ' justify-content: center;' +
            ' page-break-after: always;' +
            ' break-after: page;' +
            ' page-break-inside: avoid;' +
            ' break-inside: avoid;' +
        ' }',
        '.pdf-compact .chapter:last-child {' +
            ' page-break-after: auto;' +
            ' break-after: auto;' +
            ' height: auto;' +              /* 最后一章不强制高度，避免末尾空白被算作新页 */
            ' min-height: 270mm;' +
        ' }',
        // 图表容器：占满章节宽度
        '.pdf-compact .chart-container { margin: 0; width: 100%; }',
        // 图像包装与图本身
        '.pdf-compact .chart-img-wrap { text-align: center; margin: 0; line-height: 0; width: 100%; }',
        '.pdf-compact .chart-img-wrap img { max-width: 100%; max-height: 260mm; height: auto; display: block; margin: 0 auto; }'
    ].join('\n');

    /**
     * 把克隆体内的每个 <canvas> 替换为它当前帧的 <img>。
     * 按 canvas 的 id 在源节点中查找对应 canvas，避免顺序错位
     * （克隆体内可能比源节点少 canvas，按下标会对错）。
     */
    function replaceCanvasWithImage(rootEl, sourceEl) {
        var clonedCanvases = rootEl.querySelectorAll('canvas');
        for (var i = 0; i < clonedCanvases.length; i++) {
            var clone = clonedCanvases[i];
            if (!clone || !clone.parentNode) continue;
            var srcCanvas = clone.id ? sourceEl.querySelector('#' + clone.id) : null;
            if (!srcCanvas) {
                console.warn('PDFExporter: 未找到对应源 canvas，id=', clone.id);
                continue;
            }
            try {
                var dataUrl = srcCanvas.toDataURL('image/png');
                var img = document.createElement('img');
                img.src = dataUrl;
                img.alt = clone.id || '';
                var wrap = document.createElement('div');
                wrap.className = 'chart-img-wrap';
                wrap.appendChild(img);
                clone.parentNode.replaceChild(wrap, clone);
            } catch (e) {
                console.warn('Canvas → image 转换失败：', e);
            }
        }
    }

    /**
     * 构建用于导出的隐藏容器。
     * 流程：
     *   1) 克隆 #report
     *   2) 移除非导出章节
     *   3) 替换克隆内 canvas 为 img（数据来自原 canvas）
     *   4) 套上 .pdf-compact 类 + 注入紧凑样式
     *   5) 把容器临时挂到 body（位置不可见但可被 html2canvas 读取）
     */
    function buildExportContainer(sourceReportEl) {
        var holder = document.createElement('div');
        holder.className = 'pdf-export-holder';
        holder.style.position = 'fixed';
        holder.style.left = '-99999px';
        holder.style.top = '0';
        holder.style.width = '800px'; // 给一个稳定的渲染宽度
        holder.style.background = '#ffffff';

        // 注入紧凑样式
        var style = document.createElement('style');
        style.textContent = COMPACT_STYLE;
        holder.appendChild(style);

        // 克隆 #report
        var clone = sourceReportEl.cloneNode(true);
        clone.classList.add('pdf-compact');
        // 移除非导出章节
        var chapters = clone.querySelectorAll('[data-chapter]');
        for (var i = 0; i < chapters.length; i++) {
            var key = chapters[i].getAttribute('data-chapter');
            if (EXPORTED_CHAPTERS.indexOf(key) === -1) {
                chapters[i].parentNode.removeChild(chapters[i]);
            }
        }
        // 替换 canvas 为 img
        replaceCanvasWithImage(clone, sourceReportEl);

        holder.appendChild(clone);
        document.body.appendChild(holder);
        return { holder: holder, clone: clone };
    }

    /**
     * 导出
     * @param {HTMLElement} sourceReportEl — 页面上的 #report 节点（不会被修改）
     * @param {string}      fileName       — 文件名（含 .pdf）
     * @param {function}    onProgress     — 进度回调（接收 string）
     * @returns Promise
     */
    function exportPDF(sourceReportEl, fileName, onProgress) {
        if (typeof html2pdf === 'undefined') {
            return Promise.reject(new Error('html2pdf.js 未加载'));
        }
        if (onProgress) onProgress('正在生成 PDF……');

        var built = buildExportContainer(sourceReportEl);

        var opt = {
            margin:       [10, 10, 10, 10],   // [top, left, bottom, right]：A4 四周各 10mm
            filename:     fileName,
            image:        { type: 'jpeg', quality: 0.95 },
            html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            // 每章一页：仅由 CSS page-break 控制（避免 JS 强制分页在末尾插入空页）
            pagebreak:    { mode: ['css'] }
        };

        return html2pdf().set(opt).from(built.clone).save().then(function () {
            // 清理临时节点
            if (built.holder.parentNode) {
                built.holder.parentNode.removeChild(built.holder);
            }
            if (onProgress) onProgress('PDF 已导出：' + fileName);
        }).catch(function (err) {
            if (built.holder.parentNode) {
                built.holder.parentNode.removeChild(built.holder);
            }
            throw err;
        });
    }

    global.PDFExporter = {
        exportPDF: exportPDF,
        defaultFileName: defaultFileName,
        EXPORTED_CHAPTERS: EXPORTED_CHAPTERS
    };

})(typeof window !== 'undefined' ? window : this);
