/* 資料載入：本地 CSV 或 Google Sheets（依 site-config.js 切換） */
(function(global){
  'use strict';

  // ============================================================
  // CSV parser（支援雙引號包字串、欄位內逗號、欄位內換行）
  // ============================================================
  function parseCSV(text) {
    const rows = [];
    let cur = [''];
    let inQuotes = false;
    let i = 0;
    const len = text.length;

    while (i < len) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur[cur.length - 1] += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        cur[cur.length - 1] += ch; i++;
      } else {
        if (ch === '"') { inQuotes = true; i++; }
        else if (ch === ',') { cur.push(''); i++; }
        else if (ch === '\n' || ch === '\r') {
          if (ch === '\r' && text[i + 1] === '\n') i++;
          rows.push(cur); cur = ['']; i++;
        } else { cur[cur.length - 1] += ch; i++; }
      }
    }
    if (cur.length > 1 || cur[0] !== '') rows.push(cur);

    if (rows.length === 0) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1)
      .filter(r => r.some(c => c !== ''))
      .map(r => {
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = (r[idx] != null ? String(r[idx]) : '').trim(); });
        return obj;
      });
  }

  // ============================================================
  // sheet 清單
  //   ALL_SHEETS  ── 系統認得的全部資料表
  //   PAGE_SHEETS ── 各頁實際需要的表
  // ============================================================
  const ALL_SHEETS = [
    'config', 'classes', 'course_dates', 'faqs', 'series',
    'keywords', 'about', 'refund', 'privacy', 'exp_hints', 'time_periods',
  ];

  // 新增一張 sheet 的步驟：
  //   1. 加進 ALL_SHEETS
  //   2. 加進需要它的頁面（PAGE_SHEETS），不需要的頁面就不會去抓
  //   3. 在該頁的 js 裡讀 data.<sheet 名> 並寫渲染邏輯
  //   ※ 只是查表用的對照表（code/label 之類）做到第 2 步就能用了
  const PAGE_SHEETS = {
    home:    ['config', 'about', 'series', 'keywords'],
    courses: ['config', 'classes', 'course_dates', 'series', 'exp_hints', 'time_periods'],
    info:    ['config', 'faqs', 'refund', 'privacy'],
  };

  // 選填表：不存在也不算致命錯誤。目前無。
  const OPTIONAL_SHEETS = [];

  // ============================================================
  // 來源路由：sheet 名 → URL
  //   headers=1 為必要參數。不帶時 gviz 會自行推斷表頭列數，
  //   一旦某欄前後列的儲存格型別不一致，會把資料列誤判為表頭。
  // ============================================================
  function sourceUrl(sheetName) {
    const sid = (global.SITE_CONFIG && global.SITE_CONFIG.GOOGLE_SHEETS_ID || '').trim();
    if (sid) {
      return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sid)}/gviz/tq` +
             `?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheetName)}`;
    }
    // 離線備援：Google 無法存取時，可手動把各表匯出成 CSV 放進 data/，
    // 並清空 site-config.js 的 GOOGLE_SHEETS_ID。
    return `data/${sheetName}.csv`;
  }

  // 同一次頁面載入內去重（多個 render 共用同一張表時不重複抓）
  const inflight = new Map();

  function loadSheet(sheetName) {
    if (inflight.has(sheetName)) return inflight.get(sheetName);
    const p = (async () => {
      const res = await fetch(sourceUrl(sheetName));
      if (!res.ok) throw new Error(`${sheetName}: HTTP ${res.status}`);
      return parseCSV(await res.text());
    })();
    inflight.set(sheetName, p);
    return p;
  }

  // ============================================================
  // 載入資料
  //   單張表失敗 → 該表視為空陣列，其餘照常渲染（降級，不是陣亡）
  //   全部表失敗 → 視為網路／權限問題，拋出讓頁面導向錯誤頁
  // ============================================================
  async function load(pageOrList) {
    const list = Array.isArray(pageOrList)
      ? pageOrList
      : (PAGE_SHEETS[pageOrList] || ALL_SHEETS);

    const settled = await Promise.allSettled(list.map(loadSheet));

    const byName = {};
    const failed = [];
    list.forEach((name, idx) => {
      const r = settled[idx];
      if (r.status === 'fulfilled') {
        byName[name] = r.value;
      } else {
        byName[name] = [];
        if (OPTIONAL_SHEETS.indexOf(name) === -1) failed.push(name);
        console.warn('[Sheet Load Failed]', name, r.reason);
      }
    });

    const required = list.filter(n => OPTIONAL_SHEETS.indexOf(n) === -1);
    if (failed.length === required.length && required.length > 0) {
      const err = new Error('all sheets failed');
      err.code = 'network';
      throw err;
    }

    const config = {};
    (byName.config || []).forEach(r => { if (r.key) config[r.key] = r.value; });

    // 每一張載入的表都以「原始 sheet 名」掛在回傳物件上，
    // 所以新增 sheet 時只需要動 ALL_SHEETS / PAGE_SHEETS，這裡不用改。
    // 下面幾個是既有程式碼在用的別名，保留以免改壞呼叫端。
    return Object.assign({}, byName, {
      config,
      failed,
      dates: byName.course_dates || [],
    });
  }

  // 保留舊介面
  function loadAll() { return load(ALL_SHEETS); }

  // ============================================================
  // 錯誤處理：把可辨識的原因帶進網址，錯誤頁對外仍顯示友善文案
  // ============================================================
  function handleLoadError(err) {
    console.error('[Data Load Error]', err);
    const code = (err && err.code) || 'data';
    const detail = (err && err.message ? String(err.message) : '').slice(0, 120);
    global.location.href = 'error.html?reason=' + encodeURIComponent(code) +
                           '&detail=' + encodeURIComponent(detail);
  }

  global.TBCSV = {
    parseCSV, loadSheet, load, loadAll, handleLoadError, sourceUrl,
    SHEETS: ALL_SHEETS, PAGE_SHEETS,
  };
})(window);
