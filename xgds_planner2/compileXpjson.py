#!/usr/bin/env python

import os

from geocamUtil.Builder import Builder

from xgds_planner2 import settings, xpjson, models

THIS_DIR = os.path.dirname(os.path.abspath(__file__))


def compileXpjson(builder=None):
    if builder is None:
        builder = Builder()

    outDir = os.path.dirname(models.SIMPLIFIED_SCHEMA_PATH)
    if not os.path.exists(outDir):
        os.makedirs(outDir)

    def buildSchema():
        schema = xpjson.loadDocument(settings.XGDS_PLANNER_SCHEMA_PATH,
                                     fillInDefaults=True)
        xpjson.dumpDocumentToPath(models.SIMPLIFIED_SCHEMA_PATH, schema)
        print 'wrote normalized schema to %s' % models.SIMPLIFIED_SCHEMA_PATH
    builder.applyRule(models.SIMPLIFIED_SCHEMA_PATH,
                      [settings.XGDS_PLANNER_SCHEMA_PATH],
                      buildSchema)

    def buildLibrary():
        schema = xpjson.loadDocument(settings.XGDS_PLANNER_SCHEMA_PATH,
                                     fillInDefaults=True)
        library = xpjson.loadDocument(settings.XGDS_PLANNER_LIBRARY_PATH,
                                      schema=schema, fillInDefaults=True)
        xpjson.dumpDocumentToPath(models.SIMPLIFIED_LIBRARY_PATH, library)
        print 'wrote normalized library to %s' % models.SIMPLIFIED_LIBRARY_PATH
    builder.applyRule(models.SIMPLIFIED_LIBRARY_PATH,
                      [settings.XGDS_PLANNER_LIBRARY_PATH,
                       settings.XGDS_PLANNER_SCHEMA_PATH],
                      buildLibrary)


def main():
    import optparse
    parser = optparse.OptionParser('usage: %prog')
    opts, args = parser.parse_args()
    if args:
        parser.error('expected no args')
    compileXpjson()
