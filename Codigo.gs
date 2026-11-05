// O identificador será preenchido com a planilha criada nesta tarefa.
const PLANILHA_ID = '1AB463OfsoIZuXvZE1B002EMikA5xpjZ9SW3H0xa0Aec';
const TOTAL_QUESTOES = 30;

function doGet(e) {
  const channel = String(e && e.parameter && e.parameter.bridge || '');
  if (!/^[a-zA-Z0-9-]{15,100}$/.test(channel)) return HtmlService.createHtmlOutput('Serviço da avaliação de Matemática ativo.');
  // A ponte responde diretamente à página GitHub Pages por postMessage.
  // Nenhuma senha, token ou resposta de aluno é enviada na URL.
  const script = `
    const channel=${JSON.stringify(channel)};
    const ready=setInterval(()=>window.top.postMessage({channel,type:'ready'},'*'),700);
    window.addEventListener('message',event=>{
      if(event.source!==window.top || !event.data || event.data.channel!==channel || event.data.type!=='request')return;
      clearInterval(ready);
      const id=event.data.id, origin=event.origin;
      google.script.run.withSuccessHandler(result=>{
        window.top.postMessage({channel,type:'response',id,result},origin);
      }).withFailureHandler(()=>{
        window.top.postMessage({channel,type:'response',id,result:{ok:false,error:'Não foi possível concluir. Tente novamente.'}},origin);
      }).api(event.data.payload);
    });
  `;
  return HtmlService.createHtmlOutput('<!doctype html><html><head><meta charset="utf-8"></head><body><script>'+script+'</script></body></html>')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function api(request) {
  try {
    if (!request || typeof request !== 'object') throw new Error('Pedido inválido.');
    if (request.action === 'submit') return registrarRespostas(request.data);
    if (request.action === 'login') {
      const expected = PropertiesService.getScriptProperties().getProperty('SENHA_HASH');
      if (!expected) throw new Error('O professor precisa executar configurar_ no Apps Script.');
      if (typeof request.password !== 'string' || request.password.length>200 || hash_(request.password)!==expected) throw new Error('Senha incorreta.');
      const token = Utilities.getUuid() + '-' + Utilities.getUuid();
      CacheService.getScriptCache().put('sessao_'+hash_(token), 'professor', 1800);
      return {ok:true,token};
    }
    if (typeof request.token !== 'string' || request.token.length>100 || !CacheService.getScriptCache().get('sessao_'+hash_(request.token))) throw new Error('Sessão expirada. Entre novamente.');
    if (request.action==='logout') {
      CacheService.getScriptCache().remove('sessao_'+hash_(request.token));return {ok:true};
    }
    if (request.action==='dashboard') {
      const ss=SpreadsheetApp.openById(PLANILHA_ID), sh=ss.getSheetByName('Respostas');
      const matrix=ss.getSheetByName('Gabarito').getRange(2,1,30,4).getValues();
      const key=matrix.map(x=>x[1]);
      if(!key.every(x=>/^[A-E]$/.test(x)))throw new Error('Confira o gabarito na planilha.');
      const values=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,35).getValues():[];
      const rows=values.filter(x=>x[1]).map(x=>{
        const answers=x.slice(5,35),correct=answers.reduce((n,a,i)=>n+(a===key[i]?1:0),0);
        return {id:String(x[1]),date:x[0] instanceof Date?x[0].toISOString():String(x[0]),name:String(x[2]).replace(/^\u200B/,''),year:String(x[3]),classroom:String(x[4]).replace(/^\u200B/,''),answers,correct,grade:Math.round(correct/30*1000)/100};
      });
      return {ok:true,rows,matrix:matrix.map(x=>({n:x[0],answer:x[1],level:x[2],skill:x[3]})),updatedAt:new Date().toISOString()};
    }
    throw new Error('Operação inválida.');
  } catch(error) {
    return {ok:false,error:error.message || 'Falha no serviço.'};
  }
}

function hash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,text,Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
}

