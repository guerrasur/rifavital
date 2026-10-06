import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { initializeFirestore, collection, getDocs, getDoc, getDocsFromServer, getDocFromServer, runTransaction, doc, writeBatch, serverTimestamp, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig, ADMIN_UID } from "/firebase-config.js";
import { pokemonName, pokemonSprite } from "/pokemon.js";
import { buyerGroups, buyerUrl } from "/links.js";
import { initRafflePoster } from "/raffle-poster.js?v=1.8.0";
import { initDraw } from "/draw.js?v=1.9.0";

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=initializeFirestore(app,{experimentalForceLongPolling:true});
const $=id=>document.getElementById(id), state=new Map();
const VERSION="1.9.0";
let latestVersion=VERSION;
const TOTAL=150, DISTRIBUTION_TOTAL=144, DISTRIBUTION_PEOPLE=9, DISTRIBUTION_SIZE=16;
initRafflePoster({subscribe:(number,next,error)=>onSnapshot(doc(db,"tickets",String(number).padStart(3,"0")),{includeMetadataChanges:true},snapshot=>next({assigned:Boolean(snapshot.exists()&&snapshot.data().ownerName),fromCache:snapshot.metadata.fromCache,pending:snapshot.metadata.hasPendingWrites}),error)});
const PARTICIPANTS=[
  {slug:"juana",name:"Juana",start:1,end:16},
  {slug:"fede-diez",name:"Fede Diez",start:17,end:32},
  {slug:"juanma",name:"Juanma",start:33,end:48},
  {slug:"lucio",name:"Lucio",start:49,end:64},
  {slug:"rama",name:"Rama",start:65,end:80},
  {slug:"fede-torres",name:"Fede Torres",start:81,end:96},
  {slug:"aye",name:"Aye",start:97,end:112},
  {slug:"sofi",name:"Sofi",start:113,end:128},
  {slug:"blas",name:"Blas",start:129,end:144}
];
let selectedParticipant=null;
const linkedParticipant=PARTICIPANTS.find(p=>p.slug===new URLSearchParams(location.search).get("integrante"));
const GATE_PASSWORD="cortoidac";
const GATE_SESSION_KEY="fiebre_gate_ok";
let gateUnlocked=false;

const formatRaffleNumber=n=>String(n).padStart(3,"0");
const ticketId=n=>formatRaffleNumber(n);
const makeToken=()=>{const bytes=new Uint8Array(24);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("")};
const participantUrl=p=>`${location.origin}/?integrante=${p.slug}`;
const certificateUrl=(token,n)=>`${location.origin}/r/${formatRaffleNumber(n)}?id=${encodeURIComponent(token)}`;
const setMessage=text=>$("globalMessage").textContent=text||"";
const setParticipantMessage=text=>$("participantMessage").textContent=text||"";

function escapeHtml(value){return String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function currentFilter(){return $("statusFilter")?.value||"all"}
function participantForNumber(n){return PARTICIPANTS.find(p=>n>=p.start&&n<=p.end)||null}

function drawRequest(promise){
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("No se pudo conectar con el sorteo. Revisá la conexión e intentá de nuevo.")),15000)})]).finally(()=>clearTimeout(timer));
}
const drawRef=doc(db,"draws","first-prize");
const drawController=initDraw({
  isAdmin:()=>auth.currentUser?.uid===ADMIN_UID,
  sellerForNumber:participantForNumber,
  loadTickets:async()=>{
    const snap=await drawRequest(getDocsFromServer(collection(db,"tickets")));
    return snap.docs.map(ticket=>[Number(ticket.id),ticket.data()]);
  },
  loadResult:async()=>{
    const snap=await drawRequest(getDocFromServer(drawRef));
    return snap.exists()?snap.data():null;
  },
  saveResult:async(winner,expectedDrawId)=>{
    try{
      return await drawRequest(runTransaction(db,async transaction=>{
        const existing=await transaction.get(drawRef);
        if(existing.exists()&&existing.data().drawId!==expectedDrawId)return existing.data();
        if(!existing.exists()&&expectedDrawId)throw new Error("El resultado cambió. Volvé a abrir el sorteo.");
        const ticket=await transaction.get(doc(db,"tickets",ticketId(winner.number)));
        if(!ticket.exists()||ticket.data().ownerName?.trim()!==winner.ownerName)throw new Error("Las rifas cambiaron mientras se preparaba el sorteo. Intentá nuevamente.");
        transaction.set(drawRef,{...winner,prize:1,createdAt:serverTimestamp(),adminUid:auth.currentUser.uid});
        return winner;
      }));
    }catch(error){
      // A timed-out write may still have committed. Reload before permitting another draw.
      const saved=await drawRequest(getDocFromServer(drawRef)).catch(()=>null);
      if(saved?.exists()&&saved.data().drawId===winner.drawId)return saved.data();
      throw error;
    }
  }
});

