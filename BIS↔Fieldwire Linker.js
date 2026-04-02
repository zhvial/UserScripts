// ==UserScript==
// @name         BIS↔Fieldwire Linker
// @namespace    https://github.com/zhvial/UserScripts
// @version      4.2
// @description  BIS #NNNN → Fieldwire task link. Sync task map, command tab, highlight active task.
// @author       Claude (Modified)
// @match        https://bis.gov.lv/*
// @match        https://app.fieldwire.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/zhvial/UserScripts/main/BIS↔Fieldwire%20Linker.js
// @downloadURL  https://raw.githubusercontent.com/zhvial/UserScripts/main/BIS↔Fieldwire%20Linker.js
// ==/UserScript==

(function() {
    'use strict';

    // ═══════════════════════════════════════════
    // STORAGE HELPERS
    // ═══════════════════════════════════════════

    function getConfig() {
        return JSON.parse(GM_getValue('bisfw_config', '{}'));
    }
    function setConfig(cfg) {
        GM_setValue('bisfw_config', JSON.stringify(cfg));
    }

    function getTaskMap(projectId) {
        return JSON.parse(GM_getValue('taskmap_' + projectId, '{}'));
    }
    function setTaskMap(projectId, map) {
        GM_setValue('taskmap_' + projectId, JSON.stringify(map));
    }

    function getLastSync(projectId) {
        return GM_getValue('lastsync_' + projectId, '');
    }
    function setLastSync(projectId, ts) {
        GM_setValue('lastsync_' + projectId, ts);
    }

    // ═══════════════════════════════════════════
    // FIELDWIRE SIDE
    // ═══════════════════════════════════════════

    if (location.hostname === 'app.fieldwire.com') {

        function getProjectId() {
            const m = location.pathname.match(/projects\/([0-9a-f-]{36})/i);
            return m ? m[1] : null;
        }

        function readTasksFromIDB(projectId) {
            return new Promise((resolve, reject) => {
                const req = indexedDB.open('keyval-store');
                req.onerror = () => reject(new Error('Cannot open IndexedDB'));
                req.onsuccess = () => {
                    const db = req.result;
                    const storeNames = Array.from(db.objectStoreNames);
                    const storeName = storeNames[0] || 'keyval';
                    try {
                        const tx = db.transaction(storeName, 'readonly');
                        const store = tx.objectStore(storeName);
                        const getAll = store.getAll();
                        const getAllKeys = store.getAllKeys();

                        tx.oncomplete = () => {
                            const keys = getAllKeys.result;
                            const values = getAll.result;
                            for (let i = 0; i < keys.length; i++) {
                                const key = String(keys[i]);
                                if (key.startsWith(projectId) && values[i] && values[i].models) {
                                    const models = values[i].models;
                                    const map = {};
                                    let count = 0;
                                    for (const uuid in models) {
                                        const t = models[uuid];
                                        if (t && t.sequence_number != null && t.id && !t.deleted_at) {
                                            map[String(t.sequence_number)] = t.id;
                                            count++;
                                        }
                                    }
                                    console.log(`[BIS↔FW] IDB atslēga: "${key}", atrasti ${count} taski`);
                                    resolve(map);
                                    return;
                                }
                            }
                            resolve(null);
                        };
                        tx.onerror = () => reject(new Error('IDB transaction failed'));
                    } catch(e) {
                        reject(e);
                    }
                };
            });
        }

        let panelStatus = null;

        function updatePanel(text, color) {
            if (!panelStatus) return;
            panelStatus.textContent = text;
            panelStatus.style.color = color || '#0f0';
        }

        async function syncFromIDB(projectId) {
            updatePanel('Lasa no IndexedDB...', '#ff9800');
            try {
                const map = await readTasksFromIDB(projectId);
                if (map && Object.keys(map).length > 0) {
                    setTaskMap(projectId, map);
                    setLastSync(projectId, new Date().toISOString());
                    updatePanel(`✓ ${Object.keys(map).length} taski no IDB`, '#0f0');
                } else {
                    updatePanel('Nav atrasti taski IDB', '#ff9800');
                }
            } catch(e) {
                updatePanel(`Kļūda: ${e.message}`, '#f44');
                console.error('[BIS↔FW]', e);
            }
        }

        function createFWPanel() {
            const projectId = getProjectId();
            if (!projectId) return;

            const panel = document.createElement('div');
            panel.id = 'bisfw-fw-panel';
            Object.assign(panel.style, {
                position: 'fixed', bottom: '10px', right: '10px', zIndex: '99999',
                background: '#1a1a2e', color: '#0f0', fontFamily: 'monospace', fontSize: '12px',
                padding: '10px 14px', borderRadius: '6px', border: '1px solid #0f0',
                boxShadow: '0 2px 12px rgba(0,255,0,0.2)', maxWidth: '360px'
            });

            const title = document.createElement('div');
            title.textContent = 'BIS↔FW';
            title.style.fontWeight = 'bold';
            title.style.marginBottom = '6px';
            panel.appendChild(title);

            panelStatus = document.createElement('div');
            panelStatus.style.fontSize = '11px';
            panelStatus.style.marginBottom = '6px';
            panel.appendChild(panelStatus);

            const btnSync = document.createElement('button');
            btnSync.textContent = '↻ Sinhronizēt no IDB';
            Object.assign(btnSync.style, {
                background: '#0f0', color: '#000', border: 'none', padding: '4px 12px',
                borderRadius: '3px', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold',
                width: '100%', marginBottom: '6px', display: 'block'
            });
            btnSync.onclick = () => syncFromIDB(projectId);
            panel.appendChild(btnSync);

            const btnTarget = document.createElement('button');
            let isTargetTab = sessionStorage.getItem('bisfw_is_target') === 'true';

            function updateTargetBtnUI() {
                if (isTargetTab) {
                    btnTarget.style.background = '#4caf50';
                    btnTarget.textContent = '✓ Lapa piesaistīta (Atsaukt)';
                } else {
                    btnTarget.style.background = '#2196f3';
                    btnTarget.textContent = '📍 Izmantot šo lapu atvēršanai';
                }
            }

            Object.assign(btnTarget.style, {
                color: '#fff', border: 'none', padding: '4px 12px',
                borderRadius: '3px', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold',
                width: '100%', display: 'block'
            });
            updateTargetBtnUI();

            btnTarget.onclick = () => {
                isTargetTab = !isTargetTab;
                if (isTargetTab) {
                    sessionStorage.setItem('bisfw_is_target', 'true');
                } else {
                    sessionStorage.removeItem('bisfw_is_target');
                }
                updateTargetBtnUI();
            };
            panel.appendChild(btnTarget);

            const close = document.createElement('span');
            close.textContent = ' ✕';
            close.style.cursor = 'pointer';
            close.style.marginLeft = '10px';
            close.style.color = '#888';
            close.style.cssFloat = 'right';
            close.onclick = () => panel.remove();
            title.appendChild(close);

            document.body.appendChild(panel);

            if (typeof GM_addValueChangeListener !== 'undefined') {
                GM_addValueChangeListener('bisfw_open_cmd', function(key, old_val, new_val, remote) {
                    if (isTargetTab && new_val && new_val.url) {
                        updatePanel('Atver uzdevumu...', '#2196f3');
                        window.location.href = new_val.url;
                    }
                });
            }

            const existing = getTaskMap(projectId);
            const lastSync = getLastSync(projectId);
            if (Object.keys(existing).length > 0) {
                updatePanel(`Kešā: ${Object.keys(existing).length} taski`, '#0f0');
            }
            syncFromIDB(projectId);
        }

        function initFWPanel() {
            setTimeout(createFWPanel, 5000);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initFWPanel);
        } else {
            initFWPanel();
        }
    }

    // ═══════════════════════════════════════════
    // BIS SIDE
    // ═══════════════════════════════════════════

    if (location.hostname === 'bis.gov.lv') {
        function initBIS() {

        function getBisCaseId() {
            const m = location.pathname.match(/bis_cases\/(\d+)/);
            return m ? m[1] : null;
        }

        function getActiveProject() {
            const config = getConfig();
            const caseId = getBisCaseId();
            if (caseId && config[caseId]) {
                GM_setValue('bisfw_active', config[caseId]);
                return config[caseId];
            }
            const stored = GM_getValue('bisfw_active', '');
            if (stored && Object.values(config).includes(stored)) return stored;
            const vals = Object.values(config);
            return vals.length > 0 ? vals[0] : null;
        }

        function showConfigDialog() {
            const caseId = getBisCaseId();
            const config = getConfig();

            const overlay = document.createElement('div');
            Object.assign(overlay.style, {
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                background: 'rgba(0,0,0,0.5)', zIndex: '999999', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
            });

            const dialog = document.createElement('div');
            Object.assign(dialog.style, {
                background: '#1a1a2e', color: '#0f0', fontFamily: 'monospace',
                padding: '20px', borderRadius: '8px', border: '1px solid #0f0',
                minWidth: '420px', boxShadow: '0 4px 20px rgba(0,255,0,0.3)'
            });

            const entries = Object.entries(config);
            const activeProj = getActiveProject();

            dialog.innerHTML = `
                <div style="font-weight:bold;margin-bottom:12px;font-size:14px">BIS↔FW Konfigurācija</div>
                <fieldset style="border:1px solid #333;padding:8px;margin-bottom:12px;border-radius:4px">
                    <legend style="color:#aaa;font-size:11px;padding:0 4px">Pievienot saiti</legend>
                    <input id="bisfw-case-input" type="text" value="${caseId || ''}" placeholder="BIS lietas nr"
                        style="width:100%;box-sizing:border-box;padding:5px;font-family:monospace;font-size:12px;
                        background:#111;color:#0f0;border:1px solid #333;border-radius:3px;margin-bottom:6px">
                    <input id="bisfw-project-input" type="text" placeholder="FW UUID: 3577e854-..."
                        value="${caseId && config[caseId] ? config[caseId] : ''}"
                        style="width:100%;box-sizing:border-box;padding:5px;font-family:monospace;font-size:12px;
                        background:#111;color:#0f0;border:1px solid #333;border-radius:3px;margin-bottom:6px">
                    <button id="bisfw-save" style="background:#0f0;color:#000;border:none;padding:4px 14px;
                        border-radius:3px;cursor:pointer;font-weight:bold">Saglabāt</button>
                </fieldset>
                <div id="bisfw-existing" style="margin-bottom:12px;font-size:11px;color:#888"></div>
                <button id="bisfw-cancel" style="background:transparent;color:#888;border:1px solid #333;
                    padding:4px 14px;border-radius:3px;cursor:pointer">Aizvērt</button>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const existingDiv = dialog.querySelector('#bisfw-existing');
            if (entries.length) {
                existingDiv.innerHTML = '<div style="margin-bottom:4px;color:#aaa">Saites:</div>' +
                    entries.map(([k, v]) => {
                        const taskCount = Object.keys(getTaskMap(v)).length;
                        const isActive = v === activeProj;
                        return `<div style="margin-bottom:2px;${isActive ? 'color:#0f0' : ''}">
                            ${isActive ? '▶' : '&nbsp;'} BIS ${k} → FW ${v.substring(0,8)}… (${taskCount} taski)
                            <span class="bisfw-activate" data-proj="${v}" style="color:#4caf50;cursor:pointer;margin-left:4px" title="Aktivizēt">✓</span>
                            <span class="bisfw-delete" data-case="${k}" style="color:#f44;cursor:pointer;margin-left:4px" title="Dzēst">✕</span>
                        </div>`;
                    }).join('');
            }

            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
            dialog.querySelector('#bisfw-cancel').onclick = () => overlay.remove();
            dialog.querySelector('#bisfw-save').onclick = () => {
                const caseVal = dialog.querySelector('#bisfw-case-input').value.trim();
                const projVal = dialog.querySelector('#bisfw-project-input').value.trim();
                if (caseVal && projVal) {
                    config[caseVal] = projVal;
                    setConfig(config);
                    GM_setValue('bisfw_active', projVal);
                    overlay.remove();
                    location.reload();
                }
            };
            dialog.querySelectorAll('.bisfw-delete').forEach(el => el.onclick = () => {
                delete config[el.dataset.case];
                setConfig(config);
                overlay.remove(); showConfigDialog();
            });
            dialog.querySelectorAll('.bisfw-activate').forEach(el => el.onclick = () => {
                GM_setValue('bisfw_active', el.dataset.proj);
                overlay.remove(); location.reload();
            });
        }

        GM_registerMenuCommand('BIS↔FW Konfigurācija', showConfigDialog);

        const projectId = getActiveProject();
        const taskMap = projectId ? getTaskMap(projectId) : {};
        const hasMap = Object.keys(taskMap).length > 0;
        const hashRegex = /(#\d+)/g;

        // Глобальная переменная для отслеживания активной ссылки
        let activeTaskNum = sessionStorage.getItem('bisfw_active_task') || null;

        function highlightHashes() {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            const nodesToReplace = [];

            let node;
            while (node = walker.nextNode()) {
                const parent = node.parentNode;
                if (parent && parent.nodeName !== 'SCRIPT' && parent.nodeName !== 'STYLE' && !parent.classList.contains('hash-link')) {
                    if (hashRegex.test(node.nodeValue)) nodesToReplace.push(node);
                }
            }

            nodesToReplace.forEach(n => {
                const fragment = document.createDocumentFragment();
                const parts = n.nodeValue.split(hashRegex);

                parts.forEach(part => {
                    if (hashRegex.test(part)) {
                        const num = part.replace('#', '');
                        const uuid = taskMap[num];
                        const span = document.createElement('span');
                        span.className = 'hash-link';
                        span.textContent = part;
                        span.dataset.taskNumber = num;
                        span.dataset.skipLinkableRow = 'true';

                        if (uuid && projectId) {
                            if (num === activeTaskNum) {
                                // Стиль для АКТИВНОЙ ссылки
                                Object.assign(span.style, {
                                    backgroundColor: '#2196f3', color: '#fff', cursor: 'pointer',
                                    padding: '0 4px', borderRadius: '3px', fontWeight: 'bold',
                                    boxShadow: '0 0 6px #2196f3'
                                });
                                span.title = `Aktīvais uzdevums FW: #${num}`;
                            } else {
                                // Стиль для ОБЫЧНОЙ ссылки
                                Object.assign(span.style, {
                                    backgroundColor: '#4caf50', color: '#fff', cursor: 'pointer',
                                    padding: '0 3px', borderRadius: '3px', fontWeight: 'bold',
                                    boxShadow: 'none'
                                });
                                span.title = `Nosūtīt FW uz devumu #${num}`;
                            }
                        } else if (hasMap) {
                            Object.assign(span.style, {
                                backgroundColor: '#ff9800', color: '#fff', cursor: 'default',
                                padding: '0 3px', borderRadius: '3px'
                            });
                            span.title = `#${num} nav atrasts Fieldwire`;
                        } else {
                            Object.assign(span.style, { backgroundColor: '#ffeb3b', cursor: 'pointer', padding: '0 2px', borderRadius: '3px' });
                            span.title = 'FW nav konfigurēts vai sinhronizēts';
                        }
                        fragment.appendChild(span);
                    } else if (part.length > 0) {
                        fragment.appendChild(document.createTextNode(part));
                    }
                });
                n.parentNode.replaceChild(fragment, n);
            });
        }

        function copyNumber(num, el) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(num).then(() => {
                    const orig = el.style.backgroundColor;
                    el.style.backgroundColor = '#8bc34a';
                    setTimeout(() => { el.style.backgroundColor = orig; }, 400);
                });
            }
        }

        // Обработка кликов
        ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'].forEach(eventType => {
            document.addEventListener(eventType, function(e) {
                if (e.target && e.target.classList.contains('hash-link')) {
                    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();

                    if (eventType === 'click') {
                        const num = e.target.dataset.taskNumber;
                        const uuid = taskMap[num];

                        if (uuid && projectId) {
                            const url = `https://app.fieldwire.com/projects/${projectId}/tasks/${uuid}`;

                            // 1. Отправляем команду выбранной вкладке через память
                            GM_setValue('bisfw_open_cmd', { url: url, ts: Date.now() });

                            // 2. Запоминаем номер как активный
                            activeTaskNum = num;
                            sessionStorage.setItem('bisfw_active_task', num);

                            // 3. Динамически обновляем цвета всех ссылок на странице
                            document.querySelectorAll('.hash-link').forEach(el => {
                                const elNum = el.dataset.taskNumber;
                                if (taskMap[elNum] && projectId) {
                                    if (elNum === activeTaskNum) {
                                        Object.assign(el.style, {
                                            backgroundColor: '#2196f3',
                                            boxShadow: '0 0 6px #2196f3',
                                            padding: '0 4px'
                                        });
                                        el.title = `Aktīvais uzdevums FW: #${elNum}`;
                                    } else {
                                        Object.assign(el.style, {
                                            backgroundColor: '#4caf50',
                                            boxShadow: 'none',
                                            padding: '0 3px'
                                        });
                                        el.title = `Nosūtīt FW uz devumu #${elNum}`;
                                    }
                                }
                            });

                        } else {
                            copyNumber(num, e.target);
                        }
                    }
                }
            }, true);
        });

        document.addEventListener('contextmenu', function(e) {
            if (e.target && e.target.classList.contains('hash-link')) {
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                copyNumber(e.target.dataset.taskNumber, e.target);
            }
        }, true);

        const indicator = document.createElement('div');
        Object.assign(indicator.style, {
            position: 'fixed', bottom: '10px', right: '10px', zIndex: '99999',
            fontFamily: 'monospace', fontSize: '11px', padding: '6px 10px',
            borderRadius: '4px', cursor: 'pointer'
        });

        if (projectId && hasMap) {
            const config = getConfig();
            const caseLabel = Object.entries(config).find(([k, v]) => v === projectId)?.[0] || '?';
            indicator.textContent = `FW ✓ BIS:${caseLabel} (${Object.keys(taskMap).length})`;
            indicator.style.background = '#1a1a2e'; indicator.style.color = '#0f0'; indicator.style.border = '1px solid #0f0';
        } else if (projectId) {
            indicator.textContent = 'FW ⚠ Nav sinhronizēts';
            indicator.style.background = '#1a1a2e'; indicator.style.color = '#ff9800'; indicator.style.border = '1px solid #ff9800';
        } else {
            indicator.textContent = 'FW ✕ Nav konfigurēts';
            indicator.style.background = '#1a1a2e'; indicator.style.color = '#f44'; indicator.style.border = '1px solid #f44';
        }

        indicator.onclick = showConfigDialog;
        document.body.appendChild(indicator);

        setTimeout(highlightHashes, 1500);

        const observer = new MutationObserver((mutations) => {
            let shouldHighlight = false;
            mutations.forEach(mutation => { if (mutation.addedNodes.length > 0) shouldHighlight = true; });
            if (shouldHighlight) highlightHashes();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        }

        if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initBIS); } else { initBIS(); }
    }
})();
