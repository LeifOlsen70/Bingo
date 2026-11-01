import {validate,completedLines,ticketPage} from './logic.mjs';
import {ticketIdentifiers,detectGrid,detectPixelGrid,detectTileGrid} from './import.mjs';
const $=id=>document.getElementById(id);let tickets=[],image=null,rect={left:.1,right:.9,top:.2,bottom:.8},start=null,worker=null,busy=false,editing=null,identifiers={series:'',lot:''},page=0,importQueue=[],batchTotal=0,batchIndex=0,drawnNumbers=new Set(),view='draw';
let savedRound=null;
try{savedRound=localStorage.getItem('bingo-round');}catch{}
if(!savedRound)try{savedRound=sessionStorage.getItem('bingo-round');}catch{}
try{const saved=JSON.parse(savedRound||'[]');if(Array.isArray(saved))tickets=saved.filter(t=>t&&typeof t.name==='string'&&!validate(t.numbers)&&Array.isArray(t.marked)&&t.marked.every(i=>Number.isInteger(i)&&i>=0&&i<25));}catch{}
// Migrate the existing device round and keep numbers even when no ticket contains them.
let savedGame=null;
try{savedGame=JSON.parse(localStorage.getItem('bingo-game')||'null');}catch{}
if(savedGame&&Array.isArray(savedGame.tickets)&&savedGame.tickets.every(t=>t&&typeof t.name==='string'&&!validate(t.numbers)&&Array.isArray(t.marked))&&Array.isArray(savedGame.drawnNumbers)&&savedGame.drawnNumbers.every(n=>Number.isInteger(n)&&n>=1&&n<=75)){tickets=savedGame.tickets;drawnNumbers=new Set(savedGame.drawnNumbers);}else drawnNumbers=new Set(tickets.flatMap(t=>t.marked.map(i=>t.numbers[i])));
function syncMarks(){for(const ticket of tickets)ticket.marked=ticket.numbers.flatMap((n,i)=>drawnNumbers.has(n)?[i]:[]);}
syncMarks();
let storageWarningShown=false;
function remember(){const value=JSON.stringify(tickets),game=JSON.stringify({tickets,drawnNumbers:[...drawnNumbers]});try{localStorage.setItem('bingo-game',game);localStorage.setItem('bingo-round',value);try{sessionStorage.setItem('bingo-round',value);}catch{}}catch{try{sessionStorage.setItem('bingo-round',value);}catch{}if(!storageWarningShown){storageWarningShown=true;alert('Lose und gezogene Zahlen konnten nicht dauerhaft auf diesem Gerät gespeichert werden. Bitte prüfen, ob privates Surfen aktiv oder der Gerätespeicher voll ist.');}}}
if(tickets.length||drawnNumbers.size)remember();
function markNumber(number,mark=!drawnNumbers.has(number)){if(mark)drawnNumbers.add(number);else drawnNumbers.delete(number);syncMarks();remember();render();}
function resetRound(){if(confirm('Alle gezogenen Zahlen und Markierungen auf deinen Losen zurücksetzen?')){drawnNumbers.clear();syncMarks();remember();render();}}
function renderDraw(){ $('drawBody').replaceChildren();const letters=['B','I','N','G','O'];for(let row=0;row<15;row++){const tr=document.createElement('tr');for(let column=0;column<5;column++){const number=column*15+row+1,marked=drawnNumbers.has(number),td=document.createElement('td'),button=document.createElement('button');button.className='drawnumber'+(marked?' marked':'');button.textContent=number;button.setAttribute('aria-label',`${letters[column]} ${number}, ${marked?'markiert':'nicht markiert'}`);button.setAttribute('aria-pressed',String(marked));button.onclick=()=>markNumber(number);td.append(button);tr.append(td);}$('drawBody').append(tr);}$('drawCount').textContent=`${drawnNumbers.size} ${drawnNumbers.size===1?'Zahl':'Zahlen'} markiert`;}
function render(){const current=ticketPage(tickets,page,4);page=current.index;document.body.classList.toggle('playing',tickets.length>0||view==='draw');document.body.classList.toggle('drawing',view==='draw');$('drawScreen').hidden=view!=='draw';$('drawView').setAttribute('aria-pressed',String(view==='draw'));$('ticketsView').setAttribute('aria-pressed',String(view==='tickets'));renderDraw();$('prevPage').disabled=page===0;$('nextPage').disabled=page===current.count-1;$('pageStatus').textContent=`Seite ${page+1} von ${current.count} · ${tickets.length} Lose`;$('empty').hidden=view!=='tickets'||tickets.length>0;$('play').hidden=view!=='tickets'||!tickets.length;$('count').textContent=`(${tickets.length})`;$('cards').replaceChildren();current.items.forEach(t=>{const card=document.createElement('article');card.className='card';const head=document.createElement('div');head.className='cardhead';const title=document.createElement('h3');title.textContent=t.name;head.append(title);const tools=document.createElement('div');tools.className='tools';for(const [label,action] of [['Ändern',()=>edit(t)],['Entfernen',()=>{if(confirm(`${t.name} entfernen?`)){tickets=tickets.filter(x=>x!==t);remember();render();}}]]){const b=document.createElement('button');b.className='small';b.textContent=label==='Ändern'?'✎':'×';b.setAttribute('aria-label',`${t.name}: ${label}`);b.title=label;b.onclick=action;tools.append(b);}head.append(tools);card.append(head);const ids=document.createElement('div');ids.className='cardids';ids.textContent=`S ${t.series||'—'} · Los ${t.lot||'—'}`;card.append(ids);const lines=completedLines(t.marked),winning=new Set(lines.flat());const grid=document.createElement('div');grid.className='grid';t.numbers.forEach((n,i)=>{const b=document.createElement('button');b.className='cell'+(t.marked.includes(i)?' marked':'')+(winning.has(i)?' line':'');b.textContent=n;b.setAttribute('aria-label',`${n}, ${t.marked.includes(i)?'markiert':'nicht markiert'}`);b.setAttribute('aria-pressed',String(t.marked.includes(i)));b.onclick=()=>markNumber(n);grid.append(b);});card.append(grid);const foot=document.createElement('div');foot.className='cardfoot';const hits=document.createElement('span');hits.textContent=`${t.marked.length}/25 markiert`;const result=document.createElement('span');result.className='bingo';result.textContent=lines.length?`${lines.length}× BINGO!`:'';foot.append(hits,result);card.append(foot);$('cards').append(card);});}
function showReview(nums=Array(25).fill(''),uncertain=[]){$('cropStep').hidden=true;$('reviewStep').hidden=false;$('stepLabel').textContent='SCHRITT 2 VON 2';$('dialogTitle').textContent='Zahlen prüfen';$('reviewError').textContent='';$('seriesNumber').value=identifiers.series||'';$('lotNumber').value=identifiers.lot||'';$('identifierHint').textContent=identifiers.series&&identifiers.lot?'Losdaten erkannt – bitte mit dem Screenshot vergleichen.':'Nicht erkannte Losdaten kannst du ergänzen. Serien- und Losnummer müssen im Screenshot sichtbar sein.';$('editGrid').replaceChildren();for(let i=0;i<25;i++){const input=document.createElement('input');input.type='text';input.inputMode='numeric';input.pattern='[0-9]*';input.maxLength=2;input.value=nums[i]??'';input.className=uncertain.includes(i)||!input.value?'uncertain':'';input.setAttribute('aria-label',`Zeile ${Math.floor(i/5)+1}, Spalte ${i%5+1}`);input.oninput=()=>{input.value=input.value.replace(/\D/g,'').slice(0,2);input.classList.remove('uncertain');};$('editGrid').append(input);}$('ticketName').value=editing?editing.name:`Los ${tickets.length+1}`;$('reference').hidden=!image;$('back').hidden=!image;if(image)$('reference').src=cropped().toDataURL();}
function edit(t){batchTotal=0;importQueue=[];$('batchStatus').hidden=true;$('skipFile').hidden=true;editing=t;image=null;identifiers={series:t.series||'',lot:t.lot||''};showReview(t.numbers);$('importDialog').showModal();}
function showCrop(){ $('reviewStep').hidden=true;$('cropStep').hidden=false;$('stepLabel').textContent='SCHRITT 1 VON 2';$('dialogTitle').textContent='Bingofeld eingrenzen';$('progress').textContent='';draw();}
$('upload').onchange=async e=>{if(busy)return;const files=Array.from(e.target.files||[]);e.target.value='';if(!files.length)return;importQueue=files;batchTotal=files.length;batchIndex=0;editing=null;await openNextScreenshot();};
async function openNextScreenshot(){
 if(!importQueue.length){batchTotal=0;batchIndex=0;$('batchStatus').hidden=true;$('skipFile').hidden=true;image=null;$('importDialog').close();return;}
 const file=importQueue.shift();batchIndex++;editing=null;image=null;identifiers={series:'',lot:''};$('batchStatus').hidden=false;$('batchStatus').textContent=`Screenshot ${batchIndex} von ${batchTotal}`;$('skipFile').hidden=batchTotal<2;showCrop();$('preview').getContext('2d').clearRect(0,0,$('preview').width,$('preview').height);if(!$('importDialog').open)$('importDialog').showModal();setBusy(true);$('progress').textContent='Screenshot wird geöffnet …';
 try{const url=URL.createObjectURL(file);const img=new Image();try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});}finally{URL.revokeObjectURL(url);}const scale=Math.min(1,2400/Math.max(img.width,img.height));const source=document.createElement('canvas');source.width=Math.round(img.width*scale);source.height=Math.round(img.height*scale);source.getContext('2d').drawImage(img,0,0,source.width,source.height);image=source;rect={left:.1,right:.9,top:.2,bottom:.8};draw();await autoImport();}catch{setBusy(false);alert(`„${file.name}“ konnte nicht geöffnet werden. Bitte einen PNG- oder JPG-Screenshot auswählen.`);await openNextScreenshot();}finally{setBusy(false);}
}
function cancelImport(){if(busy)return;if(batchTotal>1&&!confirm('Import beenden? Bereits übernommene Lose bleiben erhalten.'))return;importQueue=[];batchTotal=0;batchIndex=0;image=null;$('batchStatus').hidden=true;$('skipFile').hidden=true;$('importDialog').close();}
$('skipFile').onclick=()=>{if(!busy)openNextScreenshot();};
$('drawView').onclick=()=>{view='draw';render();};$('ticketsView').onclick=()=>{view='tickets';render();};$('resetDraw').onclick=resetRound;
$('prevPage').onclick=()=>{page--;render();};$('nextPage').onclick=()=>{page++;render();};
$('manual').onclick=()=>{batchTotal=0;importQueue=[];$('batchStatus').hidden=true;$('skipFile').hidden=true;editing=null;image=null;identifiers={series:'',lot:''};showReview();$('importDialog').showModal();};$('closeDialog').onclick=cancelImport;$('importDialog').addEventListener('cancel',e=>{e.preventDefault();cancelImport();});$('back').onclick=showCrop;
function draw(){if(!image)return;const c=$('preview');const scale=Math.min(1,700/image.width);c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);const ctx=c.getContext('2d');ctx.drawImage(image,0,0,c.width,c.height);const x=rect.left*c.width,y=rect.top*c.height,w=(rect.right-rect.left)*c.width,h=(rect.bottom-rect.top)*c.height;ctx.fillStyle='rgba(5,28,16,.55)';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(image,rect.left*image.width,rect.top*image.height,(rect.right-rect.left)*image.width,(rect.bottom-rect.top)*image.height,x,y,w,h);ctx.strokeStyle='#ffe071';ctx.lineWidth=3;ctx.strokeRect(x,y,w,h);ctx.lineWidth=1;ctx.strokeStyle='rgba(255,224,113,.7)';for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(x+w*i/5,y);ctx.lineTo(x+w*i/5,y+h);ctx.moveTo(x,y+h*i/5);ctx.lineTo(x+w,y+h*i/5);ctx.stroke();}for(const key of Object.keys(rect))$(key).value=rect[key]*100;}
for(const key of Object.keys(rect))$(key).oninput=()=>{rect[key]=Number($(key).value)/100;if(rect.right<rect.left+.02){if(key==='left')rect.left=rect.right-.02;else rect.right=rect.left+.02;}if(rect.bottom<rect.top+.02){if(key==='top')rect.top=rect.bottom-.02;else rect.bottom=rect.top+.02;}draw();};
function point(e){const b=$('preview').getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))};}
$('preview').onpointerdown=e=>{if(busy)return;start=point(e);$('preview').setPointerCapture(e.pointerId);};$('preview').onpointermove=e=>{if(!start)return;const p=point(e);rect={left:Math.min(start.x,p.x),right:Math.max(start.x,p.x),top:Math.min(start.y,p.y),bottom:Math.max(start.y,p.y)};draw();};$('preview').onpointerup=()=>{start=null;if(rect.right-rect.left<.02)rect.right=Math.min(1,rect.left+.02);if(rect.bottom-rect.top<.02)rect.bottom=Math.min(1,rect.top+.02);draw();};$('preview').onpointercancel=()=>{start=null;};
function cropped(){const c=document.createElement('canvas');c.width=Math.max(1,Math.round((rect.right-rect.left)*image.width));c.height=Math.max(1,Math.round((rect.bottom-rect.top)*image.height));c.getContext('2d').drawImage(image,rect.left*image.width,rect.top*image.height,c.width,c.height,0,0,c.width,c.height);return c;}
$('skipOCR').onclick=()=>showReview();
function setBusy(value){busy=value;for(const el of $('cropStep').querySelectorAll('button,input'))el.disabled=value;$('closeDialog').disabled=value;$('skipFile').disabled=value;$('upload').disabled=value;}
$('recognize').onclick=async()=>{if(!image||busy)return;if(rect.right-rect.left<.02||rect.bottom-rect.top<.02){$('progress').textContent='Bitte zuerst einen Rahmen um das gesamte Bingofeld ziehen.';return;}setBusy(true);const numbers=[],uncertain=[];try{$('progress').textContent='Bilderkennung wird vorbereitet …';await getWorker();await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'7'});const cells=await readCells();numbers.push(...cells.numbers);uncertain.push(...cells.uncertain);showReview(numbers,uncertain);}catch(err){console.error('Bilderkennung fehlgeschlagen',err);if(worker){try{await worker.terminate();}catch{}worker=null;}$('progress').textContent='Die Bilderkennung hat nicht funktioniert. Du kannst den Ausschnitt beibehalten und die Zahlen selbst eintragen.';}finally{setBusy(false);}};
$('save').onclick=()=>{const numbers=[...$('editGrid').querySelectorAll('input')].map(x=>Number(x.value));const error=validate(numbers);if(error){$('reviewError').textContent=error;return;}const series=$('seriesNumber').value.trim(),lot=$('lotNumber').value.trim();if(series&&!/^\d{4}$/.test(series)||lot&&!/^\d{5}$/.test(lot)){$('reviewError').textContent='Die Seriennummer hat 4 Ziffern, die Losnummer 5 Ziffern. Nicht erkannte Angaben können leer bleiben.';return;}const name=$('ticketName').value.trim()||`Los ${tickets.length+1}`;if(editing){editing.name=name;if(editing.numbers.some((n,i)=>n!==numbers[i]))editing.marked=[];editing.numbers=numbers;editing.series=series;editing.lot=lot;}else{tickets.push({id:crypto.randomUUID(),name,numbers,series,lot,marked:numbers.flatMap((n,i)=>drawnNumbers.has(n)?[i]:[])});page=Math.floor((tickets.length-1)/4);}syncMarks();view='tickets';remember();render();if(batchTotal)openNextScreenshot();else $('importDialog').close();};
$('reset').onclick=resetRound;render();