function renderParticipantButtons(){
  const box=$("participantButtons");box.innerHTML="";
  PARTICIPANTS.forEach(p=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="participant-select";
    button.innerHTML=`<strong>${escapeHtml(p.name)}</strong><span>${formatRaffleNumber(p.start)}–${formatRaffleNumber(p.end)}</span>`;
    button.addEventListener("click",()=>openParticipant(p));
    const item=document.createElement("div");item.className="participant-link-item";
    item.appendChild(button);
    const copy=document.createElement("button");copy.type="button";copy.className="button-light";
    copy.textContent="Copiar link";copy.setAttribute("aria-label",`Copiar link de ${p.name}`);
    copy.addEventListener("click",()=>copyLink(participantUrl(p),copy,$("loginMessage")));
    item.appendChild(copy);box.appendChild(item);
  });
}

function switchAccessTab(tab){
  const admin=tab==="admin";
  $("adminAccessPanel").hidden=!admin;
  $("participantAccessPanel").hidden=admin;
  $("adminTabBtn").classList.toggle("active",admin);
  $("participantsTabBtn").classList.toggle("active",!admin);
  $("loginMessage").textContent="";
}

function gateIsOpen(){
  if(gateUnlocked)return true;
  try{
    gateUnlocked=localStorage.getItem(GATE_SESSION_KEY)==="1"||sessionStorage.getItem(GATE_SESSION_KEY)==="1";
    if(gateUnlocked)localStorage.setItem(GATE_SESSION_KEY,"1");
  }catch(error){console.warn("No se pudo leer el acceso guardado.");}
  return gateUnlocked;
}

function showAccessAfterGate(){
  $("gateView").hidden=true;
  if(!auth.currentUser&&!selectedParticipant)$("accessView").hidden=false;
}

function unlockGate(){
  const value=$("gatePassword").value;
  if(value!==GATE_PASSWORD){
    $("gateMessage").textContent="Contraseña incorrecta.";
    $("gatePassword").select();
    return;
  }
  gateUnlocked=true;
  try{localStorage.setItem(GATE_SESSION_KEY,"1")}catch(error){console.warn("No se pudo recordar el acceso en este navegador.");}
  $("gateMessage").textContent="";
  showAccessAfterGate();
}

async function openParticipant(participant){
  selectedParticipant=participant;
  $("accessView").hidden=true;
  $("masterView").hidden=true;
  $("participantView").hidden=false;
  $("participantTitle").textContent=participant.name;
  $("gateView").hidden=true;
  const url=new URL(location.href);url.searchParams.set("integrante",participant.slug);
  history.replaceState(null,"",url);
  $("participantDirectLink").href=participantUrl(participant);
  $("participantDirectLink").textContent=participantUrl(participant);
  setParticipantMessage("Cargando…");
  await loadParticipantTickets(participant);
}

