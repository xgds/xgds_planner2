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

# pylint: disable=W0612, W0702
import datetime
import os
import re

from django.conf import settings
from xgds_planner2.planExporter import TreeWalkPlanExporter
from xgds_planner2.models import getPlanSchema

from geocamUtil.geomath import calculateDiffMeters, getLength


class PmlPlanExporter(TreeWalkPlanExporter):
    """
    PML is the XML format that SCORE uses.
    """
    label = 'pml'
    content_type = 'application/xml'
    stationCounter = 0
    segmentCounter = 0

    startTime = None

    def initPlan(self, plan, context):
        if not self.startTime:
            if context.startTime:
                self.startTime = context.startTime
            else:
                self.startTime = datetime.datetime.now()
        try:
            fullPlanSchema = getPlanSchema(plan.platform.name)
            simulatorPath = fullPlanSchema.simulatorUrl
            if simulatorPath.startswith('/static/'):
                simulatorPath = simulatorPath[8:]
            fullpath = os.path.join(settings.STATIC_ROOT, simulatorPath)
            simulator_file = open(fullpath) # urlopen
            simulator_contents = simulator_file.read()
            regex = re.compile('.*DRIVE_TIME_MULTIPLIER\s*=\s*(\d+\.*\d*);')
            searchResults = regex.search(simulator_contents)
            result = regex.findall(searchResults.group(0))
            if result:
                self.DRIVE_TIME_MULTIPLIER = float(result[0])

            regex = re.compile('.*ROTATION_ADDITION\s*=\s*(\d+\.*\d*);')
            searchResults = regex.search(simulator_contents)
            rotation_result = regex.findall(searchResults.group(0))
            if rotation_result:
                self.ROTATION_ADDITION = float(rotation_result[0])
        except:
            simulator_file.close()
            self.DRIVE_TIME_MULTIPLIER = 1.0
            self.ROTATION_ADDITION = 0.0


    def wrapDocument(self, text):
        content = ""
        for entry in text:
            if isinstance(entry, basestring):
                content = content + entry
            elif isinstance(entry, list):
                for a in entry:
                    content = content + a
        return ("""<?xml version="1.0" encoding="UTF-8"?>
<PML>
    <Plan>
        <Children>
        %s
        </Children>
    </Plan>
</PML>
""" % content)

    def getDurationString(self, seconds):
        mins, secs = divmod(seconds, 60)
        hrs, mins = divmod(mins, 60)
        days, extra = divmod(seconds, 86400)
        durationString = "P%dDT%dH%dM%.0fS" % (days, hrs, mins, secs)
        return durationString

    def makeActivity(self, activityType, activityId, name, durationSeconds, notes):
        return ("""            <Activity activityType="%(activityType)s" duration="%(duration)s" id="%(activityId)s" name="%(name)s" scheduled="true" startTime="%(startTime)sZ">
                <SharedProperties>
                    <Property name="location">
                        <String></String>
                    </Property>
                    <Property name="class">
                        <String></String>
                    </Property>
                    <Property name="origination">
                        <String></String>
                    </Property>
                    <Property name="notes">
                        <String>%(notes)s</String>
                    </Property>
                </SharedProperties>
            </Activity>
""" % {
                'activityType': activityType,
                'activityId': '' if activityId is None else activityId,
                'name': '' if name is None else name,
                'duration': self.getDurationString(durationSeconds),
                'startTime': self.startTime.replace(microsecond=0).isoformat(),
                'notes': '' if notes is None else notes})

    def transformStation(self, station, tsequence, context):
        """
        duration for station is 0, as we are treating it as arrival at station.
        """
        if self.stationCounter == 0:
            name = "Start"
        elif not context.nextStation:
            name = "End"
        else:
            name = "%02d" % self.stationCounter

        name = "Station %s%s" % (name, '' if station.name is None else ' ' + station.name)
        result = self.makeActivity("Station", station.id, name, 0, station.notes)
        self.stationCounter = self.stationCounter + 1
        return result

    def transformSegment(self, segment, tsequence, context):
        plon, plat = context.prevStation.geometry['coordinates']
        nlon, nlat = context.nextStation.geometry['coordinates']
        meters = getLength(calculateDiffMeters([plon, plat], [nlon, nlat]))
        speed = context.plan._objDict['defaultSpeed']
        try:
            speed = segment._objDict['hintedSpeed']
        except:
            pass

        segmentDuration = self.DRIVE_TIME_MULTIPLIER * (meters / speed) + self.ROTATION_ADDITION

        name = "Segment %02d%s" % (self.segmentCounter, '' if segment.name is None else ' ' + segment.name)
        activity = self.makeActivity("Segment", segment.id, name, segmentDuration, segment.notes)
        self.startTime = self.startTime + datetime.timedelta(seconds=segmentDuration)
        self.segmentCounter = self.segmentCounter + 1
        return activity

    def transformStationCommand(self, command, context):
        duration = 60 * command.duration
        name = command.name
        if not name:
            name = "%s%s" % (str(command.type), '' if command.id is None else ' ' + command.id)
        activity = self.makeActivity(command.type, command.id, name, duration, command.notes)
        self.startTime = self.startTime + datetime.timedelta(seconds=60 * command.duration)
        return activity

    def transformSegmentCommand(self, command, context):
        duration = 60 * command.duration
        name = command.name
        if not name:
            name = "%s%s" % (str(command.type), '' if command.id is None else ' ' + command.id)
        activity = self.makeActivity(command.type, command.id, name, duration, command.notes)
        self.startTime = self.startTime + datetime.timedelta(seconds=60 * command.duration)
        return activity

    def transformPlan(self, plan, tsequence, context):
        return self.wrapDocument(tsequence)

    def exportStation(self, station, context):
        """
        Because we are adding up the timing we have to change the order here and build the station first before the children
        """
        tsequence = []
        tsequence.append(self.transformStation(station, tsequence, context))
        for i, cmd in enumerate(station.sequence):
            ctx = context.copy()
            ctx.command = cmd
            ctx.commandIndex = i
            tsequence.append(self.transformStationCommand(cmd, ctx))
        return tsequence

    def exportSegment(self, segment, context):
        """
        For a segment, the activities come first and then the timing for the drive.
        """
        tsequence = []
        for i, cmd in enumerate(segment.sequence):
            ctx = context.copy()
            ctx.command = cmd
            ctx.commandIndex = i
            tsequence.append(self.transformSegmentCommand(cmd, ctx))
        tsequence.append(self.transformSegment(segment, tsequence, context))
        return tsequence
