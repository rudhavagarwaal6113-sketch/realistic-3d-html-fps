import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js';

const scene=new THREE.Scene(); scene.background=new THREE.Color(0x101518); scene.fog=new THREE.FogExp2(0x101518,.012);
const camera=new THREE.PerspectiveCamera(74,innerWidth/innerHeight,.05,500); camera.position.set(0,1.7,8);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,1.8)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05; document.body.appendChild(renderer.domElement);
const hemi=new THREE.HemisphereLight(0xb9d2e0,0x222018,1.8); scene.add(hemi); const sun=new THREE.DirectionalLight(0xffe8c2,4); sun.position.set(-30,45,20); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-80;sun.shadow.camera.right=80;sun.shadow.camera.top=80;sun.shadow.camera.bottom=-80; scene.add(sun);
const controls=new PointerLockControls(camera,document.body); scene.add(camera);
const clock=new THREE.Clock(); const raycaster=new THREE.Raycaster(); const keys={}; let locked=false,paused=false; let health=100, ammo=30, reserve=120, reloading=false, lastShot=0, recoil=0, bob=0, velocityY=0, onGround=true, crouch=false, aiming=false;

function mat(c,r=.65,m=0){return new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});}
function box(w,h,d,c,x,y,z,cast=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;scene.add(m);return m;}
function cylinder(r,h,c,x,y,z){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),mat(c));m.position.set(x,y,z);m.castShadow=true;scene.add(m);return m;}

// Ground + environment
const ground=new THREE.Mesh(new THREE.PlaneGeometry(220,220),new THREE.MeshStandardMaterial({color:0x303633,roughness:.92})); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
for(let i=0;i<55;i++){const x=(Math.random()-.5)*130,z=(Math.random()-.5)*120;if(Math.abs(x)<12&&Math.abs(z)<18)continue; const h=2+Math.random()*9; box(2+Math.random()*5,h,2+Math.random()*5,Math.random()>.5?0x343a39:0x45443d,x,h/2,z);}
for(let i=-60;i<=60;i+=10){box(.18,.08,120,0x1d2423,i,.04,0,false);box(120,.08,.18,0x1d2423,0,.045,i,false);}
// cover
for(let i=0;i<20;i++){const x=(Math.random()-.5)*75,z=-8-Math.random()*60; const w=3+Math.random()*5,h=1.2+Math.random()*2; box(w,h,.7,0x3a3b37,x,h/2,z);}

// Weapon rig
const weapon=new THREE.Group(); camera.add(weapon); weapon.position.set(.38,-.36,-.62); weapon.rotation.set(-.03,.02,-.02);
const receiver=new THREE.Mesh(new THREE.BoxGeometry(.28,.22,.78),mat(0x202426,.32,.8));receiver.position.z=.05;receiver.castShadow=true;weapon.add(receiver);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.72,12),mat(0x111314,.25,.9));barrel.rotation.x=Math.PI/2;barrel.position.z=-.68;weapon.add(barrel);
const hand=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.28),mat(0x9a735e,.8,0));hand.position.set(-.08,-.08,-.28);weapon.add(hand);
const stock=new THREE.Mesh(new THREE.BoxGeometry(.18,.26,.45),mat(0x191b1c,.35,.6));stock.position.z=.55;weapon.add(stock);
const mag=new THREE.Mesh(new THREE.BoxGeometry(.15,.38,.22),mat(0x16191a,.4,.5));mag.position.set(0,-.22,.05);mag.rotation.x=-.2;weapon.add(mag);
const sight=new THREE.Mesh(new THREE.BoxGeometry(.05,.09,.14),mat(0x090a0b,.2,.9));sight.position.set(0,.14,-.1);weapon.add(sight);
const muzzle=new THREE.PointLight(0xffb35c,0,3);muzzle.position.z=-1.02;weapon.add(muzzle);

// Targets
const targets=[]; const targetGroup=new THREE.Group(); scene.add(targetGroup);
function makeTarget(x,z){const g=new THREE.Group();g.position.set(x,0,z);const body=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,1.55,20),mat(0x252a2b,.72,.15));body.position.y=1.15;body.castShadow=true;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.32,20,16),mat(0x8e9697,.6,.05));head.position.y=2.25;head.castShadow=true;g.add(head);const plate=new THREE.Mesh(new THREE.CircleGeometry(.24,20),mat(0xaab2b1,.3,.5));plate.position.set(0,1.4,.51);plate.rotation.y=Math.PI;g.add(plate);g.userData={hp:100,body,head,baseX:x,phase:Math.random()*6};targetGroup.add(g);targets.push(g)}
[[-10,-20],[0,-28],[11,-22],[-18,-40],[5,-47],[20,-38],[-5,-60],[30,-55],[-28,-52]].forEach(p=>makeTarget(...p));

