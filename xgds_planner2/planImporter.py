# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import datetime

from xgds_planner2 import models, xpjson


def posixTimestampToString(timestamp):
    return datetime.datetime.utcfromtimestamp(timestamp).isoformat() + 'Z'


class PlanImporter(object):
    """
    Abstract class that defines the API for plan importers.
    """

    label = 'Describe the type of file the class imports. Set in subclasses.'

    @classmethod
    def setDefaultMeta(cls, meta, path=None):
        meta.setdefault('schemaUrl', models.SIMPLIFIED_SCHEMA_URL)
        meta.setdefault('libraryUrls', [models.SIMPLIFIED_LIBRARY_URL])
        meta.setdefault('site', models.LIBRARY.sites[0]._objDict)
        meta.setdefault('platform', models.LIBRARY.platforms[0]._objDict)

        if path:
            stats = os.stat(path)
            meta.setdefault('dateCreated', posixTimestampToString(stats.st_ctime))
            meta.setdefault('dateModified', posixTimestampToString(stats.st_mtime))

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
        dbPlan.save()

    def importPlanFromBuffer(self, buf, meta, schema):
        raise NotImplementedError()
