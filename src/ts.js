const { Octokit } = require("@octokit/rest");
var request = require('request-promise');
var path = require("path");

var githubToken;
var testspaceUser;
var testspacePass;

/////////////////////////////////////////////////////////
const puppeteer = require('puppeteer');
global.browser
global.page
////////////////////////////////////////////////////////
module.exports = {

    sleep: async function(secs, text) {
        console.log("sleep ... [delay]",secs+"s", text)
        await new Promise(resolve => setTimeout(resolve, secs*1000));
    },

    startPuppet: async function() {
        browser = await puppeteer.launch({
            args: [
                '--window-size=1920,1080'
              ],
            headless: process.env.HEADLESS !== 'false'});
        page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1080 });
    },

    closePuppet: async function() {
        await browser.close();
    },

    setCreds: function( ghToken, tsCreds) {
        githubToken = ghToken;
        var testspace_cred = tsCreds.split(':');
        testspaceUser = testspace_cred[0];
        testspacePass = testspace_cred[1];
        console.log("Cred  ... [set  ] ****");
    },

    /*
    {
        repo: "myName",
        repoOrg: "s2testorg",
        repoTemplate: "s2technologies/testspace.test.spec/main.light", // Optional
        url: "https://s2testorg.stridespace.com",
    }
    */

    setProject: function( project) {
        const _handle = {};
        _handle.url   = project.url;
        _handle.name  = project.repoOrg+":"+project.repo;
        _handle.repoName = project.repo
        _handle.repoOrg  = project.repoOrg
        _handle.repoFullname = project.repoOrg+"/"+project.repo;
        _handle.template = project.repoTemplate;
        var branch = "main";
        if (project.repoTemplate) branch = path.basename(project.repoTemplate);
        _handle.space = branch;
        console.log("Proj  ... [set  ]",_handle.name, _handle.space);
        return _handle;
    },

    login: async function(handle) {
        await projectLogin(handle.url, testspaceUser, testspacePass);
    },

    gotoTab: async function(handle, tabName) {
        var tabURL = handle.url+"/projects/"+handle.name+"/spaces/"+handle.space+"/"+tabName;
        console.log("Url   ... [log  ]", tabURL);
        await page.goto(tabURL, { waitUntil: "networkidle0" });
    },

    // Uses Template
    addRepo: async function ( handle) {
        console.log("Repo  ... [add  ]", handle.repoName);
        var octokit = new Octokit({ auth: githubToken });
        var template       = handle.template.split("/")
        var templateOrg    = template[0];
        var templateRepo   = template[1];
        var templateBranch = template[2];
        await repoSetRepoDefaultBranch(octokit, templateOrg, templateRepo, templateBranch);
        await module.exports.sleep(2, "to allow default branch to settle");
        await octokit.repos.createUsingTemplate({
            template_owner: templateOrg,
            template_repo:  templateRepo,
            owner: handle.repoOrg,
            name:  handle.repoName,
            description: 'Auto-generated Repo'
        });
        await module.exports.sleep(2, "to allow new repo to settle");
    },

    newRepo: async function(handle) {
        console.log("Repo  ... [new  ]", handle.repoName);
        var octokit = new Octokit({ auth: githubToken });

        await octokit.rest.repos.createInOrg({
            org: handle.repoOrg,
            name:  handle.repoName,
            auto_init: true
        });
    },

    delRepo: async function ( handle) {
        console.log("Repo  ... [del  ]", handle.repoName, "(if exists)");
        var octokit = new Octokit({ auth: githubToken });
        var repoExist = await repoCheckExist(octokit, handle.repoOrg, handle.repoName);
        if (repoExist) {
            await octokit.repos.delete({
                owner: handle.repoOrg,
                repo:  handle.repoName,
            });
        } else {
            console.log("  no deletion: repo does not exist");
        }
    },

    writeRepoSpecs: async function ( handle, dir ) {
        console.log("Repo  ... [specs]");
        var theFiles = [];
        const commitMessage = 'test specs';
        const branch = handle.space;
        await readLocalFiles(dir,theFiles);
        var specFiles = await repoPrepSpecs(theFiles, dir, ".mdown");
        var octokit = new Octokit({ auth: githubToken });
        // Iterate over the list of files
        for (const file of specFiles) {
            // Set the path and contents of the file
            var { path, contents } = file
            console.log("  file:", path)
            try {
                // Create or update the file
                await octokit.repos.createOrUpdateFileContents({
                    owner: handle.repoOrg,
                    repo:  handle.repoName,
                    path:  path,
                    message: commitMessage,
                    content: Buffer.from(contents).toString('base64'),
                    branch
                })
            } catch (error) {
                console.error(`    ... Failed to write ${path} to repository: ${error}`)
            }
        }
    },

    writeRepoWorkflows: async function ( handle, dir ) {
        console.log("Repo  ... [workflows]");
        var theFiles = [];
        const commitMessage = 'test workflows';
        const branch = handle.space;
        await readLocalFiles(dir,theFiles);

        var specFiles = await repoPrepWorkflows(theFiles, dir);

        var octokit = new Octokit({ auth: githubToken });
        // Iterate over the list of files
        for (const file of specFiles) {
            // Set the path and contents of the file
            var { path, contents } = file
            console.log("  file:", file.path)
            try {
                // Create or update the file
                await octokit.repos.createOrUpdateFileContents({
                    owner: handle.repoOrg,
                    repo:  handle.repoName,
                    path:  path,
                    message: commitMessage,
                    content: Buffer.from(contents).toString('base64'),
                    branch
                })
            } catch (error) {
                console.error(`Failed to write ${path} to repository: ${error}`)
            }
        }
    },

    writeRepoConfig: async function ( handle, content ) {
        console.log("Repo  ... [config]");
        var octokit = new Octokit({ auth: githubToken });
        try {
            // Create or update the file
            await octokit.repos.createOrUpdateFileContents({
                owner: handle.repoOrg,
                repo:  handle.repoName,
                path:  ".testspace.yml",
                message: 'testspace configuration',
                content: Buffer.from(content).toString('base64'),
                branch: handle.space
            })
        } catch (error) {
            console.error(`ERROR: Failed to write ${path} to repository: ${error}`)
        }
    },

    // Uses API
    addProject: async function(handle) {
        console.log("Proj  ... [add  ]",handle.name);
        var ts_url = handle.url+"/api/projects";
        var requestData = { name: handle.name, service: "github" };
        var options = { url: ts_url, method: "POST", json: requestData, auth: {user: testspaceUser, password: testspacePass} };

        await request(options, function (err, res, body) {
            if (err) {
                console.debug('error:', err);
                console.debug('statusCode:', res.statusCode);
                console.debug('body:', body);
                return err;
            }
        });
        var status = await projectCheckIfManual(handle);
        return status;
    },

    // Uses UI
    newProject: async function(handle) {
        console.log("Proj  ... [new  ]",handle.name);

        const newProjButton = await page.waitForSelector('div.button > a > i.icon-plus');
        await newProjButton.click();

        const newProj = await page.waitForSelector('li[data-path='+'"'+handle.repoFullname+'"'+'] > div');
        await newProj.click();
        await page.keyboard.press('Enter');
        var status = await projectCheckIfManual(handle);
        return status;
    },

    delProject: async function(handle) {
        console.log("Proj  ... [del  ]", handle.name, "(if exists)");
        var ts_url = handle.url+"/api/projects/"+handle.name;

        var projectExist = await projectCheckExist(handle.url, testspaceUser, testspacePass, handle.name);
        if (projectExist) {

            var options = {
                url: ts_url,
                method: "DELETE",
                auth: {
                    user: testspaceUser,
                    password: testspacePass,
                }
            };

            await request(options, function (err, res, body) {
                if (err) {
                    console.debug('error:', err);
                    console.debug('statusCode:', res.statusCode);
                    console.debug('body:', body);
                    return err;
                }
            });

        } else {
            console.log("  no deletion: project does not exist");
        }
    },

    // Check does NOT work if "carrying" cases (i.e. cases not set have existing status)
    runSessions: async function(handle, sessions, check) {
        if (sessions.length != 0) {
            console.log("Test  ... [begin]", "sessions:",sessions.length,"(check:", check !== false,")");
            await projectRunSessions(page,  handle.url, testspaceUser, testspacePass, handle.name, handle.space, sessions,check);
            console.log("Test  ... [done ]", "sessions:",sessions.length,"(check:", check !== false,")");
        }
    },

    /* Selector Notes:
         td.assignee > details > summary
         td[data-value="specName"]
         //a[contains(text(), "userName")]
    */
    assignUser: async function (specName) {

        console.log("Sess  ... [user ]", specName, testspaceUser);

        /* Not working correct
        var r = await page.waitForSelector('td[data-value=\"'+specName+'\"]');
        await r.click();
        */

        const selectAssignee = await page.waitForSelector('td.assignee > details > summary');
        await selectAssignee.click();

        var selector = '//a[contains(text(), "'+testspaceUser+'")]'
        var element = await page.waitForXPath(selector); // Or var [element] = await page.$x(selector);
        await element.click();
    },

    runStandaloneSpec: async function(handle, specName, specCases, incFixtures) {
        sessionCaseCountsInit(); // Used to tracking
        var tabName = "manual";
        var tabURL = handle.url+"/projects/"+handle.name+"/spaces/"+handle.space+"/"+tabName;
        await page.goto(tabURL, { waitUntil: "networkidle0" });
        console.log("Url   ... [goto ]", tabURL);
        const standaloneSpec = true;
        await projectRunSpec(page, specName, specCases, standaloneSpec, incFixtures );
    },

    stopStandaloneSpec: async function(handle, specName) {
        await projectStopSpec(page, specName);
        var sessionName = "Run "+"'"+specName + "'"+ " spec";
        await sessionCaseCountsCheck(page, handle.url, testspaceUser,testspacePass, handle.name, handle.space, sessionName);
    },

    clearCaseIssues: async function(caseName) {
        console.log("      Case:    ",caseName);

        var document;
        // Selector uses "span" element with "title" = case name
        var caseTab = await page.waitForSelector('span[title='+'"'+caseName+'"'+']', {visible: true });
        await caseTab.click();
        var clickHere = await page.waitForSelector('div[title="Edit issues"]');
        await clickHere.click();

        // Select all text and delete
        await page.evaluate( () => document.execCommand( 'selectall', false, null ) );
        await page.keyboard.press('Enter');

        // Close the Issues dialog
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
    },

}

