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

 %prog validate <doc.json>
   Validate XPJSON document

 %prog simplify <doc.json> <out.json>
   Simplify XPJSON document (compile out inheritance, fill defaults)
    ''')
    parser.add_option('-s', '--schema',
                      help='Schema to use when validating Plan or PlanLibrary')
    opts, args = parser.parse_args()
    if not args:
        parser.error('expected a command')

    cmd = args[0]

    ######################################################################
    if cmd == 'validate':
        if len(args) < 2:
            parser.error('validate requires an argument')
        docPath = args[1]

        if opts.schema is not None:
            schema = xpjson.PlanSchema(xpjson.loadPath(opts.schema))
        else:
            schema = None

        try:
            doc = xpjson.loadDocument(docPath, schema)
            print 'VALID %s %s' % (doc.get('type'), docPath)
        except xpjson.NoSchemaError, t:
            parser.error('you must specify the --schema argument to validate a document of type %s'
                         % t)
        except:
            traceback.print_exc()
            print
            print 'INVALID %s' % docPath

    ######################################################################
    elif cmd == 'simplify':
        if len(args) != 3:
            parser.error('simplify requires exactly 2 arguments')
        docPath = args[1]
        outPath = args[2]

        try:
            docDict = xpjson.loadPath(docPath)
            docType = docDict.get('type')
            if docType not in ('PlanSchema', 'Plan', 'PlanLibrary'):
                raise ValueError('Unknown document type %s')
        except:
            traceback.print_exc()
            print
            print 'ERROR could not parse %s' % docPath

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
