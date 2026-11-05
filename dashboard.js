// Cole aqui a URL /exec da implantação do Google Apps Script.
const API_URL = "";
let teacherToken='',dashboardData=null,bridgePromise=null,bridgeWindow=null,bridgeOrigin='',bridgeChannel='';
const pendingRequests=new Map();
function apiBridge(){
  if(bridgePromise)return bridgePromise;
  if(!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(API_URL))return Promise.reject(new Error('O recebimento ainda não foi configurado. O professor precisa conectar a página ao serviço da planilha.'));
  bridgeChannel=makeId();
  bridgePromise=new Promise((resolve,reject)=>{
    const iframe=document.createElement('iframe');iframe.hidden=true;iframe.title='Conexão com a avaliação';iframe.referrerPolicy='no-referrer';
    const onMessage=event=>{
      if(!/^https:\/\/(?:[a-z0-9-]+-)?script\.googleusercontent\.com$/.test(event.origin)&&event.origin!=='https://script.google.com')return;
      const message=event.data;if(!message||message.channel!==bridgeChannel)return;
      if(message.type==='ready'){
        if(bridgeWindow&&event.source!==bridgeWindow)return;
        bridgeWindow=event.source;bridgeOrigin=event.origin;clearTimeout(timeout);resolve();return;
      }
      if(event.source!==bridgeWindow||message.type!=='response')return;
      const pending=pendingRequests.get(message.id);if(!pending)return;
      clearTimeout(pending.timer);pendingRequests.delete(message.id);pending.resolve(message.result);
    };
    window.addEventListener('message',onMessage);
    const timeout=setTimeout(()=>{window.removeEventListener('message',onMessage);iframe.remove();bridgePromise=null;bridgeWindow=null;reject(new Error('Não foi possível conectar. Verifique a internet e se o serviço foi publicado com acesso para qualquer pessoa.'));},45000);
    iframe.src=API_URL+'?bridge='+encodeURIComponent(bridgeChannel);document.body.append(iframe);
  });
  return bridgePromise;
}
async function callApi(payload){
  await apiBridge();const id=makeId();
  const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pendingRequests.delete(id);reject(new Error('O serviço demorou para responder. Tente novamente; o protocolo impede duplicar o reenvio.'));},45000);
    pendingRequests.set(id,{resolve,timer});
    bridgeWindow.postMessage({channel:bridgeChannel,type:'request',id,payload},bridgeOrigin);
  });
  if(!result||!result.ok)throw new Error(result?.error||'Não foi possível confirmar a operação.');
  return result;
}
async function submit(){
  if(submitted||sending)return;
  if(answers.some(x=>!x)){alert('Responda todas as questões antes de entregar.');return;}
  if(!confirm('Confirmar a entrega da avaliação?'))return;
  sending=true;$('send').disabled=true;$('reviewBack').disabled=true;$('send').textContent='Registrando entrega...';
  if(!submissionId)submissionId=makeId();saveDraft();
  try{
    const result=await callApi({action:'submit',data:{student,answers:answers.slice(),submissionId}});
    submitted=true;sending=false;try{localStorage.removeItem(STORE_KEY)}catch(e){}
    $('delivery').textContent='Entrega confirmada. Suas 30 respostas foram registradas. Protocolo: '+result.protocolo;show('done');
  }catch(error){failSend(error.message+' Suas respostas continuam salvas neste aparelho.');}
}
function fmt(value,digits=1){return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value);}
function dateText(value){const date=new Date(value);return Number.isNaN(date.getTime())?'Data não informada':date.toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});}
function calculateStats(rows,matrix){
  const questions=matrix.map((item,i)=>{
    const counts=Object.fromEntries(letters.map(letter=>[letter,0]));rows.forEach(row=>{if(counts[row.answers[i]]!==undefined)counts[row.answers[i]]++;});
    const correct=counts[item.answer]||0;return {...item,counts,correct,errors:rows.length-correct,rate:rows.length?correct/rows.length:0};
  });
  const histogram=[0,0,0,0,0];let totalCorrect=0;
  rows.forEach(row=>{totalCorrect+=row.correct;histogram[Math.min(4,Math.floor(row.grade/2))]++;});
  return {count:rows.length,mean:rows.length?totalCorrect/rows.length/30*10:0,accuracy:rows.length?totalCorrect/(rows.length*30):0,questions,histogram,review:rows.length?questions.filter(q=>q.rate<.5).length:0};
}
function filteredRows(){
  if(!dashboardData)return [];
  const classroom=$('classFilter').value,search=$('nameFilter').value.trim().toLocaleLowerCase('pt-BR');
  return dashboardData.rows.filter(row=>(!classroom||row.classroom===classroom)&&(!search||row.name.toLocaleLowerCase('pt-BR').includes(search)));
}
const SVG_NS='http://www.w3.org/2000/svg';
function svgElement(tag,attrs={},text){const e=document.createElementNS(SVG_NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!==undefined)e.textContent=text;return e;}
function barChart(container,items,{percent=false,title,width=1000}={}){
  container.replaceChildren();if(!items.length){empty(container,'Nenhuma entrega para os filtros selecionados.');return;}
  const h=260,left=50,right=15,top=32,bottom=45,plotH=h-top-bottom,max=percent?100:Math.max(1,...items.map(x=>x.value));
  const svg=svgElement('svg',{viewBox:`0 0 ${width} ${h}`,role:'img','aria-label':title});
  svg.append(svgElement('title',{},title));
  for(let t=0;t<=4;t++){
    const value=max*t/4,y=h-bottom-plotH*t/4;
    svg.append(svgElement('line',{x1:left,y1:y,x2:width-right,y2:y,stroke:'#e3eaf4'}));
    svg.append(svgElement('text',{x:left-9,y:y+4,'text-anchor':'end',fill:'#60728c','font-size':11},percent?Math.round(value)+'%':fmt(value,value%1?1:0)));
  }
  const step=(width-left-right)/items.length,bw=Math.min(90,step*.65);
  items.forEach((item,i)=>{
    const x=left+i*step+(step-bw)/2,height=item.value/max*plotH,y=h-bottom-height;
    const rect=svgElement('rect',{x,y,width:bw,height:Math.max(height,.5),rx:3,fill:percent&&item.value<50?'#d37b51':'#3575d3'});
    rect.append(svgElement('title',{},item.label+': '+fmt(item.value,percent?1:0)+(percent?'%':' entrega(s)')));svg.append(rect);
    svg.append(svgElement('text',{x:x+bw/2,y:h-bottom+22,'text-anchor':'middle',fill:'#536781','font-size':items.length>10?11:13},item.label));
    if(items.length<=5)svg.append(svgElement('text',{x:x+bw/2,y:y-7,'text-anchor':'middle',fill:'#172944','font-size':13},String(item.value)));
  });
  container.append(svg);
}
function empty(parent,message){const p=document.createElement('p');p.className='empty';p.textContent=message;parent.append(p);}
function cell(row,value,className){const td=document.createElement('td');td.textContent=String(value);if(className)td.className=className;row.append(td);return td;}
function detailButton(text,action){const b=document.createElement('button');b.className='tablelink';b.textContent=text;b.onclick=action;return b;}
function drawDashboard(){
  if(!dashboardData)return;
  const rows=filteredRows(),stats=calculateStats(rows,dashboardData.matrix);
  $('kpiCount').textContent=String(stats.count);$('kpiMean').textContent=stats.count?fmt(stats.mean,2):'—';$('kpiAccuracy').textContent=stats.count?fmt(stats.accuracy*100)+'%':'—';$('kpiReview').textContent=stats.count?String(stats.review):'—';
  barChart($('questionChart'),stats.count?stats.questions.map(q=>({label:String(q.n).padStart(2,'0'),value:q.rate*100})):[],{percent:true,title:'Percentual de acertos por questão, de 0 a 100 por cento'});
  barChart($('gradeChart'),stats.count?['0 a <2','2 a <4','4 a <6','6 a <8','8 a 10'].map((label,i)=>({label,value:stats.histogram[i]})):[],{title:'Quantidade de entregas por faixa de nota',width:800});
  $('questionRows').replaceChildren();
  stats.questions.forEach(q=>{const tr=document.createElement('tr');cell(tr,'').append(detailButton('Questão '+q.n,()=>showQuestion(q,rows)));cell(tr,q.skill);cell(tr,q.answer,'num');cell(tr,q.correct,'num');cell(tr,q.errors,'num');cell(tr,stats.count?fmt(q.rate*100)+'%':'—','num rate '+(q.rate<.5?'low':'high'));$('questionRows').append(tr);});
  $('studentsCaption').textContent=rows.length+' entrega(s) neste recorte. A lista mostra as mais recentes primeiro.';
  $('studentRows').replaceChildren();
  rows.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(row=>{
    const tr=document.createElement('tr');cell(tr,row.name);cell(tr,row.year);cell(tr,row.classroom);cell(tr,dateText(row.date),'num');cell(tr,row.correct+'/30','num');cell(tr,fmt(row.grade,2),'num rate');cell(tr,'').append(detailButton('Ver respostas',()=>showStudent(row)));$('studentRows').append(tr);
  });
  if(!rows.length){const tr=document.createElement('tr');const td=cell(tr,'Nenhuma entrega para os filtros selecionados.');td.colSpan=7;$('studentRows').append(tr);}
}
function openDetails(title){$('detailTitle').textContent=title;$('detailBody').replaceChildren();$('detailDialog').showModal();return $('detailBody');}
function showQuestion(q,rows){
  const body=openDetails('Questão '+q.n);const p=document.createElement('p');p.textContent=QUESTIONS[q.n-1].text;body.append(p);
  const info=document.createElement('p');info.className='muted';info.textContent=q.skill+' • Gabarito '+q.answer+' • '+q.correct+' de '+rows.length+' acertos';body.append(info);
  const chart=document.createElement('div');body.append(chart);barChart(chart,rows.length?letters.map(letter=>({label:letter+(letter===q.answer?' (correta)':''),value:q.counts[letter]})):[],{width:650,title:'Alternativas escolhidas na questão '+q.n});
  const list=document.createElement('ol');list.type='A';QUESTIONS[q.n-1].options.forEach(option=>{const li=document.createElement('li');li.textContent=option;list.append(li);});body.append(list);
}
function showStudent(row){
  const body=openDetails(row.name),p=document.createElement('p');p.textContent=row.classroom+' • Nota '+fmt(row.grade,2)+' • '+row.correct+'/30 acertos • '+dateText(row.date);body.append(p);
  const table=document.createElement('table'),head=document.createElement('thead'),hr=document.createElement('tr');['Questão','Marcada','Gabarito','Resultado'].forEach(label=>{const th=document.createElement('th');th.textContent=label;hr.append(th);});head.append(hr);table.append(head);
  const tb=document.createElement('tbody');dashboardData.matrix.forEach((q,i)=>{const tr=document.createElement('tr'),ok=row.answers[i]===q.answer;tr.className=ok?'correct':'incorrect';cell(tr,q.n);cell(tr,row.answers[i]||'—');cell(tr,q.answer);cell(tr,ok?'Acertou':'Errou');tb.append(tr);});table.append(tb);body.append(table);
}
async function loadDashboard(){
  const token=teacherToken;
  $('refreshData').disabled=true;$('dashboardStatus').textContent='Carregando entregas...';
  try{
    const result=await callApi({action:'dashboard',token});if(token!==teacherToken)return;dashboardData=result;
    const previous=$('classFilter').value;$('classFilter').replaceChildren();const all=document.createElement('option');all.value='';all.textContent='Todas as turmas';$('classFilter').append(all);
    [...new Set(result.rows.map(row=>row.classroom))].sort((a,b)=>a.localeCompare(b,'pt-BR')).forEach(classroom=>{const option=document.createElement('option');option.value=classroom;option.textContent=classroom;$('classFilter').append(option);});
    if([...$('classFilter').options].some(x=>x.value===previous))$('classFilter').value=previous;
    $('lastUpdate').textContent='Atualizado em '+dateText(result.updatedAt);$('dashboardStatus').textContent='';drawDashboard();
  }catch(error){$('dashboardStatus').textContent=error.message;if(/Sessão expirada/.test(error.message))logoutTeacher();}
  finally{$('refreshData').disabled=false;}
}
async function loginTeacher(event){
  event.preventDefault();$('loginButton').disabled=true;$('loginStatus').textContent='Verificando acesso...';
  try{const result=await callApi({action:'login',password:$('teacherPassword').value});teacherToken=result.token;$('teacherPassword').value='';$('loginStatus').textContent='';show('dashboard');await loadDashboard();}
  catch(error){$('loginStatus').textContent=error.message;}
  finally{$('loginButton').disabled=false;}
}
function logoutTeacher(){
  if(teacherToken)callApi({action:'logout',token:teacherToken}).catch(()=>{});
  teacherToken='';dashboardData=null;$('kpiCount').textContent='0';['kpiMean','kpiAccuracy','kpiReview'].forEach(id=>$(id).textContent='—');$('lastUpdate').textContent='';$('studentsCaption').textContent='';$('studentRows').replaceChildren();$('questionRows').replaceChildren();$('questionChart').replaceChildren();$('gradeChart').replaceChildren();$('detailBody').replaceChildren();$('teacherPassword').value='';$('detailDialog').close();show('teacherLogin');
}
function exportDashboard(){
  if(!dashboardData)return;
  const protect=value=>{let text=String(value??'');if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  const rows=[['Data/hora','Protocolo','Nome','Ano','Turma','Acertos','Nota',...QUESTIONS.map(q=>'Q'+String(q.n).padStart(2,'0'))],...filteredRows().map(row=>[dateText(row.date),row.id,row.name,row.year,row.classroom,row.correct,fmt(row.grade,2),...row.answers])];
  const blob=new Blob(['\ufeff'+rows.map(row=>row.map(protect).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='notas_matematica.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('teacherArea').onclick=()=>show(teacherToken?'dashboard':'teacherLogin');
$('studentArea').onclick=()=>show(submitted?'done':answers.some(Boolean)?'quiz':'intro');
$('loginForm').onsubmit=loginTeacher;$('refreshData').onclick=loadDashboard;$('logout').onclick=logoutTeacher;$('exportData').onclick=exportDashboard;$('classFilter').onchange=drawDashboard;$('nameFilter').oninput=drawDashboard;$('closeDetail').onclick=()=>$('detailDialog').close();
if(!API_URL){const notice=document.createElement('p');notice.className='alert setupnotice';notice.textContent='O professor ainda precisa conectar o recebimento de respostas. Aguarde a liberação para iniciar.';$('intro').prepend(notice);$('start').disabled=true;$('resume').disabled=true;}
