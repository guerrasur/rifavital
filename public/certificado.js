import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "/firebase-config.js";
import { pokemonSprite } from "/pokemon.js";

const VERSION="1.4.0";
const app=initializeApp(firebaseConfig),db=getFirestore(app),$=id=>document.getElementById(id);
const formatRaffleNumber=n=>String(n).padStart(3,"0");
function invalid(){$("loadingState").hidden=true;$("certificate").hidden=true;$("invalidState").hidden=false}

(async()=>{
  const id=new URLSearchParams(location.search).get("id");
  if(!id||!/^[a-f0-9]{48}$/.test(id))return invalid();
  try{
    const snap=await getDoc(doc(db,"certificates",id));
    if(!snap.exists())return invalid();
    const data=snap.data();if(data.status!=="valid")return invalid();
    const n=Number(data.raffleNumber),expected=Number(document.body.dataset.raffleNumber||0);
    if(expected&&expected!==n)return invalid();
    $("raffleNumber").textContent=`RIFA #${formatRaffleNumber(n)}`;
    $("ownerName").textContent=data.buyerName||"";
    $("pokemonImage").src=pokemonSprite(n);
    $("pokemonImage").alt=data.pokemonName||"";
    $("pokemonName").textContent=(data.pokemonName||"").toUpperCase();
    document.title=`Rifa “Fiebre de otoño”: NRO ${formatRaffleNumber(n)}`;
    $("loadingState").hidden=true;$("certificate").hidden=false;
  }catch(err){console.error(err);invalid()}
})();

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
