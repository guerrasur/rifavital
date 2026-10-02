import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, ADMIN_UID } from "/firebase-config.js";
import { pokemonName, pokemonSprite } from "/pokemon.js";

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id), state=new Map();
const TOTAL=150, DISTRIBUTION_TOTAL=144, DISTRIBUTION_PEOPLE=9, DISTRIBUTION_SIZE=16;
const formatRaffleNumber=n=>String(n).padStart(3,"0");
const ticketId=n=>formatRaffleNumber(n);
const makeToken=()=>{const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")};
const certificateUrl=token=>`${location.origin}/certificado?id=${encodeURIComponent(token)}`;
const setMessage=text=>$("globalMessage").textContent=text||"";

function escapeHtml(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function downloadText(filename,text,type="text/plain;charset=utf-8"){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)}
function currentFilter(){return $("statusFilter")?.value||"all"}

function renderRows(){
  const tbody=$("raffleRows");tbody.innerHTML="";
  for(let n=1;n<=TOTAL;n++){
    const data=state.get(n)||{},tr=document.createElement("tr");
    tr.dataset.number=String(n);tr.dataset.pokemon=pokemonName(n).toLowerCase();tr.dataset.owner=(data.ownerName||"").toLowerCase();tr.dataset.status=data.ownerName?"assigned":"free";
    tr.innerHTML=`
      <td class="number-cell">${formatRaffleNumber(n)}</td>
      <td><div class="pokemon-cell"><img class="pokemon-thumb" src="${pokemonSprite(n)}" alt="" loading="lazy"><strong>${pokemonName(n)}</strong></div></td>
      <td><input class="owner-input" value="${escapeHtml(data.ownerName||"")}" placeholder="Libre"></td>
      <td><span class="status ${data.ownerName?"assigned":"free"}">${data.ownerName?"Asignada":"Libre"}</span></td>
      <td><div class="row-actions">
        <button data-action="save">Guardar</button>
        <button data-action="open" class="secondary" ${data.certificateId?"":"disabled"}>Abrir</button>
        <button data-action="copy" class="secondary" ${data.certificateId?"":"disabled"}>Copiar link</button>
        <button data-action="share" class="secondary" ${data.certificateId?"":"disabled"}>Compartir</button>
        <button data-action="qr" class="secondary" ${data.certificateId?"":"disabled"}>QR</button>
        <button data-action="clear" class="danger" ${data.ownerName?"":"disabled"}>Liberar</button>
      </div></td>`;
    tr.querySelector(".owner-input").addEventListener("input",e=>{tr.dataset.owner=e.target.value.trim().toLowerCase();applySearch()});
    tr.querySelectorAll("button[data-action]").forEach(btn=>btn.addEventListener("click",()=>handleAction(n,btn.dataset.action,tr)));
    tbody.appendChild(tr);
  }
  updateCounts();applySearch();
}

async function loadTickets(){
  state.clear();
  const snap=await getDocs(collection(db,"tickets"));
  snap.forEach(s=>{const d=s.data(),number=Number(d.number);if(number>=1&&number<=TOTAL)state.set(number,d)});
  renderRows();
}

function updateCounts(){
  let assigned=0;
  for(let n=1;n<=TOTAL;n++)if(state.get(n)?.ownerName)assigned++;
  $("assignedCount").textContent=assigned;$("freeCount").textContent=TOTAL-assigned;
  $("progressCount").textContent=`${Math.round((assigned/TOTAL)*100)}%`;
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
  if(action==="share"){
    const text=`Rifa #${formatRaffleNumber(n)} — ${current.ownerName||""}\n${url}`;
    if(navigator.share){try{await navigator.share({title:`Rifa #${formatRaffleNumber(n)}`,text,url});}catch{}}
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener");
  }
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
  const q=$("searchInput").value.trim().toLowerCase(),filter=currentFilter();
  let visible=0;
  document.querySelectorAll("#raffleRows tr").forEach(tr=>{
    const haystack=`${tr.dataset.number} ${formatRaffleNumber(tr.dataset.number)} ${tr.dataset.pokemon} ${tr.dataset.owner}`;
    const matchesText=!q||haystack.includes(q),matchesStatus=filter==="all"||tr.dataset.status===filter;
    const show=matchesText&&matchesStatus;tr.classList.toggle("hidden-row",!show);if(show)visible++;
  });
  $("visibleCount").textContent=visible;
}

function ticketRows(){
  return Array.from({length:TOTAL},(_,i)=>{
    const n=i+1,d=state.get(n)||{};
    return {
      "Número":formatRaffleNumber(n),
      "Pokémon":pokemonName(n),
      "Estado":d.ownerName?"Asignada":"Libre",
      "Titular":d.ownerName||"",
      "Certificado":d.certificateId||"",
      "Link":d.certificateId?certificateUrl(d.certificateId):""
    };
  });
}

function distributionRows(names=[]){
  return Array.from({length:DISTRIBUTION_PEOPLE},(_,i)=>{
    const start=i*DISTRIBUTION_SIZE+1,end=start+DISTRIBUTION_SIZE-1;
    let assigned=0;for(let n=start;n<=end;n++)if(state.get(n)?.ownerName)assigned++;
    return {"Persona":names[i]||`Persona ${i+1}`,"Desde":formatRaffleNumber(start),"Hasta":formatRaffleNumber(end),"Cantidad":DISTRIBUTION_SIZE,"Asignadas":assigned,"Libres":DISTRIBUTION_SIZE-assigned};
  });
}

function exportExcel(){
  if(!window.XLSX){setMessage("No se pudo cargar el módulo de Excel. Recargá la página e intentá de nuevo.");return}
  const xlsx=window.XLSX,all=ticketRows(),assigned=all.filter(r=>r.Estado==="Asignada"),free=all.filter(r=>r.Estado==="Libre"),wb=xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(all),"Todas");
  xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(assigned),"Asignadas");
  xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(free),"Libres");
  xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(distributionRows()),"Reparto 9x16");
  xlsx.writeFile(wb,`fiebre-de-otono-rifas-${new Date().toISOString().slice(0,10)}.xlsx`);
  setMessage("Excel exportado: todas, asignadas, libres y reparto 9×16.");
}

