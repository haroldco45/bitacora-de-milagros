/* Bitácora de Milagros — Vibras Positivas HM
   Datos: data/milagros.json (curado) + data/noticias.json (robot cada 30 min)
   + búsqueda en vivo al abrir y al tocar "Actualizar" (función de Netlify, con proxies de respaldo). */
(() => {
  'use strict';

  const TZ = 'America/Bogota';
  const WHATSAPP = '573117700431';
  const CONSULTAS = [
    '"Milagro de las Regiones"',
    '"Campo Milagro" OR CampoMilagro',
    '"Ruta Milagro" OR "Isla Milagro" OR "Fondo Milagro"',
    '"Milagro de La Guajira" OR MilagroDeLaGuajira',
    '"Patria Milagro" entrega OR obra OR inauguró'
  ];
  const PROXIES = [
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u)
  ];

  const ESTADOS = {
    anunciado:   { txt: 'Anunciado',   desc: 'Se dijo, pero aún no hay obra ni plata comprobable.', paso: 1 },
    en_marcha:   { txt: 'En marcha',   desc: 'Hay contrato, obra o desembolso que se puede comprobar.', paso: 2 },
    entregado:   { txt: 'Entregado',   desc: 'La gente ya lo recibió.', paso: 3 },
    funcionando: { txt: 'Funcionando', desc: 'Entregado y sigue funcionando con el tiempo.', paso: 4 },
    vencido:     { txt: 'Vencido',     desc: 'Pasó la fecha prometida sin prueba de entrega.', paso: 1, malo: true },
    incumplido:  { txt: 'Incumplido',  desc: 'Se confirmó que no se hizo o se canceló.', paso: 1, malo: true }
  };
  const COLOR_PASO = ['var(--anun)', 'var(--marcha)', 'var(--ok)', 'var(--ok)'];

  const REGIONES = ['Maicao','Riohacha','Uribia','Manaure','San Juan del Cesar','Valledupar','Santa Marta','Barranquilla','Cartagena','Sincelejo','Coveñas','Montería','Quibdó','Caucasia','Popayán','Pasto','Neiva','Ibagué','Manizales','Armenia','Tunja','Bucaramanga','Villavicencio','Yopal','Florencia','Mocoa','Leticia',
    'La Guajira','Cesar','Magdalena','Atlántico','Bolívar','Sucre','Córdoba','Antioquia','Chocó','San Andrés','Providencia','Arauca','Casanare','Meta','Vichada','Guainía','Guaviare','Vaupés','Amazonas',
    'Putumayo','Caquetá','Nariño','Cauca','Valle del Cauca','Cali','Huila','Tolima','Caldas','Risaralda','Pereira','Quindío','Cundinamarca','Bogotá','Boyacá','Santander','Norte de Santander','Cúcuta','Urabá','Medellín'];
  const ALIAS = { 'Maicao':'La Guajira','Riohacha':'La Guajira','Uribia':'La Guajira','Manaure':'La Guajira','San Juan del Cesar':'La Guajira','Valledupar':'Cesar','Santa Marta':'Magdalena','Barranquilla':'Atlántico','Cartagena':'Bolívar','Sincelejo':'Sucre','Coveñas':'Sucre','Montería':'Córdoba','Quibdó':'Chocó','Caucasia':'Antioquia','Popayán':'Cauca','Pasto':'Nariño','Neiva':'Huila','Ibagué':'Tolima','Manizales':'Caldas','Armenia':'Quindío','Tunja':'Boyacá','Bucaramanga':'Santander','Villavicencio':'Meta','Yopal':'Casanare','Florencia':'Caquetá','Mocoa':'Putumayo','Leticia':'Amazonas',
    'Providencia':'San Andrés y Providencia','San Andrés':'San Andrés y Providencia','Cali':'Valle del Cauca','Pereira':'Risaralda','Cúcuta':'Norte de Santander','Urabá':'Antioquia','Medellín':'Antioquia' };

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const sinMov = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st = { milagros: [], noticias: [], filtroEstado: '', filtroRegion: '', filtroTipo: '', q: '', verNoticias: 15, nuevas: new Set(), abiertos: new Set(), vista: 'hoy', animado: false };

  /* ---------- utilidades ---------- */
  const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esc = s => (s || '').toString().replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const diaBog = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit' }).format(d);
  const fmtFecha = (d, conHora) => new Intl.DateTimeFormat('es-CO', Object.assign({ timeZone: TZ, day:'numeric', month:'short', year:'numeric' }, conHora ? { hour:'numeric', minute:'2-digit' } : {})).format(d);
  const fechaISO = iso => new Date(iso.length === 10 ? iso + 'T12:00:00-05:00' : iso);
  const pesos = n => {
    if (n >= 1e12) return '$' + (n / 1e12).toLocaleString('es-CO', { maximumFractionDigits: 2 }) + ' billones';
    if (n >= 1e9)  return '$' + Math.round(n / 1e6).toLocaleString('es-CO') + ' millones';
    if (n >= 1e6)  return '$' + (n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' millones';
    return '$' + n.toLocaleString('es-CO');
  };
  const haceCuanto = d => {
    const m = Math.round((Date.now() - d.getTime()) / 60000);
    if (m < 1) return 'hace un momento';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    const dd = Math.round(h / 24);
    return `hace ${dd} día${dd > 1 ? 's' : ''}`;
  };
  const hoyBog = () => diaBog(new Date());

  function tipoNoticia(t) {
    const s = norm(t);
    if (/(polemica|denuncia|critic|cuestion|contraloria|procuraduria|incumpl|retraso|sin agua|demora|reclam|protesta)/.test(s)) return 'critica';
    if (/(entreg|inaugur|entra en funcionamiento|abrio|abre la valvula|puso en marcha|recibieron|ya funciona)/.test(s)) return 'entrega';
    if (/(avanza|avance|inicia obra|arranc|contrat|adjudic|desembols)/.test(s)) return 'avance';
    return 'anuncio';
  }
  function regionNoticia(t) {
    const s = norm(t);
    for (const r of REGIONES) if (s.includes(norm(r))) return ALIAS[r] || r;
    return 'Nacional';
  }
  const claveTitulo = t => norm(t).replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3).slice(0, 9).join(' ');
  const TIPO_TXT = { anuncio: 'Anuncio', avance: 'Avance', entrega: 'Entrega', critica: 'Reparo' };

  function estadoEfectivo(m) {
    if ((m.estado === 'anunciado' || m.estado === 'en_marcha') && m.fechaCompromiso && m.fechaCompromiso < hoyBog()) return 'vencido';
    return m.estado;
  }

  /* ---------- datos ---------- */
  async function cargarJSON(ruta) {
    const r = await fetch(ruta + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(ruta + ' ' + r.status);
    return r.json();
  }

  async function conTiempo(url, ms, opc) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, Object.assign({ signal: ctrl.signal }, opc)); } finally { clearTimeout(to); }
  }

  async function buscarEnVivo() {
    const marcar = n => ({ ...n, tipo: tipoNoticia(n.titulo), region: regionNoticia(n.titulo), vivo: true });
    // 1) Función propia en Netlify
    try {
      const r = await conTiempo('/.netlify/functions/noticias', 12000, { cache: 'no-store' });
      if (r.ok) { const d = await r.json(); if (d.ok) return { ok: true, encontrados: (d.items || []).map(marcar) }; }
    } catch (e) { /* en GitHub Pages no existe: seguir */ }
    // 2) Proxies públicos de respaldo
    const encontrados = [];
    const res = await Promise.all(CONSULTAS.map(async q => {
      const rss = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:7d') + '&hl=es-419&gl=CO&ceid=CO:es-419';
      for (const px of PROXIES) {
        try {
          const r = await conTiempo(px(rss), 9000);
          if (!r.ok) continue;
          const xml = new DOMParser().parseFromString(await r.text(), 'text/xml');
          if (!xml.querySelector('channel')) continue;
          for (const it of xml.querySelectorAll('item')) {
            const crudo = it.querySelector('title')?.textContent || '';
            const medio = it.querySelector('source')?.textContent || '';
            const titulo = medio && crudo.endsWith(' - ' + medio) ? crudo.slice(0, -(medio.length + 3)) : crudo;
            if (!/milagro/i.test(titulo)) continue;
            encontrados.push(marcar({ titulo, url: it.querySelector('link')?.textContent, medio, fecha: new Date(it.querySelector('pubDate')?.textContent || Date.now()).toISOString() }));
          }
          return true;
        } catch (e) { /* siguiente */ }
      }
      return false;
    }));
    return { ok: res.some(Boolean), encontrados };
  }

  function fusionar(base, nuevas) {
    const vistos = new Map();
    for (const n of base) vistos.set(claveTitulo(n.titulo), n);
    const agregadas = [];
    for (const n of nuevas) {
      const k = claveTitulo(n.titulo);
      if (!k || vistos.has(k)) continue;
      vistos.set(k, n); agregadas.push(k);
    }
    return { todas: [...vistos.values()].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)), agregadas };
  }

  function ponerVivo(clase, txt) {
    $('#puntoVivo').className = 'punto ' + clase;
    $('#estadoVivo').textContent = txt;
  }

  async function actualizar(primeraVez) {
    const btn = $('#btnActualizar');
    btn.classList.add('girando'); btn.disabled = true;
    ponerVivo('', 'Buscando noticias…');
    let robotFecha = null;
    try {
      const [m, n] = await Promise.all([cargarJSON('data/milagros.json'), cargarJSON('data/noticias.json')]);
      st.milagros = m.milagros || [];
      const vivas = st.noticias.filter(x => x.vivo);
      st.noticias = fusionar((n.noticias || []), primeraVez ? [] : vivas).todas;
      robotFecha = n.actualizado ? new Date(n.actualizado) : null;
      $('#notActualizado').textContent = robotFecha ? 'Robot: ' + haceCuanto(robotFecha) : '';
    } catch (e) { console.warn('No se pudieron cargar los datos', e); }
    pintarTodo();

    const vivo = await buscarEnVivo();
    if (vivo.ok) {
      const fz = fusionar(st.noticias, vivo.encontrados);
      st.noticias = fz.todas;
      st.nuevas = new Set(fz.agregadas);
      ponerVivo('ok', 'En vivo · ' + new Intl.DateTimeFormat('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(new Date()) + (fz.agregadas.length ? ` · ${fz.agregadas.length} nueva${fz.agregadas.length > 1 ? 's' : ''}` : ''));
    } else {
      ponerVivo('off', 'Robot ' + (robotFecha ? haceCuanto(robotFecha) : '') + ' · en vivo no disponible');
    }
    pintarTodo();
    btn.classList.remove('girando'); btn.disabled = false;
  }

  /* ---------- pestañas ---------- */
  function irA(vista, sinScroll) {
    if (!['hoy', 'milagros', 'noticias', 'reportar'].includes(vista)) vista = 'hoy';
    st.vista = vista;
    $$('.vista').forEach(v => { v.hidden = v.dataset.vista !== vista; });
    $$('.tab').forEach(t => { const on = t.dataset.tab === vista; t.classList.toggle('activa', on); t.setAttribute('aria-current', on ? 'page' : 'false'); });
    if (vista === 'milagros') revelarTarjetas();
    if (vista === 'noticias') { $('#cntNuevas').textContent = ''; }
    if (!sinScroll) scrollTo({ top: 0, behavior: sinMov ? 'auto' : 'smooth' });
  }
  function leerHash() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (st.milagros.some(m => m.id === h)) { irA('milagros', true); abrirMilagro(h); return; }
    irA(h || 'hoy', true);
  }

  /* ---------- HOY ---------- */
  function conteos() {
    const c = { total: st.milagros.length, anunciado: 0, en_marcha: 0, entregado: 0, funcionando: 0, vencido: 0, incumplido: 0, plata: 0, conPlata: 0 };
    for (const m of st.milagros) {
      c[estadoEfectivo(m)]++;
      if (typeof m.monto === 'number') { c.plata += m.monto; c.conPlata++; }
    }
    c.ok = c.entregado + c.funcionando;
    return c;
  }

  function pintarTablero() {
    const c = conteos();
    if (!c.total) return;
    const L = 2 * Math.PI * 52;
    const fOk = c.ok / c.total, fMar = (c.ok + c.en_marcha) / c.total;
    const aplicar = () => {
      $('#arcoOk').style.strokeDasharray = `${L * fOk} ${L}`;
      $('#arcoMarcha').style.strokeDasharray = `${L * fMar} ${L}`;
    };
    const pct = Math.round(fOk * 100);
    $('#resumenFrase').textContent = `De ${c.total} milagros anunciados, ${c.ok} ya ${c.ok === 1 ? 'se entregó' : 'se entregaron'} y ${c.en_marcha} ${c.en_marcha === 1 ? 'va' : 'van'} en marcha. El resto sigue en el papel.`;
    $('#stats').innerHTML = `
      <button class="stat" type="button" data-ir="anunciado"><b data-n="${c.anunciado + c.vencido}">0</b><span>solo anunciados</span></button>
      <button class="stat" type="button" data-ir="en_marcha"><b data-n="${c.en_marcha}">0</b><span>en marcha</span></button>
      <button class="stat" type="button" data-ir="entregado"><b data-n="${c.ok}">0</b><span>entregados</span></button>
      <button class="stat" type="button" data-ir="vencido"><b data-n="${c.vencido + c.incumplido}">0</b><span>vencidos o incumplidos</span></button>
      <div class="stat plata"><b data-plata="${c.plata}">$0</b><span>anunciados en ${c.conPlata} milagros con cifra. Anunciado no es lo mismo que girado.</span></div>`;
    $('#cntMilagros').textContent = c.total;
    if (sinMov || st.animado) {
      aplicar(); $('#pctOk').textContent = pct + '%';
      $$('#stats b[data-n]').forEach(b => { b.textContent = b.dataset.n; });
      $('#stats b[data-plata]').textContent = pesos(c.plata);
      return;
    }
    st.animado = true;
    requestAnimationFrame(() => requestAnimationFrame(aplicar));
    const t0 = performance.now(), dur = 1300;
    const paso = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      $('#pctOk').textContent = Math.round(pct * e) + '%';
      $$('#stats b[data-n]').forEach(b => { b.textContent = Math.round(+b.dataset.n * e); });
      $('#stats b[data-plata]').textContent = pesos(Math.round(c.plata * e / 1e6) * 1e6);
      if (k < 1) requestAnimationFrame(paso); else $('#stats b[data-plata]').textContent = pesos(c.plata);
    };
    requestAnimationFrame(paso);
  }

  let relojCuenta = null;
  function pintarCuenta() {
    const hoy = hoyBog();
    const prox = st.milagros
      .filter(m => m.fechaCompromiso && m.fechaCompromiso >= hoy && ['anunciado', 'en_marcha'].includes(estadoEfectivo(m)))
      .sort((a, b) => a.fechaCompromiso.localeCompare(b.fechaCompromiso))[0];
    const box = $('#cuenta');
    if (!prox) { box.hidden = true; return; }
    box.hidden = false;
    const t = $('#cuentaT'); t.textContent = `${prox.titulo} · ${fmtFecha(fechaISO(prox.fechaCompromiso))}`; t.href = '#' + prox.id;
    const meta = new Date(prox.fechaCompromiso + 'T23:59:59-05:00').getTime();
    const previo = {};
    const tic = () => {
      let s = Math.max(0, Math.floor((meta - Date.now()) / 1000));
      const v = { cD: Math.floor(s / 86400), cH: Math.floor(s % 86400 / 3600), cM: Math.floor(s % 3600 / 60), cS: s % 60 };
      for (const k in v) {
        const txt = k === 'cD' ? String(v[k]) : String(v[k]).padStart(2, '0');
        if (previo[k] !== txt) {
          const el = document.getElementById(k);
          el.textContent = txt;
          if (!sinMov && previo[k] !== undefined) { el.classList.remove('tic'); void el.offsetWidth; el.classList.add('tic'); }
          previo[k] = txt;
        }
      }
    };
    clearInterval(relojCuenta); tic(); relojCuenta = setInterval(tic, 1000);
  }

  function pintarHoy() {
    const hoy = hoyBog();
    $('#hoyFecha').textContent = new Intl.DateTimeFormat('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    const items = [];
    for (const n of st.noticias) if (diaBog(new Date(n.fecha)) === hoy) items.push({ ico: 'n', icoTxt: 'N', t: n.titulo, url: n.url, ext: true, sub: `${n.medio || 'Noticia'} · ${haceCuanto(new Date(n.fecha))}` });
    for (const m of st.milagros) {
      for (const ev of m.eventos) if (ev.fecha === hoy) items.push({ ico: 'r', icoTxt: '✓', t: `${m.titulo}: ${ev.texto}`, url: '#' + m.id, sub: `Nuevo en la bitácora · ${ESTADOS[estadoEfectivo(m)].txt}` });
      if (m.fechaCompromiso === hoy) items.push({ ico: 'c', icoTxt: '!', t: `Hoy vence lo prometido: ${m.titulo}`, url: '#' + m.id, sub: '¿Se cumplió? Cuéntenos en Reportar' });
    }
    const cont = $('#hoyLista');
    if (!items.length) {
      const ult = st.noticias[0];
      cont.innerHTML = `<div class="hoy-vacio">Hoy todavía no hay movimientos de milagros.${ult ? ` Lo último: <a href="${esc(ult.url)}" target="_blank" rel="noopener">${esc(ult.titulo)}</a> (${haceCuanto(new Date(ult.fecha))}).` : ''}</div>`;
      return;
    }
    cont.innerHTML = items.map(i => `<a class="hoy-item" href="${esc(i.url)}" ${i.ext ? 'target="_blank" rel="noopener"' : ''}><span class="hoy-ico ${i.ico}" aria-hidden="true">${i.icoTxt}</span><span>${esc(i.t)}<small>${esc(i.sub)}</small></span></a>`).join('');
  }

  function pintarTicker() {
    const ult = st.noticias.slice(0, 10);
    const cinta = $('#ticker');
    if (!ult.length) { cinta.innerHTML = '<span>Esperando noticias…</span>'; return; }
    const html = ult.map(n => `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.titulo)}</a>`).join('');
    cinta.innerHTML = html + html.replace(/<a /g, '<a aria-hidden="true" tabindex="-1" ');
    const largo = ult.reduce((s, n) => s + n.titulo.length, 0);
    cinta.style.setProperty('--dur', Math.max(30, Math.round(largo / 7)) + 's');
  }

  /* ---------- MILAGROS ---------- */
  function pintarFiltros() {
    const conteo = {};
    for (const m of st.milagros) { const e = estadoEfectivo(m); conteo[e] = (conteo[e] || 0) + 1; }
    const ops = [['', 'Todos', st.milagros.length], ...Object.keys(ESTADOS).filter(k => conteo[k]).map(k => [k, ESTADOS[k].txt, conteo[k]])];
    $('#filtrosEstado').innerHTML = ops.map(([k, t, n]) => `<button class="chip" type="button" data-e="${k}" aria-pressed="${st.filtroEstado === k}">${t} · ${n}</button>`).join('');
    const regs = [...new Set(st.milagros.map(m => m.region))].sort((a, b) => a.localeCompare(b, 'es'));
    $('#filtrosRegion').innerHTML = [['', 'Todas las regiones'], ...regs.map(r => [r, r])].map(([k, t]) => `<button class="chip region" type="button" data-r="${esc(k)}" aria-pressed="${st.filtroRegion === k}">${esc(t)}</button>`).join('');
    $('#leyenda').innerHTML = Object.entries(ESTADOS).map(([k, v]) => `<li><span class="estado s-${k}">${v.txt}</span>${v.desc}</li>`).join('');
  }

  function relacionadas(m) {
    const claves = (m.palabras || []).map(norm);
    return st.noticias.filter(n => { const t = norm(n.titulo); return claves.some(k => t.includes(k)); })
      .filter(n => !m.eventos.some(ev => ev.url && ev.url === n.url)).slice(0, 4);
  }

  function pintarLista() {
    const q = norm(st.q);
    const lista = st.milagros.filter(m => {
      if (st.filtroEstado && estadoEfectivo(m) !== st.filtroEstado) return false;
      if (st.filtroRegion && m.region !== st.filtroRegion) return false;
      if (q) {
        const texto = norm([m.titulo, m.etiqueta, m.region, m.entidad, m.beneficiarios, m.contexto, ...m.eventos.map(e => e.texto)].join(' '));
        return q.split(/\s+/).every(p => texto.includes(p));
      }
      return true;
    }).sort((a, b) => b.eventos.map(e => e.fecha).sort().pop().localeCompare(a.eventos.map(e => e.fecha).sort().pop()));

    const cont = $('#lista');
    cont.innerHTML = '';
    if (!lista.length) { cont.innerHTML = '<p class="vacio">Nada con ese filtro. Pruebe otra palabra o región.</p>'; return; }
    const tpl = $('#tplMilagro');
    for (const m of lista) {
      const n = tpl.content.cloneNode(true);
      const card = n.querySelector('.card');
      card.id = m.id;
      const e = estadoEfectivo(m), info = ESTADOS[e];
      const be = n.querySelector('.estado'); be.textContent = info.txt; be.classList.add('s-' + e); be.title = info.desc;
      n.querySelector('.etiqueta').textContent = m.etiqueta || '';
      n.querySelector('.card-t').textContent = m.titulo;
      const meta = [m.region, m.monto != null ? `<b>${pesos(m.monto)}</b>` : null, m.entidad].filter(Boolean);
      n.querySelector('.card-meta').innerHTML = meta.map((x, i) => i === 1 ? `<span>${x}</span>` : `<span>${esc(x)}</span>`).join('');
      // barra de pasos
      n.querySelectorAll('.pasos span').forEach((s, i) => {
        if (i < info.paso) { s.classList.add('on'); s.style.setProperty('--i', i); s.style.setProperty('--c', info.malo ? 'var(--malo)' : COLOR_PASO[info.paso - 1]); }
      });
      // detalle
      if (m.fechaCompromiso) {
        const c = n.querySelector('.compromiso'); c.hidden = false;
        const dias = Math.round((fechaISO(m.fechaCompromiso) - fechaISO(hoyBog())) / 86400000);
        c.textContent = e === 'vencido' ? `Prometido para el ${fmtFecha(fechaISO(m.fechaCompromiso))}: venció hace ${-dias} día(s) sin prueba de entrega.`
          : (e === 'entregado' || e === 'funcionando') ? `Prometido para el ${fmtFecha(fechaISO(m.fechaCompromiso))}.`
          : dias === 0 ? 'Prometido para HOY.' : `Prometido para el ${fmtFecha(fechaISO(m.fechaCompromiso))} · faltan ${dias} días.`;
      }
      n.querySelector('.linea').innerHTML = m.eventos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(ev =>
        `<li class="t-${ev.tipo}"><span class="f">${fmtFecha(fechaISO(ev.fecha))} · ${TIPO_TXT[ev.tipo] || ev.tipo}</span>${esc(ev.texto)} <span class="src">— ${ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(ev.fuente)}</a>` : esc(ev.fuente)}</span></li>`).join('');
      if (m.contexto) {
        const d = n.querySelector('.ctx'); d.hidden = false;
        d.querySelector('span').innerHTML = esc(m.contexto) + (m.contextoUrl ? ` <a href="${esc(m.contextoUrl)}" target="_blank" rel="noopener">Fuente</a>` : '');
      }
      const rel = relacionadas(m);
      if (rel.length) {
        const r = n.querySelector('.rel'); r.hidden = false;
        r.querySelector('ul').innerHTML = rel.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titulo)}</a> <span class="muted">${esc(x.medio || '')} · ${haceCuanto(new Date(x.fecha))}</span></li>`).join('');
      }
      n.querySelector('.card-cab').addEventListener('click', () => alternar(card));
      n.querySelector('.btn-share').addEventListener('click', () => compartir(m));
      if (st.abiertos.has(m.id)) abrirCard(card, false);
      cont.appendChild(n);
    }
    if (st.vista === 'milagros') revelarTarjetas();
  }

  function abrirCard(card, abrir) {
    const cab = card.querySelector('.card-cab'), cuerpo = card.querySelector('.card-cuerpo');
    const on = abrir !== false;
    cuerpo.hidden = !on; card.classList.toggle('abierta', on); cab.setAttribute('aria-expanded', on);
    on ? st.abiertos.add(card.id) : st.abiertos.delete(card.id);
  }
  function alternar(card) { abrirCard(card, !card.classList.contains('abierta')); }
  function abrirMilagro(id) {
    st.filtroEstado = ''; st.filtroRegion = ''; st.q = ''; $('#q').value = '';
    pintarFiltros(); pintarLista();
    const card = document.getElementById(id);
    if (card) { abrirCard(card, true); card.classList.add('visible'); setTimeout(() => card.scrollIntoView({ behavior: sinMov ? 'auto' : 'smooth', block: 'start' }), 60); }
  }

  const obs = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    for (const en of es) if (en.isIntersecting) { en.target.classList.add('visible'); obs.unobserve(en.target); }
  }, { rootMargin: '0px 0px -6% 0px' }) : null;
  function revelarTarjetas() {
    $$('.card:not(.visible)').forEach((c, i) => {
      if (!obs || sinMov) { c.classList.add('visible'); return; }
      c.style.transitionDelay = Math.min(i, 6) * 60 + 'ms';
      obs.observe(c);
    });
  }

  /* ---------- NOTICIAS ---------- */
  function pintarNoticias() {
    const cnt = {};
    for (const n of st.noticias) cnt[n.tipo] = (cnt[n.tipo] || 0) + 1;
    $('#filtrosTipo').innerHTML = [['', 'Todas', st.noticias.length], ...Object.keys(TIPO_TXT).filter(k => cnt[k]).map(k => [k, TIPO_TXT[k] + 's', cnt[k]])]
      .map(([k, t, n]) => `<button class="chip" type="button" data-t="${k}" aria-pressed="${st.filtroTipo === k}">${t} · ${n}</button>`).join('');
    const lista = st.noticias.filter(n => !st.filtroTipo || n.tipo === st.filtroTipo);
    const ver = lista.slice(0, st.verNoticias);
    $('#noticias').innerHTML = ver.length ? ver.map(n => {
      const nueva = st.nuevas.has(claveTitulo(n.titulo));
      return `<a class="nota${nueva ? ' entra' : ''}" href="${esc(n.url)}" target="_blank" rel="noopener"><span class="nt">${esc(n.titulo)}</span>
        <small>${nueva ? '<span class="nueva">NUEVA</span>' : ''}<span class="tag ${n.tipo}">${TIPO_TXT[n.tipo] || n.tipo}</span><span>${esc(n.medio || '')}</span><span>${esc(n.region || '')}</span><span>${haceCuanto(new Date(n.fecha))}</span></small></a>`;
    }).join('') : '<p class="vacio">Todavía no hay noticias. El robot las trae cada 30 minutos.</p>';
    $('#masNoticias').hidden = lista.length <= st.verNoticias;
    const b = $('#cntNuevas');
    if (st.nuevas.size && st.vista !== 'noticias') { b.textContent = st.nuevas.size; b.classList.add('nuevo'); }
  }

  function pintarTodo() { pintarTablero(); pintarCuenta(); pintarHoy(); pintarTicker(); pintarFiltros(); pintarLista(); pintarNoticias(); }

  /* ---------- acciones ---------- */
  function compartir(m) {
    const url = location.origin + location.pathname + '#' + m.id;
    const texto = `${m.titulo} — estado: ${ESTADOS[estadoEfectivo(m)].txt}. Mírelo en la Bitácora de Milagros:`;
    if (navigator.share) navigator.share({ title: 'Bitácora de Milagros', text: texto, url }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url), '_blank', 'noopener');
  }

  function init() {
    document.documentElement.classList.replace('no-js', 'js');
    $('#btnReportar').href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Hola, quiero reportar un milagro para la Bitácora de Milagros.\nMunicipio:\nQué se anunció:\nQué se ve hoy (adjunto foto):\nFecha:');
    $('#btnCompartirApp').addEventListener('click', () => {
      const url = location.origin + location.pathname, texto = '¿Se cumplió o quedó en anuncio? Siga los milagros del Gobierno, uno por uno, con fuentes:';
      if (navigator.share) navigator.share({ title: 'Bitácora de Milagros', text: texto, url }).catch(() => {});
      else window.open('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url), '_blank', 'noopener');
    });
    $('#btnActualizar').addEventListener('click', () => actualizar(false));
    $('#q').addEventListener('input', e => { st.q = e.target.value; pintarLista(); });
    $('#filtrosEstado').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; st.filtroEstado = b.dataset.e; pintarFiltros(); pintarLista(); });
    $('#filtrosRegion').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; st.filtroRegion = b.dataset.r; pintarFiltros(); pintarLista(); });
    $('#filtrosTipo').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; st.filtroTipo = b.dataset.t; st.verNoticias = 15; pintarNoticias(); });
    $('#masNoticias').addEventListener('click', () => { st.verNoticias += 15; pintarNoticias(); });
    $('#stats').addEventListener('click', e => {
      const b = e.target.closest('[data-ir]'); if (!b) return;
      st.filtroEstado = b.dataset.ir === 'entregado' ? 'entregado' : b.dataset.ir;
      if (!st.milagros.some(m => estadoEfectivo(m) === st.filtroEstado)) st.filtroEstado = '';
      pintarFiltros(); pintarLista(); location.hash = 'milagros';
    });
    window.addEventListener('hashchange', leerHash);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { pintarHoy(); pintarCuenta(); } });
    irA((location.hash || '#hoy').slice(1), true);
    actualizar(true).then(leerHash);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  init();
})();
