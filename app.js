const $=s=>document.querySelector(s),API='https://data.brreg.no/enhetsregisteret/api/enheter';
const noise=/\b(holding|hjemmel|eiendom|invest|investment|property|prosjekt|utvikling)\b/i;
const dead=/\b(konkursbo|tvangsavviklingsbo|tvangsoppløsningsbo|dødsbo|avviklingsbo)\b/i;
const customer=/bygg|snekker|tømrer|maler|gulv|vvs|rør|elektr|klinikk|helse|omsorg|studio|design|frisør|salong|restaurant|cafe|kafé|renhold|transport|service|konsulent|rådgiv|butikk|media|foto|trening/i;
const junk=new Set(['as','enk','nuf','asa','da','ans','sa','konkursbo','tvangsavviklingsbo','tvangsopplosningsbo','dodsbo','avviklingsbo']);
function clean(s){return s.toLowerCase().normalize('NFD').replaceAll('ø','o').replaceAll('æ','ae').replaceAll('å','a').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
function words(name){return clean(name).split(' ').filter(x=>x&&!junk.has(x))}
function suggestions(name){let w=words(name),out=[];if(!w.length)return[];let joined=w.join(''),hyphen=w.join('-');if(joined.length<=24)out.push(joined);if(hyphen.length<=24&&w.length>1)out.push(hyphen);if(w.length>1){let two=w.slice(0,2).join('');if(two.length<=20)out.push(two)}if(w.length>2){let brand=w[0]+w[w.length-1];if(brand.length<=20)out.push(brand)}return[...new Set(out)].filter(x=>x.length>=3&&x.length<=24).slice(0,3).map(x=>x+'.no')}
function inactive(e){return dead.test(e.navn)||e.konkurs===true||e.underAvvikling===true||e.underTvangsavviklingEllerTvangsopplosning===true}
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function score(e){let t=e.navn+' '+(e.naeringskode1?.beskrivelse||''),n=45;if(customer.test(t))n+=30;if(noise.test(e.navn))n-=30;if(inactive(e))n=0;if(suggestions(e.navn).length)n+=10;return Math.max(0,Math.min(95,n))}
function level(n){return n>=75?['Høy','high']:n>=50?['Middels','mid']:['Lav','low']}
async function search(){let st=$('#status'),box=$('#results');st.innerHTML='<span class="spinner"></span> Henter virksomheter…';box.innerHTML='';try{let p=new URLSearchParams({size:$('#size').value,sort:'registreringsdatoEnhetsregisteret,DESC'}),name=$('#q').value.trim(),ind=$('#industry').value;if(name)p.set('navn',name);if(ind)p.set('naeringskode',ind);let r=await fetch(API+'?'+p);if(!r.ok)throw Error('HTTP '+r.status);let j=await r.json(),raw=j._embedded?.enheter||[],a=raw;if($('#hideInactive').checked)a=a.filter(e=>!inactive(e));if($('#hideNoise').checked)a=a.filter(e=>!noise.test(e.navn));a.sort((x,y)=>score(y)-score(x));st.textContent='Viser '+a.length+' kandidater av '+raw.length+' hentet · '+(j.page?.totalElements??raw.length)+' totale treff';box.innerHTML=a.map(e=>{let s=score(e),lv=level(s),place=e.forretningsadresse?.poststed||e.postadresse?.poststed||'Ukjent sted',d=suggestions(e.navn),date=e.registreringsdatoEnhetsregisteret||'';return '<article class="card"><div class="top"><div class="company"><div class="name">'+esc(e.navn)+'</div><div class="meta">'+esc(place)+' <b>·</b> '+esc(e.naeringskode1?.kode||'')+' '+esc(e.naeringskode1?.beskrivelse||'')+'</div><div class="sub">Org.nr. '+esc(e.organisasjonsnummer)+(date?' · Registrert '+esc(date):'')+'</div></div><span class="score '+lv[1]+'"><i></i>'+lv[0]+' potensial</span></div><div class="domains">'+(d.length?d.map(x=>'<button class="domain checkdomain" data-domain="'+esc(x)+'" onclick="checkDomain(this)">'+esc(x)+' <small>Sjekk</small></button>').join(''):'<span class="nodomain">Ingen ryddig domenekandidat</span>')+'</div></article>'}).join('')||'<div class="empty">Ingen kandidater med disse filtrene.</div>'}catch(e){st.textContent='Kunne ikke hente data: '+e.message}}
$('#search').onclick=search;$('#q').onkeydown=e=>{if(e.key==='Enter')search()};search();
async function checkDomain(btn){
 const d=btn.dataset.domain; btn.disabled=true; btn.classList.remove('free','taken','unknown');
 const small=btn.querySelector('small'); small.textContent='Kontrollerer…';
 try{
  const r=await fetch('https://rdap.norid.no/domain/'+encodeURIComponent(d),{headers:{'Accept':'application/rdap+json'}});
  if(r.status===200){btn.classList.add('taken');small.textContent='Registrert';return}
  if(r.status===404){let body='';try{body=JSON.stringify(await r.json())}catch(_){};if(/not available|unavailable|reserved|blocked/i.test(body)){btn.classList.add('taken');small.textContent='Ikke registrerbart'}else{btn.classList.add('free');small.textContent='Ikke funnet hos Norid'};return}
  throw Error('HTTP '+r.status)
 }catch(e){btn.classList.add('unknown');small.textContent='Ubekreftet – åpne Norid';window.open('https://www.norid.no/no/domeneoppslag/','_blank','noopener')}
 finally{btn.disabled=false}
}