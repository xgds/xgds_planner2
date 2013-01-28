
Main Stuff
==========

 * xpjson.rst - Specification for XPJSON and XPSJSON
 * examplePlan.json - An example XPJSON plan
 * examplePlanSchema.json - An example XPSJSON plan schema

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