async function loadParticipantTickets(participant){
  for(let n=participant.start;n<=participant.end;n++)state.delete(n);
  const timeoutMs=12000;
  let timeoutId;
  try{
    const reads=[];
    for(let n=participant.start;n<=participant.end;n++)reads.push(getDoc(doc(db,"tickets",ticketId(n))));
    const timeout=new Promise((_,reject)=>{
      timeoutId=setTimeout(()=>reject(new Error("Tiempo de espera agotado al conectar con Firestore.")),timeoutMs);
    });
    const snaps=await Promise.race([Promise.all(reads),timeout]);
    clearTimeout(timeoutId);
    if(selectedParticipant!==participant)return;
    snaps.forEach((snap,i)=>{if(snap.exists())state.set(participant.start+i,snap.data())});
    renderParticipantGrid();
    setParticipantMessage("");
  }catch(err){
    clearTimeout(timeoutId);
    console.error(err);
    if(selectedParticipant!==participant)return;
    setParticipantMessage("No se pudieron cargar las rifas. Volvé e intentá de nuevo.");
  }
}

function renderParticipantGrid(){
  if(!selectedParticipant)return;
  const box=$("participantGrid");box.innerHTML="";
  let assigned=0;
  for(let n=selectedParticipant.start;n<=selectedParticipant.end;n++){
    const data=state.get(n)||{},isAssigned=Boolean(data.ownerName);
    if(isAssigned)assigned++;
    const card=document.createElement("article");
    card.className=`participant-card ${isAssigned?"is-assigned":""}`;
    card.innerHTML=`
      <div class="participant-card-head">
        <strong>#${formatRaffleNumber(n)}</strong>
        <span class="participant-status">${isAssigned?"Asignado":"Libre"}</span>
      </div>
      <img src="${pokemonSprite(n)}" alt="${escapeHtml(pokemonName(n))}" loading="lazy">
      <h2>${escapeHtml(pokemonName(n))}</h2>
      ${isAssigned
        ? `<div class="participant-assigned-info">
            <p class="participant-owner">Asignado a <strong>${escapeHtml(data.ownerName)}</strong></p>
            ${data.certificateId ? `
              <div class="participant-ticket-link">
                <a href="${certificateUrl(data.certificateId,n)}" target="_blank" rel="noopener" title="${certificateUrl(data.certificateId,n)}">${certificateUrl(data.certificateId,n)}</a>
                <button type="button" class="participant-copy-link" data-copy-participant-link>Copiar</button>
              </div>` : ``}
          </div>`
        : `<div class="participant-assign"><input type="text" maxlength="80" placeholder="Nombre comprador" aria-label="Nombre comprador para rifa ${formatRaffleNumber(n)}"><button type="button">Asignar</button></div>`
      }`;
    if(!isAssigned){
      const input=card.querySelector("input"),button=card.querySelector("button");
      const submit=()=>assignParticipantTicket(n,input.value.trim(),card);
      button.addEventListener("click",submit);
      input.addEventListener("keydown",e=>{if(e.key==="Enter")submit()});
    }else{
      const copyButton=card.querySelector("[data-copy-participant-link]");
      if(copyButton)copyButton.addEventListener("click",()=>copyParticipantTicketLink(n,data.certificateId,copyButton));
    }
    box.appendChild(card);
  }
  $("participantAssignedCount").textContent=assigned;
}

async function copyParticipantTicketLink(n,certificateId,button){
  if(!certificateId)return;
  const url=certificateUrl(certificateId,n),original=button.textContent;
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
    else{
      const textarea=document.createElement("textarea");
      textarea.value=url;textarea.setAttribute("readonly","");
      textarea.style.position="fixed";textarea.style.opacity="0";
      document.body.appendChild(textarea);textarea.select();
      document.execCommand("copy");textarea.remove();
    }
    button.textContent="Copiado";
    setParticipantMessage(`Link de la rifa #${formatRaffleNumber(n)} copiado.`);
    setTimeout(()=>{button.textContent=original},1400);
  }catch(err){
    console.error(err);
    setParticipantMessage("No se pudo copiar el link. Tocá el enlace para abrirlo.");
  }
}

