// Robot de noticias — Bitácora de la Reconstrucción (Vibras Positivas HM)
// Lo corre GitHub Actions cada 30 minutos. Trae noticias reales de Google News
// sobre la reconstrucción tras el terremoto del 10 de agosto de 2026 y las guarda
// en data/noticias.json. No necesita llaves ni paquetes (Node 20+).
import { readFile, writeFile } from 'node:fs/promises';

const ARCHIVO = new URL('../data/noticias.json', import.meta.url);
const MAX = 200;
const CONSULTAS = [
  'reconstrucción terremoto Colombia',
  '"Fondo Milagro"',
  'damnificados terremoto UNGRD',
  'terremoto Chocó reconstrucción',
  'terremoto Cali reconstrucción',
  'terremoto Pereira reconstrucción',
  'viviendas damnificados terremoto Colombia',
];

const DEPTOS = {
  'Chocó': ['chocó', 'choco', 'quibdó', 'quibdo', 'istmina', 'san juan'],
  'Valle del Cauca': ['cali', 'valle del cauca', 'buenaventura', 'tuluá', 'palmira', 'cartago', 'buga'],
  'Risaralda': ['pereira', 'risaralda', 'dosquebradas', 'santa rosa de cabal'],
  'Caldas': ['caldas', 'manizales'],
  'Quindío': ['quindío', 'quindio', 'armenia'],
  'Antioquia': ['antioquia', 'medellín', 'medellin'],
};

const decode = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .replace(/<[^>]+>/g, '').trim();

const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : ''; };

function deptoDe(texto) {
  const t = texto.toLowerCase();
  for (const [d, claves] of Object.entries(DEPTOS)) if (claves.some(k => t.includes(k))) return d;
  return 'Nacional';
}

async function buscar(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:30d')}&hl=es-419&gl=CO&ceid=CO:es-419`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (BitacoraReconstruccion)' } });
  if (!r.ok) throw new Error(`${q}: HTTP ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    let titulo = tag(it, 'title');
    const medio = tag(it, 'source');
    if (medio && titulo.endsWith(' - ' + medio)) titulo = titulo.slice(0, -(medio.length + 3));
    const fecha = new Date(tag(it, 'pubDate'));
    return {
      titulo, medio, url: tag(it, 'link'),
      fecha: isNaN(fecha) ? new Date().toISOString() : fecha.toISOString(),
      depto: deptoDe(titulo), consulta: q,
    };
  });
}

const clave = n => n.titulo.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '').slice(0, 80);

let previas = [];
try { previas = JSON.parse(await readFile(ARCHIVO, 'utf8')).noticias || []; } catch {}

const mapa = new Map(previas.map(n => [clave(n), n]));
let nuevas = 0, errores = 0;
for (const q of CONSULTAS) {
  try {
    for (const n of await buscar(q)) {
      // Solo lo que tenga que ver con el sismo
      if (!/terremoto|sismo|damnificad|reconstrucci|fondo milagro|ungrd/i.test(n.titulo)) continue;
      const k = clave(n);
      if (!mapa.has(k)) { mapa.set(k, n); nuevas++; }
    }
  } catch (e) { errores++; console.error('Falló', e.message); }
}

if (errores === CONSULTAS.length) { console.error('Ninguna consulta respondió; no se toca el archivo.'); process.exit(0); }

const noticias = [...mapa.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAX);
const ahora = new Date();
const actualizado = new Date(ahora.getTime() - 5 * 3600e3).toISOString().replace('Z', '-05:00').replace(/\.\d{3}/, '');
await writeFile(ARCHIVO, JSON.stringify({ actualizado, total: noticias.length, noticias }, null, 2) + '\n');
console.log(`Listo: ${nuevas} nuevas, ${noticias.length} en total (hora Colombia ${actualizado}).`);
