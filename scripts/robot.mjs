// Robot de la Bitácora de Milagros
// Corre en GitHub Actions cada 30 minutos: busca noticias reales con la palabra "milagro"
// en Google Noticias Colombia y actualiza data/noticias.json (no toca milagros.json).
import { readFile, writeFile } from 'node:fs/promises';

const ARCHIVO = new URL('../data/noticias.json', import.meta.url);
const MAX = 400;
const CONSULTAS = [
  '"Milagro de las Regiones"',
  '"Campo Milagro" OR CampoMilagro',
  '"Ruta Milagro" OR "Isla Milagro" OR "Fondo Milagro"',
  '"Milagro de La Guajira" OR MilagroDeLaGuajira',
  '"Patria Milagro" entrega OR obra OR inauguró',
  '"Patria Milagro" ministerio anuncia'
];
// Evita mezclar otros países y el municipio de Milagro (Ecuador)
const EXCLUIR = /(ecuador|venezuela|guatemala|argentina|milagro, guayas|equipo milagro|milagro de navidad|milagro en la cancha)/i;

const REGIONES = ['Maicao','Riohacha','Uribia','Manaure','San Juan del Cesar','Valledupar','Santa Marta','Barranquilla','Cartagena','Sincelejo','Coveñas','Montería','Quibdó','Caucasia','Popayán','Pasto','Neiva','Ibagué','Manizales','Armenia','Tunja','Bucaramanga','Villavicencio','Yopal','Florencia','Mocoa','Leticia','La Guajira','Cesar','Magdalena','Atlántico','Bolívar','Sucre','Córdoba','Antioquia','Chocó',
  'San Andrés','Providencia','Arauca','Casanare','Meta','Vichada','Guainía','Guaviare','Vaupés','Amazonas',
  'Putumayo','Caquetá','Nariño','Cauca','Valle del Cauca','Cali','Huila','Tolima','Caldas','Risaralda','Pereira',
  'Quindío','Cundinamarca','Bogotá','Boyacá','Santander','Norte de Santander','Cúcuta','Urabá','Medellín'];
const ALIAS = { 'Maicao':'La Guajira','Riohacha':'La Guajira','Uribia':'La Guajira','Manaure':'La Guajira','San Juan del Cesar':'La Guajira','Valledupar':'Cesar','Santa Marta':'Magdalena','Barranquilla':'Atlántico','Cartagena':'Bolívar','Sincelejo':'Sucre','Coveñas':'Sucre','Montería':'Córdoba','Quibdó':'Chocó','Caucasia':'Antioquia','Popayán':'Cauca','Pasto':'Nariño','Neiva':'Huila','Ibagué':'Tolima','Manizales':'Caldas','Armenia':'Quindío','Tunja':'Boyacá','Bucaramanga':'Santander','Villavicencio':'Meta','Yopal':'Casanare','Florencia':'Caquetá','Mocoa':'Putumayo','Leticia':'Amazonas','Providencia':'San Andrés y Providencia','San Andrés':'San Andrés y Providencia','Cali':'Valle del Cauca',
  'Pereira':'Risaralda','Cúcuta':'Norte de Santander','Urabá':'Antioquia','Medellín':'Antioquia' };

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const clave = t => norm(t).replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3).slice(0, 9).join(' ');
const decode = s => s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();

function tipo(t) {
  const s = norm(t);
  if (/(polemica|denuncia|critic|cuestion|contraloria|procuraduria|incumpl|retraso|sin agua|demora|reclam|protesta)/.test(s)) return 'critica';
  if (/(entreg|inaugur|entra en funcionamiento|abrio|abre la valvula|puso en marcha|recibieron|ya funciona)/.test(s)) return 'entrega';
  if (/(avanza|avance|inicia obra|arranc|contrat|adjudic|desembols)/.test(s)) return 'avance';
  return 'anuncio';
}
function region(t) {
  const s = norm(t);
  for (const r of REGIONES) if (s.includes(norm(r))) return ALIAS[r] || r;
  return 'Nacional';
}
// Hora de Colombia (UTC-5) en formato ISO
function isoBogota(d) {
  const b = new Date(d.getTime() - 5 * 3600e3);
  return b.toISOString().replace('Z', '').replace(/\.\d+$/, '') + '-05:00';
}

async function consultar(q) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:14d') + '&hl=es-419&gl=CO&ceid=CO:es-419';
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 BitacoraDeMilagros/1.0' } });
  if (!r.ok) throw new Error(q + ' → HTTP ' + r.status);
  const xml = await r.text();
  const items = [];
  for (const [, it] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const get = tag => decode((it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || '');
    const medio = get('source');
    let titulo = get('title');
    if (medio && titulo.endsWith(' - ' + medio)) titulo = titulo.slice(0, -(medio.length + 3));
    if (!/milagro/i.test(titulo) || EXCLUIR.test(titulo + ' ' + medio)) continue;
    const fecha = new Date(get('pubDate') || Date.now());
    items.push({ titulo, url: get('link'), medio, fecha: isoBogota(fecha), tipo: tipo(titulo), region: region(titulo) });
  }
  return items;
}

const actual = JSON.parse(await readFile(ARCHIVO, 'utf8'));
const mapa = new Map((actual.noticias || []).map(n => [clave(n.titulo), n]));
let nuevas = 0, fallos = 0;
for (const q of CONSULTAS) {
  try {
    for (const n of await consultar(q)) {
      const k = clave(n.titulo);
      if (k && !mapa.has(k)) { mapa.set(k, n); nuevas++; }
    }
  } catch (e) { fallos++; console.warn('Falló:', e.message); }
}
if (fallos === CONSULTAS.length) { console.error('Ninguna consulta funcionó; no se toca el archivo.'); process.exit(0); }

const noticias = [...mapa.values()].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, MAX);
const salida = { actualizado: isoBogota(new Date()), origen: 'robot', noticias };
// Solo se escribe si hay noticias nuevas; así no se hace un commit vacío cada 30 min.
if (nuevas > 0 || actual.origen !== 'robot') {
  await writeFile(ARCHIVO, JSON.stringify(salida, null, 2) + '\n');
  console.log(`Listo: ${nuevas} noticias nuevas, ${noticias.length} en total.`);
} else {
  console.log('Sin noticias nuevas.');
}
