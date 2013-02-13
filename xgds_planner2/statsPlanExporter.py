# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import math
import pyproj

from xgds_planner2.planExporter import JsonPlanExporter, TreeWalkPlanExporter

GEOD = pyproj.Geod(ellps='WGS84')


def norm2(lonLat1, lonLat2):
    lon1, lat1 = lonLat1
    lon2, lat2 = lonLat2
    return math.sqrt((lon1 - lon2) ** 2 + (lat1 - lat2) ** 2)


def getDistanceMeters(lonLat1, lonLat2):
    # oops, GEOD.inv fails when Points are nearly equal
    if norm2(lonLat1, lonLat2) < 1e-5:
        return 0

    lon1, lat1 = lonLat1
    lon2, lat2 = lonLat2
    # print 'GEOD.inv(%s, %s, %s, %s)' % (lon1, lat1, lon2, lat2)
    az12, az21, dist = GEOD.inv(lon1, lat1, lon2, lat2)
    return dist


class StatsPlanExporter(JsonPlanExporter, TreeWalkPlanExporter):
    """
    Returns summary statistics.
    """

    label = 'Stats-JSON'

    def __init__(self):
        self.numStations = 0
        self.numSegments = 0
        self.numCommands = 0
        self.numCommandsByType = {}
        self.lengthMeters = 0

    def transformPlan(self, plan, tsequence, context):
        return {
            'numStations': self.numStations,
            'numSegments': self.numSegments,
            'numCommands': self.numCommands,
            'numCommandsByType': self.numCommandsByType,
            'lengthMeters': self.lengthMeters
        }

    def transformStation(self, station, tsequence, context):
        self.numStations += 1

    def transformSegment(self, segment, tsequence, context):
        self.numSegments += 1
        self.lengthMeters += getDistanceMeters(context.prevStation.geometry['coordinates'],
                                               context.nextStation.geometry['coordinates'])

    def transformStationCommand(self, command, context):
        self.numCommands += 1

        n = self.numCommandsByType.get(command.type, 0)
        self.numCommandsByType[command.type] = n + 1

    def transformSegmentCommand(self, command, context):
        self.transformStationCommand(command, context)


def getSummaryOfCommandsByType(stats):
    lst = []
    counts = stats['numCommandsByType']
    for commandType in sorted(counts.keys()):
        n = counts[commandType]
        lst.append('%s:&nbsp;%s' % (commandType, n))
    return ' '.join(lst)


def getSummary(stats):
    lst = ['Stn:&nbsp;%s' % stats['numStations'],
           'Cmd:&nbsp;%s' % stats['numCommands']]
    lst.append(getSummaryOfCommandsByType(stats))
    return ' '.join(lst)
