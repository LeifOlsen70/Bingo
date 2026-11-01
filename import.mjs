// Keep all identifiers as strings, including leading zeroes.
export function ticketIdentifiers(text){
 const normalized=text.replace(/[–—]/g,'-');
 const combined=normalized.match(/(?:Serien\s*[-/]+\s*(?:und\s*)?Los(?:nummer|nr\.?)?|Serie\s*\/\s*Los)\s*[:#-]?\s*(\d{4})\s*[/ -]\s*(\d{5})/i);
 const read=(label,length)=>{const re=new RegExp(label+'\\s*[:#-]?\\s*(\\d(?:[ \\t]*\\d){'+(length-1)+'})(?![ \\t]*\\d)','i');return normalized.match(re)?.[1].replace(/\s/g,'')||'';};
 return {series:combined?.[1]||read('(?:BINGO[! -]*)?(?:Serien(?:[ -]*(?:nummer|nr\\.?))?|Serie(?:[ -]*(?:nummer|nr\\.?))?)',4),lot:combined?.[2]||read('(?:BINGO[! -]*)?Los[ -]*(?:nummer|nr\\.?)',5)};
}
export function wordsFromTSV(tsv=''){return tsv.trim().split('\n').slice(1).map(line=>{const parts=line.split('\t');return {level:Number(parts[0]),x:Number(parts[6]),y:Number(parts[7]),w:Number(parts[8]),h:Number(parts[9]),confidence:Number(parts[10]),text:parts.slice(11).join('\t').trim()};}).filter(w=>w.level===5&&w.text);}
export function detectGrid(tsv,width,height){
 const words=wordsFromTSV(tsv).filter(w=>/^\d{1,2}$/.test(w.text)&&Number(w.text)>=1&&Number(w.text)<=75&&w.w>0&&w.h>0).map(w=>({...w,cx:w.x+w.w/2,cy:w.y+w.h/2})).sort((a,b)=>a.cy-b.cy);
 const rows=[];
 for(const word of words){let row=rows.find(r=>Math.abs(r.cy-word.cy)<Math.max(word.h,r.h)*.7);if(!row){row={cy:word.cy,h:word.h,words:[]};rows.push(row);}row.words.push(word);row.cy=row.words.reduce((s,w)=>s+w.cy,0)/row.words.length;row.h=Math.max(row.h,word.h);}
 const candidates=rows.filter(r=>r.words.length>=5).sort((a,b)=>a.cy-b.cy);let best=null;
 for(let r=0;r<=candidates.length-5;r++){const group=candidates.slice(r,r+5);const yy=group.slice(1).map((v,i)=>v.cy-group[i].cy),dy=yy.reduce((s,v)=>s+v,0)/4;if(dy<=0||yy.some(v=>Math.abs(v-dy)>dy*.28))continue;
 const first=group[0].words.sort((a,b)=>a.cx-b.cx);
 for(let s=0;s<=first.length-5;s++){const anchors=first.slice(s,s+5);const xx=anchors.slice(1).map((v,i)=>v.cx-anchors[i].cx),dx=xx.reduce((sum,v)=>sum+v,0)/4;if(dx<=0||xx.some(v=>Math.abs(v-dx)>dx*.3))continue;
 const selected=[];let aligned=true;for(const row of group){const taken=new Set();for(const anchor of anchors){const options=row.words.filter(w=>!taken.has(w)).sort((a,b)=>Math.abs(a.cx-anchor.cx)-Math.abs(b.cx-anchor.cx));const w=options[0];if(!w||Math.abs(w.cx-anchor.cx)>dx*.22){aligned=false;break;}selected.push(w);taken.add(w);}if(!aligned)break;}if(!aligned||new Set(selected.map(w=>Number(w.text))).size!==25)continue;
 const score=selected.reduce((sum,w)=>sum+w.confidence,0)/25;if(!best||score>best.score){best={score,numbers:selected.map(w=>Number(w.text)),uncertain:selected.flatMap((w,i)=>w.confidence<75?[i]:[]),rect:{left:Math.max(0,(anchors[0].cx-dx/2)/width),right:Math.min(1,(anchors[4].cx+dx/2)/width),top:Math.max(0,(group[0].cy-dy/2)/height),bottom:Math.min(1,(group[4].cy+dy/2)/height)}};}
 }}return best;
}
export function detectPixelGrid({data,width,height}){
 const dark=(x,y)=>{const i=(y*width+x)*4;return data[i]*.299+data[i+1]*.587+data[i+2]*.114<170&&data[i+3]>100;};
 const bands=[];let start=-1;for(let y=0;y<height;y++){let run=0,max=0;for(let x=0;x<width;x++){run=dark(x,y)?run+1:0;if(run>max)max=run;}const hit=max>width*.22;if(hit&&start<0)start=y;if(!hit&&start>=0){bands.push((start+y-1)/2);start=-1;}}if(start>=0)bands.push((start+height-1)/2);
 for(let a=0;a<bands.length;a++)for(let b=a+1;b<bands.length;b++){const step=bands[b]-bands[a];if(step<height*.02||step>height*.2)continue;// Paper tickets have a BINGO heading row above the five number rows.
 // If seven horizontal grid lines are present, skip the heading row.
 const seven=Array.from({length:7},(_,i)=>bands.find(y=>Math.abs(y-(bands[a]+i*step))<step*.08));
 if(seven.every(y=>y!==undefined)&&new Set(seven).size===7){
  const top=seven[1],bottom=seven[6];
  const xs=[];let begin=-1;
  for(let x=0;x<width;x++){let count=0;for(let y=Math.ceil(top);y<=Math.floor(bottom);y++)if(dark(x,y))count++;const hit=count/(bottom-top+1)>.78;if(hit&&begin<0)begin=x;if(!hit&&begin>=0){xs.push((begin+x-1)/2);begin=-1;}}
  if(begin>=0)xs.push((begin+width-1)/2);
  for(let c=0;c<xs.length;c++)for(let d=c+1;d<xs.length;d++){
   const dx=xs[d]-xs[c];if(dx<width*.035)continue;
   const selected=Array.from({length:6},(_,i)=>xs.find(x=>Math.abs(x-(xs[c]+i*dx))<dx*.08));
   if(selected.every(x=>x!==undefined)&&new Set(selected).size===6)return {left:selected[0]/width,right:selected[5]/width,top:top/height,bottom:bottom/height};
  }
 }
 const ys=Array.from({length:6},(_,i)=>bands.find(y=>Math.abs(y-(bands[a]+i*step))<step*.045));if(ys.some(y=>y===undefined)||new Set(ys).size!==6)continue;const xs=[];let begin=-1;for(let x=0;x<width;x++){let count=0;for(let y=Math.ceil(ys[0]);y<=Math.floor(ys[5]);y++)if(dark(x,y))count++;const hit=count/(ys[5]-ys[0]+1)>.85;if(hit&&begin<0)begin=x;if(!hit&&begin>=0){xs.push((begin+x-1)/2);begin=-1;}}if(begin>=0)xs.push((begin+width-1)/2);
 for(let c=0;c<xs.length;c++)for(let d=c+1;d<xs.length;d++){const dx=xs[d]-xs[c];if(dx<width*.035)continue;const selected=Array.from({length:6},(_,i)=>xs.find(x=>Math.abs(x-(xs[c]+i*dx))<dx*.045));if(selected.some(x=>x===undefined)||new Set(selected).size!==6)continue;return {left:selected[0]/width,right:selected[5]/width,top:ys[0]/height,bottom:ys[5]/height};}
 }return null;
}
// Find the light, flat-colour number tiles in online lottery receipts.
export function detectTileGrid({data,width,height}){
 const size=width*height,labels=new Uint16Array(size),visited=new Uint8Array(size),queue=new Int32Array(size),groups=new Map();
 for(let p=0;p<size;p++){const i=p*4,r=data[i],g=data[i+1],b=data[i+2];const light=r*.299+g*.587+b*.114;if(light<175||Math.min(r,g,b)>245||data[i+3]<200)continue;labels[p]=1+((r>>4)<<8)+((g>>4)<<4)+(b>>4);}
 for(let p=0;p<size;p++){if(!labels[p]||visited[p])continue;const label=labels[p];let head=0,tail=1,count=0,minX=width,minY=height,maxX=0,maxY=0;queue[0]=p;visited[p]=1;while(head<tail){const v=queue[head++],x=v%width,y=Math.floor(v/width);count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);const neighbours=[];if(x>0)neighbours.push(v-1);if(x<width-1)neighbours.push(v+1);if(y>0)neighbours.push(v-width);if(y<height-1)neighbours.push(v+width);for(const n of neighbours)if(!visited[n]&&labels[n]===label){visited[n]=1;queue[tail++]=n;}}
 const w=maxX-minX+1,h=maxY-minY+1;if(w<width*.035||h<height*.02||w/h<.65||w/h>1.5||count<w*h*.5||count>size*.035)continue;if(!groups.has(label))groups.set(label,[]);groups.get(label).push({x:minX,y:minY,w,h});}
 for(const tiles of groups.values()){if(tiles.length<25||tiles.length>75)continue;const tsv='level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n'+tiles.map((t,i)=>`5\t1\t1\t1\t1\t${i+1}\t${t.x}\t${t.y}\t${t.w}\t${t.h}\t100\t${i+1}`).join('\n');const grid=detectGrid(tsv,width,height);if(grid)return grid.rect;}return null;
}
