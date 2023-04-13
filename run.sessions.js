const ts = require('./src/ts');
const fs = require('fs');

console.log("Args:", process.argv[2], process.argv[3])

var branch         = process.argv[2]
var sessions       = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

ts.setCreds(process.env.GH_PAT_FOR_TF, process.env.TESTSPACE_CRED);

var repo           = process.env.REPO;
var ghorg          = process.env.GHORG;
var template       = ghorg+"/"+repo+"/"+branch;
var testspace_url  = "https://"+ghorg+".stridespace.com";

var project = {
    repo: repo,
    repoOrg: ghorg, 
    repoTemplate: template,  // the template "branch" defines the active Space
    url: testspace_url,
}

const testHandle = ts.setProject(project);

async function main() {
    try{  
        await ts.startPuppet();
        await ts.login(testHandle);
        await ts.runSessions(testHandle, sessions, true);
        await ts.closePuppet();
    } catch(err){
        console.log('Problem has occured!');
        console.log(err);
        process.exit(1);
    }
}
main();


