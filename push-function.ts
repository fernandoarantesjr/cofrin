// @ts-nocheck
// Cofrin — carteiro das notificações
// acao: 'chave'  -> devolve a chave pública pro celular se cadastrar
//       'avisar' -> (pessoa logada) manda aviso pros outros celulares
//       'manha' / 'semana' -> (agendado pelo banco) avisos automáticos
// As chaves secretas são criadas aqui mesmo na primeira vez e ficam numa tabela que só o servidor lê.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SB_URL = Deno.env.get('SUPABASE_URL');
const ANON = Deno.env.get('SUPABASE_ANON_KEY');
const adm = createClient(SB_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fmt = (v) => '₲ ' + Math.round(v).toLocaleString('pt-BR');
const fmtK = (v) => { const a = Math.abs(v); return (v < 0 ? '−' : '') + (a >= 1e6 ? (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi' : a >= 1e3 ? Math.round(a / 1e3) + ' mil' : Math.round(a)); };
const hojePY = (off = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(new Date(Date.now() + off * 864e5));
const dtm = (m, dia) => { const [y, mm] = m.split('-').map(Number); const last = new Date(Date.UTC(y, mm, 0)).getUTCDate(); return m + '-' + String(Math.min(dia, last)).padStart(2, '0'); };
const addM = (m, n) => { const [y, mm] = m.split('-').map(Number); return new Date(Date.UTC(y, mm - 1 + n, 15)).toISOString().slice(0, 7); };
const CATE = { Mercado: '🛒', Comida: '🍔', Delivery: '🛵', Transporte: '🚗', Casa: '🏠', 'Bebê': '🍼', 'Saúde': '💊', Lazer: '🎮', Compras: '🛍️', Contas: '🧾', Pets: '🐾', Outros: '✨' };

async function segredo(id, criar) {
  const { data } = await adm.from('cofrin_segredos').select('valor').eq('id', id).maybeSingle();
  if (data) return data.valor;
  const valor = await criar();
  await adm.from('cofrin_segredos').upsert({ id, valor });
  return valor;
}
const vapid = () => segredo('vapid', async () => {
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { pub: b64u(await crypto.subtle.exportKey('raw', k.publicKey)), priv: (await crypto.subtle.exportKey('jwk', k.privateKey)).d };
});
const cronToken = () => segredo('cron', async () => ({ token: b64u(crypto.getRandomValues(new Uint8Array(24))) }));

async function enviar(payload, { excluir = null, so = null } = {}) {
  const v = await vapid();
  webpush.setVapidDetails('mailto:fernando@cofrin.app', v.pub, v.priv);
  let q = adm.from('cofrin_push').select('endpoint,sub');
  if (so) q = q.eq('endpoint', so);
  const { data: subs } = await q;
  let enviados = 0; const falhas = [];
  for (const s of subs || []) {
    if (excluir && s.endpoint === excluir) continue;
    try { await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 43200, urgency: 'high' }); enviados++; }
    catch (e) {
      falhas.push(String(e.statusCode || '') + ' ' + String(e.body || e.message || e).slice(0, 100));
      if (e.statusCode === 404 || e.statusCode === 410) await adm.from('cofrin_push').delete().eq('endpoint', s.endpoint);
    }
  }
  console.log(JSON.stringify({ aviso: payload.title, aparelhos: (subs || []).length, enviados, falhas }));
  return { enviados, falhas };
}

async function lerDados(m) {
  const { data } = await adm.from('cofrin').select('id,data').in('id', ['config/geral', 'meses/' + m, 'meses/' + addM(m, -1), 'meses/' + addM(m, 1)]);
  const by = Object.fromEntries((data || []).map((r) => [r.id, r.data]));
  const cfg = by['config/geral'] || { limite: 3000000, fixos: [], rendas: [] };
  const mes = (k) => by['meses/' + k] || { limite: cfg.limite, fixos: cfg.fixos || [], tx: [], pagos: {} };
  return { cfg, mes };
}

async function manha() {
  const hoje = hojePY(), ontem = hojePY(-1), amanha = hojePY(1), m = hoje.slice(0, 7);
  const { cfg, mes } = await lerDados(m);
  const avisos = [];
  // contas fixas
  for (const [dia, rot] of [[ontem, 'atrasada'], [hoje, 'vence hoje'], [amanha, 'vence amanhã']]) {
    const k = dia.slice(0, 7), M = mes(k);
    for (const f of M.fixos || []) {
      if (M.pagos?.[f.id] || dtm(k, f.dia || 1) !== dia) continue;
      avisos.push({ title: rot === 'atrasada' ? `Conta atrasada: ${f.nome}` : `${f.nome} ${rot}`, body: `${fmt(f.valor)}${f.quem ? ' · ' + f.quem + ' paga' : ''}. Marque como paga em Contas.`, tag: 'conta-' + f.id + '-' + k, url: './#contas' });
    }
  }
  // dia 1: retrospectiva do mês que acabou
  if (hoje.slice(8) === '01') {
    const ant = addM(m, -1), nome = new Date(ant + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    if ((mes(ant).tx || []).some((t) => t.type === 'gasto'))
      avisos.push({ title: `Sua retrospectiva de ${nome} chegou`, body: 'Quanto gastaram, o maior gasto, a categoria campeã e a nota do porquinho. Toque pra ver.', tag: 'retro-' + ant, url: './#retro' });
  }
  // dia de salário
  const M = mes(m);
  for (const r of cfg.rendas || []) {
    if (dtm(m, r.dia) !== hoje || (M.tx || []).some((t) => t.type === 'receita' && t.renda === r.id)) continue;
    avisos.push({ title: `Hoje é dia do salário de ${r.nome}`, body: 'Quando cair e trocar pra guaraní, lance no Cofrin com a cotação do dia.', tag: 'salario-' + r.id + '-' + m, url: './#inicio' });
  }
  // ritmo do mês (avisa uma vez ao acelerar e uma vez ao estourar)
  const gastos = (M.tx || []).filter((t) => t.type === 'gasto').reduce((a, t) => a + t.valor, 0);
  const [y, mm] = m.split('-').map(Number), D = new Date(Date.UTC(y, mm, 0)).getUTCDate(), dia = +hoje.slice(8);
  const lim = M.limite || cfg.limite, resta = lim - gastos, diasRest = Math.max(1, D - dia + 1);
  const estado = resta < 0 ? 'estourou' : dia > 3 && gastos > lim * dia / D * 1.15 ? 'rapido' : 'ok';
  const reg = await segredo('avisos', async () => ({}));
  const nivel = { ok: 0, rapido: 1, estourou: 2 };
  if (nivel[estado] > nivel[reg[m] || 'ok']) {
    avisos.push(estado === 'estourou'
      ? { title: 'Limite do mês estourado', body: `Passaram ${fmt(-resta)} do limite de ${fmt(lim)}. Eu avisei. Eu SEMPRE aviso.`, tag: 'ritmo-' + m, url: './#painel' }
      : { title: 'Vocês aceleraram', body: `Já foram ${fmt(gastos)} de ${fmt(lim)}. Pra fechar no limite: ${fmt(resta / diasRest)} por dia.`, tag: 'ritmo-' + m, url: './#painel' });
    reg[m] = estado; await adm.from('cofrin_segredos').upsert({ id: 'avisos', valor: reg });
  }
  const res = [];
  for (const a of avisos) res.push({ aviso: a.title, ...(await enviar(a)) });
  return { hoje, avisos: res };
}

async function semana() {
  const hoje = hojePY(), ini = hojePY(-6), m = hoje.slice(0, 7);
  const { cfg, mes } = await lerDados(m);
  const tx = [...(mes(addM(m, -1)).tx || []), ...(mes(m).tx || [])].filter((t) => t.type === 'gasto' && t.date >= ini && t.date <= hoje);
  const tot = tx.reduce((a, t) => a + t.valor, 0);
  const porCat = {}; tx.forEach((t) => (porCat[t.cat] = (porCat[t.cat] || 0) + t.valor));
  const top = Object.entries(porCat).sort((a, b) => b[1] - a[1])[0];
  const M = mes(m), gastos = (M.tx || []).filter((t) => t.type === 'gasto').reduce((a, t) => a + t.valor, 0);
  const [y, mm] = m.split('-').map(Number), D = new Date(Date.UTC(y, mm, 0)).getUTCDate(), diasRest = Math.max(1, D - +hoje.slice(8) + 1);
  const resta = (M.limite || cfg.limite) - gastos;
  const body = tot
    ? `Gastaram ${fmt(tot)} em ${tx.length} lançamentos. Mais em ${top[0]} (${fmtK(top[1])}). ` + (resta >= 0 ? `Pra fechar o mês: ${fmt(resta / diasRest)} por dia.` : `O mês já passou ${fmt(-resta)} do limite.`)
    : 'Nenhum gasto lançado na semana. Economia ou esquecimento?';
  return { hoje, ...(await enviar({ title: 'Resumo da semana', body, tag: 'semana-' + hoje, url: './#painel' })) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  let b = {};
  try { b = req.method === 'POST' ? await req.json() : {}; } catch { /* corpo vazio */ }
  const acao = b.acao || new URL(req.url).searchParams.get('acao') || 'chave';

  if (acao === 'chave') { await cronToken(); return json({ pub: (await vapid()).pub }); }

  if (acao === 'manha' || acao === 'semana') {
    const t = await cronToken();
    if (req.headers.get('x-cron') !== t.token) return json({ erro: 'sem permissão' }, 401);
    return json(acao === 'manha' ? await manha() : await semana());
  }

  if (acao === 'avisar') {
    const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tok) return json({ erro: 'faça login' }, 401);
    const user = createClient(SB_URL, ANON, { global: { headers: { Authorization: 'Bearer ' + tok } }, auth: { persistSession: false } });
    const { data: ok } = await user.rpc('cofrin_liberado');
    if (ok !== true) return json({ erro: 'sem acesso' }, 401);
    const title = String(b.title || 'Cofrin').slice(0, 80), body = String(b.body || '').slice(0, 240);
    return json(await enviar({ title, body, tag: b.tag || 'lanc-' + Date.now(), url: b.url || './' }, { excluir: b.excluir || null, so: b.so || null }));
  }
  return json({ erro: 'ação desconhecida' }, 400);
});
