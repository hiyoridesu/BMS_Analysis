/**
 * I18n — 多语言翻译引擎
 *
 * 数据源：window.TRANSLATIONS（由 lib/translations.js 提供）
 *
 * API：
 *   I18n.init()                    — 初始化，读取 localStorage 中保存的语言（如有），否则用 default
 *   I18n.setLang(lang)             — 切换语言，自动 applyAll(document.body)
 *   I18n.getLang()                 — 当前语言代码
 *   I18n.t(key)                    — 拿到当前语言下的翻译；找不到返回 undefined
 *   I18n.applyAll(root)            — 扫描 root 下所有 [data-i18n]，按当前语言替换 textContent
 *   I18n.langs                     — 支持的语言列表
 *   I18n.languageNames             — 语言代码 → 显示名称的映射
 *
 * 找不到翻译时，applyAll 保留 HTML 中现有的 textContent（即原文，通常是 zh）。
 *
 * 暴露：window.I18n
 */
(function (global) {
    'use strict';

    var STORAGE_KEY = 'bms-analyzer-lang';

    var state = {
        currentLang: null,
        dict: {},       // { key → { zh, en, ja, ... } }
        listeners: []   // 语言变化时调用的回调列表
    };

    function getData() {
        return global.TRANSLATIONS || { languages: ['zh'], default: 'zh', entries: [] };
    }

    function buildDict() {
        var data = getData();
        var dict = {};
        (data.entries || []).forEach(function (entry) {
            if (entry && entry.key) {
                dict[entry.key] = entry;
            }
        });
        state.dict = dict;
    }

    function init() {
        buildDict();
        var data = getData();
        var saved = null;
        try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* ignore */ }
        if (saved && data.languages.indexOf(saved) !== -1) {
            state.currentLang = saved;
        } else {
            state.currentLang = data.default;
        }
    }

    function getLang() {
        return state.currentLang;
    }

    function setLang(lang) {
        var data = getData();
        if (data.languages.indexOf(lang) === -1) {
            console.warn('I18n: 未知语言', lang);
            return;
        }
        state.currentLang = lang;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
        applyAll(document.body);
        // 通知监听器（动态内容需重渲染）
        state.listeners.forEach(function (cb) {
            try { cb(lang); } catch (e) { console.error(e); }
        });
    }

    function onChange(cb) {
        if (typeof cb === 'function') state.listeners.push(cb);
    }

    function t(key) {
        var entry = state.dict[key];
        if (!entry) return undefined;
        return entry[state.currentLang];
    }

    /**
     * 翻译；找不到时回退到 fallback（默认为 key 自身）。
     * 用于 JS 动态生成内容时方便链式调用。
     */
    function tt(key, fallback) {
        var v = t(key);
        if (v != null) return v;
        return fallback != null ? fallback : key;
    }

    /**
     * 扫描 root 下所有 [data-i18n] 元素，替换其 textContent。
     * 元素首次被处理时，把原始 textContent 存到 data-i18n-original，
     * 后续切换语言时若 t(key) 找不到翻译，则回退到原始文本。
     */
    function applyAll(root) {
        if (!root || !root.querySelectorAll) return;
        var els = root.querySelectorAll('[data-i18n]');
        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            var key = el.getAttribute('data-i18n');
            if (!key) continue;
            // 缓存原始文本（用于无翻译时回退）
            if (el.getAttribute('data-i18n-original') == null) {
                el.setAttribute('data-i18n-original', el.textContent);
            }
            var translated = t(key);
            if (translated != null) {
                el.textContent = translated;
            } else {
                // 无翻译则回退到原始文本
                el.textContent = el.getAttribute('data-i18n-original');
            }
        }

        // 同时处理 <option> 内的 data-i18n（option 是 select 子元素，querySelectorAll 已覆盖）
        // 处理 [data-i18n-attr-*]：将翻译值写入指定属性（如 title / placeholder）
        var attrEls = root.querySelectorAll('[data-i18n-attr]');
        for (var j = 0; j < attrEls.length; j++) {
            var e2 = attrEls[j];
            var pair = e2.getAttribute('data-i18n-attr'); // 形如 "title:tip.upload"
            if (!pair) continue;
            var parts = pair.split(':');
            if (parts.length !== 2) continue;
            var attrName = parts[0].trim();
            var k2 = parts[1].trim();
            var tr = t(k2);
            if (tr != null) e2.setAttribute(attrName, tr);
        }
    }

    global.I18n = {
        init:           init,
        setLang:        setLang,
        getLang:        getLang,
        t:              t,
        tt:             tt,
        applyAll:       applyAll,
        onChange:       onChange,
        get langs()        { return getData().languages; },
        get languageNames(){ return getData().languageNames || {}; },
        get defaultLang()  { return getData().default; }
    };

})(typeof window !== 'undefined' ? window : this);
