import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
const SUPABASE_URL="https://xdqtaskumrwohqfcuial.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_67zeK-MfnR0yxQmma2v7Xg_AWCZdEPh";
const db=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const $=s=>document.querySelector(s);
const loginPanel=$("#login-panel"),dashboard=$("#dashboard"),loginMessage=$("#login-message"),dashboardMessage=$("#dashboard-message");
let categories=[],products=[],selectedPhoto=null,photoPreviewUrl=null;
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function message(el,text,error=false){el.textContent=text;el.classList.toggle("error",error);el.classList.toggle("success",!error&&!!text)}
function money(v,c){return new Intl.NumberFormat("es",{maximumFractionDigits:2}).format(Number(v)||0)+(c?" "+c:"")}
function showLogin(){loginPanel.hidden=false;dashboard.hidden=true}
function showDashboard(user){loginPanel.hidden=true;dashboard.hidden=false;$("#admin-email").textContent=user.email||"Sesión de administrador"}
async function verifyAdmin(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){showLogin();return}
 const {data,error}=await db.rpc("is_menu_admin");
 if(error||data!==true){await db.auth.signOut();showLogin();message(loginMessage,"Esta cuenta no tiene permisos de administrador.",true);return}
 showDashboard(session.user);await loadData();
}
async function loadData(){
 message(dashboardMessage,"Cargando datos…");
 const [c,p]=await Promise.all([db.from("menu_categories").select("*").order("sort_order").order("name"),db.from("menu_products").select("*").order("sort_order").order("name")]);
 if(c.error||p.error){message(dashboardMessage,c.error?.message||p.error?.message,true);return}
 categories=c.data||[];products=p.data||[];renderCategories();renderProducts();message(dashboardMessage,"Cambios guardados directamente en tu menú.");
}
function renderCategories(){
 $("#category-list").innerHTML=categories.map(c=>`<div class="manage-row"><div><strong>${esc(c.name)}</strong><small>${c.is_active?"Visible en el menú":"Desactivada"}</small></div><div class="row-actions"><button data-cat-toggle="${c.id}" class="small-button">${c.is_active?"Desactivar":"Activar"}</button><button data-cat-delete="${c.id}" class="small-button danger">Eliminar</button></div></div>`).join("")||'<p class="muted">Todavía no hay categorías.</p>';
 $("#product-category").innerHTML='<option value="">Sin categoría</option>'+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}
