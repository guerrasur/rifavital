import { pokemonSprite } from "/pokemon.js";
import { initCardMotion } from "/card-motion.js?v=1.8.0";
import { fetchCertificate } from "/certificate-data.js?v=1.8.0";

const VERSION="1.9.0";
const $=id=>document.getElementById(id);
let loading=false,motionReady=false;
const formatRaffleNumber=n=>String(n).padStart(3,"0");
function invalid(){$("loadingState").hidden=true;$("certificate").hidden=true;$("invalidState").hidden=false}

async function loadCertificate(){
  if(loading)return;
  const id=String(new URLSearchParams(location.search).get("id")||"").trim().toLowerCase();
  $("loadingState").hidden=false;$("invalidState").hidden=true;$("loadErrorState").hidden=true;$("certificate").hidden=true;
  if(!id||!/^[a-f0-9]{48}$/.test(id))return invalid();
  loading=true;
  try{
    const data=await fetchCertificate(id);
    if(!data||data.status!=="valid")return invalid();
    const n=Number(data.raffleNumber),expected=Number(document.body.dataset.raffleNumber||0);
    if(!Number.isInteger(n)||n<1||n>150)return invalid();
    if(expected&&expected!==n)return invalid();
    $("raffleNumber").textContent=`RIFA #${formatRaffleNumber(n)}`;
    $("ownerName").textContent=data.buyerName||"";
    $("pokemonImage").src=pokemonSprite(n);
    $("pokemonImage").alt=data.pokemonName||"";
    $("pokemonName").textContent=(data.pokemonName||"").toUpperCase();
    document.title=`Rifa “Fiebre de otoño”: NRO ${formatRaffleNumber(n)}`;
    $("loadingState").hidden=true;$("certificate").hidden=false;
    if(!motionReady){
      try{initCardMotion($("certificate"),$("motionToggle"),$("motionHint"))}
      catch(err){console.warn(err);$("motionToggle").hidden=true}
      motionReady=true;
    }
  }catch(err){
    console.error(err);
    $("loadingState").hidden=true;$("certificate").hidden=true;$("invalidState").hidden=true;$("loadErrorState").hidden=false;
  }finally{loading=false}
}
$("certificateRetry").addEventListener("click",loadCertificate);
loadCertificate();

async function refreshIfStale(){
  try{
    const response=await fetch(`/version.json?_=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
    if(!response.ok)return;
    const data=await response.json(),remote=String(data.version||VERSION);
    if(remote!==VERSION){
      const url=new URL(location.href);
      if(url.searchParams.get("_v")===remote)return;
      url.searchParams.set("_v",remote);
      url.searchParams.set("_t",Date.now().toString());
      location.replace(url.toString());
    }
  }catch{}
}
window.addEventListener("focus",refreshIfStale);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshIfStale()});
setInterval(refreshIfStale,60000);
refreshIfStale();
