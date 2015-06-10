
Main Stuff
==========

 * xpjson.rst - Specification for XPJSON
 * examplePlan.json - An example XPJSON plan
 * examplePlanSchema.json - An example XPSJSON plan schema
 * examplePlanLibrary.json - An example XPSJSON plan library

Validation Tests
================

 * xpjsonPlanDocumentSchema.js - jsonschema for XPJSON Plan documents
 * xpjsonPlanSchemaDocumentSchema.js - jsonschema for XPJSON PlanSchema documents
 * xpjsonPlanLibraryDocumentSchema.js - jsonschema for XPJSON PlanLibrary documents
 * jsonSchemaValidate.py - script for validating files with Python jsonschema module
 * xpjsonValidateTest.sh - validates examplePlan*.json with Python jsonschema module
 * xpjsonValidateTest.js - validates examplePlan*.json with Kris Zyp's JavaScript validator
 * validate.html - Non-working attempt to test dojox.json.schema validator

Build
=====

Type 'make' to generate xpjson.html from xpjson.rst. Requires
rst2html.py script to be in your PATH (e.g.  pip install docutils).

.. o  __BEGIN_LICENSE__
.. o Copyright (c) 2015, United States Government, as represented by the 
.. o Administrator of the National Aeronautics and Space Administration. 
.. o All rights reserved.
.. o 
.. o The xGDS platform is licensed under the Apache License, Version 2.0 
.. o (the "License"); you may not use this file except in compliance with the License. 
.. o You may obtain a copy of the License at 
.. o http://www.apache.org/licenses/LICENSE-2.0.
.. o 
.. o Unless required by applicable law or agreed to in writing, software distributed 
.. o under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
.. o CONDITIONS OF ANY KIND, either express or implied. See the License for the 
.. o specific language governing permissions and limitations under the License.
.. o  __END_LICENSE__
