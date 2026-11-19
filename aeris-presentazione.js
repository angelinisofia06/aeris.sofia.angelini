'use strict';

const galleriaAeris = document.getElementById('viste-aeris');
const vistaPrecedente = document.querySelector('[data-galleria-indietro]');
const vistaSuccessiva = document.querySelector('[data-galleria-avanti]');

function aggiornaControlliGalleria() {
    const { scrollLeft, scrollWidth, clientWidth } = galleriaAeris;
    vistaPrecedente.disabled = scrollLeft < 2;
    vistaSuccessiva.disabled = scrollLeft + clientWidth >= scrollWidth - 2;
}

function scorriGalleria(direzione) {
    const [prima, seconda] = galleriaAeris.children;
    const passo = seconda.offsetLeft - prima.offsetLeft;
    const vista = Math.round(galleriaAeris.scrollLeft / passo) + direzione;
    const comportamento = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
    galleriaAeris.scrollTo({ left: vista * passo, behavior: comportamento });
}

vistaPrecedente.addEventListener('click', () => scorriGalleria(-1));
vistaSuccessiva.addEventListener('click', () => scorriGalleria(1));
galleriaAeris.addEventListener('scroll', aggiornaControlliGalleria, { passive: true });
new ResizeObserver(aggiornaControlliGalleria).observe(galleriaAeris);
aggiornaControlliGalleria();
