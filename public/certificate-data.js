import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { initializeFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "/firebase-config.js";

const app=initializeApp(firebaseConfig);
const db=initializeFirestore(app,{experimentalForceLongPolling:true});

// Both public views use the same connection and distinguish missing data from network errors.
export async function fetchCertificate(value,{timeoutMs=20000}={}){
  const token=String(value||"").trim().toLowerCase();
  if(!/^[a-f0-9]{48}$/.test(token))return null;
  let timeout;
  async function read(){
    for(let attempt=0;attempt<3;attempt++){
      try{
        const snapshot=await getDoc(doc(db,"certificates",token));
        return snapshot.exists()?snapshot.data():null;
      }catch(error){
        if(attempt===2||!["unavailable","deadline-exceeded"].includes(error.code))throw error;
        await new Promise(resolve=>setTimeout(resolve,750*(attempt+1)));
      }
    }
  }
  try{
    return await Promise.race([
      read(),
      new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error("No se pudo cargar la rifa a tiempo.")),timeoutMs)})
    ]);
  }finally{clearTimeout(timeout)}
}
