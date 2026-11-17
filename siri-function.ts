// @ts-nocheck
// Cofrin — porta de entrada da Siri (Atalhos do iPhone)
// Recebe {email, senha, texto}, entende a frase e grava no mesmo banco do app.
// A senha só serve pra entrar como a pessoa: as regras de acesso (RLS) continuam valendo.
import { createClient } from 'npm:@supabase/supabase-js@2';

/* ---------- entende frases: "gastei 85 mil no ifood e 30 mil de uber ontem" ---------- */
const semAcento=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const NUMS={zero:0,um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,quatorze:14,catorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100,duzentos:200,trezentos:300,quatrocentos:400,quinhentos:500,seiscentos:600,setecentos:700,oitocentos:800,novecentos:900,meio:.5,meia:.5};
// "cento e vinte mil" -> "120 mil" ; "um milhao e meio" -> "1.5 milhao"
function palavrasParaNumeros(s){
 s=s.replace(/\b(um|uma)\s+(milhao|milhoes|mil)\b/g,'1 $2');
 return s.replace(/\b((?:(?:zero|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos)(?:\s+e\s+|\s+)?)+)/g,m=>{
  const n=m.trim().split(/\s+e\s+|\s+/).reduce((a,w)=>a+(NUMS[w]||0),0);return n+' '});
}
// lê o valor de um pedaço: "85 mil", "85.000", "1,5 milhao", "1 milhao e 200 mil", "50 reais"
function lerValor(p){
 let total=0,achou=false,brl=false;
 const re=/(\d+(?:[.,]\d+)*)\s*(milhoes|milhao|mi\b|mil\b|k\b)?(?:\s+e\s+meio)?/g;let m;
 while((m=re.exec(p))){
  let raw=m[1];
  if(/^\d{1,3}(\.\d{3})+$/.test(raw))raw=raw.replace(/\./g,'');      // 85.000
  else raw=raw.replace(/\./g,'').replace(',','.');                     // 1,5
  let v=parseFloat(raw);if(isNaN(v))continue;
  const u=m[2]||'';if(/milh|^mi$/.test(u))v*=1e6;else if(u==='mil'||u==='k')v*=1e3;
  if(/e\s+meio/.test(m[0]))v+=(/milh|^mi$/.test(u)?5e5:500);
  // "em 3 vezes"/"3x" não é valor
  const depois=p.slice(m.index+m[0].length,m.index+m[0].length+9);
  if(v<=48&&!u&&/^\s*(x\b|vezes\b|parcelas\b)/.test(depois))continue;
  total+=v;achou=true;
 }
 if(/\breais\b|\bem real\b|r\$/.test(p))brl=true;
 return achou?{v:total,brl}:null;
}
const KW={
 Delivery:['ifood','delivery','pedidosya','pedidos ya','monchis','rappi','entrega','tele entrega'],
 Mercado:['supermercado','mercado','superseis','super seis','stock','biggie','real supermercado','feira','acougue','hortifruti','atacado','despensa'],
 Comida:['almoco','jantar','janta','lanche','restaurante','cafe','pizza','hamburguer','burger','sorvete','padaria','empanada','chipa','pao','comida','mcdonald','bk','burger king','sushi','churrasco'],
 Transporte:['uber','bolt','gasolina','combustivel','nafta','posto','onibus','taxi','estacionamento','muv','pedagio','mecanico','oficina'],
 Casa:['aluguel','luz','ande','agua','essap','gas','moveis','casa','limpeza','faxina','condominio'],
 'Bebê':['fralda','fraldas','leite','bebe','pediatra','mamadeira','lenco umedecido','creche','brinquedo'],
 'Saúde':['farmacia','remedio','medico','consulta','dentista','exame','hospital','academia','vacina'],
 Lazer:['cinema','bar','cerveja','jogo','game','netflix','spotify','show','balada','passeio','viagem','festa','xbox','steam'],
 Compras:['shopping','roupa','loja','presente','sapato','tenis','amazon','shein','mercado livre','camiseta','eletronico','celular novo'],
 Contas:['internet','tigo','personal','claro','conta de','fatura','assinatura','plano','seguro','imposto'],
 Pets:['racao','veterinario','pet','cachorro','gato']
};
const MARCAS={ifood:'iFood',pedidosya:'PedidosYa',monchis:'Monchis',superseis:'Superseis','super seis':'Superseis',stock:'Stock',biggie:'Biggie',uber:'Uber',bolt:'Bolt',muv:'MUV',netflix:'Netflix',spotify:'Spotify',amazon:'Amazon',shein:'Shein',tigo:'Tigo',ande:'ANDE',essap:'ESSAP',mcdonald:"McDonald's",'burger king':'Burger King',shopping:'Shopping',rappi:'Rappi'};
const STOP=new Set('eu gastei gastamos paguei pagamos comprei compramos foi deu de do da dos das no na nos nas em com pra para por o a os as um uma uns umas hoje ontem anteontem guarani guaranis gs mil milhao milhoes reais real e que ai la aqui mais tambem so agora reais valor tipo ja meio parcelado vezes'.split(' '));
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
function interpretar(frase){
 const original=frase.trim();if(!original)return[];
 let s=' '+semAcento(original).replace(/[!?;]/g,' ').replace(/,\s/g,' , ')+' ';
 s=palavrasParaNumeros(s).replace(/\s+/g,' ');
 // "1 milhao e 200 mil" vira um número só
 s=s.replace(/(\d+(?:[.,]\d+)?)\s*milh(?:ao|oes)\s+e\s+(\d+)\s*mil\b/g,(_,a,b)=>String(Math.round(parseFloat(a.replace(',','.'))*1e6+(+b)*1e3)));
 const acentos={};original.split(/\s+/).forEach(w=>{const c=w.replace(/[^\p{L}\p{N}]/gu,'');if(c)acentos[semAcento(c)]=c.toLowerCase()});
 // data
 let dataOff=0;if(/\banteontem\b/.test(s))dataOff=-2;else if(/\bontem\b/.test(s))dataOff=-1;
 // tipo da frase toda
 const tipoGeral=/\b(recebi|recebemos|caiu|entrou|salario|pagamento da empresa|ganhei)\b/.test(s)?'receita':/\b(guardei|guardamos|guarda|guardar|poupei|separei)\b/.test(s)?'guardar':'gasto';
 // separa vários itens: "85 mil no ifood e 30 mil de uber"
 const partes=s.split(/\s(?:e|mais|,)\s(?=(?:(?!\be\b).)*?\d)/).filter(p=>/\d/.test(p));
 const out=[];
 (partes.length?partes:[s]).forEach(p=>{
  const val=lerValor(p);if(!val||!val.v)return;
  let par=1;const mp=p.match(/(?:em\s+)?(\d{1,2})\s*(?:x\b|vezes|parcelas)/);if(mp)par=Math.min(48,+mp[1]);
  let cat=null,marca=null;
  for(const [c,ws] of Object.entries(KW)){for(const w of ws){if(new RegExp('\\b'+w+'\\b').test(p)){cat=c;if(MARCAS[w])marca=MARCAS[w];break}}if(cat)break}
  // descrição: palavras que sobraram
  const resto=p.replace(/\d+(?:[.,]\d+)*/g,' ').replace(/\b(x|vezes|parcelas|parcelado|milhoes|milhao|mi|mil|k)\b/g,' ').split(/\s+/).filter(w=>w&&!STOP.has(w)&&!/^(recebi|recebemos|caiu|entrou|guardei|guardamos|guarda|guardar|poupei|separei|na caixinha|caixinha)$/.test(w));
  let desc=marca||(resto.length?cap(resto.slice(0,4).map(w=>acentos[w]||w).join(' ')):'');
  out.push({tipo:tipoGeral,valor:Math.round(val.v),brl:val.brl,cat:cat||(tipoGeral==='gasto'?'Outros':null),desc,par,dataOff});
 });
 return out;
}