async function assignParticipantTicket(n,ownerName,card){
  if(!selectedParticipant||n<selectedParticipant.start||n>selectedParticipant.end)return;
  if(!ownerName){setParticipantMessage("Escribí el nombre del comprador.");return}
  card.classList.add("saving");setParticipantMessage("");
  try{
    const ref=doc(db,"tickets",ticketId(n)),fresh=await getDoc(ref);
    if(fresh.exists()&&fresh.data().ownerName){
      state.set(n,fresh.data());renderParticipantGrid();setParticipantMessage(`La rifa #${formatRaffleNumber(n)} ya estaba asignada.`);return;
    }
    const certificateId=makeToken(),batch=writeBatch(db),participantName=selectedParticipant.name;
    const base={
      number:n,pokemonId:n,pokemonName:pokemonName(n),ownerName,certificateId,assigned:true,
      participantName,source:"participant",createdAt:serverTimestamp(),updatedAt:serverTimestamp()
    };
    batch.set(ref,base);
    batch.set(doc(db,"certificates",certificateId),{
      raffleNumber:n,buyerName:ownerName,pokemonId:n,pokemonName:pokemonName(n),status:"valid",
      participantName,source:"participant",updatedAt:serverTimestamp()
    });
    await batch.commit();
    state.set(n,{...base,createdAt:new Date(),updatedAt:new Date()});
    renderParticipantGrid();
    setParticipantMessage(`Rifa #${formatRaffleNumber(n)} asignada a ${ownerName}.`);
  }catch(err){
    console.error(err);
    card.classList.remove("saving");
    setParticipantMessage("No se pudo asignar. Puede que otra persona haya tomado esa rifa al mismo tiempo.");
  }
}

async function copyLink(url,button,message){
  const original=button.textContent;
  try{
    if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
    else{
      const input=document.createElement("textarea");input.value=url;
      input.style.position="fixed";input.style.opacity="0";
      (button.closest("dialog")||document.body).appendChild(input);input.select();
      const copied=document.execCommand("copy");input.remove();
      if(!copied)throw new Error("No se pudo copiar");
    }
    button.textContent="Copiado";
    if(message)message.textContent="Link copiado.";
    setTimeout(()=>button.textContent=original,1400);
  }catch(err){if(message)message.textContent="No se pudo copiar. Abrí el enlace y copialo desde la barra de direcciones."}
}

function openBuyerLinks(){
  const tickets=Array.from(state).filter(([n])=>!selectedParticipant||(n>=selectedParticipant.start&&n<=selectedParticipant.end));
  const groups=buyerGroups(tickets),box=$("buyerLinksList");box.innerHTML="";
  $("buyerLinksMessage").textContent=groups.length?"":"Todavía no hay rifas asignadas.";
  for(const group of groups){
    const url=buyerUrl(location.origin,group.tickets),item=document.createElement("article");
    item.className="buyer-link-item";
    item.innerHTML=`<strong>${escapeHtml(group.name)}</strong><p>${group.tickets.map(t=>`#${formatRaffleNumber(t.number)}`).join(" · ")}</p><a href="${url}" target="_blank" rel="noopener">Ver tus rifas</a><button type="button" class="button-light">Copiar link</button>`;
    item.querySelector("button").addEventListener("click",()=>copyLink(url,item.querySelector("button"),$("buyerLinksMessage")));
    box.appendChild(item);
  }
  $("buyerLinksDialog").showModal();
}

function openParticipantLinks(){
  const box=$("participantLinksList");box.innerHTML="";
  PARTICIPANTS.forEach(p=>{
    const item=document.createElement("article"),url=participantUrl(p);item.className="buyer-link-item";
    item.innerHTML=`<strong>${escapeHtml(p.name)}</strong><p>${formatRaffleNumber(p.start)}–${formatRaffleNumber(p.end)}</p><a href="${url}" target="_blank" rel="noopener">Abrir sección</a><button type="button" class="button-light">Copiar link</button>`;
    item.querySelector("button").addEventListener("click",()=>copyLink(url,item.querySelector("button"),$("participantLinksMessage")));
    box.appendChild(item);
  });
  $("participantLinksMessage").textContent="";$("participantLinksDialog").showModal();
}

