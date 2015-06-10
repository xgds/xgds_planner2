# __BEGIN_LICENSE__
#Copyright (c) 2015, United States Government, as represented by the 
#Administrator of the National Aeronautics and Space Administration. 
#All rights reserved.
#
#The xGDS platform is licensed under the Apache License, Version 2.0 
#(the "License"); you may not use this file except in compliance with the License. 
#You may obtain a copy of the License at 
#http://www.apache.org/licenses/LICENSE-2.0.
#
#Unless required by applicable law or agreed to in writing, software distributed 
#under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
#CONDITIONS OF ANY KIND, either express or implied. See the License for the 
#specific language governing permissions and limitations under the License.
# __END_LICENSE__

import re

from geocamUtil.xml2json import xml2struct

from xgds_planner2.planImporter import PlanImporter, planDocFromPlanDict


def parseCoordinateTuple(s):
    return [float(v) for v in s.split(',')]


def parseCoordinateTuples(s):
    s = s.strip()
    return [parseCoordinateTuple(s)[:2]
            for s in re.split(r'\s+', s)]


def coordsFromBuf(buf):
    xml = xml2struct(buf, True)
    mark = xml.kml.Document.Placemark
    return parseCoordinateTuples(mark.LineString.coordinates.text)


def planDictFromCoords(coords, meta):
    plan = meta.copy()
    n = len(coords)
    for i, lonLat in enumerate(coords):
        plan['sequence'].append({
            'type': 'Station',
            'geometry': {
                'type': 'Point',
                'coordinates': lonLat
            }
        })
        if i != n - 1:
            plan['sequence'].append({
                'type': 'Segment'
            })

    return plan


class KmlLineStringPlanImporter(PlanImporter):
    """
    Creates a plan skeleton from a KML LineString. Stations are placed
    at the vertices of the LineString.
    """
    label = 'KML LineString'

    # TODO set up plan schema
    def importPlanFromBuffer(self, buf, meta, schema):
        coords = coordsFromBuf(buf)
        planDict = planDictFromCoords(coords, meta)
        planDoc = planDocFromPlanDict(planDict, schema)
        return planDoc
