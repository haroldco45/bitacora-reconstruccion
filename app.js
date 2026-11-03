/* Bitácora de la Reconstrucción — Vibras Positivas HM
   Registro ciudadano de la reconstrucción tras el terremoto del 10 de agosto de 2026. */
'use strict';

const ZONA = 'America/Bogota';
const SISMO = '2026-08-10';
const WHATSAPP = '573117700431';
const CLAVE_MIOS = 'bitacora_reconstruccion_mios_v1';

const TIPOS = ['Vivienda', 'Subsidios', 'Ayuda humanitaria', 'Salud', 'Educación', 'Vías y puentes',
  'Agua y servicios', 'Evaluación de edificios', 'Escombros / demolición', 'Economía / negocios',
  'Plata / fondos', 'Denuncia / reclamo', 'Emergencia', 'Otro'];
const ESTADOS = ['Anunciado', 'En ejecución', 'Entregado', 'Retrasado'];
const DEPTOS = ['Nacional', 'Chocó', 'Valle del Cauca', 'Risaralda', 'Caldas', 'Quindío', 'Antioquia', 'Cauca',
  'Nariño', 'Tolima', 'Huila', 'Córdoba', 'Sucre', 'Bolívar', 'Atlántico', 'Magdalena', 'Cesar', 'La Guajira',
  'Norte de Santander', 'Santander', 'Boyacá', 'Cundinamarca', 'Bogotá D.C.', 'Meta', 'Casanare', 'Arauca',
  'Caquetá', 'Putumayo', 'Amazonas', 'Guainía', 'Guaviare', 'Vaupés', 'Vichada', 'San Andrés'];

const S = { oficiales: [], mios: [], noticias: [], noticiasVivo: [], cifras: null, actualizado: null, fotos: [], videos: [] };

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fechaCO = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(d); // YYYY-MM-DD
const horaCO = d => new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }).format(d);
const fechaLarga = d => new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const fechaCorta = ymd => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
const pesos = n => n == null || n === '' ? '' : '$' + Number(n).toLocaleString('es-CO');
const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const uid = () => 'mi-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function diasDesdeSismo() {
  const [a, b] = [SISMO, fechaCO()].map(s => Date.UTC(...s.split('-').map((v, i) => i === 1 ? v - 1 : +v)));
  return Math.round((b - a) / 864e5);
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2600); }

function leerMios() { try { return JSON.parse(localStorage.getItem(CLAVE_MIOS)) || []; } catch { return []; } }
function guardarMios() { try { localStorage.setItem(CLAVE_MIOS, JSON.stringify(S.mios)); } catch { toast('No se pudo guardar en este teléfono'); } }
const todos = () => [...S.mios.map(r => ({ ...r, origen: 'mio' })), ...S.oficiales.map(r => ({ ...r, origen: 'oficial' }))]
  .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || '').localeCompare(a.creado || ''));

