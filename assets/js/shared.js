/* 共用元件：Header / Footer / 工具 / Modal / Accordion / applyText */
(function(global){
  'use strict';

  // ============================================================
  // 工具函式
  // ============================================================
  function formatPrice(n) {
    const num = Number(n);
    if (isNaN(num)) return n;
    return 'NT$ ' + num.toLocaleString('en-US');
  }

  const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

  // 純字串處理。
  function formatDate(iso) {
    const m = ISO_DATE.exec(String(iso || '').trim());
    if (!m) return iso || '';
    return `${m[1]}/${m[2]}/${m[3]}`;
  }

  const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

  function weekdayOf(iso) {
    const m = ISO_DATE.exec(String(iso || '').trim());
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return '';
    return WEEKDAYS[d.getDay()];
  }

  // display_order 空值或非數字 → 排到最後
  function orderOf(v) {
    // 注意 Number('') === 0，空值不能直接丟給 Number 判斷
    if (v == null || String(v).trim() === '') return Number.MAX_SAFE_INTEGER;
    const n = Number(v);
    return isNaN(n) ? Number.MAX_SAFE_INTEGER : n;
  }

  function byOrder(field) {
    const f = field || 'display_order';
    return (a, b) => orderOf(a[f]) - orderOf(b[f]);
  }

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  // 試算表內容會進到 href。
  const SAFE_SCHEME = /^(?:https?:\/\/|mailto:|tel:|\/|\.\/|#)/i;
  function safeUrl(u) {
    const s = String(u == null ? '' : u).trim();
    if (!s) return '#';
    return SAFE_SCHEME.test(s) ? s : '#';
  }

  const EMAIL_RE = /^[^\s@<>"'`?&]+@[^\s@<>"'`?&]+\.[^\s@<>"'`?&]+$/;
  function safeEmail(e) {
    const s = String(e == null ? '' : e).trim();
    return EMAIL_RE.test(s) ? s : '';
  }

  // ============================================================
  // applyText：把 config 表內容套到頁面上
  // 若 config 中沒有對應 key，保留 HTML 內原文字當 fallback
  // ============================================================
  function applyText(config, root) {
    const scope = root || document;
    if (!config) return;

    scope.querySelectorAll('[data-cfg]').forEach(el => {
      const key = el.getAttribute('data-cfg');
      const v = config[key];
      if (v != null && v !== '') el.textContent = v;
    });

    scope.querySelectorAll('[data-cfg-ml]').forEach(el => {
      const key = el.getAttribute('data-cfg-ml');
      const v = config[key];
      if (v != null && v !== '') {
        el.innerHTML = escapeHTML(v).replace(/\n/g, '<br>');
      }
    });
  }

  // ============================================================
  // Header 注入
  // ============================================================
  function injectHeader(config) {
    const lineUrl = safeUrl(config && config.line_oa_url);
    // 站名改用文字 logo 圖，站名文字改掛在 alt（仍由 config.site_name 決定）
    const siteName = (config && config.site_name) || '虎甲自然';
    const header = document.createElement('header');
    header.className = 'site-header';
    header.innerHTML = `
      <div class="site-header__inner">
        <a href="index.html" class="site-header__logo" aria-label="${escapeHTML(siteName)}">
          <img src="assets/img/logo-head.png" alt="" class="site-header__logo-mark">
          <img src="assets/img/logo-word.png" alt="${escapeHTML(siteName)}" class="site-header__logo-word">
        </a>
        <nav class="site-header__nav">
          <a href="index.html"           data-cfg="nav_home">企業概述</a>
          <a href="courses.html"         data-cfg="nav_courses">課程介紹</a>
          <a href="info.html#contact"    data-cfg="nav_contact">聯絡我們</a>
          <a href="info.html#download"   data-cfg="nav_download">檔案下載</a>
        </nav>
        <a href="${escapeHTML(lineUrl)}" class="site-header__back" target="_blank" rel="noopener" data-cfg="nav_line">回到 LINE</a>
      </div>
    `;
    document.body.insertBefore(header, document.body.firstChild);
  }

  // ============================================================
  // Footer 注入
  // ============================================================
  function injectFooter(config) {
    const cfg = config || {};
    const lineUrl = safeUrl(cfg.line_oa_url);
    const lineId = cfg.line_oa_id || '';
    const email = safeEmail(cfg.contact_email);
    const pdfUrl = safeUrl(cfg.pdf_url);
    const lineLabel = (cfg.footer_line_label || '回到 LINE') + (lineId ? ' ' + lineId : '');

    const emailHTML = email
      ? `<a href="mailto:${escapeHTML(email)}">${escapeHTML(email)}</a>`
      : '';

    const footer = document.createElement('footer');
    footer.className = 'site-footer';
    footer.innerHTML = `
      <div class="site-footer__inner">
        <div class="site-footer__row">
          <a href="${escapeHTML(lineUrl)}" target="_blank" rel="noopener">${escapeHTML(lineLabel)}</a>
          ${emailHTML}
          <a href="${escapeHTML(pdfUrl)}" target="_blank" rel="noopener" data-cfg="footer_pdf_label">下載 PDF 簡章</a>
        </div>
        <div class="site-footer__copyright" data-cfg="footer_copyright">
          © 虎甲自然 Tiger Beetle Nature · 城市與自然的引路者
        </div>
      </div>
    `;
    document.body.appendChild(footer);
  }

  // ============================================================
  // 通用 Modal
  // ============================================================
  let modalEl = null;
  let lastFocused = null;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'modal';
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-labelledby', 'tb-modal-title');
    modalEl.innerHTML = `
      <div class="modal__sheet" role="document">
        <div class="modal__handle"></div>
        <button class="modal__close" aria-label="關閉">×</button>
        <h2 class="modal__title" id="tb-modal-title" data-modal-title></h2>
        <div data-modal-body></div>
      </div>
    `;
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });
    modalEl.querySelector('.modal__close').addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (!modalEl.hasAttribute('open')) return;
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key === 'Tab') trapFocus(e);
    });
    return modalEl;
  }

  const FOCUSABLE = 'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])';

  function trapFocus(e) {
    const items = Array.from(modalEl.querySelectorAll(FOCUSABLE))
      .filter(el => el.offsetParent !== null);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  function openModal(title, bodyHTML) {
    const m = ensureModal();
    lastFocused = document.activeElement;
    m.querySelector('[data-modal-title]').textContent = title || '';
    m.querySelector('[data-modal-body]').innerHTML = bodyHTML || '';
    m.setAttribute('open', '');
    document.body.classList.add('modal-open');
    const closeBtn = m.querySelector('.modal__close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modalEl) return;
    modalEl.removeAttribute('open');
    document.body.classList.remove('modal-open');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    lastFocused = null;
  }

  // ============================================================
  // Accordion：同時只展開一項
  // ============================================================
  function singleOpenAccordion(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    container.addEventListener('toggle', (e) => {
      const target = e.target;
      if (target.tagName !== 'DETAILS' || !target.open) return;
      container.querySelectorAll('details[open]').forEach(d => {
        if (d !== target) d.open = false;
      });
    }, true);
  }

  // ============================================================
  // anchor scroll
  // ============================================================
  function handleAnchorScroll(offset) {
    if (!location.hash) return;
    let target = null;
    try { target = document.querySelector(location.hash); } catch (e) { return; }
    if (!target) return;
    setTimeout(() => {
      const y = target.getBoundingClientRect().top + window.scrollY - (offset || 72);
      window.scrollTo({ top: y, behavior: 'smooth' });
    }, 100);
  }

  // ============================================================
  // 對外 API
  // ============================================================
  global.TB = {
    formatPrice, formatDate, weekdayOf, escapeHTML,
    safeUrl, safeEmail, orderOf, byOrder,
    applyText,
    injectHeader, injectFooter,
    openModal, closeModal,
    singleOpenAccordion,
    handleAnchorScroll,
  };
})(window);
