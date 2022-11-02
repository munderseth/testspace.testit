var tf = require('@s2technologies/testspace.test.functions')
var fs = require('fs');

console.log("Args:", process.argv[2], process.argv[3])

var branch         = process.argv[2]
var sessions       = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

var testspace_cred = process.env.TESTSPACE_CRED.split(':');
var ghorg          = process.env.GHORG 
var repo           = process.env.REPO.split('/')

var testspace_user = testspace_cred[0];
var testspace_pass = testspace_cred[1]; 
var testspace_url  = "https://"+ghorg+".stridespace.com";
var project        = ghorg+":"+repo[1]; // 2nd part required

console.log("URL & Project", testspace_url, project);

async function main() {
    try{  
        await tf.projectNewSessions(testspace_url,testspace_user, testspace_pass, project, branch, sessions);
    } catch(err){
        console.log('Problem has occured!');
        console.log(err);
        process.exit(1);
    }

}
main();


