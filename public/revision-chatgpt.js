import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { initializeFirestore, doc, getDocFromServer } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "/firebase-config.js";

const app=initializeApp(firebaseConfig);
const db=initializeFirestore(app,{experimentalForceLongPolling:true});
const TOTAL=150;
const $=id=>document.getElementById(id);
const fmt=n=>String(n).padStart(3,"0");
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[ch]));
const ts=value=>{
  if(!value)return "";
  if(typeof value.toDate==="function")return value.toDate().toISOString();
  if(typeof value.seconds==="number")return new Date(value.seconds*1000).toISOString();
  return String(value);
};

async function loadOne(n){
  const snap=await getDocFromServer(doc(db,"tickets",fmt(n)));
  const d=snap.exists()?snap.data():{};
  return {
    number:n,
    assigned:Boolean(d.ownerName),
    ownerName:d.ownerName||"",
    participantName:d.participantName||"",
    pokemonId:d.pokemonId||n,
    pokemonName:d.pokemonName||"",
    source:d.source||"",
    createdAt:ts(d.createdAt),
    updatedAt:ts(d.updatedAt)
  };
}

async function loadAll(){
  const result=[];
  for(let start=1;start<=TOTAL;start+=25){
    const end=Math.min(start+24,TOTAL);
    const batch=await Promise.all(Array.from({length:end-start+1},(_,i)=>loadOne(start+i)));
    result.push(...batch);
  }
  return result;
}

function render(data){
  const assigned=data.filter(x=>x.assigned).length;
  $("total").textContent=String(data.length);
  $("assigned").textContent=String(assigned);
  $("free").textContent=String(data.length-assigned);
  $("loadedAt").textContent=new Date().toLocaleString("es-AR");
  $("rows").innerHTML=data.map(x=>`<tr>
    <td>${fmt(x.number)}</td>
    <td class="${x.assigned?"assigned":"free"}">${x.assigned?"Asignada":"Libre"}</td>
    <td>${esc(x.ownerName)}</td>
    <td>${esc(x.participantName)}</td>
    <td>${esc(x.pokemonName)}</td>
    <td>${esc(x.updatedAt)}</td>
  </tr>`).join("");
  $("json").textContent=JSON.stringify({
    generatedAt:new Date().toISOString(),
    total:data.length,
    assigned,
    free:data.length-assigned,
    tickets:data
  },null,2);
  $("status").textContent="Datos cargados directamente desde Firestore.";
}

try{
  const data=await loadAll();
  render(data);
}catch(error){
  console.error(error);
  $("status").textContent="No se pudieron cargar los datos de revisión.";
  $("json").textContent=JSON.stringify({error:String(error?.message||error)},null,2);
}
