// ==UserScript==
// @name         LVS Direct PDF Opener
// @namespace    https://github.com/zhvial/UserScripts
// @version      1.4
// @description  Bypass embedded PDF reader and open/download PDF directly on lvs.lv
// @author       You
// @match        *://*.lvs.lv/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/zhvial/UserScripts/main/LVS%20Direct%20PDF%20Opener-1.4.js
// @downloadURL  https://raw.githubusercontent.com/zhvial/UserScripts/main/LVS%20Direct%20PDF%20Opener-1.4.js
// ==/UserScript==

(function() {
    'use strict';

    // 1. Создаем UI переключателя
    const toggleContainer = document.createElement('div');
    toggleContainer.style.position = 'fixed';
    toggleContainer.style.bottom = '20px';
    toggleContainer.style.right = '20px';
    toggleContainer.style.backgroundColor = '#ffffff';
    toggleContainer.style.border = '1px solid #ced4da';
    toggleContainer.style.padding = '10px 15px';
    toggleContainer.style.borderRadius = '8px';
    toggleContainer.style.zIndex = '999999';
    toggleContainer.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    toggleContainer.style.fontFamily = 'Helvetica, Arial, sans-serif';
    toggleContainer.style.fontSize = '14px';
    toggleContainer.style.display = 'flex';
    toggleContainer.style.alignItems = 'center';
    toggleContainer.style.color = '#333';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'lvs-pdf-toggle';
    checkbox.style.marginRight = '8px';
    checkbox.style.cursor = 'pointer';

    // Загружаем состояние из памяти
    const isDirect = localStorage.getItem('lvs_direct_pdf_mode') === 'true';
    checkbox.checked = isDirect;

    checkbox.addEventListener('change', (e) => {
        localStorage.setItem('lvs_direct_pdf_mode', e.target.checked);
    });

    const label = document.createElement('label');
    label.htmlFor = 'lvs-pdf-toggle';
    label.innerText = 'Direct PDF Mode';
    label.style.cursor = 'pointer';
    label.style.userSelect = 'none';

    toggleContainer.appendChild(checkbox);
    toggleContainer.appendChild(label);
    document.body.appendChild(toggleContainer);

    // 2. Перехват кликов
    document.addEventListener('click', async function(e) {
        if (!checkbox.checked) return;

        const target = e.target.closest('a');
        if (!target) return;

        const href = target.getAttribute('href');

        // Проверяем, ведет ли ссылка на страницу встроенного ридера
        if (href && href.includes('/library/read/')) {
            e.preventDefault();
            e.stopPropagation();

            const originalText = target.innerText;
            target.innerText = 'Loading PDF...';
            target.style.pointerEvents = 'none';
            target.style.opacity = '0.6';

            try {
                const fetchUrl = target.href;
                const response = await fetch(fetchUrl);
                const text = await response.text();

                // Ищем закодированную ссылку после "file=" внутри iframe
                // Пример: file=%2Flibrary%2FreadPdf%3Fid%3D19690%26doc%3D...
                const regex = /file=([^"'\s>]*readPdf[^"'\s>]*)/i;
                const match = text.match(regex);

                if (match) {
                    // Расшифровываем URL (меняем %2F на /, %3F на ? и т.д.)
                    const decodedPath = decodeURIComponent(match[1]);

                    // Формируем финальную абсолютную ссылку
                    const directUrl = window.location.origin + decodedPath;

                    // Перенаправляем
                    window.location.href = directUrl;
                } else {
                    console.warn('Direct PDF link not found in HTML. Falling back to default reader.');
                    window.location.href = fetchUrl;
                }
            } catch (err) {
                console.error('Error fetching PDF page:', err);
                window.location.href = target.href;
            } finally {
                if(target) {
                    target.innerText = originalText;
                    target.style.pointerEvents = 'auto';
                    target.style.opacity = '1';
                }
            }
        }
    }, true);
})();
