// __BEGIN_LICENSE__
//Copyright © 2015, United States Government, as represented by the 
//Administrator of the National Aeronautics and Space Administration. 
//All rights reserved.
//
//The xGDS platform is licensed under the Apache License, Version 2.0 
//(the "License"); you may not use this file except in compliance with the License. 
//You may obtain a copy of the License at 
//http://www.apache.org/licenses/LICENSE-2.0.
//
//Unless required by applicable law or agreed to in writing, software distributed 
//under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
//CONDITIONS OF ANY KIND, either express or implied. See the License for the 
//specific language governing permissions and limitations under the License.
// __END_LICENSE__

// This is a node.js JavaScript script. To run it:
// * Install Node.js (e.g. port install nodejs)
// * Install the Node Package Manager (e.g. port install npm)
// * Install the vows node package (e.g. npm install vows)
// * Install Kris Zyp's JSON schema validator from https://github.com/kriszyp/json-schema
//   into the json-schema subdir of this directory.
// * Run: node xpjsonValidateTest.js

// Note: It seems like "npm install json-schema" should be faster but it
// doesn't currently work.

var fs = require('fs');
var validate = require('./json-schema/lib/validate').validate;

function check(objPath, schemaPath) {
    var result;

    if (schemaPath) {
        console.log('Checking if ' + objPath + ' is consistent with ' + schemaPath + ':');
        var obj = JSON.parse(fs.readFileSync(objPath));
        var schema = JSON.parse(fs.readFileSync(schemaPath));
        result = validate(obj, schema);
    } else {
        var schemaPath = objPath;
        console.log('Checking if ' + schemaPath + ' is self-consistent');
        var schema = JSON.parse(fs.readFileSync(schemaPath));
        result = validate(schema);
    }

    if (result.valid) {
        console.log('  PASSED');
    } else {
        console.log('  FAILED');
        console.log(result.errors);
    }
}

function checkBoth(objPath, schemaPath) {
    check(schemaPath);
    check(objPath, schemaPath);
}

checkBoth('examplePlan.json', 'xpjsonPlanDocumentSchema.json');
checkBoth('examplePlanSchema.json', 'xpjsonPlanSchemaDocumentSchema.json');
checkBoth('examplePlanLibrary.json', 'xpjsonPlanLibraryDocumentSchema.json');
