// ==UserScript==
// @name         Fieldwire Universal Viewer (360° & 2D High-Res)
// @namespace    https://github.com/zhvial/UserScripts
// @version      6.3
// @description  Раздельная сортировка: 360 по дате, 2D по порядку на экране
// @match        *://app.fieldwire.com/*
// @require      https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @connect      app.fieldwire.com
// @connect      files.us.fieldwire.com
// @connect      tsvabqmdcirbjnxq.s3.us-east-1.amazonaws.com
// @connect      s3.us-east-1.amazonaws.com
// @connect      s3.amazonaws.com
// @updateURL    https://raw.githubusercontent.com/zhvial/UserScripts/main/Fieldwire%20Universal%20Viewer%20(360°%20&%202D%20High-Res).js
// @downloadURL  https://raw.githubusercontent.com/zhvial/UserScripts/main/Fieldwire%20Universal%20Viewer%20(360°%20&%202D%20High-Res).js
// ==/UserScript==

(function() {
    'use strict';

    const MARKER = 'tm-viewer-btn-added';
    let viewerMode = '360';

    // ==========================================
    // 1. ПЕРЕХВАТ BEARER ТОКЕНА
    // ==========================================
    let bearerToken = null;

    const tokenInjectCode = function() {
        const origOpen = XMLHttpRequest.prototype.open;
        const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

        XMLHttpRequest.prototype.open = function(method, url) {
            this._fw_url = url;
            return origOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
            if (name && name.toLowerCase() === 'authorization' && value && value.startsWith('Bearer ') && this._fw_url && this._fw_url.includes('fieldwire.com')) {
                window.dispatchEvent(new CustomEvent('FW_BearerToken', { detail: value }));
            }
            return origSetHeader.apply(this, arguments);
        };
    };

    const tokenScript = document.createElement('script');
    tokenScript.textContent = '(' + tokenInjectCode.toString() + ')();';
    (document.head || document.documentElement).appendChild(tokenScript);
    tokenScript.remove();

    window.addEventListener('FW_BearerToken', function(e) {
        if (e.detail && e.detail !== bearerToken) { bearerToken = e.detail; }
    });

    // ==========================================
    // 2. СТИЛИ ИНТЕРФЕЙСА
    // ==========================================
    GM_addStyle(`
        @import url("https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css");

        #tm-intercept-toast { position: fixed; bottom: 30px; right: 30px; background: #333; color: white; padding: 12px 20px; border-radius: 8px; font-family: sans-serif; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 999999; display: none; align-items: center; gap: 12px; }
        .tm-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: tm-spin 1s linear infinite; }
        @keyframes tm-spin { to { transform: rotate(360deg); } }

        #tm-pano-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.92); z-index: 999999; display: none; align-items: center; justify-content: center; flex-direction: column; }
        #tm-pano-container { width: 85%; height: 80%; background: #000; position: relative; box-shadow: 0 0 30px rgba(0,0,0,0.9); border-radius: 8px; overflow: hidden; display: none; }

        #tm-2d-viewport { width: 100%; height: 100%; display: none; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; overflow: hidden; }
        #tm-2d-image { max-width: 100%; max-height: 100%; object-fit: contain; cursor: grab; user-select: none; }
        #tm-2d-image:active { cursor: grabbing; }

        #tm-pano-close { position: absolute; top: 15px; right: 25px; color: white; font-size: 40px; cursor: pointer; z-index: 10; font-family: sans-serif; text-shadow: 0 0 5px black; line-height: 1; }
        #tm-pano-close:hover { color: #ff5555; }

        #tm-pano-download { position: absolute; top: 22px; right: 80px; color: white; font-size: 14px; cursor: pointer; z-index: 10; font-family: sans-serif; font-weight: bold; background: rgba(255,255,255,0.2); padding: 8px 14px; border-radius: 4px; transition: background 0.2s; border: 1px solid rgba(255,255,255,0.4); }
        #tm-pano-download:hover { background: rgba(255,255,255,0.4); }

        #tm-pano-date { position: absolute; top: 18px; left: 18px; color: white; font-family: sans-serif; font-size: 15px; font-weight: bold; z-index: 10; background: rgba(0,0,0,0.55); padding: 6px 14px; border-radius: 20px; pointer-events: none; display: none; }
        #tm-pano-counter { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); color: white; font-family: sans-serif; font-size: 13px; z-index: 10; background: rgba(0,0,0,0.45); padding: 5px 12px; border-radius: 20px; pointer-events: none; display: none; }
        .tm-pano-nav { position: absolute; top: 50%; transform: translateY(-50%); color: white; font-size: 48px; cursor: pointer; z-index: 10; font-family: sans-serif; text-shadow: 0 0 8px black; line-height: 1; background: rgba(0,0,0,0.3); padding: 8px 14px; border-radius: 6px; transition: background 0.2s; user-select: none; }
        .tm-pano-nav:hover { background: rgba(0,0,0,0.65); }
        #tm-pano-prev { left: 12px; }
        #tm-pano-next { right: 12px; }
        .tm-pano-nav.disabled { display: none; }

        #tm-pano-timeline { width: 85%; margin-top: 12px; display: none; align-items: center; gap: 8px; overflow-x: auto; padding: 6px 4px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) transparent; }
        .tm-timeline-item { flex-shrink: 0; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .tm-timeline-thumb { width: 60px; height: 60px; object-fit: cover; border-radius: 5px; border: 2px solid rgba(255,255,255,0.3); transition: 0.2s; }
        .tm-timeline-item:hover .tm-timeline-thumb { border-color: #2196F3; transform: scale(1.08); }
        .tm-timeline-item.active .tm-timeline-thumb { border-color: #2196F3; transform: scale(1.1); }
        .tm-timeline-label { color: rgba(255,255,255,0.75); font-family: sans-serif; font-size: 10px; text-align: center; max-width: 64px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .tm-timeline-item.active .tm-timeline-label { color: #2196F3; font-weight: bold; }

        #tm-loading-text { color: white; font-family: sans-serif; margin-bottom: 20px; font-size: 18px; display: none; }
        #tm-pano-switching { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: none; align-items: center; justify-content: center; z-index: 20; font-family: sans-serif; color: white; font-size: 16px; flex-direction: column; gap: 14px; }
        #tm-pano-switching .tm-spinner { width: 32px; height: 32px; border-width: 3px; }
    `);

    // ==========================================
    // 3. СОЗДАНИЕ HTML ЭЛЕМЕНТОВ
    // ==========================================
    const loadingToast = document.createElement('div');
    loadingToast.id = 'tm-intercept-toast';
    loadingToast.innerHTML = '<div class="tm-spinner"></div><span id="tm-toast-msg">Preparing image...</span>';
    document.body.appendChild(loadingToast);

    const panoOverlay = document.createElement('div');
    panoOverlay.id = 'tm-pano-overlay';
    panoOverlay.innerHTML = `
        <div id="tm-loading-text">Loading image...</div>
        <div id="tm-pano-container">
            <div id="tm-pano-date"></div>
            <div id="tm-pano-counter"></div>
            <div id="tm-pano-download" title="Save original image">&#11015; Download</div>
            <div id="tm-pano-close" title="Close viewer">&times;</div>
            <div id="tm-pano-prev" class="tm-pano-nav" title="Previous photo">&#8249;</div>
            <div id="tm-pano-next" class="tm-pano-nav" title="Next photo">&#8250;</div>
            <div id="tm-pano-switching"><div class="tm-spinner"></div><span>Loading...</span></div>
            <div id="tm-panorama" style="width:100%;height:100%;"></div>
            <div id="tm-2d-viewport"><img id="tm-2d-image" draggable="false"></div>
        </div>
        <div id="tm-pano-timeline"></div>
    `;
    document.body.appendChild(panoOverlay);

    // ==========================================
    // 4. ЛОГИКА ЗУМА И ПАНОРАМИРОВАНИЯ
    // ==========================================
    const viewport2d = document.getElementById('tm-2d-viewport');
    const img2d = document.getElementById('tm-2d-image');
    let scale2d = 1, panX2d = 0, panY2d = 0, isDragging2d = false, startX2d, startY2d;

    const update2dTransform = () => { img2d.style.transform = `translate(${panX2d}px, ${panY2d}px) scale(${scale2d})`; };
    const reset2d = () => { scale2d = 1; panX2d = 0; panY2d = 0; update2dTransform(); };

    viewport2d.addEventListener('wheel', (e) => {
        if (viewerMode !== '2D') return;
        e.preventDefault();
        const rect = viewport2d.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
        const mouseX = e.clientX - centerX, mouseY = e.clientY - centerY;
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        const oldScale = scale2d;
        scale2d = Math.min(Math.max(0.2, scale2d + (scale2d * delta)), 30);
        const ratio = scale2d / oldScale;
        panX2d -= (mouseX - panX2d) * (ratio - 1);
        panY2d -= (mouseY - panY2d) * (ratio - 1);
        if (isDragging2d) { startX2d = e.clientX - panX2d; startY2d = e.clientY - panY2d; }
        update2dTransform();
    });

    viewport2d.addEventListener('mousedown', (e) => {
        if (viewerMode !== '2D') return;
        isDragging2d = true; startX2d = e.clientX - panX2d; startY2d = e.clientY - panY2d;
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging2d) return;
        panX2d = e.clientX - startX2d; panY2d = e.clientY - startY2d;
        update2dTransform();
    });
    window.addEventListener('mouseup', () => { isDragging2d = false; });
    viewport2d.addEventListener('mouseleave', () => { isDragging2d = false; });

    let viewer = null, currentGeneratedBlobUrl = null, currentDownloadUrl = null, photos = [], currentIndex = 0, isLoading = false;

    const elDate = document.getElementById('tm-pano-date'), elCounter = document.getElementById('tm-pano-counter'), elTimeline = document.getElementById('tm-pano-timeline'), elSwitching = document.getElementById('tm-pano-switching'), elPrev = document.getElementById('tm-pano-prev'), elNext = document.getElementById('tm-pano-next'), elContainer = document.getElementById('tm-pano-container'), elPanoView = document.getElementById('tm-panorama');

    const getProjectId = () => { const m = window.location.href.match(/projects\/([a-f0-9-]{36})/); return m ? m[1] : null; };
    const getTaskId = () => { const m = window.location.href.match(/tasks\/([a-f0-9-]{36})/); return m ? m[1] : null; };
    const bareUrl = (url) => url ? url.split('?')[0] : '';
    const formatLabel = (content) => {
        if (!content) return null;
        const iso = content.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/); if (iso) return iso[1] + ' ' + iso[2];
        const d1 = content.match(/(\d{4})[_.-]?(\d{2})[_.-]?(\d{2})/); if (d1) return d1[1] + '-' + d1[2] + '-' + d1[3];
        const d2 = content.match(/(\d{2})[._-](\d{2})[._-](\d{4})/); if (d2) return d2[3] + '-' + d2[2] + '-' + d2[1];
        return content.replace(/\.\w{2,5}$/, '').substring(0, 25);
    };

    const fetchAllBubbles = (projectId, taskId, callback) => {
        let allBubbles = [];
        let offset = 0;
        const limit = 50;
        const seenIds = new Set();

        const fetchNextPage = () => {
            const url = `/api/v3/projects/${projectId}/tasks/${taskId}/bubbles?limit=${limit}&offset=${offset}&nocache=${Date.now()}`;
            GM_xmlhttpRequest({
                method: 'GET', url: url,
                headers: { 'Accept': 'application/json', 'Authorization': bearerToken, 'fieldwire-platform': 'web', 'fieldwire-version': '2025-09-15' },
                onload: function(resp) {
                    if (resp.status === 200) {
                        try {
                            const data = JSON.parse(resp.responseText);
                            if (data && data.length > 0) {
                                const newItems = data.filter(d => !seenIds.has(d.id));
                                if (newItems.length === 0) { callback(allBubbles); return; }
                                newItems.forEach(d => seenIds.add(d.id));
                                allBubbles = allBubbles.concat(newItems);
                                if (data.length >= limit) { offset += limit; fetchNextPage(); }
                                else { callback(allBubbles); }
                            } else { callback(allBubbles); }
                        } catch(e) { callback(allBubbles); }
                    } else { callback(allBubbles); }
                },
                onerror: function() { callback(allBubbles); }
            });
        };
        fetchNextPage();
    };

    const fetchBubbleMeta = (callback) => {
        const projectId = getProjectId(), taskId = getTaskId();
        if (!projectId || !taskId) { callback([]); return; }
        if (!bearerToken) {
            let waited = 0;
            const wait = setInterval(() => {
                waited += 200;
                if (bearerToken) { clearInterval(wait); fetchAllBubbles(projectId, taskId, callback); }
                else if (waited >= 5000) { clearInterval(wait); callback([]); }
            }, 200);
            return;
        }
        fetchAllBubbles(projectId, taskId, callback);
    };

    const closePano = () => {
        panoOverlay.style.display = 'none';
        if (viewer) { viewer.destroy(); viewer = null; }
        if (currentGeneratedBlobUrl) { URL.revokeObjectURL(currentGeneratedBlobUrl); currentGeneratedBlobUrl = null; }
        img2d.src = ''; currentDownloadUrl = null; photos = []; currentIndex = 0; isLoading = false;
        elTimeline.innerHTML = ''; elTimeline.style.display = 'none'; elContainer.style.display = 'none';
    };

    document.getElementById('tm-pano-close').addEventListener('click', closePano);
    panoOverlay.addEventListener('click', (e) => { if (e.target === panoOverlay) closePano(); });
    document.addEventListener('keydown', (e) => {
        if (!panoOverlay.style.display || panoOverlay.style.display === 'none') return;
        if (e.key === 'Escape') closePano();
        if (e.key === 'ArrowLeft') navigateTo(currentIndex - 1);
        if (e.key === 'ArrowRight') navigateTo(currentIndex + 1);
    });

    document.getElementById('tm-pano-download').addEventListener('click', () => {
        if (!currentDownloadUrl) return;
        const a = document.createElement('a'); a.href = currentDownloadUrl; a.download = `FW_HighRes_${Date.now()}.jpg`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });

    elPrev.addEventListener('click', () => navigateTo(currentIndex - 1));
    elNext.addEventListener('click', () => navigateTo(currentIndex + 1));

    const updateNavUI = () => {
        elPrev.classList.toggle('disabled', currentIndex <= 0);
        elNext.classList.toggle('disabled', currentIndex >= photos.length - 1);
        if (photos.length > 1) { elCounter.textContent = `${currentIndex + 1} / ${photos.length}`; elCounter.style.display = 'block'; } else { elCounter.style.display = 'none'; }
        Array.from(elTimeline.querySelectorAll('.tm-timeline-item')).forEach((el, i) => { el.classList.toggle('active', i === currentIndex); });
        const active = elTimeline.querySelector('.tm-timeline-item.active');
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    };

    const showInViewer = (blobUrl, photo) => {
        currentDownloadUrl = photo.originalUrl || blobUrl;
        elDate.textContent = photo.label || ''; elDate.style.display = photo.label ? 'block' : 'none';
        document.getElementById('tm-loading-text').style.display = 'none';
        elContainer.style.display = 'block'; elSwitching.style.display = 'none'; isLoading = false;

        if (viewerMode === '360') {
            viewport2d.style.display = 'none'; elPanoView.style.display = 'block';
            if (viewer) viewer.destroy();
            viewer = window.pannellum.viewer('tm-panorama', { type: 'equirectangular', panorama: blobUrl, autoLoad: true, mouseZoom: true, keyboardZoom: true, showControls: true });
        } else {
            elPanoView.style.display = 'none'; viewport2d.style.display = 'flex';
            if (viewer) { viewer.destroy(); viewer = null; }
            img2d.src = blobUrl; reset2d();
        }
        updateNavUI();
    };

    const fetchAndShowReal = (fetchUrl, photo) => {
        if (fetchUrl.startsWith('blob:')) {
            showInViewer(fetchUrl, photo);
            buildTimeline();
            return;
        }

        const cleanUrl = fetchUrl.replace(/[?&]download(=true)?/g, '').replace(/[?&]$/, '') + (fetchUrl.includes('?') ? '&' : '?') + 'nocache=' + Date.now();
        GM_xmlhttpRequest({
            method: 'GET', url: cleanUrl, responseType: 'blob',
            onload: function(response) {
                if (response.status === 200) {
                    currentGeneratedBlobUrl = URL.createObjectURL(response.response);
                    showInViewer(currentGeneratedBlobUrl, photo);
                    buildTimeline();
                } else { alert(`Failed to load (HTTP ${response.status})`); elSwitching.style.display = 'none'; isLoading = false; }
            },
            onerror: function() { alert('Network error. Check your connection or CORS settings.'); elSwitching.style.display = 'none'; isLoading = false; }
        });
    };

    const findOriginalFileLink = (element) => {
        const all = Array.from(element.querySelectorAll('a, button'));
        const byAttr = all.find(el => el.querySelector('[translate="ORIGINAL_FILE"]'));
        if (byAttr) return byAttr;
        return all.find(el => /original\s*file/i.test(el.textContent)) || null;
    };

    const fetchAndShow = (index) => {
        if (isLoading) return;
        isLoading = true; currentIndex = index;
        const photo = photos[index];
        elSwitching.style.display = 'flex';

        if (currentGeneratedBlobUrl) { URL.revokeObjectURL(currentGeneratedBlobUrl); currentGeneratedBlobUrl = null; }

        if (photo.originalUrl) {
            fetchAndShowReal(photo.originalUrl, photo);
        } else {
            const origLink = findOriginalFileLink(photo.row);
            if (origLink) {
                window.dispatchEvent(new CustomEvent('ActivateViewerTrap', { detail: { mode: viewerMode, targetIndex: index } }));
                origLink.click();
            } else {
                const menuBtn = photo.row.querySelector('.dropdown-toggle, [data-toggle="dropdown"]');
                if (menuBtn) {
                    menuBtn.click();
                    setTimeout(() => {
                        const linkAfterOpen = findOriginalFileLink(photo.row);
                        if (linkAfterOpen) {
                            window.dispatchEvent(new CustomEvent('ActivateViewerTrap', { detail: { mode: viewerMode, targetIndex: index } }));
                            linkAfterOpen.click();
                            menuBtn.click();
                        } else {
                            alert('Could not find original quality. Please try manually.');
                            elSwitching.style.display = 'none'; isLoading = false;
                        }
                    }, 150);
                } else {
                    alert('Could not open menu automatically.');
                    elSwitching.style.display = 'none'; isLoading = false;
                }
            }
        }
    };

    const navigateTo = (index) => {
        if (index < 0 || index >= photos.length) return;
        if (index === currentIndex && viewer && !isLoading) return;
        fetchAndShow(index);
    };

    const buildTimeline = () => {
        elTimeline.innerHTML = '';
        if (photos.length <= 1) { elTimeline.style.display = 'none'; return; }
        elTimeline.style.display = 'flex';
        photos.forEach((photo, i) => {
            const item = document.createElement('div');
            item.className = 'tm-timeline-item' + (i === currentIndex ? ' active' : '');
            const thumb = document.createElement('img');
            thumb.className = 'tm-timeline-thumb'; thumb.src = photo.thumbSrc; thumb.onerror = function() { this.style.background = '#444'; };
            const lbl = document.createElement('div');
            lbl.className = 'tm-timeline-label'; lbl.textContent = photo.label || `Photo ${i + 1}`;
            item.appendChild(thumb); item.appendChild(lbl);
            item.addEventListener('click', () => navigateTo(i));
            elTimeline.appendChild(item);
        });
    };

    const collectDomRows = (clickedMenu) => {
        const clickedRow = clickedMenu.closest('.downloadable-image');
        if (!clickedRow) return [];
        let container = clickedRow.parentElement;
        let found = [clickedRow];
        for (let depth = 0; depth < 10; depth++) {
            if (!container) break;
            const siblings = Array.from(container.querySelectorAll('.downloadable-image'));
            if (siblings.length > found.length) found = siblings;
            if (siblings.length > 1) break;
            container = container.parentElement;
        }
        return found;
    };

    const buildPhotoList = (domRows, bubbles) => {
        return domRows.map(row => {
            const img = row.querySelector('img.image');
            const thumbSrc = img ? img.src : '';
            const bareSrc = bareUrl(thumbSrc);

            let bubble = bubbles.find(b => b.thumb_url && bareUrl(b.thumb_url) === bareSrc);

            if (!bubble) {
                const fileName = bareSrc.split('/').pop() || '';
                const uuidMatch = fileName.match(/([a-f0-9]{32}|[a-f0-9-]{36})/);
                if (uuidMatch) {
                    const hash = uuidMatch[1];
                    bubble = bubbles.find(b =>
                        (b.thumb_url && b.thumb_url.includes(hash)) ||
                        (b.original_url && b.original_url.includes(hash)) ||
                        (b.file_url && b.file_url.includes(hash))
                    );
                }
            }

            let origUrl = bubble ? (bubble.original_url || bubble.file_url) : null;
            if (!origUrl && thumbSrc && !thumbSrc.includes('-thumb')) { origUrl = thumbSrc; }

            return {
                thumbSrc: thumbSrc,
                originalUrl: origUrl,
                label: bubble ? formatLabel(bubble.content || bubble.name || '') : null,
                createdAt: bubble ? bubble.created_at : null, // Если нет даты, будет null
                row: row
            };
        }).filter(p => p.thumbSrc);
    };

    const openViewer = (menu) => {
        const projectId = getProjectId();
        const taskId = getTaskId();
        const domRows = collectDomRows(menu);

        if (!projectId || !taskId || domRows.length === 0) {
            const origLink = findOriginalFileLink(menu);
            if (origLink) { window.dispatchEvent(new CustomEvent('ActivateViewerTrap', { detail: { mode: viewerMode } })); origLink.click(); }
            return;
        }

        panoOverlay.style.display = 'flex'; elContainer.style.display = 'block'; elSwitching.style.display = 'flex';
        document.getElementById('tm-loading-text').style.display = 'none';

        const clickedRow = menu.closest('.downloadable-image');

        fetchBubbleMeta((bubbles) => {
            photos = buildPhotoList(domRows, bubbles);

            if (photos.length === 0) {
                closePano();
                const origLink = findOriginalFileLink(menu);
                if (origLink) { window.dispatchEvent(new CustomEvent('ActivateViewerTrap', { detail: { mode: viewerMode } })); origLink.click(); }
                return;
            }

            // ИЗМЕНЕНИЕ: Сортируем по дате ТОЛЬКО если открыт режим 360
            if (viewerMode === '360') {
                photos.sort((a, b) => {
                    if (!a.createdAt) return 1;
                    if (!b.createdAt) return -1;
                    return new Date(a.createdAt) - new Date(b.createdAt);
                });
            }

            currentIndex = photos.findIndex(p => p.row === clickedRow);
            if (currentIndex < 0) currentIndex = 0;

            buildTimeline(); fetchAndShow(currentIndex);
        });
    };

    // ==========================================
    // 9. СОБЫТИЯ ОТ ИНЖЕКТА И СИНХРОНИЗАЦИЯ
    // ==========================================
    window.addEventListener('ShowLoadingToast', () => {
        document.getElementById('tm-toast-msg').innerText = viewerMode === '360' ? 'Preparing 360 view...' : 'Preparing high-res image...';
        loadingToast.style.display = 'flex';
    });
    window.addEventListener('HideLoadingToast', () => loadingToast.style.display = 'none');

    window.addEventListener('OpenViewer', function(e) {
        loadingToast.style.display = 'none';
        if (e.detail && e.detail.url) {
            viewerMode = e.detail.mode || '360';
            panoOverlay.style.display = 'flex'; elContainer.style.display = 'block'; elSwitching.style.display = 'flex';

            if (e.detail.targetIndex !== undefined && e.detail.targetIndex !== null && photos[e.detail.targetIndex]) {
                photos[e.detail.targetIndex].originalUrl = e.detail.url;
                fetchAndShowReal(e.detail.url, photos[e.detail.targetIndex]);
            } else {
                fetchAndShowReal(e.detail.url, { label: null, originalUrl: e.detail.url });
            }
        }
    });

    // ==========================================
    // 10. ДОБАВЛЕНИЕ КНОПОК В МЕНЮ
    // ==========================================
    const tryInjectButtons = (menu) => {
        if (menu.querySelector('.' + MARKER)) return;
        if (!findOriginalFileLink(menu)) return;

        const divider = document.createElement('li');
        divider.className = `divider ng-star-inserted ${MARKER}`;
        divider.setAttribute('role', 'separator');

        const btn360 = document.createElement('li');
        btn360.className = `ng-star-inserted ${MARKER}`;
        btn360.innerHTML = `
            <a class="dropdown-item" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
                <span class="ng-star-inserted" style="color:#2196F3;font-weight:bold;">View in 360&deg;</span>
                <span style="font-size:16px;">&#x1F504;</span>
            </a>
        `;

        const btn2D = document.createElement('li');
        btn2D.className = `ng-star-inserted ${MARKER}`;
        btn2D.innerHTML = `
            <a class="dropdown-item" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;">
                <span class="ng-star-inserted" style="color:#4CAF50;font-weight:bold;">View original quality</span>
                <span style="font-size:16px;">&#x1F50D;</span>
            </a>
        `;

        menu.prepend(btn360, btn2D, divider);

        const attachLogic = (button, mode) => {
            button.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const dropdown = menu.closest('.dropdown, .open, [class*="dropdown"]');
                if (dropdown) dropdown.classList.remove('open');
                menu.style.display = 'none';
                setTimeout(() => { menu.style.display = ''; }, 100);

                viewerMode = mode;
                openViewer(menu);
            });
        };

        attachLogic(btn360, '360');
        attachLogic(btn2D, '2D');
    };

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType === 1) {
                if (node.matches && node.matches('ul.dropdown-menu, [role="menu"]')) tryInjectButtons(node);
                if (node.querySelectorAll) node.querySelectorAll('ul.dropdown-menu, [role="menu"]').forEach(tryInjectButtons);
            }
        }));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // ==========================================
    // 11. ИНЖЕКТ ШПИОНА В СТРАНИЦУ
    // ==========================================
    const injectCode = function() {
        window._forceViewer = false;
        window._trapMode = '360';
        window._trapIndex = null;
        let timeoutId = null;

        window.addEventListener('ActivateViewerTrap', function(e) {
            window._forceViewer = true;
            window._trapMode = (e.detail && e.detail.mode) ? e.detail.mode : '360';
            window._trapIndex = (e.detail && e.detail.targetIndex !== undefined) ? e.detail.targetIndex : null;
            window.dispatchEvent(new CustomEvent('ShowLoadingToast'));

            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                window._forceViewer = false;
                window.dispatchEvent(new CustomEvent('HideLoadingToast'));
            }, 15000);
        });

        function intercept(url) {
            if (timeoutId) clearTimeout(timeoutId);
            window._forceViewer = false;
            window.dispatchEvent(new CustomEvent('HideLoadingToast'));
            window.dispatchEvent(new CustomEvent('OpenViewer', { detail: { url: url, mode: window._trapMode, targetIndex: window._trapIndex } }));
        }

        const isTarget = (url) => url && (url.includes('fieldwire.com') || url.startsWith('blob:'));

        const origClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function() {
            if (window._forceViewer && isTarget(this.href)) { intercept(this.href); return; }
            return origClick.apply(this, arguments);
        };

        const origDispatch = EventTarget.prototype.dispatchEvent;
        EventTarget.prototype.dispatchEvent = function(event) {
            if (window._forceViewer && event.type === 'click' && this.tagName === 'A' && isTarget(this.href)) {
                intercept(this.href); return false;
            }
            return origDispatch.apply(this, arguments);
        };

        const origOpen = window.open;
        window.open = function(url) {
            if (window._forceViewer && isTarget(url)) { intercept(url); return null; }
            return origOpen.apply(this, arguments);
        };
    };

    const script = document.createElement('script');
    script.textContent = '(' + injectCode.toString() + ')();';
    (document.head || document.documentElement).appendChild(script);
    script.remove();

})();