///////////////////////////////////////////////////////////////
// REPO
//////////////////////////////////////////////////////////////

async function repoCheckExist(octokit, org, repoMatch)
{
    // TEMP HACK: support local testing
    var list;

    if (org == "munderseth") {
        const { data: response1 } = await octokit.repos.listForAuthenticatedUser({
            username: org,
            sort: "created",
            per_page: 100,
            page: 1,
        });
        list = response1;
    } else {
        const { data: response2 } = await octokit.repos.listForOrg({
            org: org,
            sort: "created",
            per_page: 100,
            page: 1,
        });
        list = response2;
    }

    var i = 0;
    while (list[i]) {
        if (list[i].name == repoMatch) return true;
        i++;
    }
    return false;
}

async function repoSetRepoDefaultBranch(octokit, org, repo, branch)
{
    const { data: response } = await octokit.repos.get({
        owner: org,
        repo:  repo,
    });

    var currentBranch = response.default_branch;
    if (branch != currentBranch) {
        await octokit.repos.update({
            owner: org,
            repo:  repo,
            default_branch: branch,
        });
    }
    return currentBranch;
}

// Recursive routine
const fs = require('fs');
async function readLocalFiles(dir,theFiles) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const stats = fs.statSync(`${dir}/${file}`);
        if (stats.isFile()) {
            var data;
            var extension = path.extname(`${dir}/${file}`);
            // Requires different params for binary files
            if (extension === '.png') {
                data = fs.readFileSync(`${dir}/${file}`);
            } else {
                data = fs.readFileSync(`${dir}/${file}`, 'utf-8');
            }
            var aFile = {}
            aFile["path"] = `${dir}/${file}`;
            aFile["contents"] = data;
            theFiles.push(aFile);
        } else if (stats.isDirectory()) {
            readLocalFiles(`${dir}/${file}`,theFiles);
        }
    });
}

