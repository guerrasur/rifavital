import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { initializeFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "/firebase-config.js";
import { pokemonName, pokemonSprite } from "/pokemon.js";
import { parseBuyerTokens } from "/links.js";

const app=initializeApp(firebaseConfig),db=initializeFirestore(app,{experimentalForceLongPolling:true});
const $=id=>document.getElementById(id);

async function loadBuyerRaffles(){
  $("buyerLoading").hidden=false;$("buyerError").hidden=true;$("buyerRetry").hidden=true;
  $("buyerRaffles").hidden=true;$("buyerRaffles").replaceChildren();$("buyerName").textContent="";
  const ids=parseBuyerTokens(location.hash);
  if(!ids.length){
    $("buyerLoading").hidden=true;$("buyerError").hidden=false;
    $("buyerError").textContent="Este enlace no contiene rifas válidas.";return;
  }
  let timeout;
  try{
    const results=await Promise.race([
      Promise.allSettled(ids.map(id=>getDoc(doc(db,"certificates",id)))),
      new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error("timeout")),12000)})
    ]);
    const valid=results.filter(result=>result.status==="fulfilled"&&result.value.exists())
      .map(result=>result.value.data())
      .filter(data=>data.status==="valid"&&Number.isInteger(data.raffleNumber)&&data.raffleNumber>=1&&data.raffleNumber<=150)
      .sort((a,b)=>a.raffleNumber-b.raffleNumber);
    const seen=new Set(),tickets=valid.filter(data=>{if(seen.has(data.raffleNumber))return false;seen.add(data.raffleNumber);return true});
    const names=[...new Set(tickets.map(data=>data.buyerName||"").filter(Boolean))];
    if(names.length===1)$("buyerName").textContent=names[0];
    for(const data of tickets){
      const n=data.raffleNumber,card=document.createElement("article");card.className="buyer-raffle";
      const title=document.createElement("h2");title.textContent=`#${String(n).padStart(3,"0")}`;
      const img=document.createElement("img");img.src=pokemonSprite(n);img.alt=pokemonName(n);
      const name=document.createElement("p");name.textContent=pokemonName(n);
      card.append(title,img,name);$("buyerRaffles").appendChild(card);
    }
    $("buyerRaffles").hidden=!tickets.length;
    const failed=results.some(result=>result.status==="rejected");
    if(failed||valid.length<ids.length){
      $("buyerError").hidden=false;
      $("buyerError").textContent=failed?"No se pudieron cargar algunas rifas. Intentá de nuevo.":tickets.length?"Algunas rifas del enlace ya no están disponibles.":"Estas rifas ya no están disponibles.";
      $("buyerRetry").hidden=!failed;
    }
  }catch(err){
    $("buyerError").hidden=false;$("buyerRetry").hidden=false;
    $("buyerError").textContent="No se pudieron cargar las rifas. Revisá tu conexión e intentá de nuevo.";
  }finally{clearTimeout(timeout);$("buyerLoading").hidden=true}
}

$("buyerRetry").addEventListener("click",loadBuyerRaffles);
loadBuyerRaffles();