function loadCanvasImage(src){
  return new Promise(resolve=>{
    const img=new Image();
    img.crossOrigin="anonymous";
    img.onload=()=>resolve(img);
    img.onerror=()=>resolve(null);
    img.src=src;
  });
}

async function generateParticipantImageBlob(){
  if(!selectedParticipant)throw new Error("No hay participante seleccionado.");
  const numbers=Array.from({length:16},(_,i)=>selectedParticipant.start+i);
  const available=numbers.filter(n=>!state.get(n)?.ownerName).length;
  const images=await Promise.all(numbers.map(n=>loadCanvasImage(pokemonSprite(n))));
  const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
  const width=1400,margin=60,gap=22,cols=4,header=220,cardW=(width-margin*2-gap*(cols-1))/cols,cardH=285,rows=4,height=header+rows*cardH+(rows-1)*gap+90;
  canvas.width=width;canvas.height=height;
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,height);
  const headerTextX=margin+40;
  ctx.fillStyle="#000000";ctx.font="700 54px Arial";ctx.textAlign="left";ctx.fillText("Rifa “Fiebre de otoño”",headerTextX,72);
  ctx.font="700 38px Arial";ctx.fillText(selectedParticipant.name,headerTextX,126);
  ctx.font="700 28px Arial";ctx.fillText(`Rifas disponibles: ${available}/16`,headerTextX,170);

  numbers.forEach((n,i)=>{
    const col=i%cols,row=Math.floor(i/cols),x=margin+col*(cardW+gap),y=header+row*(cardH+gap),data=state.get(n)||{},assigned=Boolean(data.ownerName);
    ctx.fillStyle="#ffffff";ctx.fillRect(x,y,cardW,cardH);
    ctx.strokeStyle="#cfcfcf";ctx.lineWidth=2;ctx.strokeRect(x,y,cardW,cardH);
    ctx.fillStyle="#000000";ctx.textAlign="left";ctx.font="700 30px Arial";ctx.fillText(`#${formatRaffleNumber(n)}`,x+20,y+40);
    ctx.textAlign="right";ctx.font="700 18px Arial";ctx.fillStyle=assigned?"#b00020":"#666666";ctx.fillText(assigned?"ASIGNADO":"LIBRE",x+cardW-20,y+38);
    const img=images[i],imgSize=145,imgX=x+(cardW-imgSize)/2,imgY=y+62;
    if(img)ctx.drawImage(img,imgX,imgY,imgSize,imgSize);
    ctx.textAlign="center";ctx.fillStyle="#000000";ctx.font="700 22px Arial";ctx.fillText(pokemonName(n),x+cardW/2,y+242);
    if(assigned){
      ctx.strokeStyle="#d40000";ctx.lineWidth=11;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(imgX-8,imgY+10);ctx.lineTo(imgX+imgSize+8,imgY+imgSize-10);ctx.stroke();
      ctx.beginPath();ctx.moveTo(imgX+imgSize+8,imgY+10);ctx.lineTo(imgX-8,imgY+imgSize-10);ctx.stroke();
    }
  });

  ctx.textAlign="left";ctx.fillStyle="#777777";ctx.font="400 18px Arial";ctx.fillText("Fiebre Producciones © 2026",margin,height-38);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  if(!blob)throw new Error("No se pudo generar la imagen");
  return blob;
}

function participantImageFilename(){
  const slug=selectedParticipant.name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  return `fiebre-de-otono-${slug}.png`;
}

