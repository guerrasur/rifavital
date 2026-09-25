import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, ADMIN_UID } from "/firebase-config.js";
import { pokemonName, pokemonSprite } from "/pokemon.js";

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id), state=new Map();
const formatRaffleNumber=n=>String(n).padStart(3,"0");
const ticketId=n=>formatRaffleNumber(n);
const makeToken=()=>{const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")};
const certificateUrl=token=>`${location.origin}/certificado?id=${encodeURIComponent(token)}`;
const setMessage=text=>$("globalMessage").textContent=text||"";

function escapeHtml(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}

function renderRows(){
  const tbody=$("raffleRows");tbody.innerHTML="";
  for(let n=1;n<=150;n++){
    const data=state.get(n)||{},tr=document.createElement("tr");
    tr.dataset.number=String(n);tr.dataset.pokemon=pokemonName(n).toLowerCase();tr.dataset.owner=(data.ownerName||"").toLowerCase();
    tr.innerHTML=`
      <td class="number-cell">${formatRaffleNumber(n)}</td>
      <td><div class="pokemon-cell"><img class="pokemon-thumb" src="${pokemonSprite(n)}" alt="" loading="lazy"><strong>${pokemonName(n)}</strong></div></td>
      <td><input class="owner-input" value="${escapeHtml(data.ownerName||"")}" placeholder="Libre"></td>
      <td><span class="status ${data.ownerName?"assigned":"free"}">${data.ownerName?"Asignada":"Libre"}</span></td>
      <td><div class="row-actions">
        <button data-action="save">Guardar</button>
        <button data-action="open" class="secondary" ${data.certificateId?"":"disabled"}>Abrir</button>
        <button data-action="copy" class="secondary" ${data.certificateId?"":"disabled"}>Copiar link</button>
        <button data-action="qr" class="secondary" ${data.certificateId?"":"disabled"}>QR</button>
        <button data-action="clear" class="danger" ${data.ownerName?"":"disabled"}>Liberar</button>
      </div></td>`;
    tr.querySelector(".owner-input").addEventListener("input",e=>{tr.dataset.owner=e.target.value.trim().toLowerCase();applySearch()});
    tr.querySelectorAll("button[data-action]").forEach(btn=>btn.addEventListener("click",()=>handleAction(n,btn.dataset.action,tr)));
    tbody.appendChild(tr);
  }
  updateCounts();
}

async function loadTickets(){
  state.clear();
  const snap=await getDocs(collection(db,"tickets"));
  snap.forEach(s=>{const d=s.data(),number=Number(d.number);if(number>=1&&number<=150)state.set(number,d)});
  renderRows();
}

function updateCounts(){
  let assigned=0;
  for(let n=1;n<=150;n++)if(state.get(n)?.ownerName)assigned++;
  $("assignedCount").textContent=assigned;$("freeCount").textContent=150-assigned;
}

async function handleAction(n,action,tr){
  const current=state.get(n)||{};
  if(action==="save"){
    const ownerName=tr.querySelector(".owner-input").value.trim();
    if(!ownerName){setMessage(`La rifa #${formatRaffleNumber(n)} no tiene titular. Usá “Liberar” si querés dejarla libre.`);return}
    await saveTicket(n,ownerName,current,tr);return;
  }
  if(action==="clear"){
    if(!current.ownerName)return;
    if(!confirm(`¿Liberar la rifa #${formatRaffleNumber(n)} de ${current.ownerName}?`))return;
    await clearTicket(n,current,tr);return;
  }
  if(!current.certificateId)return;
  const url=certificateUrl(current.certificateId);
  if(action==="open")window.open(url,"_blank","noopener");
  if(action==="copy"){await navigator.clipboard.writeText(url);setMessage(`Link de la rifa #${formatRaffleNumber(n)} copiado.`)}
  if(action==="qr")openQr(n,url);
}

async function saveTicket(n,ownerName,current,tr){
  tr.classList.add("saving");setMessage("");
  try{
    const certificateId=current.certificateId||makeToken(),batch=writeBatch(db);
    const base={number:n,pokemonId:n,pokemonName:pokemonName(n),ownerName,certificateId,assigned:true,updatedAt:serverTimestamp()};
    batch.set(doc(db,"tickets",ticketId(n)),{...base,createdAt:current.createdAt||serverTimestamp()},{merge:true});
    batch.set(doc(db,"certificates",certificateId),{raffleNumber:n,buyerName:ownerName,pokemonId:n,pokemonName:pokemonName(n),status:"valid",updatedAt:serverTimestamp()},{merge:true});
    await batch.commit();
    state.set(n,{...current,...base,certificateId});
    renderRows();setMessage(`Rifa #${formatRaffleNumber(n)} guardada para ${ownerName}.`);
  }catch(err){console.error(err);setMessage("No se pudo guardar. Revisá que las reglas de Firestore estén desplegadas.");tr.classList.remove("saving")}
}

async function clearTicket(n,current,tr){
  tr.classList.add("saving");setMessage("");
  try{
    const batch=writeBatch(db);
    batch.delete(doc(db,"tickets",ticketId(n)));
    if(current.certificateId)batch.delete(doc(db,"certificates",current.certificateId));
    await batch.commit();state.delete(n);renderRows();setMessage(`Rifa #${formatRaffleNumber(n)} liberada.`);
  }catch(err){console.error(err);setMessage("No se pudo liberar el número.");tr.classList.remove("saving")}
}

function openQr(n,url){
  $("qrTitle").textContent=`Rifa #${formatRaffleNumber(n)}`;$("qrLink").value=url;$("qrBox").innerHTML="";
  new QRCode($("qrBox"),{text:url,width:240,height:240});$("qrDialog").showModal();
}

function applySearch(){
  const q=$("searchInput").value.trim().toLowerCase();
  document.querySelectorAll("#raffleRows tr").forEach(tr=>{
    const haystack=`${tr.dataset.number} ${tr.dataset.pokemon} ${tr.dataset.owner}`;
    tr.classList.toggle("hidden-row",q&&!haystack.includes(q));
  });
}

$("loginBtn").addEventListener("click",async()=>{ $("loginMessage").textContent=""; try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}catch(err){console.error(err);$("loginMessage").textContent="Email o contraseña incorrectos."}});
$("password").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click()});
$("logoutBtn").addEventListener("click",()=>signOut(auth));
$("searchInput").addEventListener("input",applySearch);
$("closeQrBtn").addEventListener("click",()=>$("qrDialog").close());
$("copyQrLinkBtn").addEventListener("click",async()=>{await navigator.clipboard.writeText($("qrLink").value);$("copyQrLinkBtn").textContent="Copiado";setTimeout(()=>$("copyQrLinkBtn").textContent="Copiar link",1000)});
$("downloadQrBtn").addEventListener("click",()=>{const canvas=$("qrBox").querySelector("canvas"),img=$("qrBox").querySelector("img"),href=canvas?canvas.toDataURL("image/png"):img?.src;if(!href)return;const a=document.createElement("a");a.href=href;a.download="rifavital-qr.png";a.click()});

onAuthStateChanged(auth,async user=>{
  if(!user){$("loginView").hidden=false;$("masterView").hidden=true;return}
  if(user.uid!==ADMIN_UID){$("loginMessage").textContent="Esta cuenta no está autorizada.";await signOut(auth);return}
  $("loginView").hidden=true;$("masterView").hidden=false;
  try{await loadTickets()}catch(err){console.error(err);setMessage("Conectado, pero Firestore todavía no permite leer la tabla. Falta desplegar las reglas.")}
});
