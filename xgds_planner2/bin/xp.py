#!/usr/bin/env python
# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

"""
Command-line utility for performing common operations on XPJSON documents.
"""

import json
import traceback
import ipdb

from xgds_planner2 import xpjson


def main():
    import optparse
    parser = optparse.OptionParser('''usage: %prog [opts] <cmd> ...

 %prog validateSchema <schema.json>
   Validate PlanSchema

 %prog validatePlan <plan.json> <schema.json>
   Validate Plan

 %prog simplify <schema.json> <out.json>
   Simplify PlanSchema (compile out inheritance, fill defaults)
    ''')
    opts, args = parser.parse_args()
    if not args:
        parser.error('expected a command')

    cmd = args[0]

    ######################################################################
    if cmd == 'validateSchema':
        if len(args) != 2:
            parser.error('validateSchema requires exactly 1 argument')
        schemaPath = args[1]

        try:
            xpjson.PlanSchema(xpjson.loadPath(schemaPath))
            print 'VALID PlanSchema %s' % schemaPath
        except:
            traceback.print_exc()
            print
            print 'INVALID PlanSchema %s' % schemaPath

    ######################################################################
    elif cmd == 'validatePlan':
        if len(args) != 3:
            parser.error('validatePlan requires exactly 2 arguments')
        planPath = args[1]
        schemaPath = args[2]

        schema = xpjson.PlanSchema(xpjson.loadPath(schemaPath))
        try:
            xpjson.Plan(xpjson.loadPath(planPath), schema=schema)
            print 'VALID Plan %s' % planPath
        except:
            traceback.print_exc()
            print
            print 'INVALID Plan %s' % planPath

    ######################################################################
    elif cmd == 'simplify':
        if len(args) != 3:
            parser.error('simplify requires exactly 2 arguments')
        inSchemaPath = args[1]
        outSchemaPath = args[2]

        with ipdb.launch_ipdb_on_exception():
            schemaDict = xpjson.loadPath(inSchemaPath)
            parseOpts = xpjson.ParseOpts(fillInDefaults=True)
            schema = xpjson.PlanSchema(schemaDict, parseOpts=parseOpts)
            xpjson.dumpPath(outSchemaPath, schema.objDict)
            print 'wrote simplified PlanSchema to %s' % outSchemaPath

    ######################################################################
    else:
        parser.error('unknown command %s' % cmd)


if __name__ == '__main__':
    main()
