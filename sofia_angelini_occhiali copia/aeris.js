export const percorsoAeris = 'models/occhiali.glb';
export const descrizioneAeris = 'Occhiali protettivi con lente fumé avvolgente, ripari laterali ventilati e finitura nera satinata. Scegli le finiture e osserva il modello sul tuo viso.';

export function parteAeris(nome) {
    if (nome === 'Lente') return 'lente';
    if (nome === 'Bordino_superiore') return 'bordino';
    if (nome === 'Bordo_incavo_nasale') return 'ponte';
    if (nome.startsWith('Riparo_laterale_')) return 'ripari';
    if (nome.startsWith('Aletta_')) return 'alette';
    if (nome.startsWith('Cerniera_')) return 'cerniere';
    if (nome.startsWith('Perno_')) return 'perni';
    if (nome.startsWith('Asta_')) return 'aste';
    if (nome.startsWith('Terminale_asta_')) return 'terminali';
}

export function applicaFinituraAeris(radice) {
    radice.traverse((oggetto) => {
        if (oggetto.isLine || oggetto.isPoints) oggetto.visible = false;
        if (!oggetto.isMesh) return;

        let parte;
        for (let nodo = oggetto; nodo && !parte; nodo = nodo.parent) parte = parteAeris(nodo.name);
        if (!parte) return;

        const lente = parte === 'lente';
        const frontale = ['ripari', 'alette', 'bordino', 'ponte'].includes(parte);
        const gruppo = lente ? 'lenti' : frontale ? 'colore' : 'dettagli';
        const colore = lente ? '#252931' : frontale ? '#15171b' : '#25272c';
        const colora = (originale) => {
            const materiale = originale.clone();
            materiale.color.set(colore);
            materiale.metalness = lente ? 0 : frontale ? .22 : .55;
            materiale.roughness = lente ? .15 : .33;
            materiale.transparent = lente;
            materiale.opacity = lente ? .57 : 1;
            materiale.depthWrite = !lente;
            materiale.userData.coloreSorgente = materiale.color.getHex();
            materiale.userData.gruppoAeris = gruppo;
            return materiale;
        };
        oggetto.material = Array.isArray(oggetto.material) ? oggetto.material.map(colora) : colora(oggetto.material);
    });
}

export function applicaColoriAeris(radice, finitura) {
    const colori = { lenti: finitura.lente, colore: finitura.montatura, dettagli: finitura.dettagli };
    radice.traverse((oggetto) => {
        if (!oggetto.isMesh) return;
        for (const materiale of [].concat(oggetto.material)) {
            const colore = colori[materiale.userData.gruppoAeris];
            if (colore) materiale.color.set(colore);
        }
    });
}
