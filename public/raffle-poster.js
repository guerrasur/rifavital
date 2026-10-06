// Pixel coordinates of the numbered grid in the unmodified 1131 × 1600 asset.
export const POSTER_GRID={left:77,top:760,right:677,bottom:1550,columns:10,rows:15};
export function numberCell(number){
  if(!Number.isInteger(number)||number<1||number>150)throw new RangeError("Número de rifa inválido");
  const g=POSTER_GRID,w=(g.right-g.left)/g.columns,h=(g.bottom-g.top)/g.rows;
  return {x:g.left+((number-1)%g.columns)*w,y:g.top+Math.floor((number-1)/g.columns)*h,w,h};
}

export async function generatePosterBlob(image,assigned){
  const canvas=document.createElement("canvas");
  canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext("2d");
  ctx.drawImage(image,0,0);
  ctx.strokeStyle="#ff3030";ctx.lineWidth=4;ctx.lineCap="round";
  for(const number of assigned){
    const {x,y,w,h}=numberCell(number),pad=10;
    ctx.beginPath();
    ctx.moveTo(x+pad,y+pad);ctx.lineTo(x+w-pad,y+h-pad);
    ctx.moveTo(x+w-pad,y+pad);ctx.lineTo(x+pad,y+h-pad);ctx.stroke();
  }
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  if(!blob)throw new Error("No se pudo generar el afiche.");
  return blob;
}

export function initRafflePoster({subscribe,variant="raffle",generateBlob}){
  const pokemon=variant==="pokemon";
  const $=id=>document.getElementById(pokemon?id.replace("RafflePoster","PokemonPoster").replace("rafflePoster","pokemonPoster"):id),dialog=$("rafflePosterDialog"),preview=$("rafflePosterPreview");
  const filename=pokemon?"fiebre-de-otono-pokemones.png":"fiebre-de-otono-rifas.png";
  const actions=["copyRafflePosterBtn","shareRafflePosterBtn","downloadRafflePosterBtn"].map($);
  const assigned=new Set(),ready=new Set();
  let unsubscribers=[],timer,deadline,revision=0,session=0,blob=null,previewUrl=null,imagePromise=null;
  const message=text=>$("rafflePosterMessage").textContent=text;
  const disable=()=>{blob=null;actions.forEach(button=>button.disabled=true)};
  function revokePreview(){
    preview.hidden=true;preview.removeAttribute("src");
    if(previewUrl)URL.revokeObjectURL(previewUrl);
    previewUrl=null;
  }
  function stop(){
    revision++;session++;clearTimeout(timer);clearTimeout(deadline);deadline=null;
    unsubscribers.forEach(unsubscribe=>unsubscribe());unsubscribers=[];
    disable();revokePreview();
  }
  function fail(error){
    stop();console.error(error);
    message("No se pudo actualizar el afiche. Revisá la conexión y reintentá.");
    $("retryRafflePosterBtn").hidden=false;
  }
  function loadImage(){
    if(!imagePromise)imagePromise=new Promise((resolve,reject)=>{
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>{imagePromise=null;reject(new Error("No se pudo cargar el afiche original."))};
      image.src="/assets/rifa-fiebre-original.jpeg";
    });
    return imagePromise;
  }
  async function render(){
    const current=revision,numbers=new Set(assigned);
    try{
      const nextBlob=generateBlob?await generateBlob(numbers):await generatePosterBlob(await loadImage(),numbers);
      if(current!==revision||!dialog.open||ready.size!==150)return;
      revokePreview();blob=nextBlob;previewUrl=URL.createObjectURL(blob);
      preview.src=previewUrl;preview.hidden=false;
      actions.forEach(button=>button.disabled=false);
      message(`Actualizado · ${numbers.size} asignadas · ${150-numbers.size} disponibles.`);
    }catch(error){if(current===revision&&dialog.open)fail(error)}
  }
  function start(){
    stop();assigned.clear();ready.clear();
    const currentSession=session;
    $("retryRafflePosterBtn").hidden=true;message("Cargando números actualizados…");
    deadline=setTimeout(()=>fail(new Error("Tiempo de espera agotado")),20000);
    for(let number=1;number<=150;number++){
      unsubscribers.push(subscribe(number,snapshot=>{
        if(!dialog.open||currentSession!==session)return;
        if(snapshot.fromCache||snapshot.pending){
          ready.delete(number);revision++;clearTimeout(timer);disable();revokePreview();
          message("Actualizando números…");
          if(!deadline)deadline=setTimeout(()=>fail(new Error("Sin conexión")),20000);
          return;
        }
        const changed=assigned.has(number)!==snapshot.assigned,wasReady=ready.has(number);
        if(snapshot.assigned)assigned.add(number);else assigned.delete(number);
        ready.add(number);
        if(changed||!wasReady){revision++;disable();revokePreview();clearTimeout(timer)}
        if(ready.size===150){
          clearTimeout(deadline);deadline=null;
          if(changed||!wasReady){message("Preparando imagen actualizada…");timer=setTimeout(render,180)}
        }
      },error=>{if(currentSession===session)fail(error)}));
    }
  }
  $("rafflePosterBtn").addEventListener("click",()=>{dialog.showModal();start()});
  $("closeRafflePosterBtn").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("close",stop);
  $("retryRafflePosterBtn").addEventListener("click",start);
  window.addEventListener("offline",()=>{if(dialog.open)fail(new Error("Sin conexión"))});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&dialog.open)start()});

  $("copyRafflePosterBtn").addEventListener("click",()=>{
    if(!blob)return;
    if(!navigator.clipboard?.write||typeof ClipboardItem==="undefined"){
      message("Este navegador no permite copiar imágenes. Usá Compartir imagen o Descargar.");return;
    }
    // Use the already prepared blob so iPhone retains the button's user activation.
    navigator.clipboard.write([new ClipboardItem({"image/png":blob})])
      .then(()=>message("Imagen copiada."))
      .catch(()=>message("No se pudo copiar. Usá Compartir imagen o Descargar."));
  });
  $("shareRafflePosterBtn").addEventListener("click",()=>{
    if(!blob)return;
    const file=new File([blob],filename,{type:"image/png"});
    if(!navigator.share||(navigator.canShare&&!navigator.canShare({files:[file]}))){
      message("Este navegador no permite compartir imágenes. Usá Copiar imagen o Descargar.");return;
    }
    navigator.share({files:[file],title:pokemon?"Pokémon · Rifa Fiebre de otoño":"Rifa Fiebre de otoño"})
      .then(()=>message("Imagen compartida."))
      .catch(error=>{if(error.name!=="AbortError")message("No se pudo compartir. Usá Copiar imagen o Descargar.")});
  });
  $("downloadRafflePosterBtn").addEventListener("click",()=>{
    if(!blob)return;
    const url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=filename;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);message("Imagen descargada.");
  });
}
