import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applicaColoriAeris, applicaFinituraAeris, descrizioneAeris, percorsoAeris } from './aeris.js';
import { creaAcquisizione } from './acquisizione-prova.js';

const visore = document.getElementById('visore-prova');
const video = document.getElementById('video-prova');
const acquisizione = creaAcquisizione(video);
const stato = document.getElementById('stato-prova');
const pulsante = document.getElementById('fotocamera');
const etichettaFotocamera = pulsante.querySelector('.comando-prova-etichetta');
// Riferimento stimato fra gli angoli esterni degli occhi, in metri.
const distanzaOcchiRiferimento = 0.09;
const massimoVolti = 4;
const scena = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 40);
camera.position.z = 10;
const luce = new THREE.DirectionalLight(0xffffff, 2);
luce.position.set(1, 2, 3);
scena.add(luce, new THREE.HemisphereLight(0xffffff, 0xa8b7c6, 1.5));

let preparazione;
let sessione = null;
let modelloProva;

async function caricaSchedaProva() {
    const descrizione = document.getElementById('descrizione-occhiale');
    descrizione.textContent = descrizioneAeris;
    descrizione.hidden = false;

    const { scene } = await new GLTFLoader().loadAsync(percorsoAeris);
    applicaFinituraAeris(scene);
    scene.updateMatrixWorld(true);
    const limiti = new THREE.Box3();
    const volume = new THREE.Box3();
    scene.traverseVisible((oggetto) => {
        if (oggetto.isMesh) limiti.union(volume.setFromObject(oggetto));
    });
    const sfera = limiti.getBoundingSphere(new THREE.Sphere());
    if (!Number.isFinite(sfera.radius) || sfera.radius <= 0) {
        throw new Error('Il modello AERIS non contiene geometria visibile.');
    }

    const modello = new THREE.Group();
    const centrato = new THREE.Group();
    centrato.add(scene);
    centrato.scale.setScalar(1 / sfera.radius);
    centrato.position.copy(sfera.center).multiplyScalar(-1 / sfera.radius);
    modello.add(centrato);
    modelloProva = {
        modello,
        raggioInMetri: sfera.radius,
        fronte: (limiti.max.z - sfera.center.z) / sfera.radius
    };

    const palette = window.paletteAeris;
    if (palette) {
        applicaColoriAeris(modello, palette.finitura);
        palette.elemento.addEventListener('aeris-finitura', ({ detail }) => applicaColoriAeris(modello, detail));
    }
    stato.textContent = 'Attiva la fotocamera e inquadra fino a ' + massimoVolti + ' persone. Il video resta nel browser.';
    pulsante.disabled = false;
}

async function preparaProva() {
    const { modello, raggioInMetri, fronte } = modelloProva;
    const libreria = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
    const { FaceLandmarker, FilesetResolver } = await import(`${libreria}/vision_bundle.mjs`);
    const ambiente = await FilesetResolver.forVisionTasks(`${libreria}/wasm`);
    const rilevatore = await FaceLandmarker.createFromOptions(ambiente, {
        baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
        },
        runningMode: 'VIDEO',
        numFaces: massimoVolti,
        outputFacialTransformationMatrixes: true
    });

    const grafica = new THREE.WebGLRenderer({
        alpha: true, antialias: true, preserveDrawingBuffer: true
    });
    grafica.toneMapping = THREE.ACESFilmicToneMapping;
    grafica.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');
    const ambienteLuce = new RoomEnvironment();
    const filtro = new THREE.PMREMGenerator(grafica);
    scena.environment = filtro.fromScene(ambienteLuce).texture;
    ambienteLuce.dispose();
    filtro.dispose();
    grafica.domElement.setAttribute('aria-hidden', 'true');
    grafica.domElement.hidden = true;
    visore.append(grafica.domElement);

    // La maschera scrive solo la profondità, così il video resta visibile.
    const indiciViso = FaceLandmarker.FACE_LANDMARKS_TESSELATION.map(({ start }) => start);
    const materialeMaschera = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, side: THREE.DoubleSide });
    const volti = Array.from({ length: massimoVolti }, () =>
        creaSupportoViso(modello, fronte, raggioInMetri, indiciViso, materialeMaschera));
    return { grafica, rilevatore, volti };
}

