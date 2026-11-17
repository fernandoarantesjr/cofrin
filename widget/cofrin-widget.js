// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-purple; icon-glyph: piggy-bank;
//
// COFRIN — widget do porquinho (Scriptable)
// 1) Cole este script no app Scriptable e rode uma vez: ele pede o e-mail e a senha
//    do Cofrin e guarda nas Chaves do iPhone (Keychain). Nada fica escrito aqui.
// 2) Adicione um widget do Scriptable na tela (pequeno ou médio) ou na tela de bloqueio
//    e escolha este script.
// Pra trocar de login: rode o script de novo dentro do app e toque em "Trocar login".

const SUPABASE_URL = 'https://thsdxhvikpuhfzcohano.supabase.co';
const SUPABASE_KEY = 'sb_publishable_C_VZK5xzqaz7UkCFzll9TQ_Pyxq7Td3'; // chave pública (pode ficar aqui)
const APP_URL = 'https://cofrin-three.vercel.app/';
const IMG_URL = 'https://cofrin-three.vercel.app/widget/pig-';
const KC_EMAIL = 'cofrin.email', KC_SENHA = 'cofrin.senha';

// ---------------- datas e formatação ----------------
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addM = (m, n) => { const [y, mm] = m.split('-').map(Number); const d = new Date(y, mm - 1 + n, 15); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const dt = (m, dia) => { const [y, mm] = m.split('-').map(Number); return `${m}-${pad(Math.min(dia, new Date(y, mm, 0).getDate()))}`; };
const diasEntre = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const fmt = (v) => '₲ ' + Math.round(v).toLocaleString('pt-BR');
const fmtK = (v) => { const a = Math.abs(v), s = v < 0 ? '−' : ''; return s + (a >= 1e6 ? (a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi' : a >= 1e3 ? Math.round(a / 1e3) + ' mil' : String(Math.round(a))); };

// ---------------- a mesma conta do app ----------------
function calcular(cfg, meses, hoje) {
  const m = hoje.slice(0, 7);
  const mes = (k) => meses[k] || { limite: cfg.limite, fixos: cfg.fixos || [], tx: [], pagos: {} };
  const todas = []; for (const [k, M] of Object.entries(meses)) (M.tx || []).forEach((t) => todas.push(t));
  const recebeu = (k, r) => (mes(k).tx || []).some((t) => t.type === 'receita' && t.renda === r.id);
  const sinal = (t) => (t.type === 'receita' || t.type === 'resgatar' ? 1 : -1);
  let cx = cfg.saldo || 0;
  for (const M of Object.values(meses)) {
    (M.tx || []).forEach((t) => { if (t.date <= hoje) cx += sinal(t) * t.valor; });
    (M.fixos || []).forEach((f) => { const p = (M.pagos || {})[f.id]; if (p && p <= hoje) cx -= f.valor; });
  }
  const rendas = cfg.rendas || [];
  const prox = rendas.map((r) => ({ r, data: recebeu(m, r) ? dt(addM(m, 1), r.dia) : dt(m, r.dia) })).sort((a, b) => a.data.localeCompare(b.data))[0];
  if (!prox) return { ok: false, caixa: cx };
  const M = mes(m);
  const pend = (M.fixos || []).filter((f) => !(M.pagos || {})[f.id] && dt(m, f.dia || 1) < prox.data).reduce((a, f) => a + f.valor, 0);
  const agend = todas.filter((t) => t.type === 'gasto' && t.date > hoje && t.date < prox.data).reduce((a, t) => a + t.valor, 0);
  const livre = cx - pend - agend, dias = Math.max(1, diasEntre(hoje, prox.data));
  const atrasada = prox.data <= hoje;
  // período: da última entrada até a próxima
  const ini = rendas.map((r) => { const d = dt(m, r.dia); return d <= hoje ? d : dt(addM(m, -1), r.dia); }).sort().pop() || m + '-01';
  const gastos = todas.filter((t) => t.type === 'gasto' && t.date >= ini && t.date <= hoje).reduce((a, t) => a + t.valor, 0);
  const base = livre + gastos, total = Math.max(1, diasEntre(ini, prox.data)), passados = diasEntre(ini, hoje);
  const pct = base > 0 ? Math.max(0, Math.min(1, livre / base)) : 0, ideal = 1 - passados / total;
  const estado = livre < 0 ? 'estourou' : gastos === 0 ? 'cheio' : pct < ideal * 0.85 ? 'rapido' : pct > ideal * 1.15 ? 'eco' : 'ritmo';
  const humor = { cheio: 'feliz', eco: 'feliz', ritmo: 'ok', rapido: 'julga', estourou: 'bravo' }[estado];
  const rotulo = { cheio: 'Nenhum gasto ainda', eco: 'Econômico', ritmo: 'No ritmo', rapido: 'Acelerado', estourou: 'Faltando' }[estado];
  const [, mm, dd] = prox.data.split('-');
  return { ok: true, livre, porDia: livre / dias, dias, nome: prox.r.nome, quando: `${+dd}/${mm}`, pct, estado, humor, rotulo, atrasada, caixa: cx, pend: pend + agend };
}

// ---------------- dados do Supabase ----------------
async function pedirLogin(erro) {
  const a = new Alert();
  a.title = erro ? 'Não deu pra entrar' : 'Cofrin';
  a.message = (erro ? erro + '\n\n' : '') + 'Use o mesmo e-mail e senha do app (ex: fernando@cofrin.app). Ficam guardados nas Chaves do iPhone.';
  const em = a.addTextField('E-mail', Keychain.contains(KC_EMAIL) ? Keychain.get(KC_EMAIL) : '');
  try { em.setEmailAddressKeyboard(); } catch (e) {}
  a.addSecureTextField('Senha', '');
  a.addAction('Entrar'); a.addCancelAction('Cancelar');
  if ((await a.present()) === -1) return false;
  Keychain.set(KC_EMAIL, a.textFieldValue(0).replace(/\s+/g, '').toLowerCase());
  Keychain.set(KC_SENHA, a.textFieldValue(1).replace(/^\s+|\s+$/g, ''));
  return true;
}
async function buscar() {
  if (!Keychain.contains(KC_EMAIL) || !Keychain.contains(KC_SENHA)) throw new Error('login');
  const auth = new Request(`${SUPABASE_URL}/auth/v1/token?grant_type=password`);
  auth.method = 'POST';
  auth.headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  auth.body = JSON.stringify({ email: Keychain.get(KC_EMAIL), password: Keychain.get(KC_SENHA) });
  let tok;
  try { tok = await auth.loadJSON(); } catch (e) { throw new Error('rede'); }
  if (!tok.access_token) {
    const cod = tok.error_code || tok.error || '';
    const err = new Error('login');
    err.motivo = cod === 'invalid_credentials' || cod === 'invalid_grant' ? `E-mail ou senha não conferem (${Keychain.get(KC_EMAIL)}).`
      : cod === 'email_not_confirmed' ? 'Esse e-mail ainda não foi confirmado no Supabase.'
      : 'O servidor recusou o login: ' + (tok.msg || tok.error_description || cod || 'sem detalhe') + '.';
    throw err;
  }
  const r = new Request(`${SUPABASE_URL}/rest/v1/cofrin?select=id,data`);
  r.headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + tok.access_token };
  const rows = await r.loadJSON();
  const meses = {}; let cfg = {};
  rows.forEach((x) => { if (x.id === 'config/geral') cfg = x.data; else if (x.id.startsWith('meses/')) meses[x.id.slice(6)] = x.data; });
  return { cfg, meses };
}

// imagens do porquinho (guardadas no iPhone depois do 1º download)
async function porquinho(humor) {
  const fm = FileManager.local(), path = fm.joinPath(fm.cacheDirectory(), `cofrin-pig-${humor}.png`);
  if (fm.fileExists(path)) return fm.readImage(path);
  try { const img = await new Request(IMG_URL + humor + '.png').loadImage(); fm.writeImage(path, img); return img; } catch (e) { return null; }
}

// ---------------- visual ----------------
const C = { roxo1: new Color('#2e2339'), roxo2: new Color('#120e18'), branco: Color.white(), cinza: new Color('#b9b3c4'), laranja: new Color('#ff7a2e'), verde: new Color('#3cc27a'), vermelho: new Color('#ff5c5e'), trilho: new Color('#ffffff', 0.14) };
const corEstado = (e) => (e === 'estourou' ? C.vermelho : e === 'rapido' ? C.laranja : C.verde);
function fundo(w) { const g = new LinearGradient(); g.colors = [C.roxo1, C.roxo2]; g.locations = [0, 1]; g.startPoint = new Point(0, 0); g.endPoint = new Point(1, 1); w.backgroundGradient = g; }
function barra(pct, cor, largura) {
  const h = 8, d = new DrawContext(); d.size = new Size(largura, h); d.opaque = false; d.respectScreenScale = true;
  const fundoP = new Path(); fundoP.addRoundedRect(new Rect(0, 0, largura, h), 4, 4); d.addPath(fundoP); d.setFillColor(C.trilho); d.fillPath();
  const w = Math.max(h, largura * pct), p = new Path(); p.addRoundedRect(new Rect(0, 0, w, h), 4, 4); d.addPath(p); d.setFillColor(cor); d.fillPath();
  return d.getImage();
}
function texto(stack, t, fonte, cor, linhas = 1) { const x = stack.addText(t); x.font = fonte; x.textColor = cor; x.lineLimit = linhas; x.minimumScaleFactor = 0.6; return x; }

async function montar(r, familia) {
  const w = new ListWidget(); w.url = APP_URL;
  w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
  const titulo = r.atrasada ? `Salário de ${r.nome} não lançado` : `Livre até ${r.nome} receber`;
  const valor = r.atrasada ? fmt(r.caixa) : (r.livre < 0 ? '−' : '') + fmt(Math.abs(r.livre));
  const sub = r.atrasada ? 'em caixa agora' : r.livre < 0 ? `faltam pras contas até ${r.quando}` : `${fmt(r.porDia)} por dia · ${r.dias} ${r.dias > 1 ? 'dias' : 'dia'}`;

  // tela de bloqueio
  if (familia === 'accessoryInline') { w.addText(r.atrasada ? `Cofrin: lançar salário de ${r.nome}` : `₲ ${fmtK(r.livre)} livres · ${fmtK(r.porDia)}/dia`); return w; }
  if (familia === 'accessoryCircular') {
    const s = w.addStack(); s.layoutVertically(); s.centerAlignContent();
    texto(s, fmtK(r.livre), Font.boldRoundedSystemFont(13), Color.white()).centerAlignText();
    texto(s, 'livre', Font.systemFont(9), Color.white()).centerAlignText();
    return w;
  }
  if (familia === 'accessoryRectangular') {
    texto(w, titulo, Font.semiboldSystemFont(11), Color.white());
    texto(w, valor, Font.boldRoundedSystemFont(17), Color.white());
    texto(w, sub, Font.systemFont(11), Color.white());
    return w;
  }

  fundo(w);
  const img = await porquinho(r.humor);
  if (familia === 'small') {
    w.setPadding(12, 14, 12, 14);
    const topo = w.addStack(); topo.centerAlignContent();
    if (img) { const i = topo.addImage(img); i.imageSize = new Size(52, 48); }
    topo.addSpacer();
    const chip = topo.addStack(); chip.backgroundColor = new Color('#ffffff', 0.12); chip.cornerRadius = 8; chip.setPadding(3, 7, 3, 7);
    texto(chip, r.rotulo, Font.semiboldSystemFont(9), corEstado(r.estado));
    w.addSpacer();
    texto(w, titulo, Font.mediumSystemFont(10), C.cinza);
    texto(w, valor, Font.heavyRoundedSystemFont(22), r.livre < 0 ? C.vermelho : C.branco);
    w.addSpacer(3);
    texto(w, sub, Font.mediumSystemFont(10), C.cinza);
    w.addSpacer(6);
    w.addImage(barra(r.pct, corEstado(r.estado), 130)).imageSize = new Size(130, 6);
    return w;
  }
  // médio e grande
  w.setPadding(14, 16, 14, 16);
  const linha = w.addStack(); linha.centerAlignContent();
  if (img) { const i = linha.addImage(img); i.imageSize = new Size(108, 100); }
  linha.addSpacer(12);
  const col = linha.addStack(); col.layoutVertically();
  const cab = col.addStack(); cab.centerAlignContent();
  texto(cab, 'cofrin', Font.heavyRoundedSystemFont(13), C.branco); cab.addSpacer();
  const chip = cab.addStack(); chip.backgroundColor = new Color('#ffffff', 0.12); chip.cornerRadius = 8; chip.setPadding(3, 8, 3, 8);
  texto(chip, r.rotulo, Font.semiboldSystemFont(10), corEstado(r.estado));
  col.addSpacer(6);
  texto(col, titulo, Font.mediumSystemFont(11), C.cinza);
  texto(col, valor, Font.heavyRoundedSystemFont(26), r.livre < 0 ? C.vermelho : C.branco);
  texto(col, sub, Font.mediumSystemFont(11), C.cinza);
  col.addSpacer(8);
  col.addImage(barra(r.pct, corEstado(r.estado), 180)).imageSize = new Size(180, 7);
  if (familia === 'large') {
    w.addSpacer(14);
    texto(w, `Contas até ${r.quando}: ${fmt(r.pend)}`, Font.semiboldSystemFont(13), C.branco);
    texto(w, `Dinheiro em caixa hoje: ${fmt(r.caixa)}`, Font.mediumSystemFont(12), C.cinza);
    w.addSpacer();
    texto(w, 'Toque pra abrir o Cofrin', Font.mediumSystemFont(11), C.cinza);
  }
  return w;
}
function avisoWidget(msg) { const w = new ListWidget(); fundo(w); w.url = APP_URL; texto(w, 'cofrin', Font.heavyRoundedSystemFont(14), C.branco); w.addSpacer(6); texto(w, msg, Font.mediumSystemFont(12), C.cinza, 4); return w; }

// ---------------- execução ----------------
async function rodar() {
  if (!config.runsInWidget && Keychain.contains(KC_EMAIL)) {
    const a = new Alert(); a.title = 'Cofrin'; a.message = `Conectado como ${Keychain.get(KC_EMAIL)}`;
    a.addAction('Ver prévia'); a.addAction('Trocar login'); a.addCancelAction('Fechar');
    const op = await a.present();
    if (op === -1) return;
    if (op === 1 && !(await pedirLogin())) return;
  } else if (!config.runsInWidget) {
    if (!(await pedirLogin())) return;
  }
  let w;
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try { await buscar(); break; }
    catch (e) {
      if (config.runsInWidget || String(e.message) !== 'login') break;
      if (!(await pedirLogin(e.motivo))) return Script.complete();   // no app: mostra o motivo e pede de novo
    }
  }
  try {
    const { cfg, meses } = await buscar();
    const r = calcular(cfg, meses, ymd(new Date()));
    w = r.ok ? await montar(r, config.widgetFamily || 'medium') : avisoWidget('Cadastre quem recebe e o dia do salário em Ajustes no app.');
  } catch (e) {
    w = avisoWidget(String(e.message) === 'login' ? (e.motivo ? e.motivo + ' Abra o Scriptable e rode o script Cofrin.' : 'Abra o Scriptable e rode o script Cofrin pra entrar com seu e-mail e senha.') : 'Sem conexão agora. Tento de novo em alguns minutos.');
    w.refreshAfterDate = new Date(Date.now() + 10 * 60 * 1000);
  }
  if (config.runsInWidget) Script.setWidget(w);
  else await w.presentMedium();
  Script.complete();
}
await rodar();
