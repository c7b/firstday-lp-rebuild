import { chromium } from 'playwright';
const OUT='/tmp/claude-1000/-home-lcam-jarvis/b20340ce-93f1-47b7-acab-161d0f33ad1b/scratchpad';
const b=await chromium.launch({executablePath:'/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',args:['--no-sandbox']});
for (const w of [1440,390]) {
  const ctx=await b.newContext({viewport:{width:w,height:1100},deviceScaleFactor:1});
  const p=await ctx.newPage();
  for (const [tag,url] of [['ref','http://127.0.0.1:8777/fd-lp.html'],['v2','http://127.0.0.1:8777/v2-live.html']]) {
    await p.goto(url,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(6500);
    await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(1800);
    await p.evaluate(()=>window.scrollTo(0,0)); await p.waitForTimeout(1200);
    await p.screenshot({path:`${OUT}/vv-${tag}-${w}.png`, clip:{x:0,y:0,width:w,height:3200}});
  }
  await ctx.close();
  console.log(`  ${w}px listo`);
}
await b.close();
