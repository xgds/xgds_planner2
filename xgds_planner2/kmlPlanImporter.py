# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import copy
import json
import re
import datetime

from django.http import HttpResponse

from geocamUtil.dotDict import DotDict, convertToDotDictRecurse
from xgds_pipeline.scripts.xml2json import xml2struct

from xgds_planner2 import models, xpjson
from xgds_planner2.planImporter import PlanImporter
from xgds_planner2.fillIdsPlanExporter import FillIdsPlanExporter


def parseCoordinateTuple(s):
    return [float(v) for v in s.split(',')]


def parseCoordinateTuples(s):
    s = s.strip()
    return [parseCoordinateTuple(s)[:2]
            for s in re.split('\s+', s)]


def coordsFromBuf(buf):
    xml = xml2struct(buf, True)
    mark = xml.kml.Document.Placemark
    return parseCoordinateTuples(mark.LineString.coordinates.text)


def planDictFromCoords(coords, meta):
    plan = meta.copy()
    plan.update({
        'xpjson': '0.1',
        'type': 'Plan',
        'sequence': []
    })
    n = len(coords)
    for i, lonLat in enumerate(coords):
        plan['sequence'].append({
            'type': 'Station',
            'geometry': {
            'type': 'Point',
            'coordinates': lonLat
        }
    })
    if i != n-1:
        plan['sequence'].append({
            'type': 'Segment'
        })

    # downstream processing tools assume plan is a DotDict
    plan = convertToDotDictRecurse(plan)

    return plan


def planDocFromPlanDict(planDict, schema):
    planDoc = (xpjson.loadDocumentFromDict
               (planDict,
                schema=schema,
                parseOpts=xpjson.ParseOpts(fillInDefaults=True)))

    # fill in ids
    fillIds = FillIdsPlanExporter()
    return fillIds.exportPlan(planDoc)


class KmlLineStringPlanImporter(PlanImporter):
    """
    Creates a plan skeleton from a KML LineString. Stations are placed
    at the vertices of the LineString.
    """
    label = 'KML LineString'

    def importPlanFromBuffer(self, buf, meta, schema):
        coords = coordsFromBuf(buf)
        planDict = planDictFromCoords(coords, meta)
        planDoc = planDocFromPlanDict(planDict, schema)
        print xpjson.dumpDocumentToString(planDoc)
        return planDoc


def posixTimestampToString(timestamp):
    return datetime.datetime.utcfromtimestamp(timestamp).isoformat() + 'Z'


def main():
    username = 'root'
    meta = {
        'creator': username,
        'planNumber': 1,
        'planVersion': 'A',
    }

    path = '/Users/mfsmith3/Desktop/PathTest.kml'
    name = os.path.basename(path)
    meta.setdefault('name', name)

    stats = os.stat(path)
    meta.setdefault('dateCreated', posixTimestampToString(stats.st_ctime))
    meta.setdefault('dateModified', posixTimestampToString(stats.st_mtime))

    schema = xpjson.loadDocument(models.SIMPLIFIED_SCHEMA_PATH)
    library = xpjson.loadDocument(models.SIMPLIFIED_LIBRARY_PATH,
                                  schema=schema)

    meta.setdefault('schemaUrl', models.SIMPLIFIED_SCHEMA_URL)
    meta.setdefault('libraryUrls', [models.SIMPLIFIED_LIBRARY_URL])
    meta.setdefault('site', library.sites[0]._objDict)
    meta.setdefault('platform', library.platforms[0]._objDict)

    importer = KmlLineStringPlanImporter()
    importer.importPlanFromPath(path, meta, schema)


if __name__ == '__main__':
    main()