async function traer(ruta) {
  const r = await fetch(ruta + (ruta.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error(ruta + ' ' + r.status);
  return r.json();
}

/* ---------- carga de datos ---------- */
async function cargarTodo() {
  const btn = $('#btnActualizar');
  btn.classList.add('girando');
  $('#estadoSync').textContent = 'Actualizando…';
  S.mios = leerMios();
  const [reg, cif, not, fot, vid] = await Promise.allSettled([traer('data/registros.json'), traer('data/cifras.json'), traer('data/noticias.json'), traer('data/fotos.json'), traer('data/videos.json')]);
  if (fot.status === 'fulfilled') S.fotos = fot.value.fotos || [];
  if (vid.status === 'fulfilled') {
    const vistos = new Set();
    S.videos = [...(vid.value.nuevos || []).map(v => ({ ...v, nuevo: true })), ...(vid.value.fijos || [])]
      .filter(v => v.id && !vistos.has(v.id) && vistos.add(v.id));
  }
  if (reg.status === 'fulfilled') S.oficiales = reg.value.registros || [];
  if (cif.status === 'fulfilled') S.cifras = cif.value;
  if (not.status === 'fulfilled') { S.noticias = not.value.noticias || []; S.actualizado = not.value.actualizado; }
  pintarTodo();
  await busquedaEnVivo();
  btn.classList.remove('girando');
}

// Búsqueda en vivo al abrir: noticias de las últimas 48 h directo de Google News
async function busquedaEnVivo() {
  const rss = 'https://news.google.com/rss/search?q=' + encodeURIComponent('terremoto Colombia reconstrucción OR "Fondo Milagro" OR damnificados when:2d') + '&hl=es-419&gl=CO&ceid=CO:es-419';
  try {
    const ctrl = new AbortController(); setTimeout(() => ctrl.abort(), 9000);
    const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(rss), { signal: ctrl.signal });
    const j = await r.json();
    if (j.status !== 'ok') throw new Error('rss');
    S.noticiasVivo = (j.items || []).filter(i => /terremoto|sismo|damnificad|reconstrucci|fondo milagro|ungrd/i.test(i.title)).map(i => {
      const partes = i.title.split(' - ');
      const medio = partes.length > 1 ? partes.pop() : (i.author || '');
      return { titulo: partes.join(' - '), medio, url: i.link, fecha: new Date(i.pubDate.replace(' ', 'T') + 'Z').toISOString(), vivo: true };
    });
    $('#estadoSync').textContent = `En vivo · revisado ${horaCO(new Date())} (hora Colombia)`;
  } catch {
    $('#estadoSync').textContent = S.actualizado
      ? `Noticias del robot · ${horaCO(new Date(S.actualizado))} (hora Colombia)`
      : 'Sin conexión: mostrando lo guardado';
  }
  pintarNoticias(); pintarHoy();
}

function noticiasUnidas() {
  const vistas = new Set(); const out = [];
  for (const n of [...S.noticiasVivo, ...S.noticias]) {
    const k = sinTildes(n.titulo).replace(/[^a-z0-9]/g, '').slice(0, 70);
    if (!vistas.has(k)) { vistas.add(k); out.push(n); }
  }
  return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/* ---------- pintar ---------- */
function pintarTodo() { pintarHero(); pintarHoy(); pintarRegistros(); pintarNoticias(); pintarCifras(); pintarMultimedia(); }

/* ---------- fotos y videos reales ---------- */
const hashN = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
// Foto real que corresponde al registro o noticia: por tema y departamento
function fotoPara(x) {
  if (!S.fotos.length) return null;
  const k = hashN(x.id || x.titulo || '');
  const tipo = x.tipo, depto = x.depto;
  const a = S.fotos.filter(f => tipo && f.temas.includes(tipo) && depto && f.depto === depto);
  const b = S.fotos.filter(f => tipo && f.temas.includes(tipo));
  const c = S.fotos.filter(f => depto && depto !== 'Nacional' && f.depto === depto);
  const lista = a.length ? a : b.length ? b : c.length ? c : S.fotos;
  return lista[k % lista.length];
}
const imgTag = (src, alt, extra = '') => `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.closest('[data-caer]')?.remove()" ${extra}>`;

let heroIdx = 0, heroTimer = null;
function pintarHero() {
  const fotos = S.fotos.filter(f => f.portada);
  if (!fotos.length) return;
  if ($('#heroFotos').childElementCount !== fotos.length) {
    $('#heroFotos').innerHTML = fotos.map((f, i) => `<img src="${esc(f.src)}" alt="${esc(f.texto)}" referrerpolicy="no-referrer" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} onerror="this.remove()">`).join('');
    $('#heroPuntos').innerHTML = fotos.map(() => '<i></i>').join('');
  }
  const mostrar = () => {
    const imgs = [...$('#heroFotos').children], pts = [...$('#heroPuntos').children];
    if (!imgs.length) return;
    heroIdx %= imgs.length;
    imgs.forEach((im, i) => im.classList.toggle('ve', i === heroIdx));
    pts.forEach((p, i) => p.classList.toggle('on', i === heroIdx));
    const f = fotos.find(x => x.texto === imgs[heroIdx].alt);
    $('#heroPie').textContent = f ? `${f.texto} · ${f.lugar} · Foto: ${f.credito}` : '';
  };
  mostrar();
  clearInterval(heroTimer);
  heroTimer = setInterval(() => { heroIdx++; mostrar(); }, 6000);
}

function tarjetaVideo(v) {
  return `<div class="vid aparece" data-video="${esc(v.id)}" data-caer>
    <img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy" onload="if(this.naturalWidth<=120)this.closest('[data-caer]').remove()" onerror="this.closest('[data-caer]').remove()">
    ${v.nuevo ? '<span class="nuevo">Nuevo</span>' : ''}
    <span class="play"></span>
    <div class="lab">${esc(v.titulo)}</div>
  </div>`;
}
function tarjetaFoto(f) {
  return `<figure class="foto aparece" data-foto="${esc(f.id)}" data-caer>
    ${imgTag(f.src, f.texto)}
    <figcaption>${esc(f.texto)}<small>${esc(f.lugar)} · Foto: ${esc(f.credito)}</small></figcaption>
  </figure>`;
}
function pintarMultimedia() {
  $('#hoyVideos').innerHTML = S.videos.slice(0, 6).map(tarjetaVideo).join('') || '<p class="vacio">Sin videos por ahora.</p>';
  $('#gridVideos').innerHTML = S.videos.map(tarjetaVideo).join('') || '<p class="vacio">Sin videos por ahora.</p>';
  const orden = [...S.fotos].sort((a, b) => (b.portada - a.portada));
  $('#hoyFotos').innerHTML = orden.map(tarjetaFoto).join('');
  $('#gridFotos').innerHTML = S.fotos.map(tarjetaFoto).join('');
  const banda = S.fotos.find(f => f.id === 'f04') || S.fotos[0];
  if (banda) $('#bandaCifras').innerHTML = `<div style="position:absolute;inset:0;background:url('${esc(banda.src)}') center/cover"></div><span>Foto: ${esc(banda.credito)}</span>`;
}
function reproducir(el) {
  if (el.classList.contains('jugando')) return;
  el.classList.add('jugando');
  el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(el.dataset.video)}?autoplay=1&rel=0" title="Video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
}
let visorLista = [], visorI = 0;
function abrirVisor(id) {
  visorLista = S.fotos; visorI = Math.max(0, visorLista.findIndex(f => f.id === id));
  pintarVisor(); $('#visor').hidden = false;
}
function pintarVisor() {
  const f = visorLista[visorI]; if (!f) return;
  $('#visorImg').src = f.src; $('#visorImg').alt = f.texto;
  $('#visorPie').innerHTML = `${esc(f.texto)}<small>${esc(f.lugar)} · Foto: ${esc(f.credito)}${f.fuente ? ` · <a href="${esc(f.fuente)}" target="_blank" rel="noopener">Ver la nota</a>` : ''} · ${visorI + 1} de ${visorLista.length}</small>`;
}

function tarjetaRegistro(r) {
  const estCls = 'est-' + r.estado.split(' ')[0];
  const f = fotoPara(r);
  return `<article class="item con-foto aparece">
    ${f ? `<div class="item-foto" data-caer data-foto="${esc(f.id)}">${imgTag(f.src, f.texto)}<span class="cred">Foto: ${esc(f.credito)}</span></div>` : ''}
    <div class="item-cuerpo">
    <div class="meta">
      <span class="chip ${r.origen === 'oficial' ? 'verif' : 'mio'}">${r.origen === 'oficial' ? 'Verificado' : 'Mi registro'}</span>
      <span class="chip ${estCls}">${esc(r.estado)}</span>
      <span class="chip">${esc(r.tipo)}</span>
    </div>
    <h3>${esc(r.titulo)}</h3>
    <p>${esc([r.municipio, r.depto].filter(Boolean).join(', '))} · ${fechaCorta(r.fecha)}${r.entidad ? ' · ' + esc(r.entidad) : ''}</p>
    ${r.monto ? `<p><strong>${pesos(r.monto)}</strong>${r.cantidad ? ' · ' + esc(r.cantidad) : ''}</p>` : r.cantidad ? `<p>${esc(r.cantidad)}</p>` : ''}
    <div class="item-acciones">
      <button data-ver="${esc(r.id)}">Ver detalle</button>
      ${r.fuente ? `<a href="${esc(r.fuente)}" target="_blank" rel="noopener">Ver fuente</a>` : ''}
      <button data-wa="${esc(r.id)}">Compartir</button>
      ${r.origen === 'mio' ? `<button data-editar="${esc(r.id)}">Editar</button><button data-borrar="${esc(r.id)}">Borrar</button>` : ''}
    </div>
    </div>
  </article>`;
}

function tarjetaNoticia(n, i) {
  const propia = n.imagen;
  const f = propia ? null : fotoPara({ titulo: n.titulo, depto: n.depto || DEPTOS.find(d => d !== 'Nacional' && sinTildes(n.titulo).includes(sinTildes(d))) });
  const src = propia || f?.src;
  return `<article class="item noti aparece">
    ${src ? `<div class="noti-img" data-caer>${imgTag(src, '')}${propia ? '' : `<span class="cred">Archivo: ${esc(f.credito.split(' / ')[0])}</span>`}</div>` : ''}
    <div class="noti-txt">
    <div class="meta">
      ${n.vivo ? '<span class="chip vivo">En vivo</span>' : ''}
      <span class="chip">${esc(n.medio || 'Medio')}</span>
      <span class="chip">${horaCO(new Date(n.fecha))}</span>
    </div>
    <h3>${esc(n.titulo)}</h3>
    <div class="item-acciones">
      <a href="${esc(n.urlDirecta || n.url)}" target="_blank" rel="noopener">Leer la nota</a>
      <button data-anotar="${i}">Convertir en registro</button>
    </div>
    </div>
  </article>`;
}

function pintarHoy() {
  const hoy = fechaCO();
  { const f = fechaLarga(new Date()); $('#hoyFecha').textContent = f[0].toUpperCase() + f.slice(1); }
  $('#diasSismo').textContent = diasDesdeSismo();
  if (S.cifras?.mini) $('#miniCifras').innerHTML = S.cifras.mini.map(c => `<div class="mini"><b>${esc(c.valor)}</b><small>${esc(c.texto)}</small></div>`).join('');

  const lista = noticiasUnidas();
  let deHoy = lista.filter(n => fechaCO(new Date(n.fecha)) === hoy);
  const etiqueta = deHoy.length ? '' : '<p class="nota">Aún no hay noticias de hoy. Estas son las más recientes:</p>';
  if (!deHoy.length) deHoy = lista.slice(0, 3);
  window.__hoyNot = deHoy;
  $('#hoyNoticias').innerHTML = etiqueta + (deHoy.length ? deHoy.slice(0, 6).map((n, i) => tarjetaNoticia(n, 'h' + i)).join('') : '<p class="vacio">Sin noticias por ahora.</p>');

  $('#hoyRegistros').innerHTML = todos().slice(0, 4).map(tarjetaRegistro).join('') || '<p class="vacio">Sin registros todavía.</p>';
}

function pintarRegistros() {
  const q = sinTildes($('#buscaReg').value);
  const d = $('#fDepto').value, t = $('#fTipo').value, e = $('#fEstado').value;
  const lista = todos().filter(r =>
    (!d || r.depto === d) && (!t || r.tipo === t) && (!e || r.estado === e) &&
    (!q || sinTildes([r.titulo, r.detalle, r.municipio, r.depto, r.entidad, r.tipo, r.cantidad].join(' ')).includes(q)));
  const total = lista.reduce((s, r) => s + (Number(r.monto) || 0), 0);
  $('#conteoReg').textContent = `${lista.length} registro${lista.length === 1 ? '' : 's'}` + (total ? ` · montos registrados: ${pesos(total)}` : '');
  $('#listaRegistros').innerHTML = lista.map(tarjetaRegistro).join('') || '<p class="vacio">Nada coincide con la búsqueda.</p>';
}

function pintarNoticias() {
  const q = sinTildes($('#buscaNot').value);
  const lista = noticiasUnidas().filter(n => !q || sinTildes(n.titulo + ' ' + n.medio).includes(q));
  window.__notLista = lista;
  $('#conteoNot').textContent = `${lista.length} noticias` + (S.noticiasVivo.length ? ` · ${S.noticiasVivo.length} traídas en vivo` : '');
  $('#listaNoticias').innerHTML = lista.slice(0, 80).map((n, i) => tarjetaNoticia(n, 'n' + i)).join('') || '<p class="vacio">Sin noticias.</p>';
}

function pintarCifras() {
  if (!S.cifras) return;
  const c = x => `<div class="cifra"><b>${esc(x.valor)}</b><span>${esc(x.texto)}</span>${x.fuente ? `<br><a href="${esc(x.fuente)}" target="_blank" rel="noopener">fuente</a>` : ''}</div>`;
  $('#cifrasDanos').innerHTML = S.cifras.danos.map(c).join('');
  $('#cifrasPlata').innerHTML = S.cifras.plata.map(c).join('');
  $('#cifrasCorte').textContent = 'Corte: ' + S.cifras.corte;
}

/* ---------- navegación ---------- */
function ir(v) {
  document.querySelectorAll('.vista').forEach(s => s.classList.toggle('activa', s.id === 'v-' + v));
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('activo', b.dataset.v === v));
  if (v === 'hoy') pintarHoy();           // "Hoy" se refresca cada vez que se entra
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- formulario ---------- */
const F = () => $('#formReg');
function llenarSelect(sel, opciones, conVacio) {
  sel.innerHTML = (conVacio ? `<option value="">${conVacio}</option>` : '') + opciones.map(o => `<option>${esc(o)}</option>`).join('');
}
function limpiarForm() {
  F().reset(); F().elements.id.value = '';
  F().elements.fecha.value = fechaCO();
  $('#tituloForm').textContent = 'Nuevo registro';
}
function abrirForm(datos = {}) {
  limpiarForm();
  for (const [k, v] of Object.entries(datos)) if (F().elements[k] && v != null) F().elements[k].value = v;
  if (datos.id) $('#tituloForm').textContent = 'Editar registro';
  ir('nuevo');
}
F().addEventListener('submit', ev => {
  ev.preventDefault();
  const f = Object.fromEntries(new FormData(F()));
  const r = {
    id: f.id || uid(), fecha: f.fecha, depto: f.depto, municipio: f.municipio.trim(), tipo: f.tipo,
    titulo: f.titulo.trim(), detalle: f.detalle.trim(), entidad: f.entidad.trim(),
    monto: f.monto ? Number(f.monto) : null, cantidad: f.cantidad.trim(), estado: f.estado, fuente: f.fuente.trim(),
    creado: new Date().toISOString(),
  };
  const i = S.mios.findIndex(x => x.id === r.id);
  if (i >= 0) S.mios[i] = r; else S.mios.unshift(r);
  guardarMios(); limpiarForm(); pintarTodo(); ir('registros');
  toast('Registro guardado. Compártelo para que quede en la bitácora pública');
});
$('#btnCancelar').addEventListener('click', limpiarForm);

/* ---------- detalle, compartir, borrar ---------- */
function buscarReg(id) { return todos().find(r => r.id === id); }
function textoWA(r) {
  return `*Bitácora de la Reconstrucción*\n*${r.titulo}*\nLugar: ${[r.municipio, r.depto].filter(Boolean).join(', ')}\nFecha: ${fechaCorta(r.fecha)} · ${r.estado}\nTipo: ${r.tipo}` +
    (r.entidad ? `\nResponsable: ${r.entidad}` : '') + (r.monto ? `\nMonto: ${pesos(r.monto)}` : '') + (r.cantidad ? `\nCantidad: ${r.cantidad}` : '') +
    (r.detalle ? `\n\n${r.detalle}` : '') + (r.fuente ? `\n\nFuente: ${r.fuente}` : '') + `\n\n${location.href.split('#')[0]}`;
}
function verDetalle(r) {
  const f = fotoPara(r);
  $('#modalCuerpo').innerHTML = `
    ${f ? `<div class="modal-foto item-foto" data-caer>${imgTag(f.src, f.texto)}<span class="cred">Foto: ${esc(f.credito)}</span></div>` : ''}
    <div class="meta"><span class="chip ${r.origen === 'oficial' ? 'verif' : 'mio'}">${r.origen === 'oficial' ? 'Verificado' : 'Mi registro'}</span><span class="chip">${esc(r.tipo)}</span><span class="chip est-${esc(r.estado.split(' ')[0])}">${esc(r.estado)}</span></div>
    <h2>${esc(r.titulo)}</h2>
    <p><strong>Lugar:</strong> ${esc([r.municipio, r.depto].filter(Boolean).join(', '))}<br><strong>Fecha:</strong> ${fechaCorta(r.fecha)}</p>
    ${r.entidad ? `<p><strong>Responsable:</strong> ${esc(r.entidad)}</p>` : ''}
    ${r.monto ? `<p><strong>Monto:</strong> ${pesos(r.monto)}</p>` : ''}
    ${r.cantidad ? `<p><strong>Cantidad:</strong> ${esc(r.cantidad)}</p>` : ''}
    ${r.detalle ? `<p>${esc(r.detalle).replace(/\n/g, '<br>')}</p>` : ''}
    <div class="item-acciones">
      ${r.fuente ? `<a href="${esc(r.fuente)}" target="_blank" rel="noopener">Ver fuente</a>` : ''}
      <button data-wa="${esc(r.id)}">Compartir</button>
      ${r.origen === 'mio' ? `<button data-enviar="${esc(r.id)}">Enviar a la bitácora pública</button>` : ''}
    </div>`;
  $('#modal').hidden = false;
}
async function compartir(r) {
  const texto = textoWA(r);
  if (navigator.share) { try { await navigator.share({ title: r.titulo, text: texto }); return; } catch { return; } }
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
}

document.addEventListener('click', ev => {
  const vid = ev.target.closest('[data-video]'); if (vid) { reproducir(vid); return; }
  const fo = ev.target.closest('[data-foto]'); if (fo && !ev.target.closest('#modal')) { abrirVisor(fo.dataset.foto); return; }
  const b = ev.target.closest('button,[data-v]'); if (!b) return;
  if (b.dataset.ir) { ir(b.dataset.ir); return; }
  const ds = b.dataset;
  if (ds.v && b.closest('.tabs')) { if (ds.v === 'nuevo') limpiarForm(); ir(ds.v); return; }
  if (ds.ver) { const r = buscarReg(ds.ver); if (r) verDetalle(r); }
  if (ds.wa) { const r = buscarReg(ds.wa); if (r) compartir(r); }
  if (ds.enviar) { const r = buscarReg(ds.enviar); if (r) window.open(`https://wa.me/${WHATSAPP}?text=` + encodeURIComponent('Hola Harold, envío este registro para verificar y agregar a la bitácora pública:\n\n' + textoWA(r)), '_blank'); }
  if (ds.editar) { const r = S.mios.find(x => x.id === ds.editar); if (r) abrirForm({ ...r, monto: r.monto ?? '' }); }
  if (ds.borrar && confirm('¿Borrar este registro tuyo?')) { S.mios = S.mios.filter(x => x.id !== ds.borrar); guardarMios(); pintarTodo(); toast('Registro borrado'); }
  if (ds.anotar) {
    const lista = ds.anotar[0] === 'h' ? window.__hoyNot : window.__notLista;
    const n = lista?.[+ds.anotar.slice(1)];
    if (n) {
      const depto = n.depto || DEPTOS.find(d => d !== 'Nacional' && sinTildes(n.titulo).includes(sinTildes(d))) || 'Nacional';
      abrirForm({ titulo: n.titulo.slice(0, 140), fecha: fechaCO(new Date(n.fecha)), fuente: n.url, depto, estado: 'Anunciado', entidad: '' });
    }
  }
});
$('#modalCerrar').addEventListener('click', () => $('#modal').hidden = true);
$('#visorCerrar').addEventListener('click', () => $('#visor').hidden = true);
$('#visorAnt').addEventListener('click', () => { visorI = (visorI - 1 + visorLista.length) % visorLista.length; pintarVisor(); });
$('#visorSig').addEventListener('click', () => { visorI = (visorI + 1) % visorLista.length; pintarVisor(); });
$('#visor').addEventListener('click', ev => { if (ev.target.id === 'visor') $('#visor').hidden = true; });
document.addEventListener('keydown', ev => {
  if ($('#visor').hidden) return;
  if (ev.key === 'Escape') $('#visor').hidden = true;
  if (ev.key === 'ArrowLeft') $('#visorAnt').click();
  if (ev.key === 'ArrowRight') $('#visorSig').click();
});
{ let x0 = null; const v = $('#visor');
  v.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
  v.addEventListener('touchend', e => { if (x0 == null) return; const d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 50) (d < 0 ? $('#visorSig') : $('#visorAnt')).click(); x0 = null; }); }