function updateTargets(t){for(const g of targets){if(g.userData.hp<=0)continue;g.position.x=g.userData.baseX+Math.sin(t*.65+g.userData.phase)*2.2;g.rotation.y=Math.sin(t*.3+g.userData.phase)*.08;}}
function shoot(){if(!locked||reloading)return;if(Date.now()-lastShot<92)return;if(ammo<=0){reload();return}lastShot=Date.now();ammo--;recoil+=.055; muzzle.intensity=8;setTimeout(()=>muzzle.intensity=0,45); weapon.rotation.z=-.025; setTimeout(()=>weapon.rotation.z=-.02,55); updateUI();
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera); const hits=raycaster.intersectObjects(targetGroup.children.flatMap(g=>[g.userData.body,g.userData.head]),false); if(hits.length){const obj=hits[0].object;const target=targets.find(t=>t.userData.body===obj||t.userData.head===obj);if(target){const damage=obj===target.userData.head?100:34;target.userData.hp-=damage;hitFX(hits[0].point);showHit();if(target.userData.hp<=0){target.visible=false;feed('TARGET NEUTRALIZED','damage');setTimeout(()=>{target.visible=true;target.userData.hp=100},2600)}}}}
function hitFX(p){const g=new THREE.Group();for(let i=0;i<7;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.025,6,6),new THREE.MeshBasicMaterial({color:0xd5d0bd}));s.position.copy(p);s.userData.v=new THREE.Vector3((Math.random()-.5)*2,Math.random()*1.8,(Math.random()-.5)*2);g.add(s)}scene.add(g);setTimeout(()=>scene.remove(g),450);const st=performance.now();function f(){const q=(performance.now()-st)/450;g.children.forEach(s=>{s.position.addScaledVector(s.userData.v,.016);s.userData.v.y-=.05});if(q<1)requestAnimationFrame(f)}f()}
function showHit(){document.body.classList.add('hit');setTimeout(()=>document.body.classList.remove('hit'),75)}
function feed(text,cls=''){const el=document.createElement('div');el.className='feedline '+cls;el.textContent=text;document.getElementById('feed').appendChild(el);setTimeout(()=>el.remove(),2200)}
function reload(){if(reloading||ammo===30||reserve<=0)return;reloading=true;document.getElementById('weaponState').textContent='RELOADING';setTimeout(()=>{const n=Math.min(30-ammo,reserve);ammo+=n;reserve-=n;reloading=false;updateUI()},850)}
function updateUI(){document.getElementById('ammo').textContent=ammo;document.getElementById('health').textContent=Math.max(0,Math.round(health));document.getElementById('healthBar').style.width=health+'%';document.getElementById('weaponState').textContent=reloading?'RELOADING':aiming?'AIMING':'READY'}

addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyR')reload();if(e.code==='ControlLeft'||e.code==='ControlRight')crouch=true;if(e.code==='Escape'&&locked)controls.unlock()});
addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='ControlLeft'||e.code==='ControlRight')crouch=false});
addEventListener('mousedown',e=>{if(!locked)return;if(e.button===0)shoot();if(e.button===2){aiming=true;updateUI()}});addEventListener('mouseup',e=>{if(e.button===2){aiming=false;updateUI()}});addEventListener('contextmenu',e=>e.preventDefault());
controls.addEventListener('lock',()=>{locked=true;document.getElementById('menu').classList.add('hidden');document.getElementById('pause').classList.add('hidden')});controls.addEventListener('unlock',()=>{locked=false;document.getElementById('pause').classList.remove('hidden')});
document.getElementById('start').onclick=()=>controls.lock();document.getElementById('resume').onclick=()=>controls.lock();

function movement(dt){if(!locked)return;const speed=(keys.ShiftLeft||keys.ShiftRight?6.7:4.1)*(crouch?.48:1);const dir=new THREE.Vector3();if(keys.KeyW)dir.z-=1;if(keys.KeyS)dir.z+=1;if(keys.KeyA)dir.x-=1;if(keys.KeyD)dir.x+=1;if(dir.lengthSq()){dir.normalize();controls.moveRight(dir.x*speed*dt);controls.moveForward(dir.z*speed*dt);bob+=dt*(keys.ShiftLeft?12:8)}else bob+=dt*2;camera.position.y=THREE.MathUtils.lerp(camera.position.y,crouch?1.18:1.7,dt*12);if(keys.Space&&onGround){velocityY=5.2;onGround=false}velocityY-=14*dt;camera.position.y+=velocityY*dt;if(camera.position.y<= (crouch?1.18:1.7)){camera.position.y=crouch?1.18:1.7;velocityY=0;onGround=true}camera.position.x=Math.max(-70,Math.min(70,camera.position.x));camera.position.z=Math.max(-75,Math.min(75,camera.position.z));}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.033),t=clock.elapsedTime;movement(dt);updateTargets(t);recoil=THREE.MathUtils.lerp(recoil,0,dt*11);const moving=keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD;const sway=moving?Math.sin(bob)*.008:0;weapon.position.x=THREE.MathUtils.lerp(weapon.position.x,aiming?.04:.38,dt*10);weapon.position.y=THREE.MathUtils.lerp(weapon.position.y,aiming?-.27: -.36,dt*10);weapon.rotation.x=-.03+recoil;weapon.position.y+=sway;camera.fov=THREE.MathUtils.lerp(camera.fov,aiming?54:74,dt*10);camera.updateProjectionMatrix();renderer.render(scene,camera)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});updateUI();animate();
