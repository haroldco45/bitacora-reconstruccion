// Robot de noticias — Bitácora de la Reconstrucción (Vibras Positivas HM)
// Lo corre GitHub Actions cada 30 minutos. Trae noticias reales de Google News
// sobre la reconstrucción tras el terremoto del 10 de agosto de 2026 y las guarda
// en data/noticias.json, con la foto real de cada nota (Bing News o la foto de
// portada del artículo). También busca videos nuevos en YouTube y los guarda en
// data/videos.json. No necesita llaves ni paquetes (Node 20+).
import { readFile, writeFile } from 'node:fs/promises';

const ARCHIVO = new URL('../data/noticias.json', import.meta.url);
const ARCHIVO_VIDEOS = new URL('../data/videos.json', import.meta.url);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
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
  const xml = await traerTexto(url);
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

async function traerTexto(url, ms = 12000) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-CO,es;q=0.9' }, signal: ctrl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

// Bing News trae la foto de cada noticia
async function bing(q) {
  const xml = await traerTexto(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&cc=CO&setlang=es`);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    let link = tag(it, 'link');
    const real = link.match(/[?&]url=([^&]+)/);
    if (real) link = decodeURIComponent(real[1]);
    let imagen = tag(it, 'News:Image');
    if (imagen) imagen = imagen + (imagen.includes('?') ? '&' : '?') + 'w=640&h=360&c=7';
    const titulo = tag(it, 'title');
    const fecha = new Date(tag(it, 'pubDate'));
    return {
      titulo, medio: tag(it, 'News:Source'), url: link, imagen,
      fecha: isNaN(fecha) ? new Date().toISOString() : fecha.toISOString(),
      depto: deptoDe(titulo), consulta: q,
    };
  });
}

async function ogImage(url) {
  try {
    const html = await traerTexto(url, 10000);
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
      || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    return m ? new URL(decode(m[1]), url).href : '';
  } catch { return ''; }
}

// Videos nuevos de YouTube sobre la reconstrucción
const CONSULTAS_VIDEO = ['reconstrucción terremoto Colombia', 'Fondo Milagro terremoto', 'damnificados terremoto Colombia vivienda'];
async function buscarVideos(q) {
  const html = await traerTexto(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAI%253D&hl=es&gl=CO`);
  const out = [];
  for (const m of html.matchAll(/"videoRenderer":\{"videoId":"([\w-]{11})"[\s\S]{0,1500}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g)) {
    let titulo = m[2]; try { titulo = JSON.parse(`"${titulo}"`); } catch {}
    out.push({ id: m[1], titulo });
  }
  return out;
}
async function actualizarVideos() {
  let previo = { fijos: [], nuevos: [] };
  try { previo = JSON.parse(await readFile(ARCHIVO_VIDEOS, 'utf8')); } catch {}
  const fijos = new Set((previo.fijos || []).map(v => v.id));
  const nuevos = new Map((previo.nuevos || []).map(v => [v.id, v]));
  for (const q of CONSULTAS_VIDEO) {
    try {
      for (const v of await buscarVideos(q)) {
        if (fijos.has(v.id) || nuevos.has(v.id)) continue;
        if (!/terremoto|sismo|reconstrucci|fondo milagro|damnificad/i.test(v.titulo)) continue;
        if (/recopilaci|compilaci|momento exacto|impactante/i.test(v.titulo)) continue;
        nuevos.set(v.id, { ...v, visto: new Date().toISOString() });
      }
    } catch (e) { console.error('YouTube falló:', q, e.message); }
  }
  const lista = [...nuevos.values()].sort((a, b) => (b.visto || '').localeCompare(a.visto || '')).slice(0, 12);
  if (JSON.stringify(lista) === JSON.stringify(previo.nuevos || [])) return;
  const actualizado = new Date(Date.now() - 5 * 3600e3).toISOString().replace('Z', '-05:00').replace(/\.\d{3}/, '');
  await writeFile(ARCHIVO_VIDEOS, JSON.stringify({ ...previo, actualizado, nuevos: lista }, null, 1) + '\n');
  console.log(`Videos nuevos: ${lista.length}`);
}

const clave = n => n.titulo.toLowerCase().replace(/[^a-záéíóúñ0-9]/g, '').slice(0, 80);

let previas = [];
try { previas = JSON.parse(await readFile(ARCHIVO, 'utf8')).noticias || []; } catch {}

const mapa = new Map(previas.map(n => [clave(n), n]));
let nuevas = 0, errores = 0;
const RELEVANTE = /terremoto|sismo|damnificad|reconstrucci|fondo milagro|ungrd/i;
function sumar(n) {
  if (!n.titulo || !RELEVANTE.test(n.titulo)) return;
  const k = clave(n);
  const ya = mapa.get(k);
  if (!ya) { mapa.set(k, n); nuevas++; return; }
  // Si ya estaba sin foto y esta versión trae foto, se la pasamos
  if (!ya.imagen && n.imagen) {
    ya.imagen = n.imagen;
    if (String(ya.url).includes('news.google.') && n.url) ya.urlDirecta = n.url;
  }
}
for (const q of CONSULTAS) {
  const [g, b] = await Promise.allSettled([buscar(q), bing(q)]);
  if (g.status === 'rejected' && b.status === 'rejected') { errores++; console.error('Falló', q, g.reason?.message); continue; }
  for (const r of [g, b]) if (r.status === 'fulfilled') r.value.forEach(sumar);
}

if (errores === CONSULTAS.length) { console.error('Ninguna consulta respondió; no se toca el archivo.'); process.exit(0); }

const noticias = [...mapa.values()].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MAX);

// Fotos reales: a las más recientes sin foto se les busca la foto de portada del artículo
const sinFoto = noticias.filter(n => !n.imagen && !n.sinFoto && (n.urlDirecta || !String(n.url).includes('news.google.'))).slice(0, 15);
await Promise.all(sinFoto.map(async n => { n.imagen = await ogImage(n.urlDirecta || n.url); if (!n.imagen) n.sinFoto = true; }));
console.log(`Con foto: ${noticias.filter(n => n.imagen).length} de ${noticias.length}`);

await actualizarVideos();
const ahora = new Date();
const actualizado = new Date(ahora.getTime() - 5 * 3600e3).toISOString().replace('Z', '-05:00').replace(/\.\d{3}/, '');
await writeFile(ARCHIVO, JSON.stringify({ actualizado, total: noticias.length, noticias }, null, 2) + '\n');
console.log(`Listo: ${nuevas} nuevas, ${noticias.length} en total (hora Colombia ${actualizado}).`);