function creaSupportoViso(modello, fronte, raggioInMetri, indiciViso, materialeMaschera) {
    const pivot = new THREE.Group();
    const occhiali = modello.clone(true);
    occhiali.position.z = -fronte;
    pivot.add(occhiali);
    pivot.visible = false;
    const geometriaViso = new THREE.BufferGeometry();
    const verticiViso = new THREE.BufferAttribute(new Float32Array(478 * 3), 3);
    verticiViso.setUsage(THREE.DynamicDrawUsage);
    geometriaViso.setAttribute('position', verticiViso);
    geometriaViso.setIndex(indiciViso);
    const maschera = new THREE.Mesh(geometriaViso, materialeMaschera);
    maschera.visible = false;
    maschera.frustumCulled = false;
    maschera.renderOrder = -1;
    scena.add(maschera, pivot);

    return {
        pivot, raggioInMetri, maschera, verticiViso,
        orientamento: new THREE.Quaternion(),
        matriceViso: new THREE.Matrix4(),
        rotazioneViso: new THREE.Matrix4(),
        posizione: new THREE.Vector3()
    };
}

function associaVolti(supporti, rilevati) {
    const coppie = [];
    for (const supporto of supporti) {
        if (!supporto.ponte) continue;
        rilevati.forEach((punti, indice) => {
            const ponte = punti[168];
            const distanza = Math.hypot(ponte.x - supporto.ponte.x, ponte.y - supporto.ponte.y);
            if (distanza < .22) coppie.push({ supporto, indice, distanza });
        });
    }
    coppie.sort((a, b) => a.distanza - b.distanza);

    const corrispondenze = new Map();
    const abbinati = new Set();
    for (const { supporto, indice } of coppie) {
        if (corrispondenze.has(supporto) || abbinati.has(indice)) continue;
        corrispondenze.set(supporto, indice);
        abbinati.add(indice);
    }
    const liberi = supporti.filter((supporto) => !corrispondenze.has(supporto));
    rilevati.forEach((_, indice) => {
        if (abbinati.has(indice)) return;
        const supporto = liberi.shift();
        supporto.ultimaPosa = null;
        corrispondenze.set(supporto, indice);
    });
    return corrispondenze;
}

function proporzioniMontatura(punti, larghezza, altezza, distanzaOcchi) {
    const [tempiaSinistra, tempiaDestra] = [punti[127], punti[356]];
    const [fronte, mento, naso] = [punti[10], punti[152], punti[168]];
    if (![tempiaSinistra, tempiaDestra, fronte, mento, naso].every((punto) =>
        punto && Number.isFinite(punto.x) && Number.isFinite(punto.y) && Number.isFinite(punto.z))) {
        return { x: 1, y: 1, z: 1 };
    }

    const distanza = (a, b) => Math.hypot(
        (a.x - b.x) * larghezza, (a.y - b.y) * altezza, (a.z - b.z) * larghezza
    );
    const ampiezzaViso = distanza(tempiaSinistra, tempiaDestra);
    if (ampiezzaViso < .001 || distanzaOcchi <= .001) return { x: 1, y: 1, z: 1 };

    const centroTempie = {
        x: (tempiaSinistra.x + tempiaDestra.x) / 2,
        y: (tempiaSinistra.y + tempiaDestra.y) / 2,
        z: (tempiaSinistra.z + tempiaDestra.z) / 2
    };
    const x = THREE.MathUtils.clamp(ampiezzaViso / (1.55 * distanzaOcchi), .84, 1.22);
    const y = THREE.MathUtils.clamp(distanza(fronte, mento) / (1.36 * ampiezzaViso), .9, 1.12);
    const profonditaRelativa = distanza(centroTempie, naso) / (.42 * distanzaOcchi);
    const z = THREE.MathUtils.clamp(1 + (profonditaRelativa - 1) * .25, .9, 1.14);
    return { x, y, z };
}