async function withParticipantImageAction(buttonId,workingText,action){
  const button=$(buttonId),original=button.textContent;
  button.disabled=true;button.textContent=workingText;setParticipantMessage("");
  try{
    const blob=await generateParticipantImageBlob();
    await action(blob);
  }catch(err){
    if(err?.name!=="AbortError"){console.error(err);setParticipantMessage(err?.message||"No se pudo generar la imagen.");}
  }finally{
    button.disabled=false;button.textContent=original;
  }
}

async function downloadParticipantImage(){
  await withParticipantImageAction("downloadParticipantImageBtn","Generando…",async blob=>{
    const url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=participantImageFilename();a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    setParticipantMessage("Imagen descargada.");
  });
}

async function copyParticipantImage(){
  await withParticipantImageAction("copyParticipantImageBtn","Copiando…",async blob=>{
    if(!navigator.clipboard?.write||typeof ClipboardItem==="undefined")throw new Error("Este navegador no permite copiar imágenes al portapapeles.");
    await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
    setParticipantMessage("Imagen copiada.");
  });
}

async function shareParticipantImage(){
  await withParticipantImageAction("shareParticipantImageBtn","Compartiendo…",async blob=>{
    if(!navigator.share)throw new Error("Este navegador no permite compartir imágenes directamente.");
    const file=new File([blob],participantImageFilename(),{type:"image/png"});
    if(navigator.canShare&&!navigator.canShare({files:[file]}))throw new Error("Este navegador no permite compartir esta imagen directamente.");
    await navigator.share({files:[file],title:`Rifa “Fiebre de otoño” — ${selectedParticipant.name}`});
    setParticipantMessage("Imagen compartida.");
  });
}

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
  const url=certificateUrl(current.certificateId,n);
  if(action==="open")window.open(url,"_blank","noopener");
  if(action==="copy"){await navigator.clipboard.writeText(url);setMessage(`Link de la rifa #${formatRaffleNumber(n)} copiado.`)}
  if(action==="share"){
    const title=`Rifa “Fiebre de otoño”: NRO ${formatRaffleNumber(n)}`;
    const text=`${title} — ${current.ownerName||""}\n${url}`;
    if(navigator.share){try{await navigator.share({title,text,url});}catch{}}
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener");
  }
  if(action==="qr")openQr(n,url);
}

async function saveTicket(n,ownerName,current,tr){
  tr.classList.add("saving");setMessage("");
  try{
    const certificateId=current.certificateId||makeToken(),batch=writeBatch(db);
    const participantName=participantForNumber(n)?.name||current.participantName||"";
    const base={number:n,pokemonId:n,pokemonName:pokemonName(n),ownerName,certificateId,assigned:true,updatedAt:serverTimestamp(),participantName,source:current.source||"admin"};
    batch.set(doc(db,"tickets",ticketId(n)),{...base,createdAt:current.createdAt||serverTimestamp()},{merge:true});
    batch.set(doc(db,"certificates",certificateId),{raffleNumber:n,buyerName:ownerName,pokemonId:n,pokemonName:pokemonName(n),status:"valid",updatedAt:serverTimestamp(),participantName,source:current.source||"admin"},{merge:true});
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
      "Participante":participantForNumber(n)?.name||"",
      "Estado":d.ownerName?"Asignada":"Libre",
      "Titular":d.ownerName||"",
      "Certificado":d.certificateId||"",
      "Link":d.certificateId?certificateUrl(d.certificateId,n):""
    };
  });
}

function distributionRows(names=PARTICIPANTS.map(p=>p.name)){
  return Array.from({length:DISTRIBUTION_PEOPLE},(_,i)=>{
    const start=i*DISTRIBUTION_SIZE+1,end=start+DISTRIBUTION_SIZE-1;
    let assigned=0;for(let n=start;n<=end;n++)if(state.get(n)?.ownerName)assigned++;
    return {"Persona":names[i]||PARTICIPANTS[i].name,"Desde":formatRaffleNumber(start),"Hasta":formatRaffleNumber(end),"Cantidad":DISTRIBUTION_SIZE,"Asignadas":assigned,"Libres":DISTRIBUTION_SIZE-assigned};
  });
}

