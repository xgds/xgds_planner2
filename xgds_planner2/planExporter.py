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

import json
import logging
import traceback

from django.http import HttpResponse
from django.conf import settings

from geocamUtil.dotDict import convertToDotDictRecurse, DotDict
from geocamUtil import geomath

import models
import xpjson


# pylint: disable=W0223


class PlanExporter(object):
    """
    Abstract class that defines the API for plan exporters.

    When defining a subclass, you must provide a description,
    content_type, and exportDbPlan() method.

    In the simplest case, your exportDbPlan() will produce the text of
    the export HTTP response. In other cases, it might be more natural
    for exportDbPlan() to return a structured object -- then you must
    define how the object should be serialized into response text using
    the serializeExportedObject() method.

    You can use opts to pass in a dictonary for extra options.
    """

    label = 'Describe the type of file the class exports. Set in subclasses.'
    content_type = 'The MIME type of the file the class exports. Set in subclasses.'

    def exportDbPlan(self, dbPlan, request):
        raise NotImplementedError()

    def serializeExportedObject(self, obj):
        return obj
    
    def getHttpResponse(self, dbPlan, attachmentName=None, request=None):
        obj = self.exportDbPlan(dbPlan, request)
        text = self.serializeExportedObject(obj)
        response = HttpResponse(text,
                                content_type=self.content_type)
        if attachmentName is not None:
            response['Content-disposition'] = 'attachment; filename=%s' % attachmentName
        return response

    def exportDbPlanToPath(self, dbPlan, path, request):
        open(path, 'wb').write(self.serializeExportedObject(self.exportDbPlan(dbPlan, request)))

    def initPlan(self, plan, context):
        """
        This hook is a place for derived classes to construct some
        initial context before transform*() methods are called.
        """
        pass


class JsonPlanExporter(PlanExporter):
    """
    A base class for plan exporters that produce JSON.
    """

    content_type = 'application/json'

    def serializeExportedObject(self, obj):
        return json.dumps(obj,
                          sort_keys=True,
                          indent=4)


class TreeWalkPlanExporter(PlanExporter):
    """
    A base class for plan exporters that walk the xpjson.Plan syntax
    tree.

    The export*() methods walk the tree for you.  Generally you will
    just need to override the transform*() methods.

    The 'tsequence' argument to your transform*() method is special --
    it is the bottom-up list of transformed elements from the sequence
    member of the object you are transforming. For example, in
    transformStation() it will be the result of calling
    transformStationCommand() on all of the commands in the station
    sequence.

    The 'context' argument gives you access to other attributes like the
    stationIndex.
    """

    def transformStationCommand(self, command, context):
        return command

    def transformSegmentCommand(self, command, context):
        return command

    def transformStation(self, station, tsequence, context):
        return station

    def transformSegment(self, segment, tsequence, context):
        return segment

    def transformPlan(self, plan, tsequence, context):
        return plan

    def getBracketingStations(self, plan, segmentIndex, isStation=False):
        stations = [s for s in plan.sequence if s.type == 'Station']
        prevStation = None
        if segmentIndex > 0:
            try:
                prevStation = stations[segmentIndex - 1]
            except IndexError:
                pass
        nextStation = None
        if isStation:
            nextIndex = segmentIndex + 1
        else:
            nextIndex = segmentIndex
        try:
            nextStation = stations[nextIndex]
        except IndexError:
            pass
        return prevStation, nextStation
