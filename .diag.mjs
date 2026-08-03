import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/home/lcam/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome',args:['--no-sandbox']});
const p=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage();
await p.goto('https://firstday-lp-rebuild.myshopify.com/password',{waitUntil:'domcontentloaded'});
const f=p.locator('input[name="password"], #password').first();
if(await f.count()){await f.fill('1234');await p.keyboard.press('Enter');await p.waitForTimeout(3500);}
await p.goto('https://firstday-lp-rebuild.myshopify.com/pages/tdk-behind-the-science-lp-v2',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(3500);
const r=await p.evaluate(()=>{
  const h=document.querySelector('.lp-hero__heading');
  const hits=[];
  for(const s of document.styleSheets){
    let rules; try{rules=s.cssRules}catch(e){continue}
    for(const rule of rules){
      if(!rule.selectorText||!rule.style)continue;
      if(rule.style.getPropertyValue('font-weight')==='')continue;
      try{ if(h.matches(rule.selectorText)) hits.push({file:(s.href||'inline').split('/').pop().split('?')[0], sel:rule.selectorText.slice(0,70), fw:rule.style.getPropertyValue('font-weight')}); }catch(e){}
    }
  }
  return {tag:h.tagName, cls:h.className, hits};
});
console.log(JSON.stringify(r,null,1));
await b.close();