function exportExcel(){
  if(!window.XLSX){setMessage("No se pudo cargar el módulo de Excel. Recargá la página e intentá de nuevo.");return}
  const xlsx=window.XLSX,all=ticketRows(),assigned=all.filter(r=>r.Estado==="Asignada"),free=all.filter(r=>r.Estado==="Libre"),wb=xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(all),"Todas");
  xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(assigned),"Asignadas");
  xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(free),"Libres");
  xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(distributionRows()),"Reparto 9x16");
  PARTICIPANTS.forEach(p=>{
    const rows=all.filter(r=>Number(r["Número"])>=p.start&&Number(r["Número"])<=p.end);
    xlsx.utils.book_append_sheet(wb,xlsx.utils.json_to_sheet(rows),p.name.slice(0,31));
  });
  xlsx.writeFile(wb,`fiebre-de-otono-rifas-${new Date().toISOString().slice(0,10)}.xlsx`);
  setMessage("Excel exportado: resumen general y una pestaña por participante.");
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
  PARTICIPANTS.forEach((p,i)=>{
    const input=document.createElement("input");input.value=p.name;input.dataset.index=String(i);box.appendChild(input);
  });
  refreshDistributionPreview();$("distributionDialog").showModal();
}
function distributionNames(){return Array.from($("distributionNames").querySelectorAll("input")).map((input,i)=>input.value.trim()||PARTICIPANTS[i].name)}
function refreshDistributionPreview(){
  const rows=distributionRows(distributionNames());
  $("distributionPreview").textContent=rows.map(r=>`${r.Persona}: ${r.Desde} al ${r.Hasta} · ${r.Asignadas} asignadas · ${r.Libres} libres`).join("\n")+ `\n\nQuedan ${formatRaffleNumber(DISTRIBUTION_TOTAL+1)} al ${formatRaffleNumber(TOTAL)} fuera del reparto.`;
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
      const current=state.get(n)||{},certificateId=current.certificateId||makeToken(),participantName=participantForNumber(n)?.name||"";
      const base={number:n,pokemonId:n,pokemonName:pokemonName(n),ownerName,certificateId,assigned:true,updatedAt:serverTimestamp(),participantName,source:current.source||"admin"};
      batch.set(doc(db,"tickets",ticketId(n)),{...base,createdAt:current.createdAt||serverTimestamp()},{merge:true});
      batch.set(doc(db,"certificates",certificateId),{raffleNumber:n,buyerName:ownerName,pokemonId:n,pokemonName:pokemonName(n),status:"valid",updatedAt:serverTimestamp(),participantName,source:current.source||"admin"},{merge:true});
      next.push([n,{...current,...base,certificateId}]);
    }
    await batch.commit();next.forEach(([n,d])=>state.set(n,d));renderRows();$("bulkInput").value="";previewBulk();$("bulkDialog").close();
    setMessage(`Carga rápida completa: ${entries.length} rifas guardadas.`);
  }catch(err){console.error(err);setMessage("No se pudo completar la carga rápida.");$("applyBulkBtn").disabled=false}
}

function compareVersions(a,b){
  const left=String(a).split(".").map(part=>Number.parseInt(part,10)||0);
  const right=String(b).split(".").map(part=>Number.parseInt(part,10)||0);
  const length=Math.max(left.length,right.length);
  for(let i=0;i<length;i++){
    const l=left[i]||0,r=right[i]||0;
    if(l!==r)return l>r?1:-1;
  }
  return 0;
}

