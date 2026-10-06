import { pokemonName, pokemonSprite } from "/pokemon.js";
import { parseBuyerTokens } from "/links.js";
import { fetchCertificate } from "/certificate-data.js?v=1.7.0";
import { initCardMotion } from "/card-motion.js?v=1.7.0";

const $=id=>document.getElementById(id),carousel=$("buyerRaffles");
const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)");
let loading=false,motionReady=false,cards=[],activeIndex=0,frame=0;

function resetTilt(card){
  if(!card)return;
  card.style.setProperty("--card-rotate-x","0deg");card.style.setProperty("--card-rotate-y","0deg");
  card.style.setProperty("--card-shine-x","50%");card.style.setProperty("--card-shine-y","50%");
}

function updateCarousel(){
  frame=0;
  if(!cards.length)return;
  const center=carousel.scrollLeft+carousel.clientWidth/2;
  let nearest=0,best=Infinity;
  cards.forEach((card,index)=>{
    const distance=card.offsetLeft+card.offsetWidth/2-center;
    const fraction=Math.min(1,Math.abs(distance)/(card.offsetWidth+16));
    card.style.setProperty("--card-scale",String(1-fraction*.12));
    card.style.setProperty("--card-opacity",String(1-fraction*.25));
    card.style.setProperty("--carousel-rotate",`${Math.max(-10,Math.min(10,-distance/carousel.clientWidth*12))}deg`);
    if(Math.abs(distance)<best){best=Math.abs(distance);nearest=index}
  });
  if(activeIndex!==nearest){resetTilt(cards[activeIndex]);activeIndex=nearest;carousel.dispatchEvent(new Event("cardchange"))}
  cards.forEach((card,index)=>card.setAttribute("aria-current",index===activeIndex?"true":"false"));
  carousel.setAttribute("aria-activedescendant",cards[activeIndex].id);
  $("buyerPosition").textContent=`${activeIndex+1} / ${cards.length}`;
  $("buyerPrevious").disabled=activeIndex===0;
  $("buyerNext").disabled=activeIndex===cards.length-1;
}
function scheduleUpdate(){if(!frame)frame=requestAnimationFrame(updateCarousel)}
function selectCard(index){
  const card=cards[Math.max(0,Math.min(cards.length-1,index))];
  if(!card)return;
  carousel.scrollTo({left:card.offsetLeft-(carousel.clientWidth-card.offsetWidth)/2,behavior:reducedMotion.matches?"auto":"smooth"});
}
carousel.addEventListener("scroll",scheduleUpdate,{passive:true});
window.addEventListener("resize",()=>{selectCard(activeIndex);scheduleUpdate()});
carousel.addEventListener("keydown",event=>{
  if(event.target.closest("a,button"))return;
  if(event.key==="ArrowLeft"||event.key==="ArrowRight"){
    event.preventDefault();selectCard(activeIndex+(event.key==="ArrowRight"?1:-1));
  }
});
carousel.addEventListener("click",event=>{
  if(event.target.closest("a,button"))return;
  const card=event.target.closest(".buyer-raffle");
  if(card)selectCard(cards.indexOf(card));
});
$("buyerPrevious").addEventListener("click",()=>selectCard(activeIndex-1));
$("buyerNext").addEventListener("click",()=>selectCard(activeIndex+1));

function createCard(data){
  const n=data.raffleNumber,card=document.createElement("article");
  card.className="certificate buyer-raffle";card.id=`buyer-raffle-${n}`;
  card.setAttribute("aria-label",`Rifa ${String(n).padStart(3,"0")}: ${pokemonName(n)}`);
  const title=document.createElement("h2");title.textContent=`RIFA #${String(n).padStart(3,"0")}`;
  const owner=document.createElement("p");owner.className="owner-name";owner.textContent=data.buyerName||"";
  const img=document.createElement("img");img.className="pokemon-image";img.src=pokemonSprite(n);img.alt=pokemonName(n);
  const name=document.createElement("p");name.className="your-raffle";name.textContent=`TU RIFA: ${pokemonName(n).toUpperCase()}`;
  const footer=document.createElement("footer");footer.className="certificate-footer";
  const thanks=document.createElement("p");thanks.className="certificate-thanks";thanks.textContent="Gracias por bancar la producción de este proyecto!";
  const instagram=document.createElement("a");instagram.className="certificate-instagram";
  instagram.href="https://instagram.com/fiebredeotono";instagram.target="_blank";instagram.rel="noopener noreferrer";instagram.textContent="@fiebredeotono";
  const credit=document.createElement("p");credit.className="certificate-credit";credit.textContent="Fiebre Producciones © 2026";
  footer.append(thanks,instagram,credit);card.append(title,owner,img,name,footer);
  return card;
}

async function loadBuyerRaffles(){
  if(loading)return;
  loading=true;
  $("buyerLoading").hidden=false;$("buyerError").hidden=true;$("buyerRetry").hidden=true;
  $("buyerControls").hidden=true;carousel.hidden=true;carousel.replaceChildren();cards=[];activeIndex=0;
  const ids=parseBuyerTokens(location.hash);
  if(!ids.length){
    $("buyerLoading").hidden=true;$("buyerError").hidden=false;
    $("buyerError").textContent="Este enlace no contiene rifas válidas.";loading=false;return;
  }
  try{
    const results=await Promise.allSettled(ids.map(id=>fetchCertificate(id)));
    const valid=results.filter(result=>result.status==="fulfilled"&&result.value)
      .map(result=>result.value)
      .filter(data=>data.status==="valid"&&Number.isInteger(data.raffleNumber)&&data.raffleNumber>=1&&data.raffleNumber<=150)
      .sort((a,b)=>a.raffleNumber-b.raffleNumber);
    const seen=new Set(),tickets=valid.filter(data=>{if(seen.has(data.raffleNumber))return false;seen.add(data.raffleNumber);return true});
    cards=tickets.map(createCard);carousel.append(...cards);carousel.hidden=!cards.length;
    $("buyerControls").hidden=cards.length<2;
    if(cards.length){
      carousel.scrollLeft=0;updateCarousel();
      if(!motionReady){
        try{initCardMotion(carousel,$("motionToggle"),$("motionHint"),{getCard:()=>cards[activeIndex],touchTilt:false})}
        catch(err){console.warn(err);$("motionToggle").hidden=true}
        motionReady=true;
      }
    }
    const failed=results.some(result=>result.status==="rejected");
    if(failed||valid.length<ids.length){
      $("buyerError").hidden=false;
      $("buyerError").textContent=failed?"No se pudieron cargar algunas rifas. Intentá de nuevo.":tickets.length?"Algunas rifas del enlace ya no están disponibles.":"Estas rifas ya no están disponibles.";
      $("buyerRetry").hidden=!failed;
    }
  }catch(err){
    $("buyerError").hidden=false;$("buyerRetry").hidden=false;
    $("buyerError").textContent="No se pudieron cargar las rifas. Revisá tu conexión e intentá de nuevo.";
  }finally{loading=false;$("buyerLoading").hidden=true}
}

$("buyerRetry").addEventListener("click",loadBuyerRaffles);
loadBuyerRaffles();
