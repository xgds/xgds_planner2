#!/usr/bin/env python

import os

from geocamUtil.Builder import Builder

from xgds_planner2 import settings, xpjson, models


def compileXpjson(builder=None):
    if builder is None:
        builder = Builder()
    for platform, schemaDict in settings.XGDS_PLANNER_SCHEMAS.iteritems():
        schema = models.PlanSchema(platform, schemaDict)
        doCompile(schema, builder)


def doCompile(planSchema, builder=None):
    outDir = os.path.dirname(planSchema.simplifiedSchemaPath)
    if not os.path.exists(outDir):
        os.makedirs(outDir)

    outDir = os.path.dirname(planSchema.simplifiedLibraryPath)
    if not os.path.exists(outDir):
        os.makedirs(outDir)

    def buildSchema(planSchema):
        schema = xpjson.loadDocument(planSchema.schemaSource)
        xpjson.dumpDocumentToPath(planSchema.simplifiedSchemaPath, schema)
        print 'wrote simplified schema for platform %s to %s' % (planSchema.platform, planSchema.simplifiedSchemaPath)
    builder.applyRule(planSchema.simplifiedSchemaPath,
                      [planSchema.schemaSource],
                      buildSchema(planSchema))

    def buildLibrary(planSchema):
        schema = xpjson.loadDocument(planSchema.schemaSource)
        library = xpjson.loadDocument(planSchema.librarySource,
                                      schema=schema,
                                      fillInDefaults=True)
        xpjson.dumpDocumentToPath(planSchema.simplifiedLibraryPath, library)
        print 'wrote simplified library for platform %s to %s' % (planSchema.platform, planSchema.simplifiedLibraryPath)
    builder.applyRule(planSchema.simplifiedLibraryPath,
                      [planSchema.librarySource,
                       planSchema.schemaSource],
                      buildLibrary(planSchema))


def main():
    import optparse
    parser = optparse.OptionParser('usage: %prog')
    _opts, args = parser.parse_args()
    if args:
        parser.error('expected no args')
    for planSchema in models.PlanSchema.objects.all():
        doCompile(planSchema)
