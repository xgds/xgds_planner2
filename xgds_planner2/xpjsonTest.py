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


class PlanSchemaTest(unittest.TestCase):
    def test_load(self):
        schema = xpjson.PlanSchema.load(SCHEMA_PATH)
        print xpjson.prettyDumps(schema)


if __name__ == '__main__':
    import optparse
    parser = optparse.OptionParser('%prog')
    parser.add_option('--schema',
                      help='Schema to test with [%default]',
                      default=SCHEMA_PATH)
    opts, args = parser.parse_args()

    SCHEMA_PATH = opts.schema

    unittest.main(argv=sys.argv[:1])
