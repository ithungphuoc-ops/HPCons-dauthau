const puppeteer=require('puppeteer-core'),path=require('path');
const OUT=path.join(__dirname,'anh'); const d=m=>new Promise(r=>setTimeout(r,m));
async function bamThat(page,loc){ // click bằng chuột thật — React trong vùng kéo-thả bỏ qua click tổng hợp
  for(const e of await page.$$('button')){ if(await e.evaluate(loc)){ await e.click(); return true; } }
  return false;
}
async function chupKhoi(page,ten,timChu,{le=12,caoToiDa=1250,rongToiThieu=360}={}){
  const hop=await page.evaluate((t,c,rt)=>{const uv=[...document.querySelectorAll('section,div,table,form')].filter(e=>e.offsetParent!==null&&(e.innerText||'').includes(t));
    if(!uv.length)return null;let chon=null;
    for(const e of uv){const r=e.getBoundingClientRect();if(r.height<90||r.width<rt)continue;const rc=chon&&chon.getBoundingClientRect();if(!chon||r.height*r.width<rc.height*rc.width)chon=e;}
    if(!chon)chon=uv[uv.length-1];chon.scrollIntoView({block:'center'});const r=chon.getBoundingClientRect();
    return{x:r.x+scrollX,y:r.y+scrollY,w:r.width,h:Math.min(r.height,c)};},timChu,caoToiDa,rongToiThieu);
  if(!hop)throw new Error('Không thấy: '+timChu); await d(400); const vp=page.viewport();
  await page.screenshot({path:path.join(OUT,ten+'.png'),clip:{x:Math.max(0,hop.x-le),y:Math.max(0,hop.y-le),width:Math.min(hop.w+le*2,vp.width),height:hop.h+le*2}});
  console.log('  ✓',ten);}
(async()=>{
 const b=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',
  defaultViewport:{width:1680,height:1400,deviceScaleFactor:2},args:['--hide-scrollbars','--disable-gpu','--force-color-profile=srgb']});
 const g=await b.newPage(); await g.goto('http://localhost:3000',{waitUntil:'networkidle2'}); await d(1500);
 await g.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Nạp 10 hồ sơ NHÁP'))?.click()); await d(1800);
 await g.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.innerText.includes('Ngô Nữ Quỳnh Trâm'))?.click()); await d(2600);
 await g.evaluate(()=>[...document.querySelectorAll('button')].find(x=>(x.title||'').includes('Chế độ sáng'))?.click()); await d(1400);
 await g.evaluate(()=>[...document.querySelectorAll('button,a')].find(x=>x.innerText.trim()==='Bảng Kanban')?.click()); await d(1800);

 // Hồ sơ 3 vòng (Sunfiber) để khung xem nhanh có bảng "Lịch sử các vòng"
 let ok=await bamThat(g,n=>(n.title||'').startsWith('Dự án:')&&n.title.includes('Sunfiber'));
 if(!ok) ok=await bamThat(g,n=>(n.title||'').startsWith('Dự án:'));
 await d(2500);
 console.log('  quick view:',await g.evaluate(()=>[...document.querySelectorAll('[role=dialog]')].some(e=>e.offsetParent!==null)));
 {const el=(await g.$$('[role=dialog]')).find(Boolean);
  if(el){await el.screenshot({path:path.join(OUT,'01-xem-nhanh.png')});console.log('  ✓ 01-xem-nhanh (cả khung)');}
  else console.log('  ! không thấy khung xem nhanh');}

 // Từ khung xem nhanh mở hồ sơ đầy đủ để chụp mục 5 "Lịch Sử Dời Tiến Độ"
 const mo=await bamThat(g,n=>n.offsetParent!==null&&/Mở hồ sơ|Sửa|Chỉnh sửa/i.test((n.innerText||'')+' '+(n.title||'')));
 await d(2600);
 const co2=await g.evaluate(()=>document.body.innerText.includes('Lịch Sử Dời Tiến Độ'));
 console.log('  form:',mo,co2);
 if(co2) await chupKhoi(g,'07-lich-su-doi-han','Lịch Sử Dời Tiến Độ',{caoToiDa:900}).catch(e=>console.log('  !',e.message));
 await b.close();
})().catch(e=>{console.error('LỖI:',e.message);process.exit(1);});