// Esta é a única função de dados acessível pelo formulário.
// Nunca retorna respostas de outros estudantes, notas ou gabarito.
function registrarRespostas(payload) {
  const p = validar_(payload);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Muitas entregas simultâneas. Tente novamente.');
  try {
    const ss = SpreadsheetApp.openById(PLANILHA_ID);
    const sh = ss.getSheetByName('Respostas');
    if (!sh || !ss.getSheetByName('Gabarito')) throw new Error('Planilha não configurada.');
    const last = sh.getLastRow();
    if (last > 1) {
      const old = sh.getRange(2, 2, last - 1, 1).createTextFinder(p.id).matchEntireCell(true).useRegularExpression(false).findNext();
      if (old) {
        const saved = sh.getRange(old.getRow(), 3, 1, 33).getValues()[0];
        // O mesmo protocolo só pode reenviar exatamente o mesmo conteúdo.
        const expected = [texto_(p.student.name), texto_(p.student.year), texto_(p.student.classroom), ...p.answers];
        if (JSON.stringify(saved) !== JSON.stringify(expected)) throw new Error('Este protocolo já foi usado em outra entrega.');
        return {ok: true, protocolo: p.id};
      }
    }
    const key = ss.getSheetByName('Gabarito').getRange(2, 2, 30, 1).getValues().flat();
    if (!key.every(x => /^[A-E]$/.test(x))) throw new Error('Gabarito inválido. Avise o professor.');
    const row = last + 1;
    if (row > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 500);
    const formulas = formulasNota_(row);
    sh.getRange(row, 1, 1, 38).setValues([[
      new Date(), p.id, texto_(p.student.name), texto_(p.student.year), texto_(p.student.classroom), ...p.answers, ...formulas
    ]]);
    sh.getRange(row, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sh.getRange(row, 36).setNumberFormat('0');
    sh.getRange(row, 37).setNumberFormat('0.00');
    sh.getRange(row, 38).setNumberFormat('0.0%');
    // Mantém o resumo abrangendo todas as linhas mesmo após ultrapassar 5 mil entregas.
    if (row > 5001) ampliarResumo_(ss, row);
    SpreadsheetApp.flush();
    return {ok: true, protocolo: p.id};
  } finally {
    lock.releaseLock();
  }
}

function validar_(p) {
  if (!p || typeof p !== 'object' || !p.student) throw new Error('Entrega inválida.');
  const clean = (v, max) => {
    if (typeof v !== 'string') throw new Error('Identificação inválida.');
    const text = v.trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
    if (!text || text.length > max) throw new Error('Confira os dados do estudante.');
    return text;
  };
  const student = {name: clean(p.student.name, 160), year: clean(p.student.year, 20), classroom: clean(p.student.classroom, 60)};
  if (!['6º ano','7º ano','8º ano','9º ano'].includes(student.year)) throw new Error('Ano escolar inválido.');
  if (typeof p.submissionId !== 'string' || !/^[a-zA-Z0-9-]{15,100}$/.test(p.submissionId)) throw new Error('Protocolo inválido.');
  if (!Array.isArray(p.answers) || p.answers.length !== TOTAL_QUESTOES || !p.answers.every(x => typeof x === 'string' && /^[A-E]$/.test(x))) throw new Error('Responda às 30 questões.');
  return {student, answers:p.answers.slice(), id:p.submissionId};
}

function texto_(text) {
  // Impede que dados digitados por estudantes sejam executados como fórmulas.
  return /^[=+@-]/.test(text) ? '\u200B' + text : text;
}

function coluna_(n) {
  let s = '';
  for (; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}

function formulasNota_(r) {
  const terms = Array.from({length:30}, (_,i) => `IF(${coluna_(i+6)}${r}=Gabarito!$B$${i+2};1;0)`);
  return ['=' + terms.join('+'), `=ROUND(AJ${r}/30*10;2)`, `=AJ${r}/30`];
}

function ampliarResumo_(ss, row) {
  const resumo = ss.getSheetByName('Resumo');
  const bound = resumo.getRange('B5').getFormula().match(/B2:B(\d+)/);
  if (bound && row <= Number(bound[1])) return;
  const limit = Math.max(5001, row + 500);
  const formulas = resumo.getRange('A4:M39').getFormulas();
  for(let r=0;r<formulas.length;r++) for(let c=0;c<formulas[r].length;c++) {
    const f = formulas[r][c];
    if (f) resumo.getRange(r+4,c+1).setFormula(f.replace(/(\$?[A-Z]+\$?2:\$?[A-Z]+\$?)\d+/g, (_,prefix) => prefix+limit));
  }
}

// Execute uma vez pelo editor do Apps Script antes de publicar.
// O sufixo _ impede chamadas dessa função pelos estudantes.
function configurar_() {
  // Execute no editor do Apps Script. NÃO publique este arquivo no GitHub.
  PropertiesService.getScriptProperties().setProperty('SENHA_HASH','0a7fce4acb09f12f037abb1213651d37175dc56f35109671dd3a8214c4a93b64');
  const ss = SpreadsheetApp.openById(PLANILHA_ID);
  ss.setSpreadsheetLocale('pt_BR');ss.setSpreadsheetTimeZone('America/Sao_Paulo');
  const sh = ss.getSheetByName('Respostas');
  if (sh.getMaxColumns()<38) sh.insertColumnsAfter(sh.getMaxColumns(),38-sh.getMaxColumns());
  // As fórmulas do resumo têm referências até a linha 5001.
  if (sh.getMaxRows()<5001) sh.insertRowsAfter(sh.getMaxRows(),5001-sh.getMaxRows());
  sh.setFrozenRows(1);sh.setFrozenColumns(3);
  sh.getRange('A2:A5001').setNumberFormat('dd/MM/yyyy HH:mm:ss');
  sh.getRange('AJ2:AJ5001').setNumberFormat('0');
  sh.getRange('AK2:AK5001').setNumberFormat('0.00');
  sh.getRange('AL2:AL5001').setNumberFormat('0.0%');
  const summary = ss.getSheetByName('Resumo');
  summary.getRange('H10:H39').setNumberFormat('0.0%');
  summary.getRange('B6').setNumberFormat('0.00');
  const rule = SpreadsheetApp.newConditionalFormatRule().setGradientMinpointWithValue('#fce8e6', SpreadsheetApp.InterpolationType.NUMBER, '0').setGradientMaxpointWithValue('#e6f4ea', SpreadsheetApp.InterpolationType.NUMBER, '1').setRanges([summary.getRange('H10:H39')]).build();
  summary.setConditionalFormatRules([rule]);
  SpreadsheetApp.flush();
  console.log('Planilha configurada: ' + ss.getUrl());
}
