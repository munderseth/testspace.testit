# testspace.testit
The concept is to define **specs**, **test cases**, and **status** using an excel spreadsheet. A GitHub Workflow is used to generate the specs, push them to a branch, and then execute session(s) using the defined status. 
								
Spec|Spec Description | Tag	|Case 	|Case Description| Steps   | Status | Comments
----|-----------------|-----|-------|----------------|---------|--------|--------
One | This is a spec  | t1	|case 1 | Do something   | do this | P	    | 
One |                 | t1	|case 2 | Do something   | do that | F	    | this is a comment

Multiple **tabs** within the excel spreadsheet will be represented as groups in Testspace. 

## Basic Usage
This repo is a `template` to be used on the `s2testorg`. All credentials (secrets) have been set up - `TESTSPACE_CRED` and `GH_PAT_FOR_TF`.  

1. Create a new repo on [s2testorg](https://github.com/s2testorg) using this repo.
2. Create a new project using the repo on [s2testorg](https://s2testorg.stridespace.com/). 
3. Run the **`testit`** workflow manually.

**NOTES**:
- Make the new repo **public**, otherwise, the `secrets` will not be defined, a *Team* account is required for private org level secrets.  
- Specs generated are always committed to a **branch** and will overwrite any existing specs if the branch already exists. The default branch used is *testit*. You can also create new branches. 

### Changes
It is simple to create new specs.

1. Modify the `testit.xlsx` on your desktop. 
2. Use the [github.dev](https://docs.github.com/en/codespaces/the-githubdev-web-based-editor) web-based editor. Just use `.` on the repo.
3. Install via *Extensions* the `Excel Viewer` (takes ~2 seconds). This enables to modify existings cells.
4. Or drag and drop an updated file from your desktop and commit the changes. 

> Note, you can add other spreadsheets to the repo. To execute a different spreadsheet, pass in the name when running the workflow. 

## Technical
The following tools have been used in developing this utility: 
- [pandas](https://pandas.pydata.org/) for generating specs from excel
- [Jupyter Notebook](https://jupyter.org/) for developing the python script 
- [Puppeteer](https://pptr.dev/) for automating the Testspace UI using Javascript 
- GitHub Workflows - for executing automation independent of person's desktop
    - [Reusable Workflows](https://docs.github.com/en/actions/using-workflows/reusing-workflows) - used separate workflows 
    - [Git Auto Commit Action](https://github.com/stefanzweifel/git-auto-commit-action) - commiting generated specs
- [GitHub Codespaces](https://github.com/features/codespaces) - Just because I wanted to learn about it
- [GitHub Packages](https://github.com/features/packages) - Again, just because

### Excelsheet 
The following is an overview of the sheet format:
							
Spec|Spec Description | Tag	|Case 	|Case Description| Steps   | Status | Comments
----|-----------------|-----|-------|----------------|---------|--------|--------
One | This is a spec  | t1	|case 1 | Do something   | do this | P	    | 
One |                 | t1	|case 2 | Do something   | do that | F	    | this is a comment
Two | Another spec    | t2  |case 1 | Basic stuff    | check it |       | 
		

- For multiple cases repeat the Spec name
- Use new line in cel for `Steps` and `Comments`
- Status: `P | p`, `F | f`, `N | n` (NA)
- Status left `blank` is mapped to `Untested`
- Each `Tab` represents a group, if there is more than 1 tab

### Setup

#### Secrets

- `TESTSPACE_CRED` - "Username:Password"; either `super-admin` or `testuser`
- `GH_PAT_FOR_TF`  - `s2-testspace` GitHub Personal Access Token used for installing the *private* testspace test function package

#### Installation

```
pip install -r requirements.txt
```

```
npm install 
```

### Desktop Usage

To generate Specs for a **branch**:

```
git checkout -b testit
python generate.specs.py testit.xlsx
git add .
git commit -m "auto-gen specs"
git push origin testit
```

To run sessions:

Onetime setup:
```
export TESTSPACE_CRED="USERNAME:PASSWORD"  # Using super admins credentials 
export headless_chrome="false"  # not working in Codespaces
```
Project setup:
```
export GHORG="NAME"        # export GHORG=munderseth or s2testorg
export REPO="GHORG/BRANCH" # export REPO=munderseth/testspace.testit/testit
```
To run session(s):
```
node run.sessions.js BRANCH-NAME specs/allSessions.json  # node run.sessions.js testit specs/allSessions.json
```

Note, don't forget to make sure that the repo has access to the `TESTSPACE_CRED` secret. Refer to *personal* [Codespaces settings](https://github.com/settings/codespaces).

### Initial Setup

Create a `.testspace.yml` file:
```
manual:
  issues:
    provider: "github:disable/issues" # bad config, hack to disable 
release:
  - "*"
```

Create a `.gitignore` file:
```
node_modules
_site
.jekyll-cache
```

#### Python

Required for script:
```
pip install pandas
pip install openpyxl
```
- marketplace install `Excel Viewer`

Required for Notebook (Codespaces)

```
pip install ipykernel
python -m ipykernel install --user --name=testspace.testit
```


#### Javascript 
Note, don't forget to make sure that the repo has access to the `GH_PAT_FOR_TF` secret. Refer to *personal* [Codespaces settings](https://github.com/settings/codespaces).


- `npm init --yes`
- create `.npmrc` file at root
    ```
    @s2technologies:registry=https://npm.pkg.github.com
    //npm.pkg.github.com/:_authToken=${GH_PAT_FOR_TF}
    ```
- Install latest version - for example:
  ```
  npm install @s2technologies/testspace.test.functions
  ```