#         return stations[segmentIndex - 1], stations[segmentIndex]

    def exportStation(self, station, context):
        tsequence = []
        if hasattr(station, 'commands'):
            station.sequence = convertToDotDictRecurse(station.commands)
            for i, cmd in enumerate(station.sequence):
                ctx = context.copy()
                ctx.command = cmd
                ctx.commandIndex = i
                tsequence.append(self.transformStationCommand(cmd, ctx))
        else:
            station.sequence = []
        return self.transformStation(station, tsequence, context)

    def exportSegment(self, segment, context):
        tsequence = []
        if hasattr(segment, 'commands'):
            segment.sequence = convertToDotDictRecurse(segment.commands)
            for i, cmd in enumerate(segment.sequence):
                ctx = context.copy()
                ctx.command = cmd
                ctx.commandIndex = i
                tsequence.append(self.transformSegmentCommand(cmd, ctx))
        else:
            segment.sequence = []
        return self.transformSegment(segment, tsequence, context)

    def exportPlan(self, plan, schema):
        context = DotDict({
            'plan': plan
        })
        context.schema = schema
        self.initPlan(plan, context)
        return self.exportPlanInternal(plan, context)

    def exportPlanInternal(self, plan, context):
        index = 0
        tsequence = []
        for elt in plan.get("sequence", []):
            ctx = context.copy()
            ctx.stationIndex = index
            if elt.type == 'Station':
                ctx.parent = ctx.station = elt
                ctx.prevStation, ctx.nextStation = self.getBracketingStations(plan, index, True)
                exported_station = self.exportStation(elt, ctx)
                if exported_station:
                    tsequence.append(exported_station)
            elif elt.type == 'Segment':
                ctx.parent = ctx.segment = elt
                ctx.prevStation, ctx.nextStation = self.getBracketingStations(plan, index)
                exported_segment = self.exportSegment(elt, ctx)
                if exported_segment:
                    tsequence.append(exported_segment)
            else:
                print 'exportPlan: cannot process element of type %s in Plan.sequence' % elt.type

            if elt.type == 'Station':
                index += 1

        return self.transformPlan(plan, tsequence, context)

    def exportDbPlan(self, dbPlan, request):
        try:
            platform = dbPlan.jsonPlan['platform']
            planSchema = models.getPlanSchema(platform["name"])
            plan = dbPlan.toXpjson()
            self.request = request
            return self.exportPlan(plan, planSchema.getSchema())
        except:
            logging.warning('exportDbPlan: could not save plan %s', dbPlan.name)
            raise  # FIX


class ExamplePlanExporter(JsonPlanExporter, TreeWalkPlanExporter):
    """
    Simple example of a tree-walking plan exporter. Returns
    a JSON summary of the ids in the plan.
    """

    label = 'Summary'

    def transformPlan(self, plan, tsequence, context):
        return {'id': plan.id, 'sequence': tsequence}

    def transformStation(self, station, tsequence, context):
        return {'id': station.id, 'sequence': tsequence}

    def transformSegment(self, segment, tsequence, context):
        return {'id': segment.id, 'sequence': tsequence}

    def transformStationCommand(self, command, context):
        return command.id

    def transformSegmentCommand(self, command, context):
        return command.id


class XpjsonPlanExporter(JsonPlanExporter):
    """
    Just export the plan as-is.
    """

    label = 'xpJson'

    def exportDbPlan(self, dbPlan, request):
        return dbPlan.jsonPlan


class CrsJsonPlanExporter(TreeWalkPlanExporter):
    """
    Export the plan with coordinates in the local coordinate reference frame.
    Uses the alternate CRS system.
    """

    label = "crsJson"

    def initPlan(self, plan, context):
        if plan.site.alternateCrs:
            plan.site.crs = plan.site.alternateCrs
            plan.site.alternateCrs = None
            context['transform'] = xpjson.getCrsTransform(plan.site.crs)

    def transformStation(self, station, tsequence, context):
        if 'transform' in context:
            if station.geometry and station.geometry.get('coordinates'):
                xform = context['transform']
                station.geometry['coordinates'] = xform(station.geometry['coordinates'])
        return station

    def serializeExportedObject(self, obj):
        return xpjson.dumpDocumentToString(obj)