async function repoPrepSpecs(theFiles, root, extension) {
    let newFiles = theFiles.map(obj => {
        return { path: obj.path
                .replace(root, "specs")
                .replace(extension, ".md"),
                contents: obj.contents };
    });
    return newFiles
}

async function repoPrepWorkflows(theFiles, root) {
    let newFiles = theFiles.map(obj => {
        return { path: obj.path
                .replace(root, ".github/workflows"),
                contents: obj.contents };
    });
    return newFiles
}

///////////////////////////////////////////////////////////////
// PROJECT
//////////////////////////////////////////////////////////////

async function projectCheckExist(testspace_url, user, pass, projectMatch) {

    var ts_url = testspace_url+"/api/projects";
    var status;
    var options = {
        url: ts_url,
        method: "GET",
        auth: {
            user: user,
            password: pass
        },
        json: true
    };

    await request(options, (err, res, body) => {
        if (err) {
            console.debug(err);
            return;
        }
        status = false;
        var i=0;
        while (body[i]) {
            if (body[i].name == projectMatch) {
                status = true;
                break;
            }
            i++;
        }

    });
    return status;
}

async function projectCheckIfManual(handle) {

    await module.exports.sleep(3, "to allow new project to settle")
    // Need to Wait & Check that Space is of "Manual" type before going forward
    var ts_url = handle.url+"/api/projects/"+handle.name+"/spaces/"+handle.space;
    var options = { url: ts_url, method: "GET", auth: { user: testspaceUser, password: testspacePass } };

    var attempts=0;
    var obj;
    while (attempts < 60) {
        attempts++;
        await request(options, function (err, res, body) {
            if (err) {
                console.debug(err);
                if (err != 404)  return err;
                obj.type = 'null';
            }
            else {
                obj = JSON.parse(body);
            }
        });
        if (obj.type === 'manual') {
            console.log("  Space confirmed as:", obj.type,"attempts:", attempts);
            return true;
        } else {
            await module.exports.sleep(1, "Space not Manual yet:"+attempts);
        }
    }
    return false;
}

