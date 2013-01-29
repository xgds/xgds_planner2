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

from xgds_planner2 import xpjson

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlanSchema.json')
PLAN_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlan.json')


class PlanSchemaTest(unittest.TestCase):
    def test_load(self):
        schema = xpjson.PlanSchema(xpjson.loadPath(SCHEMA_PATH))
        # print xpjson.prettyDumps(schema)


class PlanTest(unittest.TestCase):
    def test_load(self):
        schema = xpjson.PlanSchema(xpjson.loadPath(SCHEMA_PATH))
        plan = xpjson.Plan(xpjson.loadPath(PLAN_PATH), schema)


if __name__ == '__main__':
    unittest.main()
