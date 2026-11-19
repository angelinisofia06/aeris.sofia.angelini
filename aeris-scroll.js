import { applicaColoriAeris, applicaFinituraAeris, parteAeris, percorsoAeris } from './aeris.js';

const {
    sequenze, posaDaScroll,
    muoviRacconto, linee, anteprime
} = window.aerisScorrimento;

const dispersione = {
    lente: [0, 0, .039],
    bordino: [0, .047, .013],
    ponte: [0, -.044, .026],
    ripari: [.037, -.013, -.007],
    alette: [.058, .026, -.018],
    cerniere: [.029, .019, -.024],
    perni: [.039, .049, -.022],
    aste: [.045, .009, -.046],
    terminali: [.049, -.021, -.074]
};

async function avvia() {
    const [THREE, { GLTFLoader }, { RoomEnvironment }] = await Promise.all([
        import('three'),
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/environments/RoomEnvironment.js')
    ]);
    const { scene: sorgente } = await new GLTFLoader().loadAsync(percorsoAeris);
    applicaFinituraAeris(sorgente);

    for (const sezione of sequenze) {
        const esploso = sezione.dataset.sequenza === 'esploso';
        const visore = sezione.querySelector('[data-modello]');
        const immagine = visore.querySelector('img');
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.domElement.setAttribute('aria-hidden', 'true');

        const scena = new THREE.Scene();
        const ambiente = new RoomEnvironment();
        const filtro = new THREE.PMREMGenerator(renderer);
        scena.environment = filtro.fromScene(ambiente).texture;
        ambiente.dispose();
        filtro.dispose();

        const modello = sorgente.clone(true);
        scena.add(modello);
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 5);
        const centro = new THREE.Vector3(0, 0, esploso ? -.077 : -.048);
        const sinistra = new THREE.Vector3(-.0749, .016, -.0315);
        const destra = new THREE.Vector3(.0749, .016, -.0315);
        const parti = [];
        for (const oggetto of modello.children) {
            const tipo = parteAeris(oggetto.name);
            if (!tipo) continue;

            const lato = oggetto.name.includes('_SX') ? -1 : oggetto.name.includes('_DX') ? 1 : 0;
            const [x, y, z] = dispersione[tipo];
            const distanza = new THREE.Vector3(x * lato, y, z);
            if (tipo === 'alette') {
                const indice = Number(oggetto.name.split('_').at(-1));
                distanza.x += lato * indice * .003;
                distanza.y += indice * .002;
            }
            const geometrie = [];
            oggetto.traverse((pezzo) => {
                if (!pezzo.isMesh) return;
                pezzo.material = Array.isArray(pezzo.material)
                    ? pezzo.material.map((materiale) => materiale.clone())
                    : pezzo.material.clone();
                geometrie.push(...[].concat(pezzo.material));
            });
            const centroParte = new THREE.Box3().setFromObject(oggetto).getCenter(new THREE.Vector3());
            oggetto.worldToLocal(centroParte);
            parti.push({ oggetto, tipo, lato, distanza, geometrie, centroParte, origine: oggetto.position.clone() });
        }

        const pulsanti = [...sezione.querySelectorAll('[data-parte]')];
        const etichetta = sezione.querySelector('[data-etichetta]');
        let scelta;
        let frame;
        let visibile = true;
        let pronto = false;
        let larghezza;
        let altezza;
        const rotazione = new THREE.Quaternion();
        const asseY = new THREE.Vector3(0, 1, 0);

        function disegna() {
            frame = undefined;
            const { clientWidth: w, clientHeight: h } = visore;
            if (!w || !h) return;
            const { piega, apertura, giro } = posaDaScroll(sezione);
            if (!esploso) muoviRacconto(sezione);
            const angolo = esploso ? .62 : .62 + .24 * piega + Math.PI * 2 * giro;
            camera.position.copy(centro).add(new THREE.Vector3(Math.sin(angolo) * .44, .25 + .17 * piega, Math.cos(angolo) * .44));
            camera.lookAt(centro);

            const rapporto = w / h;
            const meta = esploso ? Math.max(.093, .165 / rapporto) : Math.max(.066, .132 / rapporto);
            Object.assign(camera, { top: meta, bottom: -meta, left: -meta * rapporto, right: meta * rapporto });
            camera.updateProjectionMatrix();
            if (w !== larghezza || h !== altezza) {
                renderer.setSize(w, h, false);
                larghezza = w;
                altezza = h;
            }

            for (const { oggetto, tipo, lato, distanza, geometrie, origine } of parti) {
                oggetto.position.copy(origine).addScaledVector(distanza, apertura);
                if (tipo === 'aste' || tipo === 'terminali' || tipo === 'ripari' || tipo === 'alette') {
                    const perno = lato < 0 ? sinistra : destra;
                    const angoloPiega = lato * piega * (lato < 0 ? 1.18 : 1.49);
                    rotazione.setFromAxisAngle(asseY, angoloPiega);
                    oggetto.position.sub(perno).applyQuaternion(rotazione).add(perno);
                    oggetto.quaternion.copy(rotazione);
                }
                for (const materiale of geometrie) {
                    materiale.emissive?.setHex(tipo === scelta ? 0x497592 : 0);
                }
            }

            renderer.render(scena, camera);
            if (esploso) {
                const coordinate = new Map();
                const posizione = new THREE.Vector3();
                for (const { tipo, oggetto, centroParte, lato } of parti) {
                    if (lato < 0 || coordinate.has(tipo)) continue;
                    posizione.copy(centroParte);
                    oggetto.localToWorld(posizione).project(camera);
                    coordinate.set(tipo, [(posizione.x + 1) * w / 2, (1 - posizione.y) * h / 2]);
                }
                linee.get(sezione)(apertura, coordinate);
            }
            if (!pronto) {
                anteprime.get(sezione)();
                immagine.hidden = true;
                pronto = true;
            }
        }

        function programma() {
            if (visibile && frame === undefined) frame = requestAnimationFrame(disegna);
        }

        for (const pulsante of pulsanti) {
            pulsante.disabled = false;
            pulsante.setAttribute('aria-pressed', 'false');
            pulsante.addEventListener('click', () => {
                scelta = scelta === pulsante.dataset.parte ? undefined : pulsante.dataset.parte;
                for (const voce of pulsanti) voce.setAttribute('aria-pressed', String(voce.dataset.parte === scelta));
                etichetta.textContent = scelta ? [...pulsante.childNodes].find((nodo) => nodo.nodeType === Node.TEXT_NODE)?.textContent : '';
                etichetta.hidden = !scelta;
                programma();
            });
        }

        if (window.paletteAeris) applicaColoriAeris(modello, window.paletteAeris.finitura);
        document.addEventListener('aeris-finitura', ({ detail }) => {
            applicaColoriAeris(modello, detail);
            programma();
        });
        visore.append(renderer.domElement);
        window.addEventListener('scroll', programma, { passive: true, capture: true });
        window.addEventListener('resize', programma);
        new ResizeObserver(programma).observe(visore);
        new IntersectionObserver(([voce]) => {
            visibile = voce.isIntersecting;
            programma();
        }).observe(visore);
        programma();
    }
}

avvia().catch((errore) => console.warn('AERIS: visualizzazione 3D non disponibile', errore));
