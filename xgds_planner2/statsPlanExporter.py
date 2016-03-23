#__BEGIN_LICENSE__
# Copyright (c) 2015, United States Government, as represented by the
# Administrator of the National Aeronautics and Space Administration.
# All rights reserved.
#
# The xGDS platform is licensed under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
#__END_LICENSE__

import math
import pyproj

from xgds_planner2.planExporter import JsonPlanExporter, TreeWalkPlanExporter

# pylint: disable=W0223

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
    _az12, _az21, dist = GEOD.inv(lon1, lat1, lon2, lat2)
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
        self.estimatedDurationSeconds = 0

    def initPlan(self, plan, context):
        self.defaultSpeed = plan.defaultSpeed
        
    def transformPlan(self, plan, tsequence, context):
        return {
            'numStations': self.numStations,
            'numSegments': self.numSegments,
            'numCommands': self.numCommands,
            'numCommandsByType': self.numCommandsByType,
            'lengthMeters': self.lengthMeters,
            'estimatedDurationSeconds': self.estimatedDurationSeconds
        }

    def transformStation(self, station, tsequence, context):
        self.numStations += 1

    def transformSegment(self, segment, tsequence, context):
        self.numSegments += 1
        segmentLength = getDistanceMeters(context.prevStation.geometry['coordinates'],
                                               context.nextStation.geometry['coordinates'])
        self.lengthMeters += segmentLength
        if hasattr(segment, "hintedSpeed"):
                speed = float(segment.hintedSpeed)
        else:
                speed = float(self.defaultSpeed)
        segmentDuration = segmentLength/speed
        if "totalTime" in segment.derivedInfo:  # "totalTime" is the SEXTANT computed time for the segment.
            segmentDuration = float(segment.derivedInfo["totalTime"])
        self.estimatedDurationSeconds += segmentDuration
        

    def transformStationCommand(self, command, context):
        self.numCommands += 1

        n = self.numCommandsByType.get(command.type, 0)
        self.numCommandsByType[command.type] = n + 1
        
        self.estimatedDurationSeconds += float(command.duration)

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
