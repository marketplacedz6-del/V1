import fs from 'fs';
import postcss from 'postcss';
import tailwind from 'tailwindcss';

const SRC = '/home/user/V1';
const primary = {50:'#f0f9ff',100:'#e0f2fe',200:'#bae6fd',300:'#7dd3fc',400:'#38bdf8',
                 500:'#0284c7',600:'#0369a1',700:'#075985',800:'#0c4a6e',900:'#0c4a6e',950:'#082f49'};

/* استخرج الكلاسات المكتوبة داخل سلاسل JS الشرطية والقوالب،
   لأن ماسح Tailwind قد يفوته ما يُركَّب ديناميكياً. */
const dyn = new Set();
for (const f of [...fs.readdirSync(SRC).filter(x=>x.endsWith('.html')).map(x=>`${SRC}/${x}`),
                 ...fs.readdirSync(`${SRC}/assets/js`).map(x=>`${SRC}/assets/js/${x}`)]) {
  const t = fs.readFileSync(f,'utf8');
  // أي سلسلة نصية قصيرة تشبه قائمة كلاسات
  for (const m of t.matchAll(/['"`]([a-z0-9][a-z0-9 :._/\[\]!#()%-]{2,180})['"`]/gi)) {
    for (const c of m[1].split(/\s+/)) {
      if (/^[a-z-]+[a-z0-9:._/\[\]!#()%-]*$/i.test(c) && c.length>1 && c.length<45) dyn.add(c);
    }
  }
}
console.log('كلاسات مرشّحة من السلاسل:', dyn.size);

const css = await postcss([tailwind({
  content: [
    { raw: [...dyn].map(c=>`<i class="${c}"></i>`).join(''), extension:'html' },
    `${SRC}/*.html`,
    `${SRC}/assets/js/*.js`,
  ],
  theme: { extend: {
    colors: { primary },
    fontFamily: { sans: ['Cairo','system-ui','-apple-system','Segoe UI','sans-serif'] },
  }},
  corePlugins: { preflight: true },
})]).process('@tailwind base;@tailwind components;@tailwind utilities;', { from: undefined });

fs.writeFileSync(`${SRC}/assets/css/tailwind.css`, css.css);
console.log('✅ tailwind.css =', (css.css.length/1024).toFixed(0), 'KB');