async function checkForUpdate(){
  const label=$("versionLabel"),button=$("updateBtn");
  if(label)label.textContent=`v${VERSION}`;
  try{
    const response=await fetch(`/version.json?_=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
    if(!response.ok)return;
    const data=await response.json();
    const publishedVersion=String(data.version||VERSION);
    const hasNewerVersion=compareVersions(publishedVersion,VERSION)>0;
    latestVersion=hasNewerVersion?publishedVersion:VERSION;
    if(button){
      if(hasNewerVersion){button.textContent=`Actualizar a v${publishedVersion}`;button.hidden=false}
      else button.hidden=true;
    }
  }catch(err){console.debug("No se pudo comprobar la versión.",err)}
}

async function installLatestVersion(){
  const button=$("updateBtn");
  if(button){button.disabled=true;button.textContent="Actualizando…"}
  try{
    if("serviceWorker" in navigator){
      const regs=await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg=>reg.unregister()));
    }
    if("caches" in window){
      const keys=await caches.keys();
      await Promise.all(keys.map(key=>caches.delete(key)));
    }
  }catch{}
  const url=new URL(location.href);
  url.searchParams.set("_v",latestVersion);
  url.searchParams.set("_t",Date.now().toString());
  location.replace(url.toString());
}

$("gateLoginBtn").addEventListener("click",unlockGate);
$("gatePassword").addEventListener("keydown",e=>{if(e.key==="Enter")unlockGate()});
$("adminTabBtn").addEventListener("click",()=>switchAccessTab("admin"));
$("participantsTabBtn").addEventListener("click",()=>switchAccessTab("participants"));
$("backParticipantBtn").addEventListener("click",()=>{
  selectedParticipant=null;$("participantView").hidden=true;
  const url=new URL(location.href);url.searchParams.delete("integrante");history.replaceState(null,"",url);
  if(gateIsOpen())$("accessView").hidden=false;else $("gateView").hidden=false;
  switchAccessTab("participants");
});
$("copyParticipantLinkBtn").addEventListener("click",()=>{if(selectedParticipant)copyLink(participantUrl(selectedParticipant),$("copyParticipantLinkBtn"),$("participantMessage"))});
$("participantBuyerLinksBtn").addEventListener("click",openBuyerLinks);
$("adminBuyerLinksBtn").addEventListener("click",openBuyerLinks);
$("participantLinksBtn").addEventListener("click",openParticipantLinks);
$("closeBuyerLinksBtn").addEventListener("click",()=>$("buyerLinksDialog").close());
$("closeParticipantLinksBtn").addEventListener("click",()=>$("participantLinksDialog").close());
$("downloadParticipantImageBtn").addEventListener("click",downloadParticipantImage);
$("copyParticipantImageBtn").addEventListener("click",copyParticipantImage);
$("shareParticipantImageBtn").addEventListener("click",shareParticipantImage);
$("loginBtn").addEventListener("click",async()=>{ $("loginMessage").textContent=""; try{await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value)}catch(err){console.error(err);$("loginMessage").textContent="Email o contraseña incorrectos."}});
$("password").addEventListener("keydown",e=>{if(e.key==="Enter")$("loginBtn").click()});
$("logoutBtn").addEventListener("click",()=>signOut(auth));
$("updateBtn").addEventListener("click",installLatestVersion);
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

window.addEventListener("focus",checkForUpdate);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkForUpdate()});
setInterval(checkForUpdate,60000);
renderParticipantButtons();
if(linkedParticipant)openParticipant(linkedParticipant);
else if(gateIsOpen())showAccessAfterGate();
else{$("gateView").hidden=false;$("accessView").hidden=true}
checkForUpdate();

onAuthStateChanged(auth,async user=>{
  if(!user){
    drawController.close();
    $("masterView").hidden=true;
    if(!selectedParticipant&&gateIsOpen())$("accessView").hidden=false;
    return;
  }
  if(user.uid!==ADMIN_UID){$("loginMessage").textContent="Esta cuenta no está autorizada.";await signOut(auth);return}
  if(selectedParticipant)return;
  selectedParticipant=null;$("gateView").hidden=true;$("accessView").hidden=true;$("participantView").hidden=true;$("masterView").hidden=false;
  try{await loadTickets()}catch(err){console.error(err);setMessage("Conectado, pero Firestore todavía no permite leer la tabla. Falta desplegar las reglas.")}
});
