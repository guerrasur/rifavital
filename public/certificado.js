import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "/firebase-config.js";
import { pokemonSprite } from "/pokemon.js";

const app=initializeApp(firebaseConfig),db=getFirestore(app),$=id=>document.getElementById(id);
function invalid(){$("loadingState").hidden=true;$("certificate").hidden=true;$("invalidState").hidden=false}

(async()=>{
  const id=new URLSearchParams(location.search).get("id");
  if(!id||!/^[a-f0-9]{48}$/.test(id))return invalid();
  try{
    const snap=await getDoc(doc(db,"certificates",id));
    if(!snap.exists())return invalid();
    const data=snap.data();if(data.status!=="valid")return invalid();
    const n=Number(data.raffleNumber);
    $("raffleNumber").textContent=`RIFA #${n}`;
    $("ownerName").textContent=data.buyerName||"";
    $("pokemonImage").src=pokemonSprite(n);
    $("pokemonImage").alt=data.pokemonName||"";
    $("pokemonName").textContent=(data.pokemonName||"").toUpperCase();
    document.title=`Rifa #${n} — ${data.pokemonName||"RifaVital"}`;
    $("loadingState").hidden=true;$("certificate").hidden=false;
  }catch(err){console.error(err);invalid()}
})();