async function copyList(type){
  const rows=ticketRows().filter(r=>type==="assigned"?r.Estado==="Asignada":r.Estado==="Libre");
  const text=type==="assigned"
    ? rows.map(r=>`#${r["Número"]} — ${r.Titular} — ${r["Pokémon"]}`).join("\n")
    : rows.map(r=>`#${r["Número"]} — ${r["Pokémon"]}`).join("\n");
  await navigator.clipboard.writeText(text||"Sin resultados");
  setMessage(type==="assigned"?"Lista de asignadas copiada.":"Lista de libres copiada.");
}

function randomFree(){
  const free=[];
  for(let n=1;n<=TOTAL;n++)if(!state.get(n)?.ownerName)free.push(n);
  if(!free.length){setMessage("No quedan números libres.");return}
  const n=free[Math.floor(Math.random()*free.length)],tr=document.querySelector(`#raffleRows tr[data-number="${n}"]`);
  $("statusFilter").value="all";$("searchInput").value=String(n);applySearch();
  tr?.scrollIntoView({behavior:"smooth",block:"center"});tr?.classList.add("flash-row");setTimeout(()=>tr?.classList.remove("flash-row"),1800);
  setMessage(`Número libre al azar: #${formatRaffleNumber(n)} (${pokemonName(n)}).`);
}

function openDistribution(){
  const box=$("distributionNames");box.innerHTML="";
  for(let i=0;i<DISTRIBUTION_PEOPLE;i++){
    const input=document.createElement("input");input.value=`Persona ${i+1}`;input.dataset.index=String(i);box.appendChild(input);
  }
  refreshDistributionPreview();$("distributionDialog").showModal();
}
function distributionNames(){return Array.from($("distributionNames").querySelectorAll("input")).map(i=>i.value.trim()||`Persona ${Number(i.dataset.index)+1}`)}
function refreshDistributionPreview(){
  const rows=distributionRows(distributionNames());
  $("distributionPreview").textContent=rows.map(r=>`${r.Persona}: ${r.Desde} al ${r.Hasta} · ${r.Asignadas} asignadas · ${r.Libres} libres`).join("\n")+`\n\nQuedan ${formatRaffleNumber(DISTRIBUTION_TOTAL+1)} al ${formatRaffleNumber(TOTAL)} fuera del reparto.`;
}
async function copyDistribution(){refreshDistributionPreview();await navigator.clipboard.writeText($("distributionPreview").textContent);setMessage("Reparto 9×16 copiado.");$("distributionDialog").close()}

