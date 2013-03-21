# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import time
import datetime

from geocamUtil.dotDict import convertToDotDictRecurse

from xgds_planner2 import models, xpjson
from xgds_planner2.fillIdsPlanExporter import FillIdsPlanExporter

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
    return fillIds.exportPlan(planDoc)


class PlanImporter(object):
    """
    Abstract class that defines the API for plan importers.
    """

    label = 'Describe the type of file the class imports. Set in subclasses.'

    @classmethod
    def setDefaultMeta(cls, meta, path=None):
        meta.setdefault('xpjson', '0.1')
        meta.setdefault('type', 'Plan')
        meta.setdefault('schemaUrl', models.SIMPLIFIED_SCHEMA_URL)
        meta.setdefault('libraryUrls', [models.SIMPLIFIED_LIBRARY_URL])
        meta.setdefault('site', models.LIBRARY.sites[0]._objDict)
        meta.setdefault('platform', models.LIBRARY.platforms[0]._objDict)
        meta.setdefault('sequence', [])

        if path:
            stats = os.stat(path)
            meta.setdefault('dateCreated', posixTimestampToString(stats.st_ctime))
            meta.setdefault('dateModified', posixTimestampToString(stats.st_mtime))
        else:
            now = time.time()
            meta.setdefault('dateCreated', posixTimestampToString(now))
            meta.setdefault('dateModified', posixTimestampToString(now))

    @classmethod
    def importPlan(cls, name, buf, meta, path=None):
        importer = cls()

        meta.setdefault('name', name)
        importer.setDefaultMeta(meta, path)

        planDoc = importer.importPlanFromBuffer(buf, meta, models.SCHEMA)
        planText = xpjson.dumpDocumentToString(planDoc)

        dbPlan = models.Plan()
        dbPlan.jsonPlan = planText
        dbPlan.extractFromJson(overWriteDateModified=False)

        return dbPlan

    def importPlanFromBuffer(self, buf, meta, schema):
        raise NotImplementedError()


class BlankPlanImporter(PlanImporter):
    def importPlanFromBuffer(self, buf, meta, schema):
        return planDocFromPlanDict(meta, schema)