const SB_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const fmt = (v: number) => '₲ ' + Math.round(v).toLocaleString('pt-BR');
const fala = (v: number) => { const a = Math.abs(v); return a >= 1e6 ? (a/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1}) + (a >= 2e6 ? ' milhões' : ' milhão') : a >= 1e3 ? Math.round(a/1e3) + ' mil' : String(Math.round(a)); };
const uid = () => Math.random().toString(36).slice(2, 9);
const hojePY = (off = 0) => { const d = new Date(Date.now() + off * 864e5); return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion' }).format(d); };
const addM = (m: string, n: number) => { const [y, mm] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mm - 1 + n, 15)); return d.toISOString().slice(0, 7); };
const dtm = (m: string, dia: number) => { const [y, mm] = m.split('-').map(Number); const last = new Date(Date.UTC(y, mm, 0)).getUTCDate(); return m + '-' + String(Math.min(dia, last)).padStart(2, '0'); };
const resp = (txt: string, status = 200) => new Response(txt, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  let body: any = {};
  try { body = await req.json(); } catch { return resp('Mande email, senha e texto.', 400); }
  const { email, senha, texto } = body;
  if (!email || !senha) return resp('Faltou o e-mail ou a senha no atalho.', 401);
  if (!texto || !String(texto).trim()) return resp('Não ouvi nada. Tenta de novo?', 400);

  const sb = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  const { data: sess, error: eLogin } = await sb.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password: String(senha) });
  if (eLogin) return resp('E-mail ou senha do atalho estão errados.', 401);

  const { data: cfgRow } = await sb.from('cofrin').select('data').eq('id', 'config/geral').maybeSingle();
  const cfg: any = cfgRow?.data || { limite: 3000000, fixos: [], cot: 0, rendas: [], caixinhas: [] };
  const its = interpretar(String(texto));
  if (!its.length) return resp('Não achei o valor. Fala tipo: 85 mil no mercado.');

  const norm = semAcento(String(texto));
  const txs: any[] = [];
  for (const o of its) {
    const date = hojePY(o.dataOff || 0);
    if (o.tipo === 'receita') {
      const r = (cfg.rendas || []).find((r: any) => norm.includes(semAcento(r.nome)));
      if (o.brl && !cfg.cot) return resp('Recebi em reais, mas não tenho a cotação. Lança essa receita pelo app.');
      const t: any = { id: uid(), type: 'receita', date, desc: r ? 'Salário ' + r.nome : (o.desc || 'Receita'), valor: o.brl ? Math.round(o.valor * cfg.cot) : o.valor };
      if (o.brl) { t.brl = o.valor; t.cot = cfg.cot; }
      if (r) t.renda = r.id;
      txs.push(t);
    } else if (o.tipo === 'guardar') {
      const cx = (cfg.caixinhas || []).find((c: any) => norm.includes(semAcento(c.nome).split(' ')[0])) || (cfg.caixinhas || [])[0];
      if (!cx) return resp('Você ainda não tem caixinha. Cria uma no app primeiro.');
      txs.push({ id: uid(), type: 'guardar', cx: cx.id, valor: o.valor, date });
    } else {
      const base = { type: 'gasto', valor: o.valor, cat: o.cat, desc: o.desc, date };
      if (o.par > 1) {
        const g = uid(), parte = Math.floor(o.valor / o.par), dia = +date.slice(8);
        for (let i = 0; i < o.par; i++) txs.push({ ...base, id: uid(), grupo: g, par: `${i + 1}/${o.par}`, valor: i === o.par - 1 ? o.valor - parte * (o.par - 1) : parte, date: dtm(addM(date.slice(0, 7), i), dia) });
      } else txs.push({ ...base, id: uid() });
    }
  }

  // grava mês a mês
  const porMes: Record<string, any[]> = {};
  txs.forEach((t) => (porMes[t.date.slice(0, 7)] ||= []).push(t));
  for (const [m, lista] of Object.entries(porMes)) {
    const { data: row } = await sb.from('cofrin').select('data').eq('id', 'meses/' + m).maybeSingle();
    const M: any = row?.data || { limite: cfg.limite, fixos: JSON.parse(JSON.stringify(cfg.fixos || [])), tx: [], pagos: {} };
    M.tx = (M.tx || []).concat(lista);
    const { error } = await sb.from('cofrin').upsert({ id: 'meses/' + m, data: M, updated_at: new Date().toISOString() });
    if (error) return resp('Não consegui salvar agora. Tenta de novo daqui a pouco.', 500);
  }

  // resposta falada
  const mAtual = hojePY().slice(0, 7);
  const { data: rowM } = await sb.from('cofrin').select('data').eq('id', 'meses/' + mAtual).maybeSingle();
  const MA: any = rowM?.data;
  const gastos = MA ? MA.tx.filter((t: any) => t.type === 'gasto').reduce((a: number, t: any) => a + t.valor, 0) : 0;
  const resta = (MA?.limite ?? cfg.limite) - gastos;
  const itens = its.map((o) => (o.tipo === 'gasto' ? (o.desc || o.cat) : o.tipo === 'receita' ? 'receita' : 'caixinha') + ' ' + (o.brl ? o.valor.toLocaleString('pt-BR') + ' reais' : fala(o.valor)) + (o.par > 1 ? ` em ${o.par} vezes` : '')).join(', ');
  const delivery = its.some((o) => o.cat === 'Delivery');
  // avisa os celulares cadastrados
  try {
    const em = String(email).trim().toLowerCase(), quem = em.charAt(0).toUpperCase() + em.split('@')[0].slice(1);
    const CATE = { Mercado: '🛒', Comida: '🍔', Delivery: '🛵', Transporte: '🚗', Casa: '🏠', 'Bebê': '🍼', 'Saúde': '💊', Lazer: '🎮', Compras: '🛍️', Contas: '🧾', Pets: '🐾', Outros: '✨' };
    const linhas = its.map((o) => o.tipo === 'gasto' ? `${o.desc || o.cat} · ${fmt(o.valor)}${o.par > 1 ? ' em ' + o.par + 'x' : ''} · ${o.cat}` : o.tipo === 'receita' ? `Receita · ${o.brl ? 'R$ ' + o.valor.toLocaleString('pt-BR') : fmt(o.valor)}` : `Caixinha · ${fmt(o.valor)}`);
    const title = its.length > 1 ? `${quem} lançou ${its.length} itens (Siri)` : its[0].tipo === 'gasto' ? `${quem} lançou um gasto (Siri)` : its[0].tipo === 'receita' ? `${quem} lançou uma receita (Siri)` : `${quem} guardou dinheiro (Siri)`;
    await fetch(SB_URL + '/functions/v1/push', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + sess.session.access_token }, body: JSON.stringify({ acao: 'avisar', title, body: linhas.join('\n') + `\nRestam ${fmt(Math.max(0, resta))} no mês.`, url: './#inicio' }) });
  } catch (_) { /* aviso é opcional */ }
  const fim = resta < 0 ? `Vocês estouraram o limite em ${fala(-resta)}. Eu avisei.` : `Restam ${fala(resta)} no mês.` + (delivery ? ' E delivery de novo, hein?' : '');
  return resp(`Anotado! ${itens}. ${fim}`);
});