async function getWorker(){if(!worker)worker=await Tesseract.createWorker('eng',1,{workerPath:new URL('./ocr/worker.min.js',document.baseURI).href,corePath:new URL('./ocr/',document.baseURI).href,langPath:new URL('./ocr/',document.baseURI).href,gzip:false,workerBlobURL:false});return worker;}
async function readRotatedIdentifiers(){
 // The printed identifiers are often vertical along the left edge of the ticket.
 const source=image, edge=document.createElement('canvas');edge.width=Math.max(1,Math.round(source.width*.38));edge.height=source.height;
 edge.getContext('2d').drawImage(source,0,0,edge.width,source.height,0,0,edge.width,edge.height);
 for(const clockwise of [true,false]){
  const rotated=document.createElement('canvas');rotated.width=edge.height;rotated.height=edge.width;
  const ctx=rotated.getContext('2d');ctx.translate(clockwise?rotated.width:0,clockwise?0:rotated.height);ctx.rotate(clockwise?Math.PI/2:-Math.PI/2);ctx.drawImage(edge,0,0);
  await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'11'});
  const result=await worker.recognize(rotated.toDataURL());
  const lines=result.data.text.split(/\n+/).map(x=>x.replace(/\D/g,''));
  const series=lines.find(x=>x.length===4),lot=lines.find(x=>x.length===5);
  if(series&&!identifiers.series)identifiers.series=series;
  if(lot&&!identifiers.lot)identifiers.lot=lot;
  if(identifiers.series&&identifiers.lot)break;
 }
}
async function autoImport(){setBusy(true);try{$('dialogTitle').textContent='Los wird automatisch gelesen';$('progress').textContent='Bingofeld, Serien- und Losnummer werden gesucht …';await getWorker();await worker.setParameters({tessedit_char_whitelist:'',tessedit_pageseg_mode:'11'});const {data}=await worker.recognize(image.toDataURL(),{},{text:true,tsv:true});identifiers=ticketIdentifiers(data.text);if(!identifiers.series||!identifiers.lot){$('progress').textContent='Seitliche Serien- und Losnummer werden gelesen …';await readRotatedIdentifiers();}const pixels=image.getContext('2d').getImageData(0,0,image.width,image.height);const pixelRect=detectTileGrid(pixels)||detectPixelGrid(pixels);const grid=detectGrid(data.tsv,image.width,image.height);if(pixelRect){rect=pixelRect;const cells=await readCells();showReview(cells.numbers,cells.uncertain);}else if(grid){rect=grid.rect;showReview(grid.numbers,grid.uncertain);}else{showCrop();$('progress').textContent='Das Bingofeld wurde nicht eindeutig erkannt. Grenze die 25 Zahlen ein und tippe auf „Zahlen erkennen“. '+(identifiers.series||identifiers.lot?'Die erkannten Losdaten werden übernommen.':'Serien- und Losnummer kannst du danach ergänzen.');}}catch(err){console.error('Automatischer Import fehlgeschlagen',err);if(worker){try{await worker.terminate();}catch{}worker=null;}showCrop();$('progress').textContent='Das Los konnte nicht automatisch gelesen werden. Du kannst den Zahlenbereich eingrenzen oder die Zahlen selbst eintragen.';}finally{setBusy(false);}}
for(const id of ['seriesNumber','lotNumber'])$(id).oninput=()=>{$(id).value=$(id).value.replace(/\D/g,'');};

