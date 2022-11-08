#!/usr/bin/env python
# __BEGIN_LICENSE__
# Copyright (c) 2015, United States Government, as represented by the
# Administrator of the National Aeronautics and Space Administration.
# All rights reserved.
#
# The xGDS platform is licensed under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
# __END_LICENSE__

"""
Test xpjson.py.
"""

import os
import unittest

from xgds_planner2 import xpjson

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
SCHEMA_PATH = os.path.join(THIS_DIR, "xpjsonSpec", "examplePlanSchema.json")
PLAN_PATH = os.path.join(THIS_DIR, "xpjsonSpec", "examplePlan.json")
LIBRARY_PATH = os.path.join(THIS_DIR, "xpjsonSpec", "examplePlanLibrary.json")


class XpjsonTest(unittest.TestCase):
    def test_schema(self):
        _schema = xpjson.loadDocument(SCHEMA_PATH)

    def test_plan(self):
        schema = xpjson.loadDocument(SCHEMA_PATH)
        _plan = xpjson.loadDocument(PLAN_PATH, schema=schema)

    def test_library(self):
        schema = xpjson.loadDocument(SCHEMA_PATH)
        _library = xpjson.loadDocument(LIBRARY_PATH, schema=schema)


if __name__ == "__main__":
    unittest.main()
