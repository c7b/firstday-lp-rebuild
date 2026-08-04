import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',args:['--no-sandbox']});
for (const [name,url] of [['REFERENCIA','http://127.0.0.1:8777/fd-lp.html'],['NUESTRA v2','http://127.0.0.1:8777/v2-live.html']]) {
  const p=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage();
  await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6000);
  const r=await p.evaluate(async()=>{
    await document.fonts.ready;
    const loaded=[...document.fonts].filter(f=>f.status==='loaded').map(f=>`${f.family}@${f.weight}`);
    const h=document.querySelector('h1');
    const cs=h?getComputedStyle(h):null;
    // medir ancho con la fuente declarada vs fallback para saber si de verdad cargo
    const probe=(fam)=>{const c=document.createElement('canvas').getContext('2d');
      c.font=`600 40px ${fam}`;return Math.round(c.measureText('Science-Backed Vitamin').width)};
    return {sofiaOk: document.fonts.check('600 40px sofia-pro'),
      anchoSofia: probe('sofia-pro'), anchoFallback: probe('sans-serif'),
      h1font: cs?.fontFamily.split(',')[0], cargadas:[...new Set(loaded)].slice(0,6)};
  });
  console.log(`  ${name}: sofia-pro cargada=${r.sofiaOk} | ancho sofia=${r.anchoSofia} vs fallback=${r.anchoFallback}`);
  console.log(`     h1 declara: ${r.h1font} | fuentes cargadas: ${r.cargadas.join(', ')||'(ninguna)'}`);
}
await b.close();
