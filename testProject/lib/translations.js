/**
 * 翻译词表
 *
 * 结构：
 *   - languages: 支持的语言代码数组
 *   - default:   默认语言
 *   - entries:   词条列表，每个 entry 必含 key 和各语言的翻译
 *
 * 添加新词条：在 entries 数组中追加一项，并为每种语言提供翻译。
 * 添加新语言：在 languages 数组追加 ID,并为所有 entries 补充该语言的翻译。
 *
 * 找不到翻译时，页面保留 HTML 中原有的 textContent（即源文本）。
 *
 * 详见 translations/translations.md
 */
    (function (global) {
    'use strict';

    global.TRANSLATIONS = {
        languages: ['zh', 'en', 'ja'],
        default:   'zh',
        // 下拉框中显示的语言名称（自我语言书写）
        languageNames: {
            zh: '中文',
            en: 'English',
            ja: '日本語'
        },
        entries: [
            // ========== 静态 UI（HTML 中 data-i18n）==========

            // ---------- 头部 ----------
            { key: 'header.title',     zh: 'BMS谱面分析系统',                  en: 'BMS Chart Analyzer',                        ja: 'BMS譜面解析' },
            { key: 'header.subtitle',  zh: '7K谱面难度与键型分析工具',          en: '7K Difficulty & Pattern Analysis Tool',     ja: '7K譜面難易度・配置解析ツール' },
        
            // ---------- 语言切换 ----------
            { key: 'lang.label',       zh: '语言：',                           en: 'Language:',                                 ja: '言語：' },
        
            // ---------- 上传区 ----------
            { key: 'section.upload',   zh: '上传',                         en: 'Upload',                              ja: 'アップロード' },
            { key: 'upload.hint',      zh: '拖入或点击上传 .bms / .bme / .pms 文件', en: 'Drag & drop or click to upload .bms / .bme / .pms', ja: '.bms / .bme / .pms ファイルをドロップまたはクリックでアップロード' },
            { key: 'btn.upload',       zh: '选择文件',                         en: 'Browse',                                    ja: 'ファイル選択' },
        
            // ---------- 个人偏好 ----------
            { key: 'pref.title',       zh: '个人差',           en: 'Preferences',            ja: '個人差' },
            { key: 'pref.best',        zh: '最擅长的配置：',                    en: 'Best at:',                                  ja: '得意な配置：' },
            { key: 'pref.worst',       zh: '最不擅长的配置：',                  en: 'Worst at:',                                 ja: '苦手な配置：' },
            { key: 'pref.best.note',   zh: '原始值 × 0.8',                 en: 'Original value × 0.8',                         ja: '生値 × 0.8' },
            { key: 'pref.worst.note',  zh: '原始值 × 1.3',                 en: 'Original value × 1.3',                         ja: '生値 × 1.3' },
            { key: 'pref.opt.none',    zh: '无',                              en: 'None',                                      ja: 'なし' },
            { key: 'pref.opt.chord',   zh: '多押',                            en: 'Chord',                                     ja: '同時押し' },
            { key: 'pref.opt.jack',    zh: '纵连',                            en: 'Jack',                                      ja: '縦連打' },
            { key: 'pref.opt.stair',   zh: '楼梯',                            en: 'Stair',                                     ja: '階段' },
            { key: 'pref.opt.scratch', zh: '皿复合',                          en: 'Scratch Combo',                             ja: '皿複合' },
        
            // ---------- 导出栏 ----------
            { key: 'btn.export',       zh: '导出 PDF',                        en: 'Export PDF',                                ja: 'PDF出力' },
        
            // ---------- 章节标题 ----------
            { key: 'report.title',     zh: '谱面分析报告',                      en: 'Chart Analysis Report',                     ja: '譜面解析レポート' },
            { key: 'chapter.1',        zh: '第 1 章：难度曲线（小节粒度）',      en: 'Chapter 1: Density Curve (per bar)',         ja: '第1章：難易度曲線（小節単位）' },
            { key: 'chapter.2',        zh: '第 2 章：难度曲线（15 秒粒度）',     en: 'Chapter 2: Density Curve (per 15s)',         ja: '第2章：難易度曲線（15秒単位）' },
            { key: 'chapter.3',        zh: '第 3 章：雷达图',            en: 'Chapter 3: Six-Axis Difficulty Radar',       ja: '第3章：レーダー図' },
            { key: 'chapter.4',        zh: '第 4 章：总览',               en: 'Chapter 4: Overview Dashboard',              ja: '第4章：一覧' },
            { key: 'chapter.5',        zh: '第 5 章：完整列表',              en: 'Chapter 5: Full Data List',                  ja: '第5章：詳細' },
        
            // ---------- 雷达图说明 ----------
            { key: 'radar.note',
              zh: '归一化规则：每维度原始值 +10 偏移后；≤100 线性，>100 取 100 + 50·log₁₀(x/100)',
              en: 'Normalization: each value first +10 offset; ≤100 linear, >100 uses 100 + 50·log₁₀(x/100)',
              ja: '正規化規則：各値に+10オフセット；≤100線形、>100は100 + 50·log₁₀(x/100)' },


            // ========== 元信息卡片 ==========
            { key: 'meta.filename',    zh: '文件名',                          en: 'File',                                      ja: 'ファイル名' },
            { key: 'meta.title',       zh: '曲目标题',                         en: 'Title',                                     ja: 'タイトル' },
            { key: 'meta.artist',      zh: '艺术家',                          en: 'Artist',                                    ja: 'アーティスト' },
            { key: 'meta.bpm',         zh: 'BPM',                            en: 'BPM',                                       ja: 'BPM' },
            { key: 'meta.playlevel',   zh: '#PLAYLEVEL',                     en: '#PLAYLEVEL',                                ja: '#PLAYLEVEL' },
            { key: 'meta.totalBars',   zh: '总小节数',                         en: 'Total Bars',                                ja: '総小節数' },
            { key: 'meta.duration',    zh: '曲目时长',                         en: 'Duration',                                  ja: '楽曲時間' },
            { key: 'meta.notes',       zh: '总音符数',                         en: 'Total Notes',                               ja: '総ノーツ数' },
            { key: 'meta.bgmNotes',    zh: 'BGM 音符数',                      en: 'BGM Notes',                                 ja: 'BGMノーツ数' },


            // ========== 仪表盘卡片 ==========
            { key: 'dash.total',          zh: '总难度',                       en: 'Total Difficulty',                          ja: '総合難易度' },
            { key: 'dash.dAvg',           zh: '加权平均密度',                  en: 'Weighted Avg Density',                      ja: '加重平均密度' },
            { key: 'dash.pOp',            zh: '峰值操作要求',                  en: 'Peak Operation',                            ja: 'ピーク操作量' },
            { key: 'dash.peakDensity',    zh: '瞬时峰值密度',                  en: 'Peak Density',                              ja: '瞬間ピーク密度' },
            { key: 'dash.sustainedPeak',  zh: '持续峰值密度',                  en: 'Sustained Peak',                            ja: '持続ピーク密度' },
            { key: 'dash.threshold',      zh: '高密度区间阈值',                en: 'High-density Threshold',                    ja: '高密度区間閾値' },
            { key: 'dash.regions',        zh: '高密度区间数',                  en: 'High-density Regions',                      ja: '高密度区間数' },
            { key: 'dash.cChord',         zh: '多押复杂度',                    en: 'Chord Complexity',                          ja: '同時押し複雑度' },
            { key: 'dash.cStair',         zh: '楼梯复杂度',                    en: 'Stair Complexity',                          ja: '階段複雑度' },
            { key: 'dash.cJack',          zh: '纵连复杂度',                    en: 'Jack Complexity',                           ja: '縦連打複雑度' },
            { key: 'dash.cScratch',       zh: '皿复合复杂度',                  en: 'Scratch Combo Complexity',                  ja: '皿複合複雑度' },
            { key: 'dash.handBalance',    zh: '左右手压力不均段数',            en: 'L/R Imbalance Sections',                    ja: 'バランス偏り区間' },


            // ========== 单位 ==========
            { key: 'unit.notesPerSec',    zh: 'notes/秒',                    en: 'notes/sec',                                 ja: 'ノーツ/秒' },
            { key: 'unit.sec',            zh: '秒',                          en: 's',                                         ja: '秒' },
            { key: 'unit.seconds',        zh: ' 秒',                         en: ' s',                                        ja: ' 秒' },


            // ========== 数据列表 ==========
    
            // 区块标题
            { key: 'list.h.difficulty',   zh: '难度计算明细（加权和）',         en: 'Difficulty Calculation (Weighted Sum)',     ja: '難易度計算詳細（加重和）' },
            { key: 'list.h.radar',        zh: '雷达图归一化值',                en: 'Radar Normalized Values',                   ja: 'レーダー図正規化値' },
            { key: 'list.h.radarRange',   zh: '0~200，每维度先 +10 偏移再归一化，键型项再乘偏好倍率',
                                          en: '0~200, each value +10 offset before normalization, pattern items also multiplied by preference',
                                          ja: '0~200、各値に+10オフセット後正規化、配置項目には好み倍率を乗算' },
            { key: 'list.h.patterns',     zh: '键型实例统计',                  en: 'Pattern Instance Stats',                    ja: '配置インスタンス統計' },
            { key: 'list.h.regions',      zh: '高密度区间明细',                en: 'High-density Region Details',               ja: '高密度区間詳細' },
            { key: 'list.h.regionsThresh', zh: '阈值',                       en: 'threshold',                                 ja: '閾値' },
            { key: 'list.h.balance',      zh: '左右手压力分配（2 小节单位）',  en: 'L/R Hand Balance (per 2 bars)',             ja: '左右手バランス（2小節単位）' },
    
            // 表头
            { key: 'list.col.dim',        zh: '维度',                        en: 'Dimension',                                 ja: '次元' },
            { key: 'list.col.raw',        zh: '原始值',                      en: 'Raw',                                       ja: '生値' },
            { key: 'list.col.weight',     zh: '权重',                        en: 'Weight',                                    ja: '重み' },
            { key: 'list.col.weighted',   zh: '加权值',                      en: 'Weighted',                                  ja: '加重値' },
            { key: 'list.col.offset',     zh: '偏移后',                      en: 'After offset',                              ja: 'オフセット後' },
            { key: 'list.col.base',       zh: '基准值',                      en: 'Base',                                      ja: '基準値' },
            { key: 'list.col.prefMul',    zh: '偏好倍率',                    en: 'Pref. multiplier',                          ja: '好み倍率' },
            { key: 'list.col.normalized', zh: '归一化',                      en: 'Normalized',                                ja: '正規化' },
            { key: 'list.col.index',      zh: '#',                          en: '#',                                         ja: '#' },
            { key: 'list.col.start',      zh: '起始',                        en: 'Start',                                     ja: '開始' },
            { key: 'list.col.end',        zh: '结束',                        en: 'End',                                       ja: '終了' },
            { key: 'list.col.duration',   zh: '时长(秒)',                    en: 'Duration (s)',                              ja: '長さ(秒)' },
            { key: 'list.col.noteCount',  zh: '音符数',                      en: 'Notes',                                     ja: 'ノーツ数' },
            { key: 'list.col.avgDensity', zh: '平均密度',                    en: 'Avg Density',                               ja: '平均密度' },
            { key: 'list.col.section',    zh: '段',                          en: 'Sec.',                                      ja: '区間' },
            { key: 'list.col.barRange',   zh: '小节范围',                    en: 'Bar Range',                                 ja: '小節範囲' },
            { key: 'list.col.leftNotes',  zh: '左手',                    en: 'Left',                                      ja: '左手' },
            { key: 'list.col.rightNotes', zh: '右手',                    en: 'Right',                                     ja: '右手' },
            { key: 'list.col.bias',       zh: '偏向',                        en: 'Bias',                                      ja: '偏り' },
    
            // 行标签（带括号简称）
            { key: 'list.row.dAvg',       zh: '加权平均密度 (D_avg)',         en: 'Weighted Avg Density (D_avg)',              ja: '加重平均密度 (D_avg)' },
            { key: 'list.row.pOp',        zh: '峰值操作要求 (P_op)',          en: 'Peak Operation (P_op)',                     ja: 'ピーク操作量 (P_op)' },
            { key: 'list.row.cChord',     zh: '多押复杂度 (C_chord)',         en: 'Chord (C_chord)',                           ja: '同時押し (C_chord)' },
            { key: 'list.row.cStair',     zh: '楼梯复杂度 (C_stair)',         en: 'Stair (C_stair)',                           ja: '階段 (C_stair)' },
            { key: 'list.row.cJack',      zh: '纵连复杂度 (C_jack)',          en: 'Jack (C_jack)',                             ja: '縦連打 (C_jack)' },
            { key: 'list.row.cScratch',   zh: '皿复合复杂度 (C_scratch)',     en: 'Scratch Combo (C_scratch)',                 ja: '皿複合 (C_scratch)' },
            { key: 'list.row.total',      zh: '总难度',                      en: 'Total',                                     ja: '総合' },
    
            // 雷达表行（不带括号）
            { key: 'list.r.dAvg',         zh: '平均密度',                    en: 'Avg Density',                               ja: '平均密度' },
            { key: 'list.r.pOp',          zh: '峰值操作',                    en: 'Peak Op.',                                  ja: 'ピーク操作' },
            { key: 'list.r.cChord',       zh: '多押',                       en: 'Chord',                                     ja: '同時押し' },
            { key: 'list.r.cStair',       zh: '楼梯',                       en: 'Stair',                                     ja: '階段' },
            { key: 'list.r.cJack',        zh: '纵连',                       en: 'Jack',                                      ja: '縦連打' },
            { key: 'list.r.cScratch',     zh: '皿复合',                     en: 'Scratch Combo',                             ja: '皿複合' },
    
            // 数据行
            { key: 'list.balance.best',   zh: '最擅长',                      en: 'Best at',                                   ja: '得意' },
            { key: 'list.balance.worst',  zh: '最不擅长',                    en: 'Worst at',                                  ja: '苦手' },
            { key: 'list.balance.count',  zh: '压力不均段数',                 en: 'Imbalanced sections',                       ja: '偏り区間数' },
            { key: 'list.pattern.jacks',     zh: '纵连组数',                 en: 'Jack groups',                               ja: '縦連打グループ数' },
            { key: 'list.pattern.chords',    zh: '多押组数',                 en: 'Chord groups',                              ja: '同時押しグループ数' },
            { key: 'list.pattern.stairs',    zh: '楼梯组数',                 en: 'Stair groups',                              ja: '階段グループ数' },
            { key: 'list.pattern.scratch',   zh: '皿复合小节数',             en: 'Scratch Combo bars',                        ja: '皿複合小節数' },
            { key: 'list.bias.left',      zh: '偏左手',                     en: 'Left-biased',                               ja: '左手寄り' },
            { key: 'list.bias.right',     zh: '偏右手',                     en: 'Right-biased',                              ja: '右手寄り' },
            { key: 'list.none',           zh: '无',                        en: 'None',                                      ja: 'なし' },
    
            // 偏好显示
            { key: 'pref.factor.best',    zh: '×0.80',                     en: '×0.80',                                     ja: '×0.80' },
            { key: 'pref.factor.worst',   zh: '×1.30',                     en: '×1.30',                                     ja: '×1.30' },


            // ========== 密度曲线图 ==========
            { key: 'chart.legend.jack',    zh: '纵连',                      en: 'Jack',                                      ja: '縦連打' },
            { key: 'chart.legend.chord',   zh: '多押',                      en: 'Chord',                                     ja: '同時押し' },
            { key: 'chart.legend.stair',   zh: '楼梯',                      en: 'Stair',                                     ja: '階段' },
            { key: 'chart.legend.scratch', zh: '皿复合',                    en: 'Scratch Combo',                             ja: '皿複合' },
            { key: 'chart.legend.density', zh: '密度 (notes/秒)',            en: 'Density (notes/sec)',                       ja: '密度 (ノーツ/秒)' },
            { key: 'chart.xaxis.bar',      zh: '小节',                      en: 'Bar',                                       ja: '小節' },
            { key: 'chart.xaxis.segment',  zh: '15 秒段（时间区间）',         en: '15s segment (time range)',                  ja: '15秒区間（時間範囲）' },
            { key: 'chart.yaxis',          zh: '密度 / 键型贡献 (notes/秒)',  en: 'Density / Pattern (notes/sec)',             ja: '密度 / 配置寄与 (ノーツ/秒)' }
        ]
    };

})(typeof window !== 'undefined' ? window : this);
