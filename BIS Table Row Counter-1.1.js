// ==UserScript==
// @name         BIS Table Row Counter
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Saskaita BIS tabulas rindas un pievieno tās esošajam Fieldwire indikatoram
// @author       Tavs Vārds
// @match        https://bis.gov.lv/*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/zhvial/UserScripts/main/BIS%20Table%20Row%20Counter-1.1.js
// @downloadURL  https://raw.githubusercontent.com/zhvial/UserScripts/main/BIS%20Table%20Row%20Counter-1.1.js
// ==/UserScript==

(function() {
    'use strict';

    setInterval(() => {
        // 1. Atrodam oriģinālā skripta indikatoru pēc tā stiliem un teksta
        const divs = document.querySelectorAll('div');
        let indicator = null;

        for (let div of divs) {
            // Meklējam pēc stiliem, kas definēti oriģinālajā skriptā
            if (div.style.bottom === '10px' &&
                div.style.right === '10px' &&
                div.style.zIndex === '99999' &&
                div.textContent.includes('FW ')) {
                indicator = div;
                break;
            }
        }

        // Ja indikators vēl nav ielādējies, gaidām nākamo ciklu
        if (!indicator) return;

        // 2. Saskaitām tabulas rindas
        const rows = document.querySelectorAll('div[data-column-header-name="Datums"]');
        const rowCount = rows.length;

        const targetText = `\nRindas tabulā: ${rowCount}`;

        // 3. Pievienojam tekstu esošajam lodziņam
        if (!indicator.textContent.includes(`Rindas tabulā: ${rowCount}`)) {
            // Notīrām iepriekšējo rindu skaitu (ja skaits lapā ir mainījies)
            indicator.textContent = indicator.textContent.replace(/\nRindas tabulā: \d+/, '');

            // Atļaujam tekstam dalīties vairākās rindās (lai nebūtu viss vienā garā desā)
            indicator.style.whiteSpace = 'pre-wrap';

            // Pievienojam jauno skaitu
            indicator.textContent += targetText;
        }
    }, 1000); // Pārbauda reizi sekundē
})();