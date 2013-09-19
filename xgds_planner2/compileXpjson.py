#!/usr/bin/env python

import os

from geocamUtil.Builder import Builder

from xgds_planner2 import settings, xpjson, models

def compileXpjson(builder=None):
    if builder is None:
        builder = Builder()
    for planSchema in models.PlanSchema.objects.all():
        compile(planSchema, builder)
        
def compile( planSchema, builder=None):
    SCHEMA_PATH = os.path.join(settings.STATIC_ROOT,planSchema.schemaUrl)
    SIMPLIFIED_SCHEMA_PATH = os.path.join(settings.STATIC_ROOT,planSchema.simplifiedSchemaPath)
    outDir = os.path.dirname(SIMPLIFIED_SCHEMA_PATH)
    if not os.path.exists(outDir):
        os.makedirs(outDir)
        
    LIBRARY_PATH = os.path.join(settings.STATIC_ROOT, planSchema.libraryUrl)
    SIMPLIFIED_LIBRARY_PATH = os.path.join(settings.STATIC_ROOT, planSchema.simplifiedLibraryPath)
    outDir = os.path.dirname(SIMPLIFIED_LIBRARY_PATH)
    if not os.path.exists(outDir):
        os.makedirs(outDir)

    def buildSchema(planSchema):
        schema = planSchema.getSchema()
        xpjson.dumpDocumentToPath(SIMPLIFIED_SCHEMA_PATH, schema)
        print 'wrote normalized schema to %s' % (SIMPLIFIED_SCHEMA_PATH)
    builder.applyRule(SIMPLIFIED_SCHEMA_PATH,
                      [SCHEMA_PATH],
                      buildSchema(planSchema))

    def buildLibrary(planSchema):
        library = planSchema.getLibrary()
        xpjson.dumpDocumentToPath(SIMPLIFIED_LIBRARY_PATH, library)
        print 'wrote normalized library to %s' % SIMPLIFIED_LIBRARY_PATH
    builder.applyRule(SIMPLIFIED_LIBRARY_PATH,
                      [LIBRARY_PATH,
                       SCHEMA_PATH],
                      buildLibrary(planSchema))


def main():
    import optparse
    parser = optparse.OptionParser('usage: %prog')
    opts, args = parser.parse_args()
    if args:
        parser.error('expected no args')
    for planSchema in models.PlanSchema.objects.all():
        compile(planSchema)
