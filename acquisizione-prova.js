export function creaAcquisizione(video) {
    const azioni = document.getElementById('azioni-acquisizione');
    const scatta = document.getElementById('scatta-foto');
    const registra = document.getElementById('registra-video');
    const etichettaRegistra = registra.querySelector('.comando-prova-etichetta');
    const stato = document.getElementById('stato-acquisizione');
    const risultato = document.getElementById('risultato-acquisizione');
    const foto = document.getElementById('anteprima-foto');
    const anteprimaVideo = document.getElementById('anteprima-video');
    const salva = document.getElementById('salva-acquisizione');
    const condividi = document.getElementById('condividi-foto');

    let fotogramma = null;
    let registrazione = null;
    let indirizzo = null;
    let fileDaCondividere = null;
    let timerFoto;

    function messaggio(testo) {
        stato.textContent = testo;
        stato.hidden = !testo;
    }

    function mostraRisultato(file, tipo, estensione) {
        clearTimeout(timerFoto);
        if (indirizzo) URL.revokeObjectURL(indirizzo);
        indirizzo = URL.createObjectURL(file);
        const èFoto = tipo === 'foto';
        const nomeFile = `prova-occhiali-${tipo}.${estensione}`;
        fileDaCondividere = typeof File === 'function' ? new File([file], nomeFile, { type: file.type }) : null;
        condividi.hidden = false;
        foto.hidden = !èFoto;
        anteprimaVideo.hidden = èFoto;
        if (èFoto) {
            anteprimaVideo.pause();
            anteprimaVideo.removeAttribute('src');
            foto.src = indirizzo;
            timerFoto = setTimeout(() => {
                foto.hidden = true;
                foto.removeAttribute('src');
            }, 5000);
        } else {
            foto.removeAttribute('src');
            anteprimaVideo.src = indirizzo;
        }
        salva.href = indirizzo;
        salva.download = nomeFile;
        salva.querySelector('.comando-prova-etichetta').textContent = èFoto ? 'Salva foto' : 'Salva video';
        risultato.hidden = false;
        messaggio(èFoto ? 'Foto pronta.' : 'Video pronto.');
    }

    condividi.addEventListener('click', async () => {
        const file = fileDaCondividere;
        const dati = file ? { files: [file], title: 'Prova degli occhiali in 3D' } : null;
        if (!dati || !navigator.share || !navigator.canShare?.(dati)) {
            messaggio('Salva il file per condividerlo da un’altra app.');
            return;
        }

        try {
            await navigator.share(dati);
        } catch (errore) {
            if (errore.name === 'AbortError' || file !== fileDaCondividere) return;
            messaggio('Impossibile condividere direttamente. Usa il pulsante Salva.');
        }
    });

    function disegnaComposizione(canvas, ctx) {
        const { overlay, viewportWidth, viewportHeight, videoWidth, videoHeight } = fotogramma;
        const scala = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
        const w = video.videoWidth * scala;
        const h = video.videoHeight * scala;
        const x = (canvas.width - w) / 2;
        const y = (canvas.height - h) / 2;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();

        // Ritaglia il canvas 3D alla porzione occupata dal video nel visore.
        const areaW = overlay.width * videoWidth / viewportWidth;
        const areaH = overlay.height * videoHeight / viewportHeight;
        ctx.drawImage(overlay, (overlay.width - areaW) / 2, (overlay.height - areaH) / 2,
            areaW, areaH, x, y, w, h);
    }

    function nuovoCanvas() {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas di acquisizione non disponibile');
        disegnaComposizione(canvas, ctx);
        return { canvas, ctx };
    }

    function fermaRegistrazione() {
        if (registrazione && registrazione.recorder.state !== 'inactive') {
            registra.disabled = true;
            registrazione.recorder.stop();
            messaggio('Preparazione del video…');
        }
    }

    scatta.addEventListener('click', () => {
        if (!fotogramma) return;
        try {
            const { canvas } = nuovoCanvas();
            canvas.toBlob((file) => {
                if (file) mostraRisultato(file, 'foto', 'png');
                else messaggio('Impossibile scattare la foto.');
            }, 'image/png');
        } catch (errore) {
            console.error('Foto non disponibile', errore);
            messaggio('Impossibile scattare la foto.');
        }
    });

    registra.addEventListener('click', () => {
        if (registrazione) {
            fermaRegistrazione();
            return;
        }
        if (!fotogramma) return;
        let stream;
        try {
            const { canvas, ctx } = nuovoCanvas();
            if (!canvas.captureStream || typeof MediaRecorder !== 'function') {
                messaggio('Questo browser non supporta la registrazione video della prova.');
                return;
            }

            stream = canvas.captureStream(30);
            const formati = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'];
            const formato = formati.find((tipo) => MediaRecorder.isTypeSupported?.(tipo));
            const recorder = formato ? new MediaRecorder(stream, { mimeType: formato }) : new MediaRecorder(stream);
            const pezzi = [];
            let erroreRegistrazione = false;
            recorder.addEventListener('dataavailable', ({ data }) => {
                if (data.size) pezzi.push(data);
            });
            recorder.addEventListener('error', () => { erroreRegistrazione = true; });
            recorder.addEventListener('stop', () => {
                stream.getTracks().forEach((traccia) => traccia.stop());
                registrazione = null;
                etichettaRegistra.textContent = 'Registra video';
                registra.removeAttribute('data-attivo');
                registra.disabled = false;
                if (erroreRegistrazione || !pezzi.length) {
                    messaggio('Impossibile salvare il video.');
                    return;
                }
                const tipo = recorder.mimeType || pezzi[0].type;
                mostraRisultato(new Blob(pezzi, { type: tipo }), 'video', tipo.includes('mp4') ? 'mp4' : 'webm');
            }, { once: true });
            recorder.start(1000);
            registrazione = { canvas, ctx, recorder };
            etichettaRegistra.textContent = 'Ferma registrazione';
            registra.setAttribute('data-attivo', '');
            messaggio('Registrazione in corso, senza audio.');
        } catch (errore) {
            stream?.getTracks().forEach((traccia) => traccia.stop());
            console.error('Registrazione non disponibile', errore);
            messaggio('Impossibile avviare la registrazione video.');
        }
    });

    window.addEventListener('pagehide', (evento) => {
        if (evento.persisted) return;
        clearTimeout(timerFoto);
        if (indirizzo) URL.revokeObjectURL(indirizzo);
    });

    return {
        mostraFrame(overlay, viewportWidth, viewportHeight, videoWidth, videoHeight) {
            fotogramma = { overlay, viewportWidth, viewportHeight, videoWidth, videoHeight };
            azioni.hidden = false;
            if (registrazione?.recorder.state === 'recording') {
                disegnaComposizione(registrazione.canvas, registrazione.ctx);
            }
        },
        spegni() {
            fotogramma = null;
            azioni.hidden = true;
            fermaRegistrazione();
        }
    };
}
