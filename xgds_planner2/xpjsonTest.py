#!/usr/bin/env python
# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

"""
Test xpjson.py.
"""

import unittest
import os

from xgds_planner2 import xpjson

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlanSchema.json')
PLAN_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlan.json')
LIBRARY_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlanLibrary.json')


class XpjsonTest(unittest.TestCase):
    def test_resolve(self):
        schemaDict = xpjson.loadDocument(SCHEMA_PATH)
        xpjson.resolveSchemaInheritance(schemaDict)

    def test_schema(self):
        _schema = xpjson.PlanSchema(xpjson.loadDocument(SCHEMA_PATH))

    def test_plan(self):
        schema = xpjson.PlanSchema(xpjson.loadDocument(SCHEMA_PATH))
        _plan = xpjson.Plan(xpjson.loadDocument(PLAN_PATH), schema=schema)

    def test_library(self):
        schema = xpjson.PlanSchema(xpjson.loadDocument(SCHEMA_PATH))
        _plan = xpjson.PlanLibrary(xpjson.loadDocument(LIBRARY_PATH), schema=schema)


if __name__ == '__main__':
    unittest.main()