async function projectLogin(testspace_url, user, pass) {

    //var pages = await browser.pages(); // could use a new page (page = await browser.newPage();)
    //var page = pages[0]; // using only default tab created when launched

    console.log("Login ... [start]", testspace_url);
    var signin_url = testspace_url.replace(/\/\/[^.]*\./, "//signin.");
    await page.goto(signin_url);

    // Selectors: Unique Ids used for logging in
    await page.type('#session_username_or_email_address', user);
    await page.type('#session_password', pass);
    await page.keyboard.press('Enter');
    await page.waitForNetworkIdle();
}

async function projectGotoListing(page, testspace_url, project, space, group) {

    // NOTE: The "Manual" (unbounded) is selected in .json setting "listing": "Manual".
    var listingURL = testspace_url+'/projects/'+project+'/spaces/'+space+'/manual';
    await page.goto(listingURL, {waitUntil: 'domcontentloaded'});

    /* Other selector
        var theSelector = ("//a[contains(., "+"'"+group+"'"+")]");
        var suiteElement = await page.waitForXPath(theSelector);
        await suiteElement.click();
    */

    var theSelector = "a[title="+"'"+group+"'"+"]"
    const theGroup = await page.waitForSelector(theSelector);
    await theGroup.click();
    await page.waitForNetworkIdle();
}