async function readCells(){
 const numbers=[],uncertain=[],crop=cropped(),cw=crop.width/5,ch=crop.height/5;
 // Independently OCR the entire grid and use its word coordinates as a second opinion.
 let fullGrid=new Map();
 try{
  await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:'11'});
  const whole=await worker.recognize(crop.toDataURL(),{},{tsv:true});
  for(const line of (whole.data.tsv||'').split('\n').slice(1)){
   const a=line.split('\t');if(Number(a[0])!==5)continue;
   const raw=(a.slice(11).join('\t')||'').trim();if(!/^\d{1,2}$/.test(raw))continue;
   const x=Number(a[6])+Number(a[8])/2,y=Number(a[7])+Number(a[9])/2;
   const col=Math.floor(x/cw),row=Math.floor(y/ch),n=Number(raw);
   if(col<0||col>4||row<0||row>4||n<col*15+1||n>col*15+15)continue;
   const idx=row*5+col,arr=fullGrid.get(idx)||[];arr.push({n,confidence:Number(a[10])||0});fullGrid.set(idx,arr);
  }
 }catch(e){console.warn('Whole-grid fallback unavailable',e);}

 for(let i=0;i<25;i++){
  $('progress').textContent=`Zahl ${i+1} von 25 wird mehrfach geprüft …`;
  const col=i%5,min=col*15+1,max=min+14,candidates=[...(fullGrid.get(i)||[])];
  const make=(threshold,margin)=>{
   const c=document.createElement('canvas');c.width=240;c.height=200;
   const ctx=c.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,240,200);
   const sx=col*cw+cw*margin,sy=Math.floor(i/5)*ch+ch*margin;
   ctx.drawImage(crop,sx,sy,cw*(1-2*margin),ch*(1-2*margin),20,20,200,160);
   if(threshold){const im=ctx.getImageData(0,0,240,200);for(let p=0;p<im.data.length;p+=4){const v=.299*im.data[p]+.587*im.data[p+1]+.114*im.data[p+2];const out=v<threshold?0:255;im.data[p]=im.data[p+1]=im.data[p+2]=out;}ctx.putImageData(im,0,0);}
   return c.toDataURL();
  };
  const variants=[make(0,.07),make(175,.07),make(125,.10),make(0,.15)];
  for(let k=0;k<variants.length;k++){
   await worker.setParameters({tessedit_char_whitelist:'0123456789',tessedit_pageseg_mode:k===0?'7':k===1?'8':k===2?'10':'13'});
   const {data}=await worker.recognize(variants[k]);const raw=(data.text||'').replace(/[^0-9]/g,'');
   if(/^\d{1,2}$/.test(raw)){const n=Number(raw);if(n>=min&&n<=max)candidates.push({n,confidence:data.confidence||0});}
   if(candidates.some(x=>x.confidence>=90))break;
  }
  const grouped=new Map();for(const x of candidates){const g=grouped.get(x.n)||{score:0,count:0};g.score+=Math.max(0,x.confidence);g.count++;grouped.set(x.n,g);}
  const ranked=[...grouped].sort((a,b)=>(b[1].score+15*b[1].count)-(a[1].score+15*a[1].count));
  const best=ranked[0];numbers.push(best?best[0]:'');
  if(!best||best[1].score/best[1].count<80||(ranked[1]&&ranked[1][1].score>best[1].score*.75))uncertain.push(i);
 }
 await worker.setParameters({tessedit_pageseg_mode:'7'});
 return {numbers,uncertain};
}

