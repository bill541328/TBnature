/* info 頁邏輯：FAQ / 退費 / 個資 / 聯絡綁定 */
(async function(){
  'use strict';

  let data;
  try {
    data = await TBCSV.load('info');
  } catch (err) {
    TBCSV.handleLoadError(err);
    return;
  }

  // 單一區塊渲染失敗不該讓整頁跳錯誤頁
  function step(name, fn) {
    try { fn(); } catch (e) { console.error('[Render Failed]', name, e); }
  }

  step('header',   () => TB.injectHeader(data.config));
  step('footer',   () => TB.injectFooter(data.config));
  step('text',     () => TB.applyText(data.config));
  step('faq',      () => renderFAQ(data.faqs));
  step('refund',   () => renderRefund(data.refund));
  step('privacy',  () => renderPrivacy(data.privacy));
  step('contacts', () => bindContacts(data.config));
  step('scroll',   () => TB.handleAnchorScroll());

  // ----------------------------------------------------------
  // FAQ Accordion
  // ----------------------------------------------------------
  function renderFAQ(faqs) {
    const container = document.querySelector('[data-faq-list]');
    if (!container || !faqs) return;
    container.innerHTML = '<div data-accordion></div>';
    const accordion = container.querySelector('[data-accordion]');

    const sorted = faqs.slice().sort(TB.byOrder('order'));
    accordion.innerHTML = sorted.map(f => `
      <details class="accordion__item">
        <summary>
          <span>
            <span class="accordion__category">${TB.escapeHTML(f.category)}</span>
            ${TB.escapeHTML(f.question)}
          </span>
        </summary>
        <div class="accordion__body">${formatMultiline(f.answer)}</div>
      </details>
    `).join('');

    TB.singleOpenAccordion('[data-accordion]');
  }

  // ----------------------------------------------------------
  // 退費規定 → <tbody> 內生成 <tr>
  // ----------------------------------------------------------
  function renderRefund(rows) {
    const tbody = document.querySelector('[data-refund-rows]');
    if (!tbody) return;
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '';
      return;
    }
    const sorted = rows.slice().sort(TB.byOrder());
    tbody.innerHTML = sorted.map(r => `
      <tr><td>${TB.escapeHTML(r.stage)}</td><td>${TB.escapeHTML(r.ratio)}</td></tr>
    `).join('');
  }

  // ----------------------------------------------------------
  // 個資聲明 → 每段一個 <h3> + <p>
  // ----------------------------------------------------------
  function renderPrivacy(rows) {
    const container = document.querySelector('[data-privacy-list]');
    if (!container) return;
    if (!rows || rows.length === 0) {
      container.innerHTML = '';
      return;
    }
    const sorted = rows.slice().sort(TB.byOrder());
    container.innerHTML = sorted.map((r, idx) => {
      const marginTop = idx === 0 ? '' : 'margin-top:24px;';
      return `
        <h3 style="font-size:18px;${marginTop}">${TB.escapeHTML(r.heading)}</h3>
        <p>${formatMultiline(r.body)}</p>
      `;
    }).join('');
  }

  function formatMultiline(text) {
    return TB.escapeHTML(text || '')
      .replace(/\\n/g, '\n')   // 向後相容舊資料的 \n 字面值
      .replace(/\n/g, '<br>');
  }

  function bindContacts(config) {
    const lineCta = document.getElementById('line-cta');
    if (lineCta) {
      lineCta.href = TB.safeUrl(config.line_oa_url);
      const idEl = lineCta.querySelector('[data-line-id]');
      if (idEl && config.line_oa_id) {
        idEl.textContent = config.line_oa_id;
        idEl.style.marginLeft = '8px';
        idEl.style.fontSize = '14px';
        idEl.style.opacity = '0.8';
      }
    }
    const emailCta = document.getElementById('email-cta');
    const email = TB.safeEmail(config.contact_email);
    if (emailCta && email) {
      emailCta.href = 'mailto:' + email;
      const eEl = emailCta.querySelector('[data-email]');
      if (eEl) {
        eEl.textContent = email;
        eEl.style.display = 'block';
        eEl.style.fontSize = '14px';
        eEl.style.opacity = '0.7';
        eEl.style.marginTop = '4px';
      }
    }
    const pdfCard = document.getElementById('pdf-card');
    if (pdfCard && config.pdf_url) {
      pdfCard.href = TB.safeUrl(config.pdf_url);
    }
  }
})();
