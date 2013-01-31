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
import sys
import json

from xgds_planner2 import xpjson

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlanSchema.json')
PLAN_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlan.json')
LIBRARY_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlanLibrary.json')


class XpjsonTest(unittest.TestCase):
    def test_resolve(self):
        schemaDict = xpjson.loadPath(SCHEMA_PATH)
        xpjson.resolveSchemaInheritance(schemaDict)

    def test_schema(self):
        schema = xpjson.PlanSchema(xpjson.loadPath(SCHEMA_PATH))

    def test_plan(self):
        schema = xpjson.PlanSchema(xpjson.loadPath(SCHEMA_PATH))
        plan = xpjson.Plan(xpjson.loadPath(PLAN_PATH), schema=schema)

    def test_library(self):
        schema = xpjson.PlanSchema(xpjson.loadPath(SCHEMA_PATH))
        plan = xpjson.PlanLibrary(xpjson.loadPath(LIBRARY_PATH), schema=schema)


if __name__ == '__main__':
    unittest.main()
