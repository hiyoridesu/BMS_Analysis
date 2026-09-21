/**
 * main.js — 应用入口
 * 在 DOM 加载完成后初始化 UI Controller
 */
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', function () {
        if (typeof UIController !== 'undefined' && typeof UIController.init === 'function') {
            UIController.init();
        } else {
            console.error('[BMS Analyzer] UIController 未加载');
        }
    });
})();