function renderProducts(){
 $("#product-count").textContent=products.length+" en total";
 $("#product-list").innerHTML=products.map(p=>{const cat=categories.find(c=>c.id===p.category_id)?.name||"Sin categoría";const state={available:"Disponible",sold_out:"Agotado",hidden:"Oculto"}[p.status];return `<div class="manage-row product-row"><div class="product-summary">${p.image_url?`<img src="${esc(p.image_url)}" alt="">`:'<span class="mini-photo">🍽️</span>'}<div><strong>${esc(p.name)}</strong><small>${esc(cat)} · ${state}</small><b>${money(p.price,p.currency)}</b></div></div><div class="row-actions"><button class="small-button" data-edit="${p.id}">Editar</button><button class="small-button danger" data-delete="${p.id}">Eliminar</button></div></div>`}).join("")||'<p class="muted">Todavía no hay productos. Añade el primero arriba.</p>';
}
$("#login-form").addEventListener("submit",async e=>{e.preventDefault();message(loginMessage,"Verificando acceso…");const {error}=await db.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});if(error){message(loginMessage,"No se pudo iniciar sesión. Comprueba el correo y la contraseña.",true);return}await verifyAdmin()});
$("#logout-button").addEventListener("click",async()=>{await db.auth.signOut();showLogin();message(loginMessage,"Sesión cerrada.")});
$("#category-form").addEventListener("submit",async e=>{e.preventDefault();const name=$("#category-name").value.trim();if(!name)return;const {error}=await db.from("menu_categories").insert({name,sort_order:categories.length});if(error){message(dashboardMessage,error.message,true);return}$("#category-name").value="";await loadData()});
$("#category-list").addEventListener("click",async e=>{const t=e.target.closest("button");if(!t)return;let error;if(t.dataset.catToggle){const c=categories.find(x=>x.id===t.dataset.catToggle);({error}=await db.from("menu_categories").update({is_active:!c.is_active}).eq("id",c.id))}else if(t.dataset.catDelete){const c=categories.find(x=>x.id===t.dataset.catDelete);if(!confirm('¿Eliminar la categoría "'+c.name+'"? Los productos quedarán sin categoría.'))return;({error}=await db.from("menu_categories").delete().eq("id",c.id))}if(error)message(dashboardMessage,error.message,true);else await loadData()});
function clearPhotoPreview(){if(photoPreviewUrl){URL.revokeObjectURL(photoPreviewUrl);photoPreviewUrl=null}$("#product-photo-preview").hidden=true;$("#product-photo-preview").removeAttribute("src")}
function resetProduct(){ $("#product-form").reset();$("#product-id").value="";$("#product-form-title").textContent="Añadir producto";$("#product-status").value="available";selectedPhoto=null;clearPhotoPreview()}
async function preparePhoto(file){
 let source=file;let type=file.type||"";const ext=(file.name.split(".").pop()||"").toLowerCase();
 if(!type)type=({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif"})[ext]||"";
 if(["image/heic","image/heif","image/heic-sequence","image/heif-sequence"].includes(type)){
  message(dashboardMessage,"Convirtiendo foto HEIC del teléfono…");
  try{const mod=await import("https://esm.sh/heic2any@0.0.4");const convert=mod.default||mod;const converted=await convert({blob:file,toType:"image/jpeg",quality:0.86});source=Array.isArray(converted)?converted[0]:converted}
  catch(err){throw new Error("No se pudo convertir la foto HEIC. Guárdala como JPG y vuelve a seleccionarla. Detalle: "+(err.message||"conversión fallida"))}
 }
 const objectUrl=URL.createObjectURL(source);
 let image;
 try{
  image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("El navegador no pudo decodificar la foto. Prueba guardarla como JPG o PNG."));img.src=objectUrl});
  const maxSide=1600,scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("No se pudo preparar la fotografía en este navegador.");
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const toBlob=q=>new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",q));
  let blob=await toBlob(0.84);if(!blob)throw new Error("No se pudo convertir la foto a JPG.");
  if(blob.size>4.7*1024*1024)blob=await toBlob(0.68);
  if(!blob||blob.size>5*1024*1024)throw new Error("La foto sigue superando los 5 MB después de optimizarla. Selecciona otra imagen.");
  return new File([blob],"producto-"+Date.now()+".jpg",{type:"image/jpeg"});
 }finally{URL.revokeObjectURL(objectUrl)}
}
$("#product-photo-file").addEventListener("change",async e=>{
 const source=e.target.files?.[0];selectedPhoto=null;
 if(!source){clearPhotoPreview();return}
 const ext=(source.name.split(".").pop()||"").toLowerCase();
 if(!(source.type.startsWith("image/")||["jpg","jpeg","png","webp","heic","heif"].includes(ext))){e.target.value="";message(dashboardMessage,"El archivo seleccionado no es una imagen compatible.",true);return}
 if(source.size>15*1024*1024){e.target.value="";message(dashboardMessage,"La foto supera los 15 MB. Selecciona una imagen más pequeña.",true);return}
 const preview=$("#product-photo-preview");
 if(photoPreviewUrl)URL.revokeObjectURL(photoPreviewUrl);
 photoPreviewUrl=URL.createObjectURL(source);preview.src=photoPreviewUrl;preview.hidden=false;
 message(dashboardMessage,"Foto seleccionada. Preparando archivo para guardar…");
 try{
  const ready=await preparePhoto(source);selectedPhoto=ready;
  if(photoPreviewUrl)URL.revokeObjectURL(photoPreviewUrl);
  photoPreviewUrl=URL.createObjectURL(ready);preview.src=photoPreviewUrl;
  message(dashboardMessage,"Foto lista. Pulsa «Guardar producto» para subirla.");
 }catch(err){
  selectedPhoto=null;console.error("Photo preview error:",err);
  message(dashboardMessage,"La foto se muestra, pero no se pudo preparar para subirla: "+(err.message||String(err)),true);
 }
});
async function uploadProductPhoto(){if(!selectedPhoto)return null;const file=await preparePhoto(selectedPhoto);const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";const {data:{session}}=await db.auth.getSession();if(!session)throw new Error("Tu sesión caducó. Cierra sesión y vuelve a entrar.");const path=Date.now()+"-"+Math.random().toString(36).slice(2)+"."+ext;const {data,error}=await db.storage.from("menu-images").upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});if(error)throw new Error(error.message+" (Storage: menu-images)");const publicUrl=db.storage.from("menu-images").getPublicUrl(data.path).data.publicUrl;if(!publicUrl)throw new Error("La foto se subió, pero no se pudo obtener su dirección pública.");return publicUrl;}
$("#cancel-edit").addEventListener("click",resetProduct);
$("#product-list").addEventListener("click",async e=>{const t=e.target.closest("button");if(!t)return;if(t.dataset.edit){const p=products.find(x=>x.id===t.dataset.edit);$("#product-id").value=p.id;$("#product-name").value=p.name;$("#product-description").value=p.description||"";$("#product-price").value=p.price;$("#product-currency").value=p.currency||"";$("#product-category").value=p.category_id||"";selectedPhoto=null;clearPhotoPreview();if(p.image_url){$("#product-photo-preview").src=p.image_url;$("#product-photo-preview").hidden=false}$("#product-status").value=p.status;$("#product-form-title").textContent="Editar producto";$("#product-name").focus();window.scrollTo({top:0,behavior:"smooth"})}else if(t.dataset.delete){const p=products.find(x=>x.id===t.dataset.delete);if(!confirm('¿Eliminar "'+p.name+'" definitivamente?'))return;const {error}=await db.from("menu_products").delete().eq("id",p.id);if(error)message(dashboardMessage,error.message,true);else await loadData()}});
$("#product-form").addEventListener("submit",async e=>{e.preventDefault();const id=$("#product-id").value;const item={name:$("#product-name").value.trim(),description:$("#product-description").value.trim(),price:Number($("#product-price").value),currency:$("#product-currency").value.trim(),category_id:$("#product-category").value||null,image_url:(id?(products.find(p=>p.id===id)?.image_url||null):null),status:$("#product-status").value};try{if(selectedPhoto){message(dashboardMessage,"Preparando y subiendo fotografía…");item.image_url=await uploadProductPhoto()}}catch(err){console.error("Photo upload failed",err);message(dashboardMessage,"No se pudo subir la foto: "+(err.message||"Error desconocido"),true);return}message(dashboardMessage,"Guardando producto…");const q=id?db.from("menu_products").update(item).eq("id",id):db.from("menu_products").insert(item);const {error}=await q;if(error){message(dashboardMessage,"La foto se subió, pero no se pudo guardar el producto: "+error.message,true);return}resetProduct();await loadData();message(dashboardMessage,item.image_url?"Producto guardado con fotografía.":"Producto guardado correctamente.");});
db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT")showLogin()});
verifyAdmin();