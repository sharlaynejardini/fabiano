import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const dir=new URL('.',import.meta.url),html=await fs.readFile(new URL('../index.html',dir),'utf8'),server=await fs.readFile(new URL('Codigo.gs',dir),'utf8');
const matrix=JSON.parse((await fs.readFile(new URL('matriz.json',dir),'utf8')).replace(/^\uFEFF/,''));
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);new vm.Script(server);
assert(!html.includes('agenor2026'),'A senha não pode estar no HTML público');
assert.equal((html.match(/id="dashboard"/g)||[]).length,1);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length,'IDs únicos');
class Element{
  constructor(tag='div'){this.tagName=tag;this.children=[];this.value='';this.attributes={};this.style={};this.textContent='';this.className='';this.classList={toggle:()=>{},remove:()=>{}};}
  append(...xs){this.children.push(...xs)}prepend(...xs){this.children.unshift(...xs)}replaceChildren(...xs){this.children=[...xs]}setAttribute(k,v){this.attributes[k]=v}get options(){return this.children}click(){}showModal(){this.open=true}close(){this.open=false}remove(){}
}
const elements=Object.fromEntries(ids.map(x=>[x,new Element()]));elements.year.value='7º ano';
const local=new Map(),alerts=[];
const context=vm.createContext({console,Intl,Date,Math,Map,Set,URL,Blob,setTimeout,clearTimeout,crypto:crypto.webcrypto,
 document:{getElementById:id=>{assert(elements[id],`ID ausente ${id}`);return elements[id]},createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),body:new Element('body')},
 window:{scrollTo(){},addEventListener(){},removeEventListener(){}},localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},alert:x=>alerts.push(x),confirm:()=>true});
vm.runInContext(script,context);
assert.equal(elements.start.disabled,true,'Sem serviço, não permite iniciar entrega');
elements.name.value='Aluno de teste';elements.room.value='7º A';
vm.runInContext('begin()',context);assert.match(elements.qnum.textContent,/Questão 1 de 30/);
for(let i=0;i<30;i++){
  const selected=elements.options.children[matrix[i].answer.charCodeAt(0)-65].children[0];selected.onchange();vm.runInContext('next()',context);
}
assert.match(elements.summary.textContent,/30\/30/);
vm.runInContext("callApi=async request=>({ok:true,protocolo:request.data.submissionId})",context);
await vm.runInContext('submit()',context);assert.match(elements.delivery.textContent,/Entrega confirmada/);assert.equal(local.has('matematica7_rascunho_v3'),false);
const dataset=[{id:'1',date:'2026-11-05T12:00:00Z',name:'Ana',year:'7º ano',classroom:'7º A',answers:matrix.map(x=>x.answer),correct:30,grade:10},{id:'2',date:'2026-11-05T12:01:00Z',name:'Beto',year:'7º ano',classroom:'7º B',answers:matrix.map(x=>x.answer==='A'?'B':'A'),correct:0,grade:0}];
context.testRows=dataset;context.testMatrix=matrix;
const stats=vm.runInContext('calculateStats(testRows,testMatrix)',context);assert.equal(stats.mean,5);assert.equal(stats.accuracy,.5);assert.deepEqual(Array.from(stats.histogram),[1,0,0,0,1]);assert(stats.questions.every(q=>q.correct===1&&q.errors===1));
const blank=vm.runInContext('calculateStats([],testMatrix)',context);assert.equal(blank.count,0);assert.equal(blank.mean,0);
vm.runInContext('dashboardData={rows:testRows,matrix:testMatrix};drawDashboard()',context);assert.equal(elements.kpiMean.textContent,'5,00');assert.equal(elements.questionRows.children.length,30);assert.equal(elements.studentRows.children.length,2);assert.equal(elements.questionChart.children[0].tagName,'svg');
elements.classFilter.value='7º A';vm.runInContext('drawDashboard()',context);assert.equal(elements.kpiMean.textContent,'10,00');assert.equal(elements.studentRows.children.length,1);
elements.nameFilter.value='Ninguém';vm.runInContext('drawDashboard()',context);assert.equal(elements.kpiCount.textContent,'0');assert.equal(elements.kpiMean.textContent,'—');
elements.nameFilter.value='';vm.runInContext('showStudent(testRows[0])',context);assert.equal(elements.detailDialog.open,true);assert.equal(elements.detailBody.children[1].children[1].children.length,30);
vm.runInContext('logoutTeacher()',context);assert.equal(elements.studentRows.children.length,0);assert.equal(elements.detailBody.children.length,0);
const store=new Map(),cache=new Map();let recorded=[],writes=0;
store.set('SENHA_HASH',crypto.createHash('sha256').update('agenor2026').digest('hex'));
const sheet={getLastRow:()=>recorded.length+1,getMaxRows:()=>5001,getRange(r,c,n=1,width=1){return {
  getValues(){if(c===3)return [recorded[r-2].slice(2,35)];if(c===1)return recorded.map(row=>row.slice(0,35));return []},
  setValues(rows){recorded[r-2]=Array.from(rows[0]);writes++;return this},setNumberFormat(){return this},
  createTextFinder(id){return {matchEntireCell(){return this},useRegularExpression(){return this},findNext(){const i=recorded.findIndex(x=>x[1]===id);return i<0?null:{getRow:()=>i+2}}}}
}}};
const gab={getRange:(r,c,n,w)=>({getValues:()=>w===4?matrix.map(m=>[m.n,m.answer,m.level,m.skill]):matrix.map(m=>[m.answer])})};
const back=vm.createContext({console,Date,JSON,Math,PropertiesService:{getScriptProperties:()=>({getProperty:k=>store.get(k)})},
 Utilities:{DigestAlgorithm:{SHA_256:1},Charset:{UTF_8:1},computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest()),getUuid:()=>crypto.randomUUID()},
 CacheService:{getScriptCache:()=>({put:(k,v)=>cache.set(k,v),get:k=>cache.get(k),remove:k=>cache.delete(k)})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:n=>n==='Respostas'?sheet:gab}),flush(){}}});