function allineaAlViso(attiva, punti, matrice, larghezza, altezza, tempo) {
    const { pivot, raggioInMetri, verticiViso, orientamento, matriceViso, rotazioneViso, posizione } = attiva;
    const [sinistro, destro] = [punti[33], punti[263]].sort((a, b) => b.x - a.x);
    const ponte = punti[168];
    const dx = (sinistro.x - destro.x) * larghezza;
    const dy = (sinistro.y - destro.y) * altezza;
    const dz = (sinistro.z - destro.z) * larghezza;
    const distanzaOcchi = Math.hypot(dx, dy, dz);
    const scalaPerMetro = Math.max(.001, distanzaOcchi) / distanzaOcchiRiferimento;
    const peso = attiva.ultimaPosa == null ? 1 : 1 - Math.exp(-(tempo - attiva.ultimaPosa) / 45);
    attiva.ultimaPosa = tempo;

    if (matrice?.data?.length === 16) {
        rotazioneViso.extractRotation(matriceViso.fromArray(matrice.data));
        orientamento.setFromRotationMatrix(rotazioneViso);
        // Il video è a specchio: il ribaltamento orizzontale inverte yaw e roll.
        orientamento.y *= -1;
        orientamento.z *= -1;
    } else {
        orientamento.setFromEuler(new THREE.Euler(0, Math.atan2(-dz, dx), Math.atan2(dy, dx), 'ZYX'));
    }

    posizione.set((0.5 - ponte.x) * larghezza, (0.5 - ponte.y) * altezza, 0.012 * scalaPerMetro);
    pivot.position.lerp(posizione, peso);
    pivot.quaternion.slerp(orientamento, peso);
    const proporzioni = proporzioniMontatura(punti, larghezza, altezza, distanzaOcchi);
    const scala = scalaPerMetro * raggioInMetri;
    pivot.scale.set(
        THREE.MathUtils.lerp(pivot.scale.x, scala * proporzioni.x, peso),
        THREE.MathUtils.lerp(pivot.scale.y, scala * proporzioni.y, peso),
        THREE.MathUtils.lerp(pivot.scale.z, scala * proporzioni.z, peso)
    );

    for (let i = 0; i < punti.length && i < verticiViso.count; i++) {
        const punto = punti[i];
        verticiViso.setXYZ(i, (0.5 - punto.x) * larghezza, (0.5 - punto.y) * altezza,
            (ponte.z - punto.z) * larghezza - 0.006 * scalaPerMetro);
    }
    verticiViso.needsUpdate = true;
}

