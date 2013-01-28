#!/bin/sh

./jsonSchemaValidate.py examplePlan.json xpjsonPlanDocumentSchema.json
./jsonSchemaValidate.py examplePlanSchema.json xpjsonPlanSchemaDocumentSchema.json
./jsonSchemaValidate.py examplePlanLibrary.json xpjsonPlanLibraryDocumentSchema.json