// Horizontal touch gestures page through the draw board and every ticket page.
function swipePage(direction){const count=ticketPage(tickets,page,4).count;if(view==='draw'){if(direction<0)return false;view='tickets';page=0;}else if(direction<0){if(page>0)page--;else view='draw';}else{if(page>=count-1)return false;page++;}render();const surface=view==='draw'?$('drawScreen'):tickets.length?$('play'):$('empty');if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches&&surface.animate)surface.animate([{opacity:.65,transform:`translateX(${direction*24}px)`},{opacity:1,transform:'translateX(0)'}],{duration:180,easing:'ease-out'});return true;}
const swipeSurface=document.querySelector('main');let swipeTouch=null,ignoreSwipeClickUntil=0;
swipeSurface.addEventListener('touchstart',event=>{swipeTouch=null;if(busy||$('importDialog').open||event.touches.length!==1||!event.target.closest('#drawScreen,#play,#empty')||event.target.closest('input,textarea,select'))return;const touch=event.touches[0];swipeTouch={id:touch.identifier,x:touch.clientX,y:touch.clientY,horizontal:false,vertical:false};},{passive:true});
swipeSurface.addEventListener('touchmove',event=>{if(!swipeTouch)return;if(event.touches.length!==1){swipeTouch=null;return;}const touch=Array.from(event.touches).find(t=>t.identifier===swipeTouch.id);if(!touch)return;const dx=touch.clientX-swipeTouch.x,dy=touch.clientY-swipeTouch.y;if(!swipeTouch.horizontal&&!swipeTouch.vertical){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.2)swipeTouch.vertical=true;else if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.5)swipeTouch.horizontal=true;}if(swipeTouch.horizontal&&event.cancelable)event.preventDefault();},{passive:false});
swipeSurface.addEventListener('touchend',event=>{const gesture=swipeTouch;swipeTouch=null;if(!gesture||event.touches.length)return;const touch=Array.from(event.changedTouches).find(t=>t.identifier===gesture.id);if(!touch)return;const dx=touch.clientX-gesture.x,dy=touch.clientY-gesture.y;const horizontal=!gesture.vertical&&Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.5;if(gesture.horizontal||horizontal){ignoreSwipeClickUntil=Date.now()+350;if(event.cancelable)event.preventDefault();if(horizontal)swipePage(dx<0?1:-1);}},{passive:false});
swipeSurface.addEventListener('touchcancel',()=>{if(swipeTouch?.horizontal)ignoreSwipeClickUntil=Date.now()+350;swipeTouch=null;},{passive:true});
swipeSurface.addEventListener('click',event=>{if(Date.now()<ignoreSwipeClickUntil){event.preventDefault();event.stopImmediatePropagation();ignoreSwipeClickUntil=0;}},true);
