// Búsqueda en vivo de noticias "milagro" desde el servidor de Netlify.
// La app la llama al abrir y al tocar "Actualizar": /.netlify/functions/noticias
const CONSULTAS = [
  '"Milagro de las Regiones"',
  '"Campo Milagro" OR CampoMilagro',
  '"Ruta Milagro" OR "Isla Milagro" OR "Fondo Milagro"',
  '"Milagro de La Guajira" OR MilagroDeLaGuajira',
  '"Malecón del Mar" Cartagena',
  '"Patria Milagro" entrega OR obra OR inauguró'
];
const EXCLUIR = /(ecuador|venezuela|guatemala|argentina|milagro, guayas|equipo milagro|milagro de navidad|milagro en la cancha)/i;

const decode = s => s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();

async function consultar(q) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:7d') + '&hl=es-419&gl=CO&ceid=CO:es-419';
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 BitacoraDeMilagros/1.0' } });
  if (!r.ok) return [];
  const xml = await r.text();
  const out = [];
  for (const [, it] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const get = tag => decode((it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1] || '');
    const medio = get('source');
    let titulo = get('title');
    if (medio && titulo.endsWith(' - ' + medio)) titulo = titulo.slice(0, -(medio.length + 3));
    if (!/milagro|malec[oó]n del mar/i.test(titulo) || EXCLUIR.test(titulo + ' ' + medio)) continue;
    out.push({ titulo, url: get('link'), medio, fecha: new Date(get('pubDate') || Date.now()).toISOString() });
  }
  return out;
}

export default async () => {
  const res = await Promise.allSettled(CONSULTAS.map(consultar));
  const ok = res.some(r => r.status === 'fulfilled');
  const items = res.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  return new Response(JSON.stringify({ ok, items, revisado: new Date().toISOString() }), {
    status: ok ? 200 : 502,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
  });
};
