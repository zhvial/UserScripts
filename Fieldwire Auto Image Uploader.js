// ==UserScript==
// @name         Fieldwire Auto Image Uploader (Pro Editor v12.4)
// @namespace    https://github.com/zhvial/UserScripts
// @version      12.4
// @description  Advanced canvas editor with precise inputs, smart wait, fallbacks, Circle tool, Orthogonal lines (Shift), Cloud tool, Shortcuts. Fixed key event bubbling.
// @match        https://app.fieldwire.com/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/zhvial/UserScripts/main/Fieldwire%20Auto%20Image%20Uploader.js
// @downloadURL  https://raw.githubusercontent.com/zhvial/UserScripts/main/Fieldwire%20Auto%20Image%20Uploader.js
// ==/UserScript==

(function() {
    'use strict';

    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let isSimulatingPaste = false;

    // --- SMART WAIT FUNCTION ---
    async function waitForElement(selectors, timeout = 4000) {
        const start = Date.now();
        while (Date.now() - start < timeout) {
            for (let sel of selectors) {
                const el = document.querySelector(sel);
                if (el) return el;
            }
            await sleep(50);
        }
        return null;
    }

    // --- AUTOMATION SEQUENCE ---
    async function performUpload(imageFile) {
        console.log("Fieldwire Script: Starting automated upload sequence...");

        const paperclipSelectors = [
            'button[data-e2e="task-edit-attachments-button"]',
            'button[data-e2e*="attachments-button"]',
            'button[title="Attachments"]',
            'button[aria-label="Attachments"]'
        ];
        const paperclipBtn = await waitForElement(paperclipSelectors, 3000);
        if (!paperclipBtn) {
            alert("Fieldwire Auto-Uploader: Ошибка! Не удалось найти кнопку 'Скрепка'. Возможно, сайт обновился.");
            return;
        }
        paperclipBtn.click();

        const photoMenuSelectors = [
            'div[translate="PHOTO_FILE"]',
            '[data-e2e*="photo-file"]',
            '[data-e2e*="attachment-menu"] div'
        ];
        const photoMenuText = await waitForElement(photoMenuSelectors, 3000);
        if (!photoMenuText) {
            alert("Fieldwire Auto-Uploader: Ошибка! Не удалось найти выпадающее меню 'Фото/Файл'.");
            return;
        }
        (photoMenuText.closest('.pointer') || photoMenuText).click();

        await sleep(500);

        isSimulatingPaste = true;
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(imageFile);
        const pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dataTransfer });
        (document.activeElement || document.body).dispatchEvent(pasteEvent);

        setTimeout(() => { isSimulatingPaste = false; }, 500);

        const uploadBtnSelectors = [
            'button[data-e2e="file-upload-modal-component-upload-btn-button"]',
            'button[data-e2e*="upload-btn"]',
            'button[data-e2e*="upload"]'
        ];
        let uploadBtn = null;
        const startWait = Date.now();
        while (Date.now() - startWait < 5000) {
            for (let sel of uploadBtnSelectors) {
                const el = document.querySelector(sel);
                if (el && !el.disabled) {
                    uploadBtn = el;
                    break;
                }
            }
            if (uploadBtn) break;
            await sleep(100);
        }

        if (uploadBtn) {
            uploadBtn.click();
        } else {
             alert("Fieldwire Auto-Uploader: Ошибка! Кнопка 'Upload' не найдена или осталась заблокированной (серая).");
        }
    }

    // --- DRAWING UI COMPONENT ---
    function openDrawingEditor(file) {
        let savedSettings = JSON.parse(localStorage.getItem('fw_editor_settings') || '{}');
        let currentTool = savedSettings.tool || 'pen';
        let currentColor = savedSettings.color || '#ff0000';
        let currentSize = savedSettings.size || 4;
        let currentOpacity = savedSettings.opacity || 1.0;

        function saveSettings() {
            localStorage.setItem('fw_editor_settings', JSON.stringify({
                tool: currentTool,
                color: currentColor,
                size: currentSize,
                opacity: currentOpacity
            }));
        }

        let history = [];
        let historyStep = -1;
        let activeTextCommit = null;
        let lastTextCommitTime = 0;
        let penPoints = [];

        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.85); z-index: 999999;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
        `;
        const canvas = document.createElement('canvas');

        modal.addEventListener('mousedown', (e) => {
            if (activeTextCommit && e.target.id !== 'fw-canvas-text-input') {
                activeTextCommit();
                if (e.target === canvas) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            }
        }, true);

        const toolbar = document.createElement('div');
        toolbar.style.cssText = `
            background: #fff;
            padding: 10px; border-radius: 8px; margin-bottom: 10px;
            display: flex; gap: 10px; align-items: center; font-family: sans-serif; flex-wrap: wrap; justify-content: center;
        `;

        const canvasContainer = document.createElement('div');
        canvasContainer.style.position = 'relative';

        canvas.style.cssText = `
            max-width: 90vw;
            max-height: 75vh;
            border: 2px solid #fff; cursor: crosshair; background: #fff; display: block;
        `;
        const ctx = canvas.getContext('2d');

        function saveState() {
            historyStep++;
            history.length = historyStep;
            history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            updateUndoRedoButtons();
        }

        const btnUndo = document.createElement('button');
        btnUndo.textContent = '↩️ Atcelt';
        btnUndo.style.cssText = `padding: 5px 10px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: #fff;`;
        btnUndo.onclick = () => {
            if (historyStep > 0) {
                historyStep--;
                ctx.putImageData(history[historyStep], 0, 0);
                updateUndoRedoButtons();
            }
        };

        const btnRedo = document.createElement('button');
        btnRedo.textContent = '↪️ Atkārtot';
        btnRedo.style.cssText = `padding: 5px 10px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: #fff;`;
        btnRedo.onclick = () => {
            if (historyStep < history.length - 1) {
                historyStep++;
                ctx.putImageData(history[historyStep], 0, 0);
                updateUndoRedoButtons();
            }
        };

        function updateUndoRedoButtons() {
            btnUndo.disabled = historyStep <= 0;
            btnUndo.style.opacity = historyStep <= 0 ? '0.5' : '1';
            btnRedo.disabled = historyStep >= history.length - 1;
            btnRedo.style.opacity = historyStep >= history.length - 1 ? '0.5' : '1';
        }

        toolbar.appendChild(btnUndo);
        toolbar.appendChild(btnRedo);

        const separator1 = document.createElement('div');
        separator1.style.cssText = 'width: 2px; height: 20px; background: #ccc; margin: 0 5px;';
        toolbar.appendChild(separator1);

        const tools = [
            { id: 'pen', icon: '🖌️ Brīvi' },
            { id: 'line', icon: '📏 Līnija' },
            { id: 'arrow', icon: '↗️ Bultiņa' },
            { id: 'rect', icon: '⬜ Taisnstūris' },
            { id: 'cloud', icon: '☁️ Mākonis' },
            { id: 'circle', icon: '⭕ Aplis' },
            { id: 'text', icon: '🅰️ Teksts' }
        ];

        const toolBtns = {};
        tools.forEach(t => {
            const btn = document.createElement('button');
            btn.textContent = t.icon;
            btn.style.cssText = `padding: 5px 10px; cursor: pointer; border: 1px solid #ccc; border-radius: 4px; background: ${t.id === currentTool ? '#e0e0e0' : '#fff'};`;
            btn.onclick = () => {
                currentTool = t.id;
                Object.values(toolBtns).forEach(b => b.style.background = '#fff');
                btn.style.background = '#e0e0e0';
                saveSettings();
            };
            toolBtns[t.id] = btn;
            toolbar.appendChild(btn);
        });

        const separator2 = document.createElement('div');
        separator2.style.cssText = 'width: 2px; height: 20px; background: #ccc; margin: 0 5px;';
        toolbar.appendChild(separator2);

        const quickColors = [
            '#ff0000', '#00ff00', '#0000ff', '#ffff00',
            '#ffa500', '#00ffff', '#800080', '#000000'
        ];

        const quickColorsContainer = document.createElement('div');
        quickColorsContainer.style.cssText = 'display: flex; gap: 4px; align-items: center; margin-right: 5px;';

        quickColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.title = color;
            swatch.style.cssText = `
                width: 20px; height: 20px; background-color: ${color};
                border: 1px solid #888; border-radius: 3px; cursor: pointer;
                box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            `;
            swatch.onclick = () => {
                currentColor = color;
                colorPicker.value = color;
                saveSettings();
            };
            quickColorsContainer.appendChild(swatch);
        });

        toolbar.appendChild(quickColorsContainer);

        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = currentColor;
        colorPicker.style.cursor = 'pointer';
        colorPicker.title = 'Izvēlēties citu krāsu';
        colorPicker.onchange = (e) => {
            currentColor = e.target.value;
            saveSettings();
        };
        toolbar.appendChild(colorPicker);

        const separator3 = document.createElement('div');
        separator3.style.cssText = 'width: 2px; height: 20px; background: #ccc; margin: 0 5px;';
        toolbar.appendChild(separator3);

        const sizeWrapper = document.createElement('div');
        sizeWrapper.style.cssText = 'display:flex; align-items:center; gap:5px; margin-left:5px; font-size:14px;';
        sizeWrapper.innerHTML = '<span title="Līnijas biezums un teksta izmērs">📏 Izmērs:</span>';

        const sizeSlider = document.createElement('input');
        sizeSlider.type = 'range';
        sizeSlider.min = '1'; sizeSlider.max = '20'; sizeSlider.value = currentSize;
        sizeSlider.style.width = '60px';

        const sizeInput = document.createElement('input');
        sizeInput.type = 'number';
        sizeInput.min = '1'; sizeInput.max = '20'; sizeInput.value = currentSize;
        sizeInput.style.cssText = 'width: 40px; text-align: center; border: 1px solid #ccc; border-radius: 4px; font-family: sans-serif;';

        sizeSlider.oninput = (e) => {
            currentSize = parseInt(e.target.value);
            sizeInput.value = currentSize;
            saveSettings();
        };
        sizeInput.onchange = (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 20) val = 20;
            currentSize = val;
            sizeInput.value = val;
            sizeSlider.value = val;
            saveSettings();
        };

        sizeWrapper.appendChild(sizeSlider);
        sizeWrapper.appendChild(sizeInput);
        toolbar.appendChild(sizeWrapper);

        const opacityWrapper = document.createElement('div');
        opacityWrapper.style.cssText = 'display:flex; align-items:center; gap:5px; margin-left:5px; font-size:14px;';
        opacityWrapper.innerHTML = '<span title="Zīmējuma caurspīdīgums (neattiecas uz tekstu)">💧 Caurspīd.:</span>';

        const opacitySlider = document.createElement('input');
        opacitySlider.type = 'range';
        opacitySlider.min = '0.1'; opacitySlider.max = '1.0'; opacitySlider.step = '0.1'; opacitySlider.value = currentOpacity;
        opacitySlider.style.width = '60px';

        const opacityInput = document.createElement('input');
        opacityInput.type = 'number';
        opacityInput.min = '0.1'; opacityInput.max = '1.0'; opacityInput.step = '0.1'; opacityInput.value = currentOpacity;
        opacityInput.style.cssText = 'width: 45px; text-align: center; border: 1px solid #ccc; border-radius: 4px; font-family: sans-serif;';

        opacitySlider.oninput = (e) => {
            currentOpacity = parseFloat(e.target.value);
            opacityInput.value = currentOpacity;
            saveSettings();
        };
        opacityInput.onchange = (e) => {
            let val = parseFloat(e.target.value);
            if (isNaN(val) || val < 0.1) val = 0.1;
            if (val > 1.0) val = 1.0;
            currentOpacity = val;
            opacityInput.value = val;
            opacitySlider.value = val;
            saveSettings();
        };

        opacityWrapper.appendChild(opacitySlider);
        opacityWrapper.appendChild(opacityInput);
        toolbar.appendChild(opacityWrapper);

        const controls = document.createElement('div');
        controls.style.cssText = 'margin-top: 15px; display: flex; gap: 15px;';

        const btnCancel = document.createElement('button');
        btnCancel.textContent = '❌ Atcelt';
        btnCancel.style.cssText = 'padding: 10px 20px; font-size: 16px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;';

        const btnUpload = document.createElement('button');
        btnUpload.textContent = '💾 Saglabāt un pievienot';
        btnUpload.style.cssText = 'padding: 10px 20px; font-size: 16px; background: #4caf50; color: white; border: none; border-radius: 5px; cursor: pointer;';

        controls.appendChild(btnCancel);
        controls.appendChild(btnUpload);

        canvasContainer.appendChild(canvas);
        modal.appendChild(toolbar);
        modal.appendChild(canvasContainer);
        modal.appendChild(controls);
        document.body.appendChild(modal);

        // --- ИСПРАВЛЕННЫЙ ПЕРЕХВАТ КЛАВИШ ---
        const handleKeyDown = (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();

            if (document.activeElement && document.activeElement.id === 'fw-canvas-text-input') {
                return;
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }

            if (e.ctrlKey || e.metaKey) {
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        if (!btnRedo.disabled) btnRedo.click();
                    } else {
                        if (!btnUndo.disabled) btnUndo.click();
                    }
                } else if (e.key.toLowerCase() === 'y') {
                    e.preventDefault();
                    if (!btnRedo.disabled) btnRedo.click();
                }
            }
        };

        // ВАЖНО: { capture: true }
        document.addEventListener('keydown', handleKeyDown, true);

        const closeEditor = () => {
            document.removeEventListener('keydown', handleKeyDown, true);
            document.body.removeChild(modal);
        };
        // ------------------------------------

        const reader = new FileReader();
        reader.onload = function(event) {
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.globalAlpha = 1.0;
                ctx.drawImage(img, 0, 0);
                saveState();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);

        let isDrawing = false;
        let startX, startY;
        let snapshot;

        function getMousePos(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
                scaleX: scaleX,
                scaleY: scaleY
            };
        }

        function drawArrow(context, fromx, fromy, tox, toy) {
            const headlen = 15 * (currentSize / 4);
            const dx = tox - fromx;
            const dy = toy - fromy;
            const angle = Math.atan2(dy, dx);
            context.beginPath();
            context.moveTo(fromx, fromy);
            context.lineTo(tox, toy);
            context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
            context.moveTo(tox, toy);
            context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
            context.stroke();
        }

        // --- ЛОГИКА ОТРИСОВКИ "ОБЛАКА" ---
        function drawCloudRect(context, x, y, w, h, size) {
            const left = Math.min(x, x + w);
            const right = Math.max(x, x + w);
            const top = Math.min(y, y + h);
            const bottom = Math.max(y, y + h);
            const width = right - left;
            const height = bottom - top;
            if (width < 5 || height < 5) return;

            const targetBumpSize = size * 4 + 10;
            const segX = Math.max(1, Math.round(width / targetBumpSize));
            const segY = Math.max(1, Math.round(height / targetBumpSize));
            const stepX = width / segX;
            const stepY = height / segY;

            context.beginPath();
            context.moveTo(left, top);

            for (let i = 0; i < segX; i++) {
                context.quadraticCurveTo(left + i * stepX + stepX / 2, top - stepX * 0.8, left + (i + 1) * stepX, top);
            }
            for (let i = 0; i < segY; i++) {
                context.quadraticCurveTo(right + stepY * 0.8, top + i * stepY + stepY / 2, right, top + (i + 1) * stepY);
            }
            for (let i = 0; i < segX; i++) {
                context.quadraticCurveTo(right - i * stepX - stepX / 2, bottom + stepX * 0.8, right - (i + 1) * stepX, bottom);
            }
            for (let i = 0; i < segY; i++) {
                context.quadraticCurveTo(left - stepY * 0.8, bottom - i * stepY - stepY / 2, left, bottom - (i + 1) * stepY);
            }

            context.stroke();
        }

        canvas.addEventListener('mousedown', (e) => {
            if (activeTextCommit) {
                activeTextCommit();
                return;
            }
            if (Date.now() - lastTextCommitTime < 200) return;

            const pos = getMousePos(e);
            startX = pos.x;
            startY = pos.y;
            isDrawing = true;

            snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = currentColor;
            ctx.lineWidth = currentSize;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (currentTool === 'pen') {
                penPoints = [{x: startX, y: startY}];
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            const pos = getMousePos(e);

            ctx.putImageData(snapshot, 0, 0);
            ctx.globalAlpha = currentOpacity;
            ctx.beginPath();

            if (currentTool === 'pen') {
                penPoints.push({x: pos.x, y: pos.y});
                ctx.moveTo(penPoints[0].x, penPoints[0].y);
                for (let i = 1; i < penPoints.length; i++) {
                    ctx.lineTo(penPoints[i].x, penPoints[i].y);
                }
                ctx.stroke();
            } else {
                let endX = pos.x;
                let endY = pos.y;

                if (e.shiftKey && (currentTool === 'line' || currentTool === 'arrow')) {
                    if (Math.abs(endX - startX) > Math.abs(endY - startY)) {
                        endY = startY;
                    } else {
                        endX = startX;
                    }
                }

                if (currentTool === 'line') {
                    ctx.moveTo(startX, startY);
                    ctx.lineTo(endX, endY);
                    ctx.stroke();
                } else if (currentTool === 'arrow') {
                    drawArrow(ctx, startX, startY, endX, endY);
                } else if (currentTool === 'rect') {
                    ctx.rect(startX, startY, pos.x - startX, pos.y - startY);
                    ctx.stroke();
                } else if (currentTool === 'cloud') {
                    drawCloudRect(ctx, startX, startY, endX - startX, endY - startY, currentSize);
                } else if (currentTool === 'circle') {
                    const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
                    ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
                    ctx.stroke();
                } else if (currentTool === 'text') {
                    ctx.globalAlpha = 1.0;
                    ctx.setLineDash([5, 5]);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#000';
                    ctx.strokeRect(startX, startY, pos.x - startX, pos.y - startY);
                    ctx.setLineDash([]);
                }
            }
        });

        canvas.addEventListener('mouseup', (e) => {
            if (!isDrawing) return;
            isDrawing = false;
            ctx.closePath();

            const pos = getMousePos(e);
            ctx.globalAlpha = 1.0;

            if (currentTool === 'text') {
                ctx.putImageData(snapshot, 0, 0);

                let rectX = Math.min(startX, pos.x);
                let rectY = Math.min(startY, pos.y);
                let rectW = Math.abs(startX - pos.x);
                let rectH = Math.abs(startY - pos.y);

                if (rectW < 50) rectW = 200;
                if (rectH < 30) rectH = 50;

                const cssLeft = rectX / pos.scaleX;
                const cssTop = rectY / pos.scaleY;
                const cssWidth = rectW / pos.scaleX;
                const cssHeight = rectH / pos.scaleY;

                const fontSize = 12 + (currentSize * 2);

                const textArea = document.createElement('textarea');
                textArea.id = 'fw-canvas-text-input';
                textArea.placeholder = 'Rakstiet šeit... (klikšķiniet ārpusē, lai saglabātu)';

                textArea.style.cssText = `
                    position: absolute;
                    left: ${cssLeft}px; top: ${cssTop}px;
                    width: ${cssWidth}px; height: ${cssHeight}px;
                    color: ${currentColor}; font-size: ${fontSize}px; font-family: sans-serif;
                    background: rgba(255, 255, 255, 0.7);
                    border: 2px dashed #333;
                    outline: none; padding: 5px; resize: none; overflow: hidden;
                    line-height: ${fontSize * 1.2}px;
                    box-sizing: border-box; z-index: 1000;
                `;

                canvasContainer.appendChild(textArea);
                setTimeout(() => textArea.focus(), 10);

                activeTextCommit = () => {
                    const text = textArea.value.trim();
                    if (text !== '') {
                        ctx.fillStyle = currentColor;
                        ctx.globalAlpha = 1.0;
                        ctx.font = `${fontSize}px sans-serif`;
                        ctx.textBaseline = 'top';

                        const lines = text.split('\n');
                        const lineHeight = fontSize * 1.2;
                        lines.forEach((line, index) => {
                            ctx.fillText(line, rectX + 5, rectY + 5 + (index * lineHeight));
                        });
                        saveState();
                    }
                    textArea.remove();
                    activeTextCommit = null;
                    lastTextCommitTime = Date.now();
                };

                textArea.addEventListener('blur', () => {
                    if (activeTextCommit) activeTextCommit();
                });
            } else {
                saveState();
            }
        });

        canvas.addEventListener('mouseleave', () => {
            if (isDrawing && currentTool !== 'text') {
                isDrawing = false;
                ctx.globalAlpha = 1.0;
                saveState();
            } else if (isDrawing && currentTool === 'text') {
                 isDrawing = false;
                 ctx.putImageData(snapshot, 0, 0);
            }
        });

        btnCancel.onclick = closeEditor;

        btnUpload.onclick = () => {
            btnUpload.textContent = 'Notiek augšupielāde...';
            btnUpload.disabled = true;
            canvas.toBlob((blob) => {
                const annotatedFile = new File([blob], file.name || "annotated_image.png", { type: "image/png" });
                closeEditor();
                performUpload(annotatedFile);
            }, 'image/png');
        };
    }

    // --- PASTE EVENT LISTENER ---
    document.addEventListener('paste', async function(e) {
        if (isSimulatingPaste) return;

        const activeEl = document.activeElement;
        const isCommentField = activeEl &&
                               activeEl.tagName === 'TEXTAREA' &&
                               activeEl.placeholder &&
                               activeEl.placeholder.includes('Enter message here');

        if (!isCommentField) return;

        const items = (e.clipboardData || window.clipboardData).items;
        let imageFile = null;

        if (items && items.length > 0) {
              for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    imageFile = items[i].getAsFile();
                    break;
                }
              }
        }

        if (!imageFile) return;

        e.preventDefault();
        openDrawingEditor(imageFile);
    });
})();