class BearingDistanceJsonPlanExporter(JsonPlanExporter, TreeWalkPlanExporter):
    """
    Returns json of the plan including durations, bearings and distances
    """

    label = 'bdJson'

    def transformPlan(self, plan, tsequence, context):
        return {'creator': plan.creator, # TODO the actual user is stored in the db plan
                'dateCreated': plan.dateCreated,
                'dateModified': plan.dateModified,
                'name': plan.name,
                'notes': plan.notes,
                'url': plan.url,
                'id': plan.id, 
                'sequence': tsequence,
                'site': plan.site._objDict,
                'subject': plan.subject,
                'targets': plan.targets}

    def transformStation(self, station, tsequence, context):
        bearing = 0
        if context.nextStation:
            plon, plat = station.geometry['coordinates']
            nlon, nlat = context.nextStation.geometry['coordinates']
            diff = geomath.calculateDiffMeters([nlon, nlat], [plon, plat])
            bearing = geomath.getBearingDegrees(diff)

        derivedInfo = station.derivedInfo; 
        durationSeconds = 0 #TODO calculate
        if derivedInfo:
            durationSeconds = derivedInfo['durationSeconds']
        station.id = station.id[-(len(station.id)-station.id.rfind('_')-1):]
        
        result = {'id': station.id,
                  'name': station.name,
                  'type': settings.XGDS_PLANNER_STATION_MONIKER,
                  'commands': tsequence,
                  'geometry': self.getStationGeometry(station, context),
                  'notes': station.notes,
                  'tolerance': station.tolerance,
                  'durationSeconds': durationSeconds,
                  'bearing': bearing}
        if hasattr(station, 'heading'):
            result['heading'] = station.heading
        if hasattr(station, 'depth'):
            result['depth'] = station.depth
        return result
    
    def getStationGeometry(self, station, context):
        return station.geometry

    def transformSegment(self, segment, tsequence, context):
        derivedInfo = segment.derivedInfo; 
        if derivedInfo:
            distanceMeters = derivedInfo['distanceMeters']
            durationSeconds = derivedInfo['durationSeconds']
        else:
            plon, plat = context.prevStation.geometry['coordinates']
            nlon, nlat = context.nextStation.geometry['coordinates']
            distanceMeters = geomath.getLength(geomath.calculateDiffMeters([plon, plat], [nlon, nlat]))
            speed = context.plan._objDict['defaultSpeed']
            try:
                speed = segment._objDict['hintedSpeed']
            except:
                pass
            durationSeconds = (distanceMeters / speed)
        
        segment.id = segment.id[-(len(segment.id)-segment.id.rfind('_')-1):]
        return {'id': segment.id, 
                'name': segment.name,
                'type': settings.XGDS_PLANNER_SEGMENT_MONIKER,
                'commands': tsequence,
                'notes': segment.notes, 
                'distanceMeters': distanceMeters, 
                'durationSeconds': durationSeconds}

    SKIP_COMMAND_KEYS = ["duration", "id", "instrument", "name", "notes", "presetCode", "presetName", "timing", "type", "uuid"]
    def transformCommand(self, command, context):
        command.type = settings.XGDS_PLANNER_COMMAND_MONIKER
        command.id = command.id[-(len(command.id)-command.id.rfind('_')-1):]

        notes = ''
        if 'notes' in command:
            notes = command.notes
        if not notes:
            notes = ''
        for key, value in command.iteritems():
            if key not in self.SKIP_COMMAND_KEYS:
                notes += ' %s: %s' % (key, str(value))
        command.notes = notes

        return command

    def transformStationCommand(self, command, context):
        return self.transformCommand(command, context)

    def transformSegmentCommand(self, command, context):
        return self.transformCommand(command, context)

    def exportDbPlan(self, dbPlan, request):
        try:
            platform = dbPlan.jsonPlan['platform']
            planSchema = models.getPlanSchema(platform["name"])
            plan = dbPlan.toXpjson()
            changedPlan =  self.exportPlan(plan, planSchema.getSchema())
            result = changedPlan
            return result
        except:
            traceback.print_exc()
            logging.warning('exportDbPlan: could not save plan %s', dbPlan.name)
            raise  # FIX


class BearingDistanceCRSJsonPlanExporter(BearingDistanceJsonPlanExporter):
    """
    Returns json of the plan including durations, bearings and distances, with station coordinates in the local CRS
    """

    def initPlan(self, plan, context):
        super(BearingDistanceCRSJsonPlanExporter, self).initPlan(plan, context)
        if plan.site.alternateCrs:
            plan.site.crs = plan.site.alternateCrs
            plan.site.alternateCrs = None
            context['transform'] = xpjson.getCrsTransform(plan.site.crs)

    def getStationGeometry(self, station, context):
        return {'coordinates':context['transform'](station.geometry['coordinates'])}