vm.runInContext(server,back);back.payload={student:{name:'Ana',year:'7º ano',classroom:'7º A'},answers:matrix.map(m=>m.answer),submissionId:crypto.randomUUID()};
assert.equal(vm.runInContext("api({action:'dashboard',token:'falso'}).ok",back),false);
assert.equal(vm.runInContext("api({action:'login',password:'errada'}).ok",back),false);
const login=vm.runInContext("api({action:'login',password:'agenor2026'})",back);assert.equal(login.ok,true);back.token=login.token;
const receipt=vm.runInContext("api({action:'submit',data:payload})",back);assert.equal(receipt.ok,true);assert.equal(writes,1);assert(!('grade' in receipt));
assert.equal(vm.runInContext("api({action:'submit',data:payload}).ok",back),true);assert.equal(writes,1,'Reenvio não duplica');
vm.runInContext("payload.answers[0]='E'",back);assert.equal(vm.runInContext("api({action:'submit',data:payload}).ok",back),false);assert.equal(writes,1);
const actual=vm.runInContext("api({action:'dashboard',token})",back);assert.equal(actual.rows[0].grade,10);assert.equal(actual.rows[0].correct,30);
vm.runInContext("api({action:'logout',token})",back);assert.equal(vm.runInContext("api({action:'dashboard',token}).ok",back),false);
vm.runInContext("payload.answers=[]",back);assert.equal(vm.runInContext("api({action:'submit',data:payload}).ok",back),false);
assert.match(recorded[0][35],/AI2=Gabarito!\$B\$31/);
assert.equal(vm.runInContext("texto_('=IMPORTXML(1)')",back),'\u200B=IMPORTXML(1)');
// Verifica a ponte entre domínios sem enviar dados para a internet.
const transportElements=Object.fromEntries(ids.map(x=>[x,new Element()]));
let listener=null,sent=null;
const transport=vm.createContext({console,Intl,Date,Math,Map,Set,URL,Blob,setTimeout,clearTimeout,crypto:crypto.webcrypto,
 document:{getElementById:id=>transportElements[id],createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),body:new Element('body')},
 window:{scrollTo(){},addEventListener:(event,fn)=>{if(event==='message')listener=fn},removeEventListener(){}},localStorage:{getItem:()=>null},alert(){},confirm:()=>true});
vm.runInContext(script.replace('const API_URL = "";','const API_URL = "https://script.google.com/macros/s/TESTE123/exec";'),transport);
const apiResult=vm.runInContext("callApi({action:'login',password:'senha-de-teste'})",transport);
const channel=vm.runInContext('bridgeChannel',transport),source={postMessage:(payload,origin)=>sent={payload,origin}};
listener({origin:'https://site-invalido.example',source,data:{channel,type:'ready'}});
assert.equal(vm.runInContext('bridgeWindow',transport),null,'Rejeita origem não autorizada');
listener({origin:'https://n-123-0lu-script.googleusercontent.com',source,data:{channel,type:'ready'}});
await Promise.resolve();await Promise.resolve();
assert.equal(sent.origin,'https://n-123-0lu-script.googleusercontent.com');
assert.equal(sent.payload.payload.password,'senha-de-teste');
listener({origin:sent.origin,source:{},data:{channel,type:'response',id:sent.payload.id,result:{ok:true,token:'incorreto'}}});
assert.equal(vm.runInContext('pendingRequests.size',transport),1,'Rejeita respostas de outra janela');
listener({origin:sent.origin,source,data:{channel,type:'response',id:sent.payload.id,result:{ok:true,token:'teste'}}});
assert.equal((await apiResult).token,'teste');
console.log('Verificados: fluxo de 30 questões, envio confirmado, recuperação de rascunho, estatísticas, filtros, gráficos SVG, detalhes, logout, autenticação, notas no servidor, validação, fórmulas e reenvio sem duplicação.');
console.log('Ponte entre domínios: aceita a origem Google, rejeita origem externa e janela incorreta, e correlaciona a resposta ao pedido.');
console.log('Limite: simulação de DOM/Apps Script; implantação Google e aparência no navegador não verificadas.');
