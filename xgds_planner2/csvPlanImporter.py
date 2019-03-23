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

import csv

from xgds_planner2.planImporter import PlanImporter, planDocFromPlanDict


def planDictFromCoords(coords, meta, names=None, notes=None):
    plan = meta.copy()
    n = len(coords)
    for i, lonLat in enumerate(coords):
        seq_dict = {
            'type': 'Station',
            'geometry': {
                'type': 'Point',
                'coordinates': lonLat
            }
        }
        if names and names[i]:
            seq_dict['name'] = names[i]
        if notes and notes[i]:
            seq_dict['notes'] = notes[i]
        plan['sequence'].append(seq_dict)
        if i != n - 1:
            plan['sequence'].append({
                'type': 'Segment'
            })

    return plan


class CSVPlanImporter(PlanImporter):
    """
    Creates a plan skeleton from a CSV File. 
    Must have column headers indicating latitude and longitude.
    """
    label = 'CSV'

    def importPlanFromBuffer(self, buf, meta, schema):
        csvReader = csv.DictReader(buf.splitlines())
        coords = []
        notes = []
        names = []
        for row in list(csvReader):
            longitude = float(row['longitude'])
            latitude = float(row['latitude'])
            if 'name' in row:
                names.append(row['name'])
            if 'note' in row:
                notes.append(row['note'])
            elif 'notes' in row:
                notes.append(row['notes'])
            coords.append([longitude, latitude])
        planDict = planDictFromCoords(coords, meta, names, notes)
        planDoc = planDocFromPlanDict(planDict, schema.schema)
        return planDoc
