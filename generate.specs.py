# %% [markdown]
# ## Init

# %%
import pandas as pd
import numpy as np
import os
import json
import sys

# %%
# Global Stats
numOfGroups    = 0
numOfSpecs     = 0
numOfCases     = 0
numOfPassing   = 0
numOfFailing   = 0
numOfNA        = 0
numOfUntested  = 0 # TBD

# %% [markdown]
# ## Helpers

# %%
def getFile(name):
    return open(name+".md", "w")

# %%
def cleanSheetData(excel_file, sheet_name):
    COL_NUM  = 1
    COL_NAME = "Spec"
    rawData = pd.read_excel(excel_file, header=None, sheet_name=sheet_name)
    
    starting_row = rawData[rawData[COL_NUM].eq(COL_NAME)].index.values[0]
    rawData[COL_NUM].replace(' ', np.nan, inplace = True) # Removing empty cells
    num_of_rows = rawData[COL_NUM].count()-1
    sheet_df = pd.read_excel(excel_file, header=starting_row, nrows=num_of_rows, sheet_name=sheet_name)
    
    # Remove bad characters & extra spaces
    sheet_df.replace(r'[^\x00-\x7f]', ' ', regex=True, inplace=True)
    sheet_df.replace(r'^\s+$', np.nan, regex=True, inplace=True)
    
    sheet_df['Spec Description'].fillna("*Missing: Add description info here*", inplace = True)
    sheet_df['Tag'].fillna("None", inplace = True)
    sheet_df['Case'].fillna("Unknown", inplace = True)
    sheet_df['Case Description'].fillna("*Missing: Add description info here*", inplace = True)
    sheet_df['Steps'].fillna("Do Something", inplace = True)
    
    # If column does not exist, create one with all "na"
    col_rst = 'Status'
    if col_rst not in sheet_df.columns:
        sheet_df[col_rst] = np.nan 
    #sheet_df[col_rst].fillna("Not Applicable", inplace = True)

    sheet_df['Status'].replace('P', 'Passed', inplace=True)
    sheet_df['Status'].replace('p', 'Passed', inplace=True)
    sheet_df['Status'].replace('F', 'Failed', inplace=True)
    sheet_df['Status'].replace('f', 'Failed', inplace=True)
    sheet_df['Status'].replace('N', 'Not Applicable', inplace=True)
    sheet_df['Status'].replace('n', 'Not Applicable', inplace=True)
    sheet_df['Status'].fillna("Untested", inplace = True)

    col = 'Comments'
    if col not in sheet_df.columns:
        sheet_df[col] = np.nan 
    sheet_df[col].fillna("", inplace = True)

    return sheet_df

# %% [markdown]
# ## Spec Generation

# %%
def theCase(f, case):

    global numOfCases
    numOfCases = numOfCases + 1

    f.write("## "+case['Case']+"\n")
    f.write(case['Case Description']+"\n\n")
    f.write("*Tag:* `"+case['Tag']+'`\n\n')
    f.write("**Steps:** \n\n")
    f.write(case['Steps']+"\n\n")
  
    # Return a case dictionary 
    caseDict = {}
    caseDict["name"]    = case['Case']
    caseDict["status"]  = case['Status']
    caseDict["defect"]  = False
    comments = []
    if case['Comments'] != "": comments.append(case['Comments'])
    caseDict["comments"] = comments
    
    return caseDict

def theSpec(f, specName, specDescription, groupName):
    f.write("---\n")
    f.write("testspace: true\n")
    f.write("title: ")
    f.write(specName+"\n")
    f.write("parent: ")
    f.write(groupName+"\n")
    f.write("---\n\n")
    f.write("{% if page %} {% assign spec = page %} {% endif %} \n\n")
    f.write("# {{ spec.title }} \n\n")
    f.write(specDescription+"\n")
    return
    
def theSpecs(sheet_df, group_name, file_path):

    global numOfSpecs
     
    testSpecs  = sheet_df.loc[:, ('Spec')].unique()
    numOfSpecs = numOfSpecs + len(testSpecs)

    # Create a list of Spec dictionaries 
    specs = []
    for spec_name in testSpecs: 

        spec_df = sheet_df[sheet_df.loc[:,('Spec')].eq(spec_name)]
        spec_df.reset_index(drop=True, inplace=True)
        #spec_usecase = spec_df.loc[(0), 'Usecase'] # Use 1st entry for the Usecase name

        file_name = file_path+"/"+spec_name
        f = getFile(file_name)
        theSpec(f, spec_name, spec_df.loc[(0), 'Spec Description'], group_name)

        # Create a list of Case dictionaries 
        cases = []
        for index, row in spec_df.iterrows():
            case = theCase(f, row)
            if case: cases.append(case)

        # Spec dictionary; if "all automated cases" do NOT create the item
        specDict = {}
        specDict["name"]  = spec_name
        specDict["cases"] = cases
        specs.append(specDict)

        f.write(" \n")
        f.close()       
    
    return specs
    
