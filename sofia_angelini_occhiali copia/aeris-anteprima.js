'use strict';

(() => {
    const sequenze = [...document.querySelectorAll('[data-sequenza]')];
    const limita = (valore) => Math.max(0, Math.min(1, valore));
    const morbido = (valore) => valore * valore * (3 - 2 * valore);
    function avanzamento(sezione) {
        const { top, height } = sezione.getBoundingClientRect();
        const corsa = height - sezione.firstElementChild.offsetHeight;
        const anticipo = innerHeight * .12;
        return limita(corsa > 25 ? (anticipo - top) / (corsa + anticipo)
            : (innerHeight * .75 - top) / (innerHeight * .55));
    }

    function progressoAste(sezione) {
        const spazio = Number.parseFloat(getComputedStyle(sezione.querySelector('.dettagli')).marginBlockStart);
        return limita(-sezione.getBoundingClientRect().top / Math.max(1, spazio));
    }

    function posaDaScroll(sezione) {
        const esploso = sezione.dataset.sequenza === 'esploso';
        if (esploso) return { piega: 0, apertura: morbido(avanzamento(sezione)), giro: 0 };

        const progresso = progressoAste(sezione);
        const piega = progresso < .52 ? progresso / .52 : (1 - progresso) / .48;
        const dettagli = sezione.querySelector('.dettagli');
        const inizio = innerHeight * .72;
        const giro = limita((inizio - dettagli.getBoundingClientRect().top) / (inizio + dettagli.offsetHeight * .72));
        return { piega: morbido(piega), apertura: 0, giro };
    }

    function muoviRacconto(sezione) {
        const dettagli = sezione.querySelector('.dettagli');
        const top = dettagli.getBoundingClientRect().top;
        const ingresso = morbido(limita((innerHeight - top) / (innerHeight * .8)));
        const fineTitolo = .55;
        sezione.style.setProperty('--titolo-visibile', 1 - limita(ingresso / fineTitolo));
        const sollevamento = morbido(limita((ingresso - fineTitolo) / (1 - fineTitolo)));
        const discesa = morbido(limita(-top / Math.max(innerHeight, dettagli.offsetHeight)));
        sezione.style.setProperty('--modello-y', (innerHeight * (-.16 * sollevamento + .23 * discesa)) + 'px');
        const area = sezione.querySelector('.hero-contenuto').getBoundingClientRect();
        const aFianco = innerWidth > 850;
        const spazio = aFianco ? Math.max(1, dettagli.getBoundingClientRect().left - area.left - 28) : area.width;
        const variazione = (spazio - area.width) * ingresso;
        sezione.style.setProperty('--modello-x', (variazione / 2) + 'px');
        sezione.style.setProperty('--larghezza-modello', (area.width + variazione) + 'px');
        sezione.style.setProperty('--scala-modello', 1 - (aFianco ? .04 : .16) * ingresso);
    }

    const ancoreAnteprima = {
        lente: [.288, .599], bordino: [.334, .273], ponte: [.255, .865],
        ripari: [.669, .680], alette: [.761, .510], cerniere: [.636, .480],
        perni: [.656, .375], aste: [.844, .439], terminali: [.937, .544]
    };

    const ancoreSequenza = {
        lente: [.373, .618], bordino: [.415, .322], ponte: [.343, .861],
        ripari: [.720, .692], alette: [.805, .538], cerniere: [.690, .510],
        perni: [.708, .414], aste: [.880, .473], terminali: [.965, .568]
    };

    function preparaLinee(sezione) {

        const svg = sezione.querySelector('[data-linee]');
        if (!svg) return;
        const modello = sezione.querySelector('[data-modello]');
        const righe = [...sezione.querySelectorAll('[data-parte]')];
        const namespace = 'http://www.w3.org/2000/svg';
        const elementi = righe.map((riga, indice) => {
            const gruppo = document.createElementNS(namespace, 'g');
            const linea = document.createElementNS(namespace, 'path');
            const punto = document.createElementNS(namespace, 'circle');
            const numero = document.createElementNS(namespace, 'text');
            const badge = document.createElement('span');
            linea.setAttribute('fill', 'none');
            punto.setAttribute('r', '3');
            numero.textContent = badge.textContent = String(indice + 1);
            badge.className = 'numero-parte';
            badge.setAttribute('aria-hidden', 'true');
            riga.prepend(badge);
            gruppo.append(linea, punto, numero);
            svg.append(gruppo);
            return { riga, gruppo, linea, punto, numero };
        });

        return (apertura, coordinate, fotogrammi) => {
            const area = svg.getBoundingClientRect();
            const visore = modello.getBoundingClientRect();
            const baseW = fotogrammi ? 540 : 900;
            const baseH = fotogrammi ? 354 : 590;
            const scala = Math.min(visore.width / baseW, visore.height / baseH);
            svg.setAttribute('viewBox', '0 0 ' + area.width + ' ' + area.height);
            for (const { riga, gruppo, linea, punto, numero } of elementi) {
                const tipo = riga.dataset.parte;
                const ancoraggio = coordinate?.get(tipo);
                const [sx, sy] = (fotogrammi ? ancoreSequenza : ancoreAnteprima)[tipo];
                const x = visore.left - area.left + (ancoraggio?.[0] ?? ((visore.width - scala * baseW) / 2 + sx * scala * baseW));
                const y = visore.top - area.top + (ancoraggio?.[1] ?? ((visore.height - scala * baseH) / 2 + sy * scala * baseH));
                const testo = riga.getBoundingClientRect();
                const fineX = testo.left - area.left - 3;
                const fineY = testo.top - area.top + testo.height / 2;
                const gomito = Math.max(x + 6, fineX - 14);
                gruppo.style.opacity = limita((apertura - .63) / .32);
                linea.setAttribute('d', 'M ' + x + ' ' + y + ' H ' + (x + 5) + ' L ' + gomito + ' ' + fineY + ' H ' + fineX);
                punto.setAttribute('cx', x);
                punto.setAttribute('cy', y);
                numero.setAttribute('x', x);
                numero.setAttribute('y', y);
            }
        };
    }

    const linee = new Map(sequenze.map((sezione) => [sezione, preparaLinee(sezione)]));

    function preparaAnteprima(sezione) {
        const esploso = sezione.dataset.sequenza === 'esploso';
        const alternativo = sezione.querySelector('[data-stato-alternativo]');
        const visore = alternativo.parentElement;
        const canvas = document.createElement('canvas');
        const contesto = canvas.getContext('2d');
        let frame;
        let pellicole;
        let finitura;
        let attivo = true;
        canvas.hidden = true;
        canvas.setAttribute('aria-hidden', 'true');
        visore.append(canvas);
        function cambiaFinitura(id) {
            if (id === finitura) return;
            finitura = id;
            const cartella = id === 'nero' ? 'img/' : 'img/finiture/' + id + '/';
            const immagini = {};
            pellicole = immagini;
            for (const tipo of esploso ? ['esploso'] : ['chiuso', 'rotazione']) {
                const immagine = new Image();
                immagini[tipo] = immagine;
                immagine.addEventListener('load', () => {
                    if (!attivo || immagini !== pellicole) return;
                    programma();
                }, { once: true });
                immagine.src = cartella + 'aeris-sequenza-' + tipo + '.png';
            }
            programma();
        }

        function ascoltaFinitura({ detail }) {
            cambiaFinitura(detail.id);
        }

        document.addEventListener('aeris-finitura', ascoltaFinitura);
        cambiaFinitura(window.paletteAeris?.finitura.id ?? 'nero');

        function aggiorna() {
            frame = undefined;
            sezione.setAttribute('data-animata', '');
            const { piega, apertura, giro } = posaDaScroll(sezione);
            const ruota = giro > 0 && pellicole.rotazione?.naturalWidth > 0;
            const sequenza = esploso ? pellicole.esploso : ruota ? pellicole.rotazione : pellicole.chiuso;
            const fotogrammi = Boolean(contesto && sequenza?.naturalWidth);
            if (esploso) linee.get(sezione)(apertura, undefined, fotogrammi);
            else muoviRacconto(sezione);
            const fase = esploso ? 1 - apertura : piega;
            alternativo.hidden = fotogrammi;
            alternativo.style.opacity = fase;
            alternativo.previousElementSibling.style.opacity = fotogrammi ? 0 : 1 - fase;
            canvas.hidden = !fotogrammi;
            if (fotogrammi) {
                const densita = Math.min(devicePixelRatio, 2);
                const w = Math.round(visore.clientWidth * densita);
                const h = Math.round(visore.clientHeight * densita);
                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                }
                const scala = Math.min(w / 540, h / 354);
                const fotogramma = 12 * (esploso ? apertura : ruota ? giro : piega);
                const inferiore = Math.floor(fotogramma);
                const miscela = fotogramma - inferiore;
                const destinazione = [(w - scala * 540) / 2, (h - scala * 354) / 2, scala * 540, scala * 354];
                contesto.clearRect(0, 0, w, h);
                if (scala > 0) {
                    contesto.globalAlpha = 1 - miscela;
                    contesto.drawImage(sequenza, 0, inferiore * 354, 540, 354, ...destinazione);
                    if (miscela > 0) {
                        contesto.globalCompositeOperation = 'lighter';
                        contesto.globalAlpha = miscela;
                        contesto.drawImage(sequenza, 0, (inferiore + 1) * 354, 540, 354, ...destinazione);
                    }
                    contesto.globalAlpha = 1;
                    contesto.globalCompositeOperation = 'source-over';
                }
            }
        }

        function programma() {
            if (frame === undefined) frame = requestAnimationFrame(aggiorna);
        }

        window.addEventListener('scroll', programma, { passive: true, capture: true });
        window.addEventListener('resize', programma);
        aggiorna();

        return () => {
            window.removeEventListener('scroll', programma, true);
            window.removeEventListener('resize', programma);
            document.removeEventListener('aeris-finitura', ascoltaFinitura);
            cancelAnimationFrame(frame);
            attivo = false;
            canvas.remove();
            alternativo.hidden = true;
        };
    }

    const anteprime = new Map(sequenze.map((sezione) => [sezione, preparaAnteprima(sezione)]));

    window.aerisScorrimento = {
        sequenze, posaDaScroll,
        muoviRacconto, linee, anteprime
    };
})();
