import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const dir=new URL('.',import.meta.url);
const matrix=JSON.parse((await fs.readFile(new URL('matriz.json',dir),'utf8')).replace(/^\uFEFF/,''));
if(matrix.length!==30)throw Error('Matriz incompleta');
let html=await fs.readFile('C:/Users/sharl/Downloads/Index.html','utf8');
const questions=JSON.parse(html.match(/const QUESTIONS=(\[.*?\]);/s)[1]);
questions[26].options=questions[26].options.map(x=>x.replace('cm²','m²'));
html=html.replace(/const QUESTIONS=\[.*?\];/s,'const QUESTIONS='+JSON.stringify(questions)+';');
html=html.replace("const STORE_KEY='matematica7_rascunho_v2';", "const STORE_KEY='matematica7_rascunho_v3';let submissionId='',sending=false;");
html=html.replace('JSON.stringify({student,answers,current})','JSON.stringify({student,answers,current,submissionId})');
html=html.replace("student={name,year,classroom:room};saveDraft();", "student={name,year,classroom:room};if(!submissionId)submissionId=makeId();saveDraft();");
html=html.replace('if(submitted)return;', 'if(submitted||sending)return;');
const start=html.indexOf(" $('send').disabled=true;");
const end=html.indexOf('\nfunction failSend',start);
html=html.slice(0,start)+`
 sending=true;$('send').disabled=true;$('reviewBack').disabled=true;$('send').textContent='Salvando na planilha...';
 if(!submissionId)submissionId=makeId();saveDraft();
 const timer=setTimeout(()=>{if(!submitted)failSend('A confirmação demorou. Verifique a conexão e tente novamente. Suas respostas continuam neste aparelho.');},45000);
 google.script.run.withSuccessHandler(function(result){
   clearTimeout(timer);if(submitted)return;
   if(!result||!result.ok){failSend('Não foi possível confirmar o registro. Tente novamente.');return;}
   submitted=true;sending=false;try{localStorage.removeItem(STORE_KEY)}catch(e){}
   $('delivery').textContent='Entrega confirmada. Suas 30 respostas foram registradas. Protocolo: '+result.protocolo;
   show('done');
 }).withFailureHandler(function(error){clearTimeout(timer);if(!submitted)failSend('Não foi possível salvar. Verifique a conexão e tente novamente.');}).registrarRespostas({student,answers,submissionId});
}
function makeId(){return globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);}
`+html.slice(end);
html=html.replace("function failSend(message){", "function failSend(message){sending=false;$('reviewBack').disabled=false;");
html=html.replace("student=data.student;answers=data.answers;current=data.current||0;", "if(!data.student||typeof data.student.name!=='string'||!data.answers.every(x=>x===''||letters.includes(x)))return;student=data.student;answers=data.answers;current=Number.isInteger(data.current)&&data.current>=0&&data.current<QUESTIONS.length?data.current:0;submissionId=typeof data.submissionId==='string'?data.submissionId:makeId();");
html=html.replace('Seu professor fará a correção.', 'Seu professor poderá consultar a correção na planilha.');
html=html.replace('Turma (opcional)', 'Turma').replace("if(!name||!year)","if(!name||!year||!room)").replace('Informe o nome e o ano escolar.', 'Informe seu nome, ano escolar e turma.');
await fs.writeFile(new URL('Index.html',dir),html);
await fs.writeFile(new URL('questoes.json',dir),JSON.stringify(questions,null,2));
const wb=Workbook.create();
const resumo=wb.worksheets.add('Resumo'),resp=wb.worksheets.add('Respostas'),gab=wb.worksheets.add('Gabarito');
const col=n=>{let s='';for(;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s};
resumo.getRange('A2').values=[['Análise de Matemática — 7º ano']];
resumo.getRange('A4:B6').values=[['Turma (vazio = todas)',''],['Entregas',null],['Média das notas (0 a 10)',null]];
resumo.getRange('B5').formulas=[['=IF(B4="",COUNTA(Respostas!B2:B5001),COUNTIF(Respostas!E2:E5001,B4))']];
resumo.getRange('B6').formulas=[['=IF(B5=0,"",IF(B4="",AVERAGE(Respostas!AK2:AK5001),AVERAGEIF(Respostas!E2:E5001,B4,Respostas!AK2:AK5001)))']];
resumo.getRange('D4').values=[['Digite a turma exatamente como foi informada pelo aluno.']];
resumo.getRange('D5').values=[['Cada entrega é uma tentativa. O protocolo evita duplicar reenvios.']];
resumo.getRange('D6').values=[['Nota = acertos ÷ 30 × 10. Cada questão vale 1 ponto.']];
resumo.getRange('A9:L9').values=[['Questão','Habilidade','Nível do item','Gabarito','Respostas','Acertos','Erros','% acertos','A','B','C','D']];
resumo.getRange('M9').values=[['E']];
const lines=matrix.map((m,i)=>{
 const r=i+10,g=i+2,c=col(i+6),range=`Respostas!${c}$2:${c}$5001`,turma='Respostas!$E$2:$E$5001';
 const count=crit=>`IF($B$4="",COUNTIF(${range},${crit}),COUNTIFS(${range},${crit},${turma},$B$4))`;
 return [`=Gabarito!A${g}`,`=Gabarito!D${g}`,`=Gabarito!C${g}`,`=Gabarito!B${g}`,'=$B$5',`=${count(`D${r}`)}`,`=E${r}-F${r}`,`=IF(E${r}=0,"",F${r}/E${r})`,...['A','B','C','D','E'].map(x=>'='+count('"'+x+'"'))];
});
resumo.getRange('A10:M39').formulas=lines;
resumo.getRange('A42').values=[['Níveis descrevem os itens do documento. A nota não equivale à escala TRI do Avalia+.']];
resp.getRange('A1:AL1').values=[['Data/hora','Protocolo','Nome','Ano escolar','Turma',...questions.map(x=>'Q'+String(x.n).padStart(2,'0')),'Acertos (0–30)','Nota (0–10)','% acertos']];
gab.getRange('A1:E1').values=[['Questão','Resposta','Nível do item','Habilidade','Enunciado']];
gab.getRange('A2:E31').values=matrix.map((m,i)=>[m.n,m.answer,m.level,m.skill,questions[i].text]);
gab.getRange('G1').values=[['Fonte: Questionario_Matematica_7ano_Avalia_2.docx — Gabarito e matriz pedagógica.']];
gab.getRange('G3').values=[['Questão 27: unidades das alternativas corrigidas para m² no HTML. Gabarito D mantido.']];
for(const [sh,area,header] of [[resumo,'A2:M42','A9:M9'],[resp,'A1:AL2','A1:AL1'],[gab,'A1:G31','A1:E1']]){
 sh.getRange(area).format.font={name:'Arial',size:10,color:'#000000'};
 sh.getRange(area).format.rowHeight=24;
 sh.getRange(area).format.verticalAlignment='center';
 sh.getRange(header).format.fill='#eeeeee';sh.getRange(header).format.font.bold=true;
 sh.getRange(header).format.wrapText=true;sh.getRange(header).format.rowHeight=38;
}
resumo.getRange('A2').format.font={name:'Arial',size:14,bold:true};
resumo.getRange('A4:A6').format.columnWidth=31;resumo.getRange('B1:B42').format.columnWidth=40;
resumo.getRange('C1:D42').format.columnWidth=16;resumo.getRange('E1:H42').format.columnWidth=13;resumo.getRange('I1:M42').format.columnWidth=8;
resumo.getRange('B4').format.fill='#fff2cc';resumo.getRange('B6').setNumberFormat('0.00');resumo.getRange('H10:H39').setNumberFormat('0.0%');
resp.getRange('A1:B2').format.columnWidth=26;resp.getRange('C1:C2').format.columnWidth=35;resp.getRange('D1:E2').format.columnWidth=16;resp.getRange('F1:AI2').format.columnWidth=7;resp.getRange('AJ1:AL2').format.columnWidth=16;
resp.freezePanes.freezeRows(1);resp.freezePanes.freezeColumns(3);
gab.getRange('A1:C31').format.columnWidth=15;gab.getRange('D1:D31').format.columnWidth=38;gab.getRange('E1:E31').format.columnWidth=85;gab.getRange('E2:E31').format.wrapText=true;gab.getRange('E2:E31').format.rowHeight=90;gab.freezePanes.freezeRows(1);
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'Resumo!A4:B6',include:'values,formulas',tableMaxRows:4,tableMaxCols:2})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:10}})).ndjson);
await (await SpreadsheetFile.exportXlsx(wb)).save(fileURLToPath(new URL('Analise_Matematica.xlsx',dir)));
for(const [sheetName,range] of [['Resumo','A2:M18'],['Respostas','A1:H3'],['Gabarito','A1:D10']]){
 const blob=await wb.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(new URL('preview-'+sheetName+'.png',dir),new Uint8Array(await blob.arrayBuffer()));
}
console.log('HTML, planilha e prévias gerados.');
