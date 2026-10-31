// Independent public PageSpeed reports, in a disposable browser. No site writes.
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
const out='artifacts/production-release-2026-10-31/public-psi';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const rows=[];
try{
 for(const route of (process.env.PSI_ROUTES||'/ru,/sr,/en,/ru/services/uborka-kvartir,/ru/himchistka-mebeli').split(',')){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const key=route.replaceAll('/','_');
  try{
   await page.goto('https://pagespeed.web.dev/',{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('input[name="url"]').fill('https://lumacleanrs.com'+route);
   const analyze=page.getByRole('button',{name:/Analyze|Анализировать/});
   if(await analyze.count())await analyze.click();
   await page.waitForFunction(()=>document.querySelector('[role="tab"]')||/Unable to (resolve|navigate)|Не удалось перейти/.test(document.body.innerText),{},{timeout:180000});
   if(!await page.getByRole('tab').count())throw Error((await page.locator('body').innerText()).match(/(?:Unable to (?:resolve|navigate)|Не удалось перейти)[^\n]*/)?.[0]||'PSI did not return a report');
   await page.getByRole('tab',{name:/Mobile|Мобильные/}).waitFor({timeout:180000});
   for(const device of ['mobile','desktop']){
    await page.getByRole('tab',{name:device==='mobile'?/Mobile|Мобильные/:/Desktop|Компьютер/}).click();
    const panel=page.locator('[role="tabpanel"]:visible');
    await panel.locator('a[href*="scorecalc"]').waitFor({timeout:180000});
    const value=await panel.evaluate(el=>({text:el.innerText,diagnostics:el.textContent,scoreLink:el.querySelector('a[href*="scorecalc"]')?.href,scores:[...el.querySelectorAll('a[href^="#"]')].map(a=>({href:a.getAttribute('href'),text:a.innerText})).filter(a=>/#(performance|accessibility|best-practices|seo)$/.test(a.href))}));
    const metrics=Object.fromEntries(new URL(value.scoreLink).hash.slice(1).split('&').map(v=>v.split('=')));
    const row={route,device,at:new Date().toISOString(),reportUrl:page.url(),scores:value.scores,metrics,cruxText:value.text.split(/Diagnose performance|Выявляйте проблемы/)[0]};
    rows.push(row);await writeFile(`${out}/${key}-${device}.txt`,value.diagnostics);await writeFile(`${out}/summary.json`,JSON.stringify(rows,null,2));
    await page.screenshot({path:`${out}/${key}-${device}.png`});console.log(JSON.stringify(row));
   }
  }catch(e){rows.push({route,error:e.message,reportUrl:page.url()});await writeFile(`${out}/summary.json`,JSON.stringify(rows,null,2));await writeFile(`${out}/${key}-error.txt`,await page.locator('body').innerText());console.log(JSON.stringify(rows.at(-1)));}
  finally{await page.close();}
 }
}finally{await browser.close();}
