'use strict';

(() => {
    const palette = document.querySelector('[data-palette-aeris]');
    const parametri = new URLSearchParams(location.search);
    const prova = document.documentElement.classList.contains('prova-aeris');
    if (!palette) return;

    const finiture = [
        { id: 'nero', nome: 'Nero fumé', lente: '#252931', montatura: '#15171b', dettagli: '#25272c' },
        { id: 'ghiaccio', nome: 'Ghiaccio', lente: '#78acd3', montatura: '#30343c', dettagli: '#aeb7c0', precedente: 'grafite' },
        { id: 'petrolio', nome: 'Petrolio', lente: '#566779', montatura: '#2d6967', dettagli: '#aeb7c0', precedente: 'petrolio' },
        { id: 'terracotta', nome: 'Terracotta', lente: '#c58f53', montatura: '#a34e3c', dettagli: '#aa6747', precedente: 'terracotta' },
        { id: 'sabbia', nome: 'Sabbia', lente: '#778a5b', montatura: '#b68f64', dettagli: '#cc9b3a', precedente: 'sabbia' },
        { id: 'lilla', nome: 'Lilla', lente: '#9a88bf', montatura: '#b57889', dettagli: '#263b62', precedente: 'cipria' }
    ];
    const anteprime = document.querySelectorAll('[data-anteprima-finitura]');
    const viste = document.querySelectorAll('[data-vista-finitura]');
    for (const vista of viste) {
        vista.dataset.altOriginale = vista.alt.replace(/, occhiali neri con lente fumé$/, '');
    }
    const nomeFinitura = document.querySelector('[data-nome-finitura]');
    const linkProva = document.querySelectorAll('[data-prova-aeris]');
    const ritorno = document.querySelector('[data-torna-aeris]');
    let corrente;

    function immagineFinitura(id) {
        return 'img/aeris-' + (id === 'nero' ? 'aperto' : 'colore-' + id) + '.png';
    }

    const campioni = finiture.map((finitura) => {
        const bottone = document.createElement('button');
        bottone.type = 'button';
        const cerchio = document.createElement('span');
        cerchio.className = 'campione-aeris';
        cerchio.setAttribute('aria-hidden', 'true');
        cerchio.style.setProperty('--montatura', finitura.montatura);
        cerchio.style.setProperty('--lente', finitura.lente);
        const etichetta = document.createElement('span');
        etichetta.textContent = finitura.nome;
        bottone.append(cerchio, etichetta);
        bottone.addEventListener('click', () => scegli(finitura, true));
        palette.append(bottone);
        return { bottone, finitura };
    });

    function scegli(finitura, aggiornaIndirizzo) {
        corrente = finitura;
        nomeFinitura.textContent = finitura.nome;
        for (const anteprima of anteprime) {
            anteprima.src = immagineFinitura(finitura.id);
            anteprima.alt = 'Occhiali AERIS nella finitura ' + finitura.nome;
        }
        const cartella = finitura.id === 'nero' ? 'img/' : 'img/finiture/' + finitura.id + '/';
        for (const vista of viste) {
            vista.src = cartella + 'aeris-' + vista.dataset.vistaFinitura;
            vista.alt = vista.dataset.altOriginale ? vista.dataset.altOriginale + ' · ' + finitura.nome : '';
        }
        for (const campione of campioni) {
            campione.bottone.setAttribute('aria-pressed', String(campione.finitura === finitura));
        }
        const scelta = 'finitura=' + finitura.id;
        for (const link of linkProva) link.href = 'prova.html?' + scelta;
        if (prova) {
            ritorno.href = 'index.html?' + scelta + '#colori';
            ritorno.hidden = false;
            if (aggiornaIndirizzo && location.protocol !== 'file:') {
                history.replaceState(null, '', '?' + scelta);
            }
        }
        palette.dispatchEvent(new CustomEvent('aeris-finitura', { detail: finitura, bubbles: true }));
    }

    window.paletteAeris = { elemento: palette, get finitura() { return corrente; } };
    const iniziale = finiture.find(({ id }) => id === parametri.get('finitura')) ||
        finiture.find(({ precedente }) => precedente && precedente === parametri.get('colore')) || finiture[0];
    scegli(iniziale, false);
})();
