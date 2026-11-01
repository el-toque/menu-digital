const { createClient } = window.supabase || {}; if (!createClient) throw new Error("No se pudo cargar la biblioteca de acceso a Supabase.");
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
$("#login-form").dataset.handlerReady="true";
$("#login-form").addEventListener("submit",async e=>{
 e.preventDefault();
 const button=$("#login-form").querySelector('button[type="submit"]');
 if(button.disabled)return;
 const email=$("#email").value.trim(),password=$("#password").value;
 if(!email||!password){message(loginMessage,"Escribe el correo y la contraseña.",true);return}
 button.disabled=true;button.textContent="Verificando…";
 message(loginMessage,"Verificando acceso…");
 try{
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error){message(loginMessage,"No se pudo iniciar sesión. Comprueba el correo y la contraseña.",true);return}
  await verifyAdmin();
 }catch(err){
  console.error("Login failed:",err);
  message(loginMessage,"No se pudo completar el acceso. Comprueba tu conexión e inténtalo de nuevo.",true);
 }finally{
  button.disabled=false;button.textContent="Entrar al panel";
 }
});
$("#logout-button").addEventListener("click",async()=>{await db.auth.signOut();showLogin();message(loginMessage,"Sesión cerrada.")});
$("#category-form").addEventListener("submit",async e=>{e.preventDefault();const name=$("#category-name").value.trim();if(!name)return;const {error}=await db.from("menu_categories").insert({name,sort_order:categories.length});if(error){message(dashboardMessage,error.message,true);return}$("#category-name").value="";await loadData()});
$("#category-list").addEventListener("click",async e=>{const t=e.target.closest("button");if(!t)return;let error;if(t.dataset.catToggle){const c=categories.find(x=>x.id===t.dataset.catToggle);({error}=await db.from("menu_categories").update({is_active:!c.is_active}).eq("id",c.id))}else if(t.dataset.catDelete){const c=categories.find(x=>x.id===t.dataset.catDelete);if(!confirm('¿Eliminar la categoría "'+c.name+'"? Los productos quedarán sin categoría.'))return;({error}=await db.from("menu_categories").delete().eq("id",c.id))}if(error)message(dashboardMessage,error.message,true);else await loadData()});
function clearPhotoPreview(){if(photoPreviewUrl){URL.revokeObjectURL(photoPreviewUrl);photoPreviewUrl=null}$("#product-photo-preview").hidden=true;$("#product-photo-preview").removeAttribute("src")}
function resetProduct(){ $("#product-form").reset();$("#product-id").value="";$("#product-form-title").textContent="Añadir producto";$("#product-status").value="available";selectedPhoto=null;clearPhotoPreview()}
async function preparePhoto(file){
 let source=file;
 let type=file.type||"";
 const ext=(file.name.split(".").pop()||"").toLowerCase();
 if(!type)type=({jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif"})[ext]||"";

 // Detectar HEIC/HEIF por la firma real del archivo, aunque Android lo etiquete como JPG.
 let brand="";
 try{const bytes=new Uint8Array(await file.slice(0,32).arrayBuffer());if(bytes.length>=12&&String.fromCharCode(...bytes.slice(4,8))==="ftyp")brand=String.fromCharCode(...bytes.slice(8,12)).toLowerCase()}catch(_){}
 const isHeif=["heic","heix","hevc","hevx","mif1","msf1"].includes(brand)||["image/heic","image/heif","image/heic-sequence","image/heif-sequence"].includes(type)||["heic","heif"].includes(ext);
 if(isHeif){
  message(dashboardMessage,"Convirtiendo foto HEIC/HEIF del teléfono…");
  try{const mod=await import("https://esm.sh/heic2any@0.0.4");const convert=mod.default||mod;const converted=await convert({blob:file,toType:"image/jpeg",quality:0.88});source=Array.isArray(converted)?converted[0]:converted;type="image/jpeg"}
  catch(err){throw new Error("No se pudo convertir la foto HEIC/HEIF. Detalle: "+(err.message||"conversión fallida"))}
 }

 let bitmap=null,image=null,lastError=null;
 // Método 1: decodificación directa del Blob (rápido y respeta orientación EXIF en navegadores compatibles).
 if(typeof createImageBitmap==="function"){
  try{bitmap=await createImageBitmap(source)}catch(err){lastError=err;console.warn("Método 1 createImageBitmap falló:",err)}
 }
 // Método 2: Image + URL temporal.
 if(!bitmap){
  let url="";
  try{
   url=URL.createObjectURL(source);
   image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("El navegador no pudo decodificar la imagen desde Blob URL."));img.src=url});
  }catch(err){lastError=err;image=null;console.warn("Método 2 Blob URL falló:",err)}
  finally{if(url)URL.revokeObjectURL(url)}
 }
 // Método 3: FileReader + data URL. Algunos Chrome Android leen este formato cuando falla Blob URL.
 if(!bitmap&&!image){
  try{
   const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error||new Error("No se pudo leer el archivo"));reader.readAsDataURL(source)});
   image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("Chrome tampoco pudo decodificar la imagen como Data URL."));img.src=dataUrl});
  }catch(err){lastError=err;image=null;console.warn("Método 3 FileReader/Data URL falló:",err)}
 }
 // Método 4: ImageDecoder (WebCodecs), disponible en algunas versiones recientes de Chrome.
 let decoder=null,decodedFrame=null;
 if(!bitmap&&!image&&typeof ImageDecoder==="function"){
  try{
   const bytes=await source.arrayBuffer();
   decoder=new ImageDecoder({data:bytes,type:source.type||type||"image/jpeg"});
   await decoder.tracks.ready;
   const result=await decoder.decode({frameIndex:0});
   decodedFrame=result.image;
   bitmap=decodedFrame;
  }catch(err){lastError=err;console.warn("Método 4 ImageDecoder falló:",err)}
 }
 if(!bitmap&&!image){try{decoder?.close()}catch(_){}throw new Error("Chrome no pudo decodificar la foto con ninguno de los métodos disponibles. "+(lastError?.message||"Prueba con otra imagen o una captura de pantalla."))}

 try{
  const width=bitmap?bitmap.displayWidth||bitmap.width:image.naturalWidth;
  const height=bitmap?bitmap.displayHeight||bitmap.height:image.naturalHeight;
  if(!width||!height)throw new Error("La imagen no tiene dimensiones válidas.");
  const maxSide=1600,scale=Math.min(1,maxSide/Math.max(width,height));
  const canvas=document.createElement("canvas");
  canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("No se pudo iniciar el conversor de imágenes.");
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(bitmap||image,0,0,canvas.width,canvas.height);
  const toBlob=q=>new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",q));
  const toBlobAlternative=q=>canvas.convertToBlob?canvas.convertToBlob({type:"image/jpeg",quality:q}):Promise.resolve(null);
  let blob=null;
  try{blob=await toBlob(0.86)}catch(err){console.warn("Canvas.toBlob falló:",err)}
  if(!blob){try{blob=await toBlobAlternative(0.86)}catch(err){console.warn("Canvas.convertToBlob falló:",err)}}
  if(!blob)throw new Error("El navegador no pudo convertir la imagen a JPG.");
  if(blob.size>4.7*1024*1024){
   try{blob=await toBlob(0.70)}catch(_){blob=null}
   if(!blob){try{blob=await toBlobAlternative(0.70)}catch(_){}}
  }
  if(!blob||blob.size>5*1024*1024)throw new Error("La foto supera los 5 MB después de optimizarla.");
  return new File([blob],"producto-"+Date.now()+".jpg",{type:"image/jpeg"});
 }finally{
  if(bitmap&&typeof bitmap.close==="function")try{bitmap.close()}catch(_){}
  try{decoder?.close()}catch(_){}
 }
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
  console.error("Photo preview error:",err);
  // Si Chrome Android no logra decodificar una imagen estándar, permitir subir
  // el archivo original sin recomprimirlo. Detectar el formato por su firma real.
  try{
   const head=new Uint8Array(await source.slice(0,16).arrayBuffer());
   let mime="",extension="";
   if(head[0]===0xff&&head[1]===0xd8&&head[2]===0xff){mime="image/jpeg";extension="jpg"}
   else if(head[0]===0x89&&head[1]===0x50&&head[2]===0x4e&&head[3]===0x47){mime="image/png";extension="png"}
   else if(head.length>=12&&String.fromCharCode(...head.slice(0,4))==="RIFF"&&String.fromCharCode(...head.slice(8,12))==="WEBP"){mime="image/webp";extension="webp"}
   if(mime){
    selectedPhoto=new File([source],"producto-original-"+Date.now()+"."+extension,{type:mime});
    message(dashboardMessage,"Chrome no pudo mostrar la vista previa, pero el archivo es "+extension.toUpperCase()+" válido. Puedes guardar el producto; se subirá la foto original sin modificar.",false);
    return;
   }
  }catch(fallbackError){console.warn("No se pudo validar la foto original:",fallbackError)}
  selectedPhoto=null;
  message(dashboardMessage,"Chrome no pudo leer ni validar esta foto. Prueba con una captura de pantalla de la imagen o con otra foto JPG, PNG o WEBP.",true);
 }
});
async function uploadProductPhoto(){if(!selectedPhoto)return null;const file=selectedPhoto;const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";const {data:{session}}=await db.auth.getSession();if(!session)throw new Error("Tu sesión caducó. Cierra sesión y vuelve a entrar.");const path=Date.now()+"-"+Math.random().toString(36).slice(2)+"."+ext;const {data,error}=await db.storage.from("menu-images").upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});if(error)throw new Error(error.message+" (Storage: menu-images)");const publicUrl=db.storage.from("menu-images").getPublicUrl(data.path).data.publicUrl;if(!publicUrl)throw new Error("La foto se subió, pero no se pudo obtener su dirección pública.");return publicUrl;}
$("#cancel-edit").addEventListener("click",resetProduct);
$("#product-list").addEventListener("click",async e=>{const t=e.target.closest("button");if(!t)return;if(t.dataset.edit){const p=products.find(x=>x.id===t.dataset.edit);$("#product-id").value=p.id;$("#product-name").value=p.name;$("#product-description").value=p.description||"";$("#product-price").value=p.price;$("#product-currency").value=p.currency||"";$("#product-category").value=p.category_id||"";selectedPhoto=null;clearPhotoPreview();if(p.image_url){$("#product-photo-preview").src=p.image_url;$("#product-photo-preview").hidden=false}$("#product-status").value=p.status;$("#product-form-title").textContent="Editar producto";$("#product-name").focus();window.scrollTo({top:0,behavior:"smooth"})}else if(t.dataset.delete){const p=products.find(x=>x.id===t.dataset.delete);if(!confirm('¿Eliminar "'+p.name+'" definitivamente?'))return;const {error}=await db.from("menu_products").delete().eq("id",p.id);if(error)message(dashboardMessage,error.message,true);else await loadData()}});
$("#product-form").addEventListener("submit",async e=>{
 e.preventDefault();
 const form=$("#product-form"),saveButton=form.querySelector('button[type="submit"]');
 if(saveButton.disabled)return;
 const id=$("#product-id").value;
 const item={name:$("#product-name").value.trim(),description:$("#product-description").value.trim(),price:Number($("#product-price").value),currency:$("#product-currency").value.trim(),category_id:$("#product-category").value||null,image_url:(id?(products.find(p=>p.id===id)?.image_url||null):null),status:$("#product-status").value};
 saveButton.disabled=true;saveButton.textContent="Guardando…";
 try{
  if(selectedPhoto){message(dashboardMessage,"Subiendo fotografía…");item.image_url=await uploadProductPhoto()}
  message(dashboardMessage,"Guardando producto en la base de datos…");
  const q=id?db.from("menu_products").update(item).eq("id",id):db.from("menu_products").insert(item);
  const {data,error}=await q.select("id").single();
  if(error)throw new Error(error.message);
  if(!data?.id)throw new Error("No se recibió confirmación del producto guardado. Actualiza la lista antes de repetirlo.");
  resetProduct();
  message(dashboardMessage,"Producto guardado. Actualizando la lista…");
  await loadData();
  message(dashboardMessage,"Producto guardado correctamente.");
 }catch(err){
  console.error("Product save failed:",err);
  message(dashboardMessage,"No se pudo completar el guardado: "+(err.message||"Error desconocido"),true);
 }finally{
  saveButton.disabled=false;saveButton.textContent="Guardar producto";
 }
});
db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT")showLogin()});
verifyAdmin();