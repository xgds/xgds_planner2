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
import os

from xgds_planner2 import xpjson, choosePlanImporter


def main():
    import optparse
    parser = optparse.OptionParser('''usage: %prog [opts] <cmd> ...

 %prog validate <doc.json>
   Validate XPJSON document

 %prog simplify <doc.json> <out.json>
   Simplify XPJSON document (compile out inheritance, fill defaults)

 %prog import <doc.kml>
   Import a plan into the database. Supported formats: only KML for now.

    ''')
    parser.add_option('-s', '--schema',
                      help='Schema to use when processing Plan or PlanLibrary')
    importOpts = optparse.OptionGroup(parser, 'Import-specific options')
    importOpts.add_option('--formatCode',
                          help='Specify importer class by format code (default is to infer based on extension)')
    importOpts.add_option('--creator',
                          help='Specify creator username [required]')
    importOpts.add_option('--planNumber',
                          type='int',
                          help='Specify plan number [required]')
    importOpts.add_option('--planVersion',
                          help='Specify plan version [required]')
    parser.add_option_group(importOpts)

    opts, args = parser.parse_args()

    if not args:
        parser.error('expected a command')
    cmd = args[0]

    if opts.schema is not None:
        schema = xpjson.loadDocument(opts.schema)
        if schema.type != 'PlanSchema':
            parser.error('--schema must be the path to a XPJSON PlanSchema document')
    else:
        schema = None

    ######################################################################
    if cmd == 'validate':
        if len(args) != 2:
            parser.error('validate requires exactly 1 argument')
        docPath = args[1]

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
            doc = xpjson.loadDocument(docPath, schema, fillInDefaults=True)
            xpjson.dumpDocumentToPath(outPath, doc)
            print 'wrote simplified %s to %s' % (doc.get('type'), outPath)
        except xpjson.NoSchemaError, t:
            parser.error('you must specify the --schema argument to validate a document of type %s'
                         % t)
        except:
            traceback.print_exc()
            print
            print 'ERROR could not simplify %s' % docPath


    ######################################################################
    elif cmd == 'import':
        if len(args) != 2:
            parser.error('import requires exactly 1 argument (import path)')
        importPath = args[1]

        if not (opts.creator
                and opts.planNumber
                and opts.planVersion):
            parser.error('import requires: --creator, --planNumber, --planVersion')

        name = os.path.basename(importPath)
        meta = {
            'creator': opts.creator,
            'planNumber': opts.planNumber,
            'planVersion': opts.planVersion,
        }

        importerClass = choosePlanImporter.chooseImporter(name, formatCode=opts.formatCode)
        importerClass.importPlan(name,
                                 buf=open(importPath, 'r').read(),
                                 meta=meta,
                                 path=importPath)

    ######################################################################
    else:
        parser.error('unknown command %s' % cmd)


if __name__ == '__main__':
    main()
