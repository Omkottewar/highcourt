const {app}=require('electron')
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const root=path.join(__dirname,'..')
const profile=process.argv.includes('--repeat')?fs.readFileSync(path.join(root,'.cache/seed-profile.txt'),'utf8'):fs.mkdtempSync(path.join(root,'.cache/seed-start-'))
fs.writeFileSync(path.join(root,'.cache/seed-profile.txt'),profile)
app.setPath('userData',profile);app.disableHardwareAcceleration()
const packaged=process.argv.includes('--packaged')
const appRoot=packaged?path.join(root,'desktop-dist/win-unpacked/resources/app.asar'):root
if(packaged){Object.defineProperty(app,'isPackaged',{value:true});Object.defineProperty(process,'resourcesPath',{value:path.join(root,'desktop-dist/win-unpacked/resources')})}
let main
app.on('browser-window-created',(_,win)=>{if(!main){main=win;win.show=()=>{}}})
require(path.join(appRoot,'desktop/main.cjs'))
app.whenReady().then(async()=>{
 try {
  for(let i=0;i<200&&(!main||main.webContents.isLoading());i++)await new Promise(r=>setTimeout(r,100))
  const db=async(op,payload)=>{const r=await main.webContents.executeJavaScript(`window.desktop.database(${JSON.stringify(op)},${JSON.stringify(payload)||'undefined'})`);if(r.error)throw new Error(r.error);return r.value}
  const info=await db('info')
  if(process.argv.includes('--repeat')) {
   assert.equal(info.count,52501)
   await db('delete',{RegdNo:9000000000000,CYear:'2026'})
   assert.equal((await db('info')).count,52500)
   console.log('PASS: second startup preserves locally added records rather than overwriting with the seed')
  } else {
   assert.equal(info.count,52500)
   await db('create',{RegdNo:9000000000000,CYear:'2026',Petitioner:'SYNTHETIC STARTUP PERSISTENCE TEST'})
   assert.equal((await db('all',{})).data.length,52501)
   console.log('PASS: first startup initializes all 52,500 migrated records and exports the full local register')
  }
  app.quit()
 }catch(error){console.error(error);app.exit(1)}
})
