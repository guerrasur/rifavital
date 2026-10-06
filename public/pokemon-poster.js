import { pokemonName } from "/pokemon.js";

let imagesPromise=null;
function loadPokemonImages(){
  if(!imagesPromise)imagesPromise=Promise.all(Array.from({length:150},(_,index)=>new Promise((resolve,reject)=>{
    const number=index+1,image=new Image();
    image.onload=()=>resolve(image);
    image.onerror=()=>reject(new Error(`No se pudo cargar el Pokémon ${number}.`));
    image.src=`/assets/draw-pokemon/${number}.png`;
  }))).catch(error=>{imagesPromise=null;throw error});
  return imagesPromise;
}

export async function generatePokemonPosterBlob(assigned){
  const images=await loadPokemonImages();
  const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
  const width=1800,margin=60,gap=10,columns=10,rows=15,header=220,cardHeight=180;
  const cardWidth=(width-margin*2-gap*(columns-1))/columns;
  const height=header+rows*cardHeight+(rows-1)*gap+80;
  canvas.width=width;canvas.height=height;
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,height);
  ctx.textAlign="left";ctx.fillStyle="#000000";ctx.font="700 64px Arial";
  ctx.fillText("Rifa “Fiebre de otoño”",margin,90);
  ctx.font="700 32px Arial";ctx.fillText("Los 150 Pokémon · Rifas 001–150",margin,144);
  ctx.font="400 25px Arial";ctx.fillStyle="#555555";
  ctx.fillText("Sin tachar: libres · Cruz roja: asignados",margin,187);
  ctx.imageSmoothingEnabled=false;

  images.forEach((image,index)=>{
    const number=index+1,isAssigned=assigned.has(number);
    const x=margin+(index%columns)*(cardWidth+gap),y=header+Math.floor(index/columns)*(cardHeight+gap);
    ctx.fillStyle=isAssigned?"#fff3f3":"#ffffff";ctx.fillRect(x,y,cardWidth,cardHeight);
    ctx.strokeStyle="#cfcfcf";ctx.lineWidth=2;ctx.strokeRect(x,y,cardWidth,cardHeight);
    ctx.textAlign="left";ctx.fillStyle="#000000";ctx.font="700 22px Arial";
    ctx.fillText(`#${String(number).padStart(3,"0")}`,x+10,y+27);
    ctx.textAlign="right";ctx.font="700 11px Arial";ctx.fillStyle=isAssigned?"#b00020":"#666666";
    ctx.fillText(isAssigned?"ASIGNADO":"LIBRE",x+cardWidth-10,y+25);
    const size=112,imgX=x+(cardWidth-size)/2,imgY=y+34;
    ctx.drawImage(image,imgX,imgY,size,size);
    ctx.textAlign="center";ctx.fillStyle="#000000";ctx.font="700 17px Arial";
    ctx.fillText(pokemonName(number),x+cardWidth/2,y+166,cardWidth-16);
    if(isAssigned){
      ctx.strokeStyle="#d40000";ctx.lineWidth=7;ctx.lineCap="round";
      ctx.beginPath();
      ctx.moveTo(imgX+5,imgY+5);ctx.lineTo(imgX+size-5,imgY+size-5);
      ctx.moveTo(imgX+size-5,imgY+5);ctx.lineTo(imgX+5,imgY+size-5);ctx.stroke();
    }
  });

  ctx.textAlign="left";ctx.fillStyle="#777777";ctx.font="400 24px Arial";
  ctx.fillText("Fiebre Producciones © 2026",margin,height-28);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
  if(!blob)throw new Error("No se pudo generar el afiche de Pokémon.");
  return blob;
}