function aggiornaProva(attiva, tempo) {
    if (sessione !== attiva) return;

    try {
        const { grafica, rilevatore, volti } = attiva;
        if (video.readyState >= 2 && video.currentTime !== attiva.ultimoVideo) {
            attiva.ultimoVideo = video.currentTime;
            const esito = rilevatore.detectForVideo(video, tempo);
            const rilevati = esito.faceLandmarks.slice(0, volti.length);
            const w = visore.clientWidth;
            const h = visore.clientHeight;
            if (!w || !h) {
                attiva.frame = requestAnimationFrame((t) => aggiornaProva(attiva, t));
                return;
            }
            const rapportoVideo = video.videoWidth / video.videoHeight;
            const wVideo = Math.min(w, h * rapportoVideo);
            const hVideo = wVideo / rapportoVideo;
            if (attiva.larghezzaVisore !== w || attiva.altezzaVisore !== h) {
                grafica.setSize(w, h, false);
                attiva.larghezzaVisore = w;
                attiva.altezzaVisore = h;
            }
            camera.left = -w / h;
            camera.right = w / h;
            camera.updateProjectionMatrix();
            const abbinamenti = associaVolti(volti, rilevati);
            for (const supporto of volti) {
                const indice = abbinamenti.get(supporto);
                const punti = rilevati[indice];
                supporto.pivot.visible = supporto.maschera.visible = Boolean(punti);
                supporto.ponte = punti?.[168];
                if (punti) {
                    allineaAlViso(supporto, punti, esito.facialTransformationMatrixes?.[indice], wVideo * 2 / h, hVideo * 2 / h, tempo);
                } else {
                    supporto.ultimaPosa = null;
                }
            }
            const conteggio = rilevati.length;
            const messaggio = conteggio > 1 ? conteggio + ' volti rilevati. Tutti pronti per la foto.'
                : conteggio === 1 ? '1 volto rilevato. Puoi scattare o inquadrare altre persone.'
                    : 'Inquadra uno o più volti per vedere gli occhiali.';
            if (stato.textContent !== messaggio) stato.textContent = messaggio;
            grafica.render(scena, camera);
            acquisizione.mostraFrame(grafica.domElement, w, h, wVideo, hVideo);
        }
        attiva.frame = requestAnimationFrame((t) => aggiornaProva(attiva, t));
    } catch (errore) {
        console.error('Prova 3D interrotta', errore);
        disattiva();
        stato.textContent = 'Il rilevamento del viso si è interrotto. Riattiva la fotocamera per riprovare.';
    }
}

function disattiva() {
    if (!sessione) return;
    const attiva = sessione;
    sessione = null;
    cancelAnimationFrame(attiva.frame);
    acquisizione.spegni();
    attiva.stream?.getTracks().forEach((traccia) => traccia.stop());
    video.srcObject = null;
    video.hidden = true;
    for (const supporto of attiva.volti ?? []) {
        supporto.ponte = undefined;
        supporto.ultimaPosa = null;
        supporto.pivot.visible = supporto.maschera.visible = false;
    }
    if (attiva.grafica) attiva.grafica.domElement.hidden = true;
    etichettaFotocamera.textContent = 'Attiva fotocamera';
    pulsante.removeAttribute('data-attivo');
    pulsante.disabled = false;
}

pulsante.addEventListener('click', async () => {
    if (sessione) {
        disattiva();
        stato.textContent = 'Fotocamera spenta.';
        return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        stato.textContent = 'La fotocamera richiede una pagina HTTPS o aperta da localhost.';
        return;
    }

    const attiva = { ultimoVideo: -1 };
    sessione = attiva;
    pulsante.disabled = true;
    stato.textContent = 'Attendi l’accesso alla fotocamera…';
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
        if (sessione !== attiva) {
            stream.getTracks().forEach((traccia) => traccia.stop());
            return;
        }
        attiva.stream = stream;
        stato.textContent = 'Preparazione degli occhiali e del rilevamento del viso…';
        preparazione ??= preparaProva().catch((errore) => {
            preparazione = undefined;
            throw errore;
        });
        const risorse = await preparazione;
        if (sessione !== attiva) return;

        Object.assign(attiva, risorse);
        video.srcObject = stream;
        await video.play();
        if (sessione !== attiva) return;

        video.hidden = false;
        attiva.grafica.domElement.hidden = false;
        etichettaFotocamera.textContent = 'Spegni fotocamera';
        pulsante.setAttribute('data-attivo', '');
        pulsante.disabled = false;
        attiva.frame = requestAnimationFrame((t) => aggiornaProva(attiva, t));
    } catch (errore) {
        if (sessione !== attiva) return;
        console.error('Prova 3D non disponibile', errore);
        disattiva();
        stato.textContent = errore.name === 'NotAllowedError'
            ? 'Consenti l’accesso alla fotocamera nel browser e riprova.'
            : 'Impossibile avviare la prova 3D. Controlla la fotocamera e la connessione.';
    }
});

window.addEventListener('pagehide', disattiva);

caricaSchedaProva().catch((errore) => {
    console.error('Modello per la prova non disponibile', errore);
    stato.textContent = 'Impossibile caricare il modello per la prova in 3D.';
});