def theGroup(sheet_name, totalGroups):
    SPECS_PATH = "./specs/"
    if totalGroups > 1:
        file_path = SPECS_PATH+sheet_name
    else:
        file_path = SPECS_PATH
    if not os.path.exists(file_path):
        os.makedirs(file_path)

    # Creating a Group index to support "Sections" in Jekyll using "Just the Docs" theme
    if totalGroups > 1:
        file_name = file_path+"/"+"index"
        f = getFile(file_name)
        f.write("---\n")
        f.write("layout: default\n")
        f.write("title: ")
        f.write(sheet_name+"\n")
        f.write("has_children: true\n")
        f.write("---\n")

    return file_path

# %%
def generateSpecs(specdata):
    
    global numOfGroups
    global numOfSpecs
    global numOfCases     
    global numOfPassing   
    global numOfFailing
    global numOfNA
    global numOfUntested

    # Array of Group dictionaries, each representing its own Session
    allSessions = []

    # Read the list of Sheets (tabs)
    testdata_file = specdata
    xls = pd.ExcelFile(testdata_file)
    numOfGroups = len(xls.sheet_names)
    for sheet_name in xls.sheet_names:
        sheet_df  = cleanSheetData(testdata_file, sheet_name)
        file_path = theGroup(sheet_name, numOfGroups)
        print("processing sheet:", sheet_name, numOfGroups)

        passing  = sheet_df['Status'].eq('Passed').sum()
        failing  = sheet_df['Status'].eq('Failed').sum()
        na       = sheet_df['Status'].eq('Not Applicable').sum()
        untested = sheet_df['Status'].eq('Untested').sum()
        cases    = passing+failing+na+untested

        numOfPassing  = numOfPassing  + passing
        numOfFailing  = numOfFailing  + failing
        numOfNA       = numOfNA       + na
        numOfUntested = numOfUntested + untested
        
        # Each group contains an array of Spec dictionaries 
        specs = theSpecs(sheet_df, sheet_name, file_path)
        
        # Session JSON files; 1 per group
        session = []
        sessionDict = {}
        group = sheet_name
        if numOfGroups == 1: group = "·Overall·"
        sessionDict["group"]    = group
        sessionDict["name"]     = sheet_name+".session.01"
        sessionDict["cases"]    = int(cases)
        sessionDict["passing"]  = int(passing)
        sessionDict["failing"]  = int(failing)
        sessionDict["na"]       = int(na)
        sessionDict["untested"] = int(untested)
        sessionDict["specs"]    = specs
        session.append(sessionDict)
        allSessions.append(sessionDict) # creating an "All" sessions file
        #file_name = file_path+"/"+spec_name
        f = open(file_path+"/"+sheet_name+".json", "w")
        f.write(json.dumps(session,indent = 4, sort_keys=True))
        f.close()


    f = open("./specs/allSessions.json", "w")
    f.write(json.dumps(allSessions,indent = 4, sort_keys=True))
    f.close()

    xls.close()

def specStats():

    global numOfGroups
    global numOfSpecs
    global numOfCases     
    global numOfPassing   
    global numOfFailing
    global numOfNA
    global numOfUntested
    
    ####################################################################
    # STATS
    ####################################################################
    print("")
    print("Groups:        {} ".format(numOfGroups))
    print("Specs:         {} ".format(numOfSpecs))
    print("Cases:         {}".format(numOfCases))
    print("  Passing:  {}".format(numOfPassing))
    print("  Failing:  {}".format(numOfFailing))
    print("  NA:       {}".format(numOfNA))
    print("  Untested: {}".format(numOfUntested))

    allSessionsStats = {}
    allSessionsStats["Groups"]   = int(numOfGroups)
    allSessionsStats["Specs"]    = int(numOfSpecs)
    allSessionsStats["Cases"]    = int(numOfPassing + numOfFailing + numOfNA+numOfUntested)
    allSessionsStats["Passing"]  = int(numOfPassing)
    allSessionsStats["Failing"]  = int(numOfFailing)
    allSessionsStats["NA"]       = int(numOfNA)
    allSessionsStats["Untested"] = int(numOfUntested)

    f = open("./specs/allSessionsStats.json", "w")
    f.write(json.dumps(allSessionsStats,indent = 4, sort_keys=True))
    f.close()


# %% [markdown]
# ## Run

# %%
sheet = sys.argv[1]
generateSpecs(sheet)
specStats()


