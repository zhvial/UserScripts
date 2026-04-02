// ==UserScript==
// @name         Fieldwire: Fix Download Names V9.1 (.msg Fix)
// @namespace    http://tampermonkey.net/
// @version      9.1
// @description  Deep intercept + MIME type fix for .msg files
// @author       You
// @match        *://app.fieldwire.com/*
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      files.us.fieldwire.com
// @updateURL    https://raw.githubusercontent.com/zhvial/UserScripts/main/Fieldwire-%20Fix%20Download%20Names%20V9.1%20(.msg%20Fix)-9.1.js
// @downloadURL  https://raw.githubusercontent.com/zhvial/UserScripts/main/Fieldwire-%20Fix%20Download%20Names%20V9.1%20(.msg%20Fix)-9.1.js
// ==/UserScript==

(function() {
    'use strict';

    // --- VISUAL NOTIFICATION ---
    function showNotification(text, bgColor = '#4CAF50') {
        const box = document.createElement('div');
        box.style.position = 'fixed';
        box.style.bottom = '20px';
        box.style.right = '20px';
        box.style.padding = '15px 20px';
        box.style.backgroundColor = bgColor;
        box.style.color = 'white';
        box.style.borderRadius = '8px';
        box.style.boxShadow = '0 4px 6px rgba(0,0,0,0.3)';
        box.style.zIndex = '999999';
        box.style.fontFamily = 'sans-serif';
        box.style.fontSize = '14px';
        box.innerText = text;
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 5000);
    }

    // --- TAMPERMONKEY LISTENER ---
    window.addEventListener('FieldwireDownload', function(e) {
        const data = e.detail;
        console.log("[FW-DEBUG] 🟢 SIGNAL RECEIVED IN TAMPERMONKEY:", data.filename, "URL:", data.url);
        showNotification(`Intercepting: ${data.filename}`, '#2196F3');

        // 🛠️ SPECIAL FIX FOR .MSG FILES
        if (data.filename.toLowerCase().endsWith('.msg')) {
            console.log("[FW-DEBUG] 📧 .msg file detected! Stripping server MIME type...");

            GM_xmlhttpRequest({
                method: 'GET',
                url: data.url,
                responseType: 'blob',
                onload: function(response) {
                    if (response.status === 200) {
                        // Force Chrome to ignore server headers
                        const blob = new Blob([response.response], { type: 'application/octet-stream' });
                        const blobUrl = window.URL.createObjectURL(blob);

                        GM_download({
                            url: blobUrl,
                            name: data.filename,
                            saveAs: false, // 🛠️ ИЗМЕНЕНО ЗДЕСЬ
                            onload: () => {
                                showNotification(`✅ Success: ${data.filename}`, '#4CAF50');
                                window.URL.revokeObjectURL(blobUrl); // Clean up memory
                            },
                            onerror: (err) => {
                                console.error('[FW-DEBUG] 🔴 BLOB DOWNLOAD ERROR:', err);
                                showNotification(`❌ Download error!`, '#f44336');
                                window.URL.revokeObjectURL(blobUrl);
                            }
                        });
                    } else {
                        console.error('[FW-DEBUG] 🔴 SERVER ERROR:', response.status);
                        showNotification(`❌ Server error: ${response.status}`, '#f44336');
                    }
                },
                onerror: function(err) {
                    console.error('[FW-DEBUG] 🔴 NETWORK ERROR:', err);
                    showNotification(`❌ Network error!`, '#f44336');
                }
            });
        }
        // 📁 NORMAL BEHAVIOR FOR ALL OTHER FILES (.xls, .docx, etc)
        else {
            GM_download({
                url: data.url,
                name: data.filename,
                saveAs: false, // 🛠️ ИЗМЕНЕНО ЗДЕСЬ
                onload: () => showNotification(`✅ Success: ${data.filename}`, '#4CAF50'),
                onerror: (err) => {
                    console.error('[FW-DEBUG] 🔴 DOWNLOAD ERROR:', err);
                    showNotification(`❌ Download error!`, '#f44336');
                }
            });
        }
    });

    // --- DEEP INTERCEPT SPY (V9 LOGIC) ---
    const injectCode = function() {
        let lastFilename = "";

        document.body.addEventListener('click', function(e) {
            const link = e.target.closest('a[data-e2e="task-bubble-file-attachment"]');
            if (link) {
                lastFilename = link.innerText.trim();
                console.log("[FW-DEBUG] 🖱️ CLICK CAUGHT! Waiting for hidden link for:", lastFilename);
                setTimeout(() => { lastFilename = ""; }, 15000);
            }
        }, true);

        function intercept(url, method) {
            console.log(`[FW-DEBUG] 🎯 INTERCEPT SUCCESS! Method: ${method}, URL: ${url}`);
            window.dispatchEvent(new CustomEvent('FieldwireDownload', { detail: { url: url, filename: lastFilename } }));
            lastFilename = "";
        }

        const origClick = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function() {
            if (lastFilename && this.href && (this.href.includes('files.us.fieldwire.com') || this.href.startsWith('blob:'))) {
                intercept(this.href, 'click()');
                return;
            }
            return origClick.apply(this, arguments);
        };

        const origDispatch = EventTarget.prototype.dispatchEvent;
        EventTarget.prototype.dispatchEvent = function(event) {
            if (lastFilename && event.type === 'click' && this.tagName === 'A' && this.href && (this.href.includes('files.us.fieldwire.com') || this.href.startsWith('blob:'))) {
                intercept(this.href, 'dispatchEvent');
                return false;
            }
            return origDispatch.apply(this, arguments);
        };

        const origAppend = Node.prototype.appendChild;
        Node.prototype.appendChild = function(node) {
            if (lastFilename && node.tagName === 'IFRAME' && node.src && node.src.includes('files.us.fieldwire.com')) {
                intercept(node.src, 'iframe');
                return document.createElement('iframe');
            }
            return origAppend.apply(this, arguments);
        };

        const origAssign = window.location.assign;
        window.location.assign = function(url) {
            if (lastFilename && typeof url === 'string' && url.includes('files.us.fieldwire.com')) {
                intercept(url, 'location.assign');
                return;
            }
            return origAssign.apply(this, arguments);
        };
    };

    const script = document.createElement('script');
    script.textContent = '(' + injectCode.toString() + ')();';
    (document.head || document.documentElement).appendChild(script);
    script.remove();

})();