function parseBulk(text){
  const entries=[],errors=[],seen=new Set();
  text.split(/\r?\n/).forEach((raw,index)=>{
    const line=raw.trim();if(!line)return;
    const match=line.match(/^#?\s*(\d{1,3})\s*(?:[,;:\-–—]|\s{2,})\s*(.+)$/);
    if(!match){errors.push(`Línea ${index+1}: formato inválido`);return}
    const n=Number(match[1]),ownerName=match[2].trim();
    if(n<1||n>TOTAL){errors.push(`Línea ${index+1}: número fuera de rango`);return}
    if(!ownerName){errors.push(`Línea ${index+1}: falta nombre`);return}
    if(seen.has(n)){errors.push(`Línea ${index+1}: número repetido`);return}
    seen.add(n);entries.push({n,ownerName});
  });
  return {entries,errors};
}

function previewBulk(){
  const {entries,errors}=parseBulk($("bulkInput").value);
  $("bulkPreview").textContent=errors.length?errors.join("\n"):`${entries.length} rifas listas para guardar.`;
  $("applyBulkBtn").disabled=!entries.length||errors.length>0;
}

async function applyBulk(){
  const {entries,errors}=parseBulk($("bulkInput").value);if(!entries.length||errors.length)return;
  if(!confirm(`¿Guardar ${entries.length} rifas? Los nombres existentes de esos números se reemplazarán, pero sus links se conservarán.`))return;
  $("applyBulkBtn").disabled=true;setMessage("Guardando carga rápida…");
  try{
    const batch=writeBatch(db),next=[];
    for(const {n,ownerName} of entries){
      const current=state.get(n)||{},certificateId=current.certificateId||makeToken();
      const base={number:n,pokemonId:n,pokemonName:pokemonName(n),ownerName,certificateId,assigned:true,updatedAt:serverTimestamp()};
      batch.set(doc(db,"tickets",ticketId(n)),{...base,createdAt:current.createdAt||serverTimestamp()},{merge:true});
      batch.set(doc(db,"certificates",certificateId),{raffleNumber:n,buyerName:ownerName,pokemonId:n,pokemonName:pokemonName(n),status:"valid",updatedAt:serverTimestamp()},{merge:true});
      next.push([n,{...current,...base,certificateId}]);
    }
    await batch.commit();next.forEach(([n,d])=>state.set(n,d));renderRows();$("bulkInput").value="";previewBulk();$("bulkDialog").close();
    setMessage(`Carga rápida completa: ${entries.length} rifas guardadas.`);
  }catch(err){console.error(err);setMessage("No se pudo completar la carga rápida.");$("applyBulkBtn").disabled=false}
}

$("loginBtn").addEventListener("click",async()=>{ $("loginMessage").textContent=""; try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}catch(err){console.error(err);$("loginMessage").textContent="Email o contraseña incorrectos."}});
$("password").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click()});
$("logoutBtn").addEventListener("click",()=>signOut(auth));
$("searchInput").addEventListener("input",applySearch);
$("statusFilter").addEventListener("change",applySearch);
$("clearSearchBtn").addEventListener("click",()=>{$("searchInput").value="";$("statusFilter").value="all";applySearch()});
$("exportExcelBtn").addEventListener("click",exportExcel);
$("copyAssignedBtn").addEventListener("click",()=>copyList("assigned"));
$("copyFreeBtn").addEventListener("click",()=>copyList("free"));
$("randomFreeBtn").addEventListener("click",randomFree);
$("distributionBtn").addEventListener("click",openDistribution);
$("bulkBtn").addEventListener("click",()=>{$("bulkDialog").showModal();previewBulk()});
$("bulkInput").addEventListener("input",previewBulk);
$("applyBulkBtn").addEventListener("click",applyBulk);
$("closeBulkBtn").addEventListener("click",()=>$("bulkDialog").close());
$("distributionNames").addEventListener("input",refreshDistributionPreview);
$("copyDistributionBtn").addEventListener("click",copyDistribution);
$("closeDistributionBtn").addEventListener("click",()=>$("distributionDialog").close());
$("closeQrBtn").addEventListener("click",()=>$("qrDialog").close());
$("copyQrLinkBtn").addEventListener("click",async()=>{await navigator.clipboard.writeText($("qrLink").value);$("copyQrLinkBtn").textContent="Copiado";setTimeout(()=>$("copyQrLinkBtn").textContent="Copiar link",1000)});
$("downloadQrBtn").addEventListener("click",()=>{const canvas=$("qrBox").querySelector("canvas"),img=$("qrBox").querySelector("img"),href=canvas?canvas.toDataURL("image/png"):img?.src;if(!href)return;const a=document.createElement("a");a.href=href;a.download="fiebre-de-otono-qr.png";a.click()});

onAuthStateChanged(auth,async user=>{
  if(!user){$("loginView").hidden=false;$("masterView").hidden=true;return}
  if(user.uid!==ADMIN_UID){$("loginMessage").textContent="Esta cuenta no está autorizada.";await signOut(auth);return}
  $("loginView").hidden=true;$("masterView").hidden=false;
  try{await loadTickets()}catch(err){console.error(err);setMessage("Conectado, pero Firestore todavía no permite leer la tabla. Falta desplegar las reglas.")}
});
