# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import datetime

from xgds_planner2.planExporter import TreeWalkPlanExporter
from xgds_planner2 import xpjson

from geocamUtil.geomath import calculateDiffMeters, getLength

class PmlPlanExporter(TreeWalkPlanExporter):
    """
    PML is the XML format that SCORE uses.  
    """
    label = 'pml'
    content_type = 'application/xml'
    
    startTime = None
    
    def initPlan(self, plan, context):
#         if plan.flight:
#             self.startTime = plan.flight.plannedStartTime
#         else:
#             self.startTime = datetime.datetime.now()
        self.startTime = datetime.datetime.now()

    
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
        durationString = "P%dDT%dH%dM%.3fS" % (days, hrs, mins, secs)
        return durationString
        
    def makeActivity(self, activityType, id, name, durationSeconds, notes):
        return ("""            <Activity activityType="%(activityType)s" duration="%(duration)s" id="%(id)s" name="%(name)s" scheduled="true" startTime="%(startTime)s">
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
""" % {'activityType': activityType,
       'id': '' if id is None else id,
       'name': '' if name is None else name,
       'duration': self.getDurationString(durationSeconds),
       'startTime': self.startTime.isoformat(),
       'notes': '' if notes is None else notes})

        
    def transformStation(self, station, tsequence, context):
        """
        duration for station is 0, as we are treating it as arrival at station. 
        """
        return self.makeActivity("Station", station.id, station.name, 0, station.notes)
        
    def transformSegment(self, segment, tsequence, context):
        plon, plat = context.prevStation.geometry['coordinates']
        nlon, nlat = context.nextStation.geometry['coordinates']
        meters = getLength(calculateDiffMeters([plon, plat], [nlon, nlat]))
        speed = context.plan._objDict['defaultSpeed']
        try:
            speed = segment._objDict['hintedSpeed']
        except:
            pass
            
        segmentDuration = meters / speed
        
        activity = self.makeActivity("Segment", segment.id, segment.name, segmentDuration, segment.notes)
        self.startTime = self.startTime + datetime.timedelta(seconds=segmentDuration)
        return activity
        
        
    def transformStationCommand(self, command, context):
        duration = 60 * command.duration
        activity = self.makeActivity(command.type, command.id, command.name, duration, command.notes)
        self.startTime = self.startTime + datetime.timedelta(seconds=60 * command.duration)
        return activity
        

    def transformSegmentCommand(self, command, context):
        duration = 60 * command.duration
        activity = self.makeActivity(command.type, command.id, command.name, duration, command.notes)
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