const fs=require('node:fs'),path=require('node:path'),babel=require('@babel/core')
const root=path.join(__dirname,'..')
const original=require.extensions['.js']
require.extensions['.js']=(module,filename)=>{
 if(!filename.startsWith(path.join(root,'src')+path.sep))return original(module,filename)
 module._compile(babel.transformSync(fs.readFileSync(filename,'utf8'),{presets:[['@babel/preset-env',{targets:{node:'current'}}]]}).code,filename)
}
const {readCaseWorkbook,suggestMapping,validateImport}=require('../src/utils/importCases')
const {openRegister,normalize}=require('../desktop/database.cjs')
;(async()=>{
 const source=path.resolve(process.argv[2]||path.join(root,'highcourt_export.csv'))
 const destination=path.resolve(process.argv[3]||path.join(root,'data/initial-register.sqlite'))
 if(fs.existsSync(destination))throw new Error('Destination exists. Choose a new database filename to preserve it.')
 const sheets=await readCaseWorkbook(fs.readFileSync(source),source)
 const sheet=sheets[0],config={...suggestMapping(sheet.grid),headerRow:1,dateOrder:'DMY'}
 const review=validateImport(sheet,config)
 if(review.mappingErrors.length)throw new Error(review.mappingErrors.join(' '))
 for(const record of review.ready){try{normalize(record.data)}catch(error){record.status='invalid';record.errors.push(error.message)}}
 const ready=review.rows.filter(row=>row.status==='ready')
 const issues=review.rows.filter(row=>row.status!=='ready')
 const db=openRegister(destination)
 try{db.importRows(ready.map(row=>row.data))}finally{db.close()}
 const quote=value=>'"'+String(value??'').replace(/"/g,'""')+'"'
 const report=path.join(path.dirname(destination),'migration-review.csv')
 fs.writeFileSync(report,'\uFEFF'+[['Source row','Registration no.','Year','Status','Reason'],...issues.map(row=>[row.rowNumber,row.data.RegdNo,row.data.CYear,row.status,row.errors.join(' ')])].map(row=>row.map(quote).join(',')).join('\r\n'))
 const summary={source,destination,totalRows:review.rows.length,imported:ready.length,heldForReview:issues.length,report}
 fs.writeFileSync(path.join(path.dirname(destination),'migration-summary.json'),JSON.stringify(summary,null,2))
 console.log(JSON.stringify(summary,null,2))
})().catch(error=>{console.error(error.message);process.exitCode=1})
