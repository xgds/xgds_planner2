# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__
import os
import time
import datetime

from geocamUtil.dotDict import convertToDotDictRecurse
from geocamUtil.loader import getModelByName

from xgds_planner2 import models, xpjson, settings
from xgds_planner2.fillIdsPlanExporter import FillIdsPlanExporter

# Please don't put lines like this at the root of modules, this breaks testing
# PLAN_MODEL = getModelByName(settings.XGDS_PLANNER2_PLAN_MODEL)


def posixTimestampToString(timestamp):
    return (datetime.datetime
            .utcfromtimestamp(timestamp)
            .replace(microsecond=0)
            .isoformat()
            + 'Z')


def planDocFromPlanDict(planDict, schema):
    # downstream processing tools assume plan is a DotDict
    planDict = convertToDotDictRecurse(planDict)

    planDoc = (xpjson.loadDocumentFromDict
               (planDict,
                schema=schema,
                parseOpts=xpjson.ParseOpts(fillInDefaults=True)))

    # fill in ids
    fillIds = FillIdsPlanExporter()
    return fillIds.exportPlan(planDoc, schema)


class PlanImporter(object):
    """
    Abstract class that defines the API for plan importers.
    """

    label = 'Describe the type of file the class imports. Set in subclasses.'

    @classmethod
    def setDefaultMeta(cls, meta, path=None, planSchema=None):
        meta.setdefault('xpjson', '0.1')
        meta.setdefault('type', 'Plan')
        meta.setdefault('sequence', [])
        meta.setdefault('readOnly', False)

        if path:
            stats = os.stat(path)
            meta.setdefault('dateCreated', posixTimestampToString(stats.st_ctime))
            meta.setdefault('dateModified', posixTimestampToString(stats.st_mtime))
        else:
            now = time.time()
            meta.setdefault('dateCreated', posixTimestampToString(now))
            meta.setdefault('dateModified', posixTimestampToString(now))
        if planSchema:
            meta.setdefault('schemaUrl', os.path.join(settings.STATIC_ROOT, planSchema.simplifiedSchemaPath))
            meta.setdefault('libraryUrls', [os.path.join(settings.STATIC_ROOT, planSchema.simplifiedLibraryPath)])
            meta.setdefault('site', planSchema.getLibrary().sites[0]._objDict)
            meta.setdefault('platform', planSchema.getLibrary().platforms[0]._objDict)
        else:
            print "Trying to set up a plan importer with no plan schema"

    @classmethod
    def importPlan(cls, name, buf, meta, planSchema=None, path=None):
        PLAN_MODEL = getModelByName(settings.XGDS_PLANNER2_PLAN_MODEL)
        importer = cls()

        meta.setdefault('name', name)

        if not planSchema:
            try:
                wholePlatform = meta['platform']
                planSchema = models.getPlanSchema(wholePlatform.name)
            except:  # pylint: disable=W0702
                # bad news
                print "no platform, you need to pass the plan Schema" + name
                return
        importer.setDefaultMeta(meta, path, planSchema)

        planDoc = importer.importPlanFromBuffer(buf, meta, planSchema)
        planText = xpjson.dumpDocumentToString(planDoc)

        dbPlan = PLAN_MODEL()

        dbPlan.jsonPlan = planText
        dbPlan.extractFromJson(overWriteDateModified=False)

        return dbPlan

    def importPlanFromBuffer(self, buf, meta, planSchema):
        raise NotImplementedError()


class BlankPlanImporter(PlanImporter):

    def importPlanFromBuffer(self, buf, meta, planSchema):
        return planDocFromPlanDict(meta, planSchema.getSchema())