async function projectRunSessions(page, testspace_url, user, pass, project, space, sessions, check=true) {

    projectLogSessions(sessions);

    for (var session of sessions) {
        console.log("Sess  ... [start]", "Name:", session.name, "Group:", session.group);
        await projectGotoListing(page, testspace_url, project, space, session.group);

        // Selecting "All" specs in the Group
        const newSession = await page.waitForSelector('div[class="three-state-checkbox bordered"]');
        await newSession.click();

        // Selecting the New Test Session link
        const newDialog = await page.waitForSelector('#new-test-session-link');
        await newDialog.click();

        // Use the Dialog "Name" field to write session name
        const sessionName = await page.waitForSelector('#test_session_name');
        await sessionName.type(session.name);
        await Promise.all([
            page.waitForNavigation({timeout: 1000*60*2}), // Using 2 minutes timeout for heavy loaded situations.
            page.keyboard.press('Enter')
        ]);
        await page.waitForSelector('div[title='+'"'+session.name+'"'+']');

        sessionCaseCountsInit(); // Used to tracking
        await projectRunSpecs(page, session.specs);
        await projectCompleteSession(page, session.name);

        // Checking if Session via API matches what is expected via UI control
        if (check == true ) {
            await sessionCaseCountsCheck(page, testspace_url, user, pass, project, space, session.name);
        }
    }
}

async function projectCompleteSession(page, sessionName) {
    var completeSession = await page.waitForSelector('div.test-session.selected a > .icon-checkmark-circle');
    await completeSession.click();
    // Waiting for the "YES" dialog confirmation
    var yes = await page.waitForSelector('button[type="submit"]');
    await Promise.all([
        page.waitForNavigation(),
        yes.click()
    ]);
    console.log("Sess  ... [compl]", "Name:", sessionName);
}

async function projectRunSpecs(page, specs) {
    var j = 0;
    while (specs[j]) {
        var spec = specs[j];
        j++;
        await projectRunSpec(page, spec.name, spec.cases, false, spec.fixture);
        await projectStopSpec(page, spec.name);
    }
}

async function projectRunSpec(page, specName, specCases, standalone, fixture) {

    console.log("Spec  ... [start]", specName, "(fixture:", fixture === true, ")");
    var select = ("//a[contains(., "+"'"+specName+"'"+")]");
    var specElement = await page.waitForXPath(select);
    await specElement.click();

    var clickHere = await page.waitForSelector('#spec-button');
    await clickHere.click();

    if (standalone) {
        var yes = await page.waitForSelector('button[type="submit"]');
        await yes.click();
    }
    await page.waitForNetworkIdle();
    await page.waitForSelector('div[class="editor-container"]', {timeout: 300000 });
    await projectRunCases(page, specCases);
}

async function projectStopSpec(page, specName) {
    var document;
    console.log("Spec  ... [stop ]", specName);
    var clickHere = await page.waitForSelector('#spec-button');
    await clickHere.click();

    // Support for "Carry prompt". If all cases have status there will be no prompt
    try {
        var carryPrompt = await page.waitForSelector('button[type="submit"]', {timeout: 1000});
        await carryPrompt.click();
    } catch {
        console.log("  no carry of cases");
    }
    await page.waitForNetworkIdle();
    await page.waitForSelector('div[class="centered-container hidden"]');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#session-spec-dialog'));
    await page.waitForNetworkIdle();
    await page.waitForFunction(() => !document.querySelector('.spinner'));
}

