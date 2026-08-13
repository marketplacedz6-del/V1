import fs from 'fs';
const SRC='/home/user/V1';
const built=fs.readFileSync(`${SRC}/assets/css/tailwind.css`,'utf8');
const theme=fs.readFileSync(`${SRC}/assets/css/theme.css`,'utf8');
const themeCls=new Set([...theme.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m=>m[1]));

// كل كلاس مكتوب صراحة في class="..."
const used=new Map();
for(const f of fs.readdirSync(SRC).filter(x=>x.endsWith('.html'))){
  const h=fs.readFileSync(`${SRC}/${f}`,'utf8');
  for(const m of h.matchAll(/class(?:Name)?="([^"]*)"/g)){
    for(let c of m[1].split(/\s+/)){
      c=c.trim(); if(!c||c.includes('${'))continue;
      if(!used.has(c))used.set(c,new Set());
      used.get(c).add(f);
    }
  }
}
const esc=s=>s.replace(/[.:/[\]!%#()<>=@,&~+*$^|'"]/g,c=>'\\'+c);
const missing=[];
for(const [c,files] of used){
  if(themeCls.has(c))continue;
  if(/^(fa-|fab$|fas$|far$|group$|peer$|dark$|se-)/.test(c))continue;
  const e='.'+esc(c);
  if(built.includes(e+' ')||built.includes(e+',')||built.includes(e+'{')||
     built.includes(e+':')||built.includes(e+'>')||built.includes(e+'\n'))continue;
  missing.push([c,[...files]]);
}
console.log(`إجمالي الكلاسات المستعملة: ${used.size}`);
console.log(`### غير مغطّاة في الملف المبني: ${missing.length}\n`);
for(const [c,f] of missing) console.log(`  .${c.padEnd(32)} → ${f.slice(0,3).join(', ')}`);