$('#modal').addEventListener('click', ev => { if (ev.target.id === 'modal') $('#modal').hidden = true; });

/* ---------- exportar / importar ---------- */
function descargar(nombre, contenido, tipo) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombre; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$('#btnExportCSV').addEventListener('click', () => {
  const cols = ['fecha', 'depto', 'municipio', 'tipo', 'titulo', 'detalle', 'entidad', 'monto', 'cantidad', 'estado', 'fuente', 'origen'];
  const filas = todos().map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(';'));
  descargar(`bitacora-reconstruccion-${fechaCO()}.csv`, '﻿' + cols.join(';') + '\n' + filas.join('\n'), 'text/csv;charset=utf-8');
});
$('#btnExportJSON').addEventListener('click', () => {
  descargar(`mis-registros-${fechaCO()}.json`, JSON.stringify({ exportado: new Date().toISOString(), registros: S.mios }, null, 2), 'application/json');
});
$('#inImport').addEventListener('change', async ev => {
  const f = ev.target.files[0]; if (!f) return;
  try {
    const datos = JSON.parse(await f.text());
    const nuevos = (datos.registros || datos).filter(r => r && r.id && r.titulo && !S.mios.some(m => m.id === r.id));
    S.mios.push(...nuevos); guardarMios(); pintarTodo();
    toast(`Se restauraron ${nuevos.length} registros`);
  } catch { toast('Ese archivo no es una copia válida'); }
  ev.target.value = '';
});

/* ---------- arranque ---------- */
llenarSelect(F().elements.depto, DEPTOS); llenarSelect(F().elements.tipo, TIPOS); llenarSelect(F().elements.estado, ESTADOS);
llenarSelect($('#fDepto'), DEPTOS, 'Todos los departamentos');
llenarSelect($('#fTipo'), TIPOS, 'Todos los tipos');
llenarSelect($('#fEstado'), ESTADOS, 'Todos los estados');
['#buscaReg', '#fDepto', '#fTipo', '#fEstado'].forEach(s => $(s).addEventListener('input', pintarRegistros));
$('#buscaNot').addEventListener('input', pintarNoticias);
$('#btnActualizar').addEventListener('click', cargarTodo);
document.addEventListener('visibilitychange', () => { if (!document.hidden) pintarHoy(); });
limpiarForm();
cargarTodo();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