// Note, this routine is "not" robust, very timing dependent
async function projectRunCases(page, cases) {

    var k = 0;
    while (cases[k]) {
        var testcase = cases[k];
        console.log("Case  ... [run  ]", testcase.name, "=", testcase.status);
        // Selector uses "span" element with "title" = case name
        var caseTab = await page.waitForSelector('span[title='+'"'+testcase.name+'"'+']', {visible: true });
        await caseTab.click();
        await projectSetCaseStatus(page, testcase, k);
        k++;
    }
}

async function projectSetCaseStatus(page, testcase) {

    var keypress = {"Passed": 'passed', "Failed": 'failed', "Blocked": 'errored', "Not Applicable": 'not_applicable', "Untested": `tbd`};

    var status = testcase.status;
    if (status == 'Untested') { return }

    sessionCaseCountsTrack(status); // Used for tracking expected test results

    // Case is already focused. Using the "Tab" key to highlight STATUS.
    await page.click('div[data-value='+'"'+keypress[status]+'"'+']');
    await projecctAddComments(page, testcase);
}

async function projecctAddComments(page, testcase) {

    if (typeof testcase.comments != "undefined") {
        await page.waitForSelector('li[class="write-content"]');
        await page.click('li[class="write-content"]');
        for (const comment of testcase.comments) {
           // console.log("      adding comment:", comment, "\n");
            console.log("Case  ... [note ]", comment);
            await page.keyboard.type(comment+"<br>");
        }
    }
}

//////////////////////////////////////////////////////////////////
//
// Routines for verifying expected generated test results
//
/////////////////////////////////////////////////////////////////

var session_case_counts_tracking;

function sessionCaseCountsInit() {
    session_case_counts_tracking = {"Passed": 0, "Failed": 0, "Not Applicable": 0, "Blocked": 0};
}

function sessionCaseCountsTrack(status) {
    session_case_counts_tracking[status]++
}

async function sessionCaseCountsCheck(page, testspace_url, user, pass, project, space, name) {

    var session_case_counts;
    var ts_url = testspace_url+"/api/projects/"+project+"/spaces/"+space+"/results/"+name;
    var options = {
        url: ts_url,
        method: "GET",
        auth: { user: user, password: pass }
    };

    var attempts=0;
    var obj;
    while (attempts <= 60) {
        attempts++;
        await request(options, function (err, res, body) {
            if (err) { console.debug(err); return err; }
            obj = JSON.parse(body);
            session_case_counts = obj.session_case_counts.slice(0,4);
        });
        if (obj.complete && JSON.stringify(Object.values(session_case_counts_tracking)) == JSON.stringify(session_case_counts)) {
            break;
        } else {
            await module.exports.sleep(1, "Results still being checked:"+attempts);
        }
    }

    if (obj.complete === false) {
        await module.exports.sleep(1, "    Error: Results NEVER COMPLETED!");
        throw new Error(" Results NEVER COMPLETED");
    }

    if (JSON.stringify(Object.values(session_case_counts_tracking)) != JSON.stringify(session_case_counts)) {
        var checkError = "  CHECK ERROR: Expect " + JSON.stringify(session_case_counts_tracking) + " Got "+ JSON.stringify(session_case_counts)
        await module.exports.sleep(1, checkError);
        throw new Error(checkError);
    }
    console.log("Sess  ... [check]", name, "Expected:",session_case_counts_tracking , "Received:", session_case_counts);
}

function projectLogSessions(sessions) {

    var i = 0;
    while (sessions[i]) {
        var session = sessions[i];
        //console.debug("Listing:", session.listing, "Session:", session.name);
        i++;
        var j = 0;
        while (session.specs[j]) {
            var suite = session.specs[j];
            //console.debug("Spec:", spec.name);
            j++;
            var k = 0;
            while (suite.cases[k]) {
                //console.debug("Case:", suite.cases[k]);
                k++;
            }
        }
    }
}
