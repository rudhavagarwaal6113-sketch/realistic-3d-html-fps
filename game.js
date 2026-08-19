const THREE = window.THREE;
if (!THREE) throw new Error('Three.js did not load. Check your internet connection or CDN access.');

class FPSControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.isLocked = false;
    this.yaw = 0;
    this.pitch = 0;
    this.listeners = { lock: [], unlock: [] };
    domElement.addEventListener('mousemove', e => {
      if (!this.isLocked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.48, Math.min(1.48, this.pitch));
      camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    });
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === domElement;
      (this.listeners[this.isLocked ? 'lock' : 'unlock'] || []).forEach(fn => fn());
    });
  }
  addEventListener(type, fn) { if (this.listeners[type]) this.listeners[type].push(fn); }
  lock() { this.domElement.requestPointerLock(); }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  moveRight(distance) { this.camera.translateX(distance); }
  moveForward(distance) { this.camera.translateZ(distance); }
}
const PointerLockControls = FPSControls;

const scene=new THREE.Scene(); scene.background=new THREE.Color(0x090b0d); scene.fog=new THREE.FogExp2(0x090b0d,.009);
const camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.05,700); camera.position.set(0,1.7,8);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); renderer.setSize(innerWidth,innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio,1.8)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08; document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xbfd8e8,0x17120d,1.8)); const sun=new THREE.DirectionalLight(0xffe6c2,4); sun.position.set(-35,45,20); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-90; sun.shadow.camera.right=90; sun.shadow.camera.top=90; sun.shadow.camera.bottom=-90; scene.add(sun);
const controls=new PointerLockControls(camera,document.body); scene.add(camera); const clock=new THREE.Clock(),raycaster=new THREE.Raycaster(); const keys={}; let locked=false,health=100,ammo=30,reserve=120,reloading=false,aiming=false,lastShot=0,recoil=0,bob=0,vy=0,grounded=true,crouch=false,kills=0,score=0,damageFlash=0;
const mat=(c,r=.7,m=.05)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
function box(w,h,d,c,x,y,z,cast=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;scene.add(m);return m}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(240,240),mat(0x343938,.96)); ground.rotation.x=-Math.PI/2; ground.receiveShadow=true; scene.add(ground);
for(let i=0;i<70;i++){const x=(Math.random()-.5)*150,z=(Math.random()-.5)*130;if(Math.abs(x)<14&&Math.abs(z)<18)continue;box(2+Math.random()*6,2+Math.random()*10,2+Math.random()*6,Math.random()>.5?0x34383a:0x45433d,x,Math.random()*5,z)}
for(let x=-60;x<=60;x+=10){box(.18,.08,120,0x202524,x,.04,0,false);box(120,.08,.18,0x202524,0,.04,x,false)}
const weapon=new THREE.Group(); camera.add(weapon); weapon.position.set(.36,-.35,-.62); weapon.rotation.set(-.04,.02,-.02);
const receiver=new THREE.Mesh(new THREE.BoxGeometry(.3,.22,.8),mat(0x25282a,.32,.7));receiver.position.z=.05;receiver.castShadow=true;weapon.add(receiver);
const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.036,.042,.72,16),mat(0x111315,.2,.9));barrel.rotation.x=Math.PI/2;barrel.position.z=-.7;weapon.add(barrel);
const hand=new THREE.Mesh(new THREE.BoxGeometry(.2,.18,.3),mat(0x9a6c52,.9,0));hand.position.set(-.09,-.08,-.28);weapon.add(hand);
const stock=new THREE.Mesh(new THREE.BoxGeometry(.18,.25,.48),mat(0x16191b,.55,.35));stock.position.z=.57;weapon.add(stock);
const sight=new THREE.Mesh(new THREE.BoxGeometry(.055,.09,.18),mat(0x090a0b,.25,.7));sight.position.set(0,.16,-.1);weapon.add(sight);
const muzzle=new THREE.PointLight(0xffb35c,0,8); muzzle.position.z=-1.05; weapon.add(muzzle);
const targets=[];
function target(x,z){const g=new THREE.Group();g.position.set(x,0,z);const body=new THREE.Mesh(new THREE.CylinderGeometry(.42,.5,1.55,20),mat(0x263238,.55,.15));body.position.y=1.15;body.castShadow=true;const head=new THREE.Mesh(new THREE.SphereGeometry(.31,20,16),mat(0x6d7775,.65,.05));head.position.y=2.2;head.castShadow=true;const plate=new THREE.Mesh(new THREE.CircleGeometry(.24,20),mat(0xb2a56f,.7,.1));plate.rotation.y=Math.PI;plate.position.set(0,1.42,.51);const rifle=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.85),mat(0x151719,.3,.75));rifle.position.set(.48,1.35,.32);rifle.rotation.x=-.06;rifle.castShadow=true;const emuzzle=new THREE.Mesh(new THREE.SphereGeometry(.055,8,8),new THREE.MeshBasicMaterial({color:0xffb35c}));emuzzle.position.z=-.46;emuzzle.visible=false;rifle.add(emuzzle);g.add(body,head,plate,rifle);g.userData={body,head,rifle,emuzzle,hp:100,baseX:x,phase:Math.random()*6.28,speed:.5+Math.random()*.8,alive:true,alert:0,lastFire:0};scene.add(g);targets.push(g)}
function enemyTracer(g,start,end,onImpact){const geom=new THREE.BufferGeometry().setFromPoints([start,end]);const line=new THREE.Line(geom,new THREE.LineBasicMaterial({color:0xffc15a,transparent:true,opacity:.95}));scene.add(line);g.userData.emuzzle.visible=true;setTimeout(()=>g.userData.emuzzle.visible=false,55);setTimeout(()=>{scene.remove(line);if(onImpact)onImpact()},110)}
function enemyFire(g,playerPos){const muzzle=new THREE.Vector3();g.userData.emuzzle.getWorldPosition(muzzle);const targetPos=playerPos.clone();enemyTracer(g,muzzle,targetPos,()=>{const now=camera.position.clone();if(now.distanceTo(targetPos)<.9){damageFlash=.5;health=Math.max(0,health-8);showHit('HIT','damage');updateUI()}})}
[[-10,-18],[0,-27],[11,-22],[-18,-39],[7,-48],[22,-38],[-30,-55],[30,-60]].forEach(p=>target(...p));
function hitFX(p,head=false){const g=new THREE.Group();for(let i=0;i<8;i++){const s=new THREE.Mesh(new THREE.SphereGeometry(.025,6,6),new THREE.MeshBasicMaterial({color:head?0xffd56a:0xe7e7e7}));s.position.copy(p);s.userData.v=new THREE.Vector3((Math.random()-.5)*2,Math.random()*1.8,(Math.random()-.5)*2);g.add(s)}scene.add(g);const start=performance.now();(function f(){const k=(performance.now()-start)/380;g.children.forEach(s=>{s.position.addScaledVector(s.userData.v,.016);s.userData.v.y-=.04});if(k<1)requestAnimationFrame(f);else scene.remove(g)})()}
function shoot(){if(!locked||reloading)return;if(performance.now()-lastShot<105)return;if(ammo<=0){reload();return}lastShot=performance.now();ammo--;recoil+=aiming?.035:.065;muzzle.intensity=10;setTimeout(()=>muzzle.intensity=0,45);weapon.rotation.z=-.045;setTimeout(()=>weapon.rotation.z=-.02,65);raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const hits=raycaster.intersectObjects(targets.flatMap(t=>[t.userData.body,t.userData.head]),false);if(hits.length){const o=hits[0].object,t=targets.find(x=>x.userData.body===o||x.userData.head===o);if(t&&t.userData.alive){const head=o===t.userData.head,d=head?100:34;t.userData.hp-=d;t.userData.alert=1;hitFX(hits[0].point,head);showHit(head?'HEADSHOT':d+' DAMAGE',head?'head':'');if(t.userData.hp<=0){t.userData.alive=false;t.visible=false;kills++;score+=head?150:100;setTimeout(()=>{t.userData.hp=100;t.userData.alive=true;t.visible=true;t.position.set(t.userData.baseX,0,t.position.z);},1800)}}}updateUI()}
function reload(){if(reloading||ammo===30||reserve<=0)return;reloading=true;updateUI();setTimeout(()=>{const n=Math.min(30-ammo,reserve);ammo+=n;reserve-=n;reloading=false;updateUI()},1050)}
function showHit(text,cls=''){const e=document.getElementById('hittext');if(!e)return;e.textContent=text;e.className='show '+cls;setTimeout(()=>e.className='',420)}
function updateTargets(t){
  for(const g of targets){
    if(!g.userData.alive) continue;
    g.position.x=g.userData.baseX+Math.sin(t*g.userData.speed+g.userData.phase)*3.2;
    const eye=new THREE.Vector3(); camera.getWorldPosition(eye);
    const enemyEye=new THREE.Vector3(); g.userData.head.getWorldPosition(enemyEye);
    const toPlayer=eye.clone().sub(enemyEye); const dist=toPlayer.length();
    if(dist<28){
      const flat=toPlayer.clone(); flat.y=0;
      if(flat.lengthSq()>0.01){
        const desired=Math.atan2(flat.x,flat.z); let d=desired-g.rotation.y;
        d=Math.atan2(Math.sin(d),Math.cos(d)); g.rotation.y+=d*0.08;
      }
      const dir=toPlayer.clone().normalize();
      const los=new THREE.Raycaster(enemyEye,dir,0,dist);
      const blockers=los.intersectObjects(scene.children,true).filter(h=>h.object!==g.userData.body&&h.object!==g.userData.head&&h.object!==g.userData.rifle&&h.object!==g.userData.emuzzle&&h.object!==weapon&&h.object!==camera);
      if(!blockers.length){
        g.userData.alert=1;
        if(t-g.userData.lastFire>1.6&&Math.random()<0.035){g.userData.lastFire=t;enemyFire(g,eye)}
      }
    }
  }
}
function updateUI(){const ammoEl=document.getElementById('ammo'),reserveEl=document.getElementById('reserve'),healthEl=document.getElementById('health'),barEl=document.getElementById('healthBar'),stateEl=document.getElementById('weaponState'),scoreEl=document.getElementById('score'),killsEl=document.getElementById('kills');if(ammoEl)ammoEl.textContent=ammo;if(reserveEl)reserveEl.textContent='/ '+reserve;if(healthEl)healthEl.textContent=Math.round(health);if(barEl)barEl.style.width=health+'%';if(stateEl)stateEl.textContent=reloading?'RELOADING':aiming?'ADS':'READY';if(scoreEl)scoreEl.textContent=String(score).padStart(5,'0');if(killsEl)killsEl.textContent=String(kills).padStart(2,'0')}
addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='KeyR')reload();if(e.code==='ControlLeft'||e.code==='ControlRight')crouch=true;if(e.code==='Escape'&&locked)controls.unlock()});addEventListener('keyup',e=>{keys[e.code]=false;if(e.code==='ControlLeft'||e.code==='ControlRight')crouch=false});addEventListener('mousedown',e=>{if(!locked)return;if(e.button===0)shoot();if(e.button===2){aiming=true;updateUI()}});addEventListener('mouseup',e=>{if(e.button===2){aiming=false;updateUI()}});addEventListener('contextmenu',e=>e.preventDefault());controls.addEventListener('lock',()=>{locked=true;document.getElementById('menu').classList.add('hidden');document.getElementById('hud').classList.remove('hidden');document.getElementById('pause').classList.add('hidden')});controls.addEventListener('unlock',()=>{locked=false;document.getElementById('pause').classList.remove('hidden')});document.getElementById('start').onclick=()=>controls.lock();document.getElementById('resume').onclick=()=>controls.lock();
function move(dt){if(!locked)return;const speed=(keys.ShiftLeft||keys.ShiftRight)?6.8:4.2;const s=crouch?.55:1;const inputX=(keys.KeyD?1:0)-(keys.KeyA?1:0);const inputZ=(keys.KeyW?1:0)-(keys.KeyS?1:0);if(inputX||inputZ){const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);forward.y=0;forward.normalize();const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);right.y=0;right.normalize();camera.position.addScaledVector(forward,inputZ*speed*s*dt);camera.position.addScaledVector(right,inputX*speed*s*dt);bob+=dt*(keys.ShiftLeft?12:8)}else bob+=dt*2;const floor=crouch?1.2:1.7;if(keys.Space&&grounded&&!crouch){vy=5.2;grounded=false}vy-=14*dt;camera.position.y+=vy*dt;if(camera.position.y<=floor){camera.position.y=floor;vy=0;grounded=true}camera.position.x=THREE.MathUtils.clamp(camera.position.x,-70,70);camera.position.z=THREE.MathUtils.clamp(camera.position.z,-75,75)}
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.033),t=clock.elapsedTime;move(dt);updateTargets(t);recoil=THREE.MathUtils.lerp(recoil,0,dt*11);const moving=keys.KeyW||keys.KeyA||keys.KeyS||keys.KeyD;const sway=moving?Math.sin(bob)*.008:0;weapon.position.x=THREE.MathUtils.lerp(weapon.position.x,aiming?.18:.36,dt*10);weapon.position.y=THREE.MathUtils.lerp(weapon.position.y,aiming?-.28:-.35,dt*10)+sway;weapon.position.z=THREE.MathUtils.lerp(weapon.position.z,aiming?-.52:-.62,dt*10);weapon.rotation.x=-.04-recoil;camera.fov=THREE.MathUtils.lerp(camera.fov,aiming?58:70,dt*12);camera.updateProjectionMatrix();if(damageFlash>0){damageFlash=Math.max(0,damageFlash-dt);document.body.style.setProperty('--damage',damageFlash*.28)}else document.body.style.setProperty('--damage','0');renderer.render(scene,camera)}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});updateUI();animate();