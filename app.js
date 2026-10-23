/* Bitácora de Milagros — Vibras Positivas HM
   Datos: data/milagros.json (curado) + data/noticias.json (robot cada 30 min)
   + búsqueda en vivo de noticias al abrir y al tocar "Actualizar". */
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
    anunciado:   { txt: 'Anunciado',   desc: 'Se dijo, pero aún no hay obra ni plata comprobable.' },
    en_marcha:   { txt: 'En marcha',   desc: 'Hay contrato, obra o desembolso que se puede comprobar.' },
    entregado:   { txt: 'Entregado',   desc: 'La gente ya lo recibió.' },
    funcionando: { txt: 'Funcionando', desc: 'Entregado y sigue funcionando con el tiempo.' },
    vencido:     { txt: 'Vencido',     desc: 'Pasó la fecha prometida sin prueba de entrega.' },
    incumplido:  { txt: 'Incumplido',  desc: 'Se confirmó que no se hizo o se canceló.' }
  };

  const REGIONES = ['Maicao','Riohacha','Uribia','Manaure','San Juan del Cesar','Valledupar','Santa Marta','Barranquilla','Cartagena','Sincelejo','Coveñas','Montería','Quibdó','Caucasia','Popayán','Pasto','Neiva','Ibagué','Manizales','Armenia','Tunja','Bucaramanga','Villavicencio','Yopal','Florencia','Mocoa','Leticia','La Guajira','Cesar','Magdalena','Atlántico','Bolívar','Sucre','Córdoba','Antioquia','Chocó',
    'San Andrés','Providencia','Arauca','Casanare','Meta','Vichada','Guainía','Guaviare','Vaupés','Amazonas',
    'Putumayo','Caquetá','Nariño','Cauca','Valle del Cauca','Cali','Huila','Tolima','Caldas','Risaralda','Pereira',
    'Quindío','Cundinamarca','Bogotá','Boyacá','Santander','Norte de Santander','Cúcuta','Urabá','Medellín'];

  const $ = s => document.querySelector(s);
  const estado = { milagros: [], noticias: [], filtroEstado: '', filtroRegion: '', q: '', verNoticias: 12, nuevas: new Set() };

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

  // Misma clasificación que usa el robot
  function tipoNoticia(t) {
    const s = norm(t);
    if (/(polemica|denuncia|critic|cuestion|contraloria|procuraduria|incumpl|retraso|sin agua|demora|reclam|protesta)/.test(s)) return 'critica';
    if (/(entreg|inaugur|entra en funcionamiento|abrio|abre la valvula|puso en marcha|recibieron|ya funciona)/.test(s)) return 'entrega';
    if (/(avanza|avance|inicia obra|arranc|contrat|adjudic|desembols)/.test(s)) return 'avance';
    return 'anuncio';
  }
  const ALIAS = { 'Maicao':'La Guajira','Riohacha':'La Guajira','Uribia':'La Guajira','Manaure':'La Guajira','San Juan del Cesar':'La Guajira','Valledupar':'Cesar','Santa Marta':'Magdalena','Barranquilla':'Atlántico','Cartagena':'Bolívar','Sincelejo':'Sucre','Coveñas':'Sucre','Montería':'Córdoba','Quibdó':'Chocó','Caucasia':'Antioquia','Popayán':'Cauca','Pasto':'Nariño','Neiva':'Huila','Ibagué':'Tolima','Manizales':'Caldas','Armenia':'Quindío','Tunja':'Boyacá','Bucaramanga':'Santander','Villavicencio':'Meta','Yopal':'Casanare','Florencia':'Caquetá','Mocoa':'Putumayo','Leticia':'Amazonas','Providencia':'San Andrés y Providencia','San Andrés':'San Andrés y Providencia','Cali':'Valle del Cauca',
    'Pereira':'Risaralda','Cúcuta':'Norte de Santander','Urabá':'Antioquia','Medellín':'Antioquia' };
  function regionNoticia(t) {
    const s = norm(t);
    for (const r of REGIONES) if (s.includes(norm(r))) return ALIAS[r] || r;
    return 'Nacional';
  }
  const claveTitulo = t => norm(t).replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3).slice(0, 9).join(' ');

  /* ---------- estado efectivo (vencido) ---------- */
  function estadoEfectivo(m) {
    if (m.estado === 'anunciado' || m.estado === 'en_marcha') {
      if (m.fechaCompromiso && m.fechaCompromiso < hoyBog()) return 'vencido';
    }
    return m.estado;
  }

  /* ---------- carga ---------- */
  async function cargarJSON(ruta) {
    const r = await fetch(ruta + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(ruta + ' ' + r.status);
    return r.json();
  }

  async function buscarEnVivo() {
    const encontrados = [];
    const tareas = CONSULTAS.map(async q => {
      const rss = 'https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:7d') + '&hl=es-419&gl=CO&ceid=CO:es-419';
      for (const px of PROXIES) {
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 9000);
          const r = await fetch(px(rss), { signal: ctrl.signal });
          clearTimeout(to);
          if (!r.ok) continue;
          const xml = new DOMParser().parseFromString(await r.text(), 'text/xml');
          const items = [...xml.querySelectorAll('item')];
          if (!items.length && !xml.querySelector('channel')) continue;
          for (const it of items) {
            const crudo = it.querySelector('title')?.textContent || '';
            const medio = it.querySelector('source')?.textContent || '';
            const titulo = medio && crudo.endsWith(' - ' + medio) ? crudo.slice(0, -(medio.length + 3)) : crudo;
            if (!/milagro/i.test(titulo)) continue;
            const fecha = new Date(it.querySelector('pubDate')?.textContent || Date.now());
            encontrados.push({ titulo, url: it.querySelector('link')?.textContent, medio, fecha: fecha.toISOString(), tipo: tipoNoticia(titulo), region: regionNoticia(titulo), vivo: true });
          }
          return true;
        } catch (e) { /* probar siguiente proxy */ }
      }
      return false;
    });
    const ok = (await Promise.all(tareas)).some(Boolean);
    return { ok, encontrados };
  }

  function fusionar(base, nuevas) {
    const vistos = new Map();
    for (const n of base) vistos.set(claveTitulo(n.titulo), n);
    const agregadas = [];
    for (const n of nuevas) {
      const k = claveTitulo(n.titulo);
      if (!k || vistos.has(k)) continue;
      vistos.set(k, n);
      agregadas.push(k);
    }
    const todas = [...vistos.values()].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    return { todas, agregadas };
  }

  async function actualizar(primeraVez) {
    const btn = $('#btnActualizar');
    const vivo = $('#estadoVivo');
    btn.classList.add('girando'); btn.disabled = true;
    vivo.className = 'vivo'; vivo.textContent = 'Buscando noticias en vivo…';

    let robotFecha = null;
    try {
      const [m, n] = await Promise.all([cargarJSON('data/milagros.json'), cargarJSON('data/noticias.json')]);
      estado.milagros = m.milagros || [];
      const previas = estado.noticias;
      estado.noticias = (n.noticias || []).slice().sort((x, y) => new Date(y.fecha) - new Date(x.fecha));
      if (!primeraVez) {
        const fz = fusionar(estado.noticias, previas.filter(x => x.vivo));
        estado.noticias = fz.todas;
      }
      robotFecha = n.actualizado ? new Date(n.actualizado) : null;
      $('#notActualizado').textContent = robotFecha ? 'Robot: ' + haceCuanto(robotFecha) : '';
    } catch (e) {
      console.warn('No se pudieron cargar los datos', e);
    }
    pintarTodo();

    const vivoRes = await buscarEnVivo();
    if (vivoRes.ok) {
      const fz = fusionar(estado.noticias, vivoRes.encontrados);
      estado.noticias = fz.todas;
      estado.nuevas = new Set(fz.agregadas);
      vivo.className = 'vivo ok';
      vivo.textContent = `En vivo · revisado ${fmtFecha(new Date(), true)}` + (fz.agregadas.length ? ` · ${fz.agregadas.length} noticia${fz.agregadas.length > 1 ? 's' : ''} nueva${fz.agregadas.length > 1 ? 's' : ''}` : ' · sin noticias nuevas');
    } else {
      vivo.className = 'vivo off';
      vivo.textContent = 'Sin conexión en vivo: mostrando lo que trajo el robot' + (robotFecha ? ' ' + haceCuanto(robotFecha) : '');
    }
    pintarTodo();
    btn.classList.remove('girando'); btn.disabled = false;
  }

  /* ---------- pintar ---------- */
  function pintarStats() {
    const c = { total: estado.milagros.length, anunciado: 0, en_marcha: 0, entregado: 0, funcionando: 0, vencido: 0, incumplido: 0 };
    let plata = 0, conPlata = 0;
    for (const m of estado.milagros) {
      c[estadoEfectivo(m)]++;
      if (typeof m.monto === 'number') { plata += m.monto; conPlata++; }
    }
    const cumplidos = c.entregado + c.funcionando;
    $('#stats').innerHTML = `
      <div class="stat"><b>${c.total}</b><span>milagros en seguimiento</span></div>
      <div class="stat"><b>${c.anunciado + c.vencido}</b><span>solo anunciados${c.vencido ? ` (${c.vencido} vencido${c.vencido > 1 ? 's' : ''})` : ''}</span></div>
      <div class="stat"><b>${c.en_marcha}</b><span>en marcha</span></div>
      <div class="stat"><b>${cumplidos}</b><span>entregados</span></div>
      <div class="stat plata"><b>${pesos(plata)}</b><span>anunciados en ${conPlata} milagros que dijeron cifra. Anunciado no es lo mismo que girado.</span></div>`;
  }

  function pintarHoy() {
    const hoy = hoyBog();
    $('#hoyFecha').textContent = fmtFecha(new Date());
    const items = [];
    for (const n of estado.noticias) if (diaBog(new Date(n.fecha)) === hoy) items.push({ t: n.titulo, url: n.url, sub: `${n.medio || 'Noticia'} · ${haceCuanto(new Date(n.fecha))}` });
    for (const m of estado.milagros) {
      for (const ev of m.eventos) if (ev.fecha === hoy) items.push({ t: `${m.titulo}: ${ev.texto}`, url: '#' + m.id, sub: `Registro de la bitácora · ${ESTADOS[estadoEfectivo(m)].txt}` });
      if (m.fechaCompromiso === hoy) items.push({ t: `Hoy vence lo prometido: ${m.titulo}`, url: '#' + m.id, sub: '¿Se cumplió? Cuéntenos' });
    }
    // próximos compromisos (7 días)
    const prox = estado.milagros.filter(m => m.fechaCompromiso && m.fechaCompromiso > hoy && (estadoEfectivo(m) === 'anunciado' || estadoEfectivo(m) === 'en_marcha'))
      .map(m => ({ m, dias: Math.round((fechaISO(m.fechaCompromiso) - fechaISO(hoy)) / 86400000) }))
      .filter(x => x.dias <= 14).sort((a, b) => a.dias - b.dias);
    for (const x of prox) items.push({ t: `Faltan ${x.dias} día${x.dias > 1 ? 's' : ''}: ${x.m.titulo}`, url: '#' + x.m.id, sub: `Compromiso para el ${fmtFecha(fechaISO(x.m.fechaCompromiso))}` });

    const cont = $('#hoyLista');
    if (!items.length) {
      const ult = estado.noticias[0];
      cont.innerHTML = `<div class="hoy-vacio">Hoy todavía no hay noticias nuevas de milagros.${ult ? ` Lo último fue <a href="${esc(ult.url)}" target="_blank" rel="noopener">${esc(ult.titulo)}</a> (${haceCuanto(new Date(ult.fecha))}).` : ''}</div>`;
      return;
    }
    cont.innerHTML = items.map(i => `<a class="hoy-item" href="${esc(i.url)}" ${i.url.startsWith('#') ? '' : 'target="_blank" rel="noopener"'}>${esc(i.t)}<small>${esc(i.sub)}</small></a>`).join('');
  }

  function pintarFiltros() {
    const cont = $('#filtrosEstado');
    const conteo = {};
    for (const m of estado.milagros) { const e = estadoEfectivo(m); conteo[e] = (conteo[e] || 0) + 1; }
    const opciones = [['', 'Todos', estado.milagros.length], ...Object.keys(ESTADOS).filter(k => conteo[k]).map(k => [k, ESTADOS[k].txt, conteo[k]])];
    cont.innerHTML = opciones.map(([k, t, n]) => `<button class="chip" type="button" data-e="${k}" aria-pressed="${estado.filtroEstado === k}">${t} · ${n}</button>`).join('');
    const sel = $('#filtroRegion');
    const regs = [...new Set(estado.milagros.map(m => m.region))].sort((a, b) => a.localeCompare(b, 'es'));
    sel.innerHTML = '<option value="">Todas</option>' + regs.map(r => `<option ${r === estado.filtroRegion ? 'selected' : ''}>${esc(r)}</option>`).join('');
  }

  function relacionadas(m) {
    const claves = (m.palabras || []).map(norm);
    return estado.noticias.filter(n => { const t = norm(n.titulo); return claves.some(k => t.includes(k)); })
      .filter(n => !m.eventos.some(ev => ev.url && ev.url === n.url)).slice(0, 4);
  }

  function pintarLista() {
    const q = norm(estado.q);
    const lista = estado.milagros.filter(m => {
      if (estado.filtroEstado && estadoEfectivo(m) !== estado.filtroEstado) return false;
      if (estado.filtroRegion && m.region !== estado.filtroRegion) return false;
      if (q) {
        const texto = norm([m.titulo, m.etiqueta, m.region, m.entidad, m.beneficiarios, m.contexto, ...m.eventos.map(e => e.texto)].join(' '));
        return q.split(/\s+/).every(p => texto.includes(p));
      }
      return true;
    }).sort((a, b) => {
      const ua = a.eventos.map(e => e.fecha).sort().pop(), ub = b.eventos.map(e => e.fecha).sort().pop();
      return ub.localeCompare(ua);
    });

    const cont = $('#lista');
    cont.innerHTML = '';
    if (!lista.length) { cont.innerHTML = '<p class="vacio">No hay milagros con ese filtro. Pruebe otra palabra.</p>'; return; }
    const tpl = $('#tplMilagro');
    for (const m of lista) {
      const n = tpl.content.cloneNode(true);
      const card = n.querySelector('.card');
      card.id = m.id;
      const e = estadoEfectivo(m);
      const be = n.querySelector('.estado'); be.textContent = ESTADOS[e].txt; be.classList.add('s-' + e); be.title = ESTADOS[e].desc;
      n.querySelector('.etiqueta').textContent = m.etiqueta || '';
      n.querySelector('.card-t').textContent = m.titulo;
      const meta = [
        ['Dónde', m.region], ['Quién', m.entidad],
        m.monto != null ? [(e === 'entregado' || e === 'funcionando') ? 'Plata entregada' : 'Plata anunciada', pesos(m.monto)] : null,
        m.beneficiarios ? ['Para', m.beneficiarios] : null
      ].filter(Boolean);
      n.querySelector('.meta').innerHTML = meta.map(([k, v]) => `<span><b>${k}:</b> ${esc(v)}</span>`).join('');
      if (m.fechaCompromiso) {
        const c = n.querySelector('.compromiso'); c.hidden = false;
        const dias = Math.round((fechaISO(m.fechaCompromiso) - fechaISO(hoyBog())) / 86400000);
        c.textContent = e === 'vencido' ? `Prometido para el ${fmtFecha(fechaISO(m.fechaCompromiso))}: venció hace ${-dias} día(s) sin prueba de entrega.`
          : (e === 'entregado' || e === 'funcionando') ? `Prometido para el ${fmtFecha(fechaISO(m.fechaCompromiso))}.`
          : dias === 0 ? 'Prometido para HOY.' : `Prometido para el ${fmtFecha(fechaISO(m.fechaCompromiso))} · faltan ${dias} días.`;
      }
      n.querySelector('.linea').innerHTML = m.eventos.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(ev =>
        `<li class="t-${ev.tipo}"><span class="f">${fmtFecha(fechaISO(ev.fecha))} · ${ev.tipo === 'critica' ? 'reparo' : ev.tipo}</span>${esc(ev.texto)} <span class="src">— ${ev.url ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(ev.fuente)}</a>` : esc(ev.fuente)}</span></li>`).join('');
      if (m.contexto) {
        const d = n.querySelector('.ctx'); d.hidden = false;
        d.querySelector('p').innerHTML = esc(m.contexto) + (m.contextoUrl ? ` <a href="${esc(m.contextoUrl)}" target="_blank" rel="noopener">Fuente</a>` : '');
      }
      const rel = relacionadas(m);
      if (rel.length) {
        const r = n.querySelector('.rel'); r.hidden = false;
        r.querySelector('ul').innerHTML = rel.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.titulo)}</a> <span class="muted">${esc(x.medio || '')} · ${haceCuanto(new Date(x.fecha))}</span></li>`).join('');
      }
      n.querySelector('.btn-share').addEventListener('click', () => compartir(m));
      cont.appendChild(n);
    }
  }

  function pintarNoticias() {
    const cont = $('#noticias');
    const ver = estado.noticias.slice(0, estado.verNoticias);
    if (!ver.length) { cont.innerHTML = '<p class="vacio">Todavía no hay noticias. El robot las trae cada 30 minutos.</p>'; }
    else cont.innerHTML = ver.map(n => {
      const nueva = estado.nuevas.has(claveTitulo(n.titulo));
      return `<a class="nota" href="${esc(n.url)}" target="_blank" rel="noopener"><span class="nt">${esc(n.titulo)}</span>
        <small>${nueva ? '<span class="nueva">NUEVA</span>' : ''}<span class="tag ${n.tipo}">${n.tipo === 'critica' ? 'reparo' : n.tipo}</span><span>${esc(n.medio || '')}</span><span>${esc(n.region || '')}</span><span>${fmtFecha(new Date(n.fecha), true)}</span></small></a>`;
    }).join('');
    $('#masNoticias').hidden = estado.noticias.length <= estado.verNoticias;
  }

  function pintarLeyenda() {
    $('#leyenda').innerHTML = Object.entries(ESTADOS).map(([k, v]) => `<li><span class="estado s-${k}">${v.txt}</span>${v.desc}</li>`).join('');
  }

  function pintarTodo() { pintarStats(); pintarHoy(); pintarFiltros(); pintarLista(); pintarNoticias(); }

  /* ---------- acciones ---------- */
  function compartir(m) {
    const url = location.origin + location.pathname + '#' + m.id;
    const texto = `${m.titulo} — estado: ${ESTADOS[estadoEfectivo(m)].txt}. Siga los milagros en la Bitácora de Milagros:`;
    if (navigator.share) navigator.share({ title: 'Bitácora de Milagros', text: texto, url }).catch(() => {});
    else window.open('https://wa.me/?text=' + encodeURIComponent(texto + ' ' + url), '_blank', 'noopener');
  }

  function init() {
    pintarLeyenda();
    $('#btnReportar').href = 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent('Hola, quiero reportar un milagro para la Bitácora de Milagros.\nMunicipio:\nQué se anunció:\nQué se ve hoy (adjunto foto):\nFecha:');
    $('#btnActualizar').addEventListener('click', () => actualizar(false));
    $('#q').addEventListener('input', e => { estado.q = e.target.value; pintarLista(); });
    $('#filtrosEstado').addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      estado.filtroEstado = b.dataset.e; pintarFiltros(); pintarLista();
    });
    $('#filtroRegion').addEventListener('change', e => { estado.filtroRegion = e.target.value; pintarLista(); });
    $('#masNoticias').addEventListener('click', () => { estado.verNoticias += 12; pintarNoticias(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pintarHoy(); });
    actualizar(true).then(() => { if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' }); });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  init();
})();
