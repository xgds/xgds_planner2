# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import copy
import json

from django.http import HttpResponse

from geocamUtil.dotDict import DotDict


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
    """

    label = 'Describe the type of file the class exports. Set in subclasses.'
    content_type = 'The MIME type of the file the class exports. Set in subclasses.'

    def exportDbPlan(self, dbPlan):
        raise NotImplementedError()

    def serializeExportedObject(self, obj):
        return obj

    def getHttpResponse(self, dbPlan):
        obj = self.exportDbPlan(dbPlan)
        text = self.serializeExportedObject(obj)
        return HttpResponse(text,
                            content_type=self.content_type)

    def exportDbPlanToPath(self, dbPlan, path):
        open(path, 'wb').write(self.exportDbPlan(dbPlan))


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

    The exportXXX() methods walk the tree for you.  Generally you will
    just need to override the transformXXX() methods.

    The 'tsequence' argument to your transformXXX() method is special --
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

    def getBracketingStations(self, plan, segmentIndex):
        stations = [s for s in plan.sequence if s.type == 'Station']
        return stations[segmentIndex-1], stations[segmentIndex]

    def exportStation(self, station, context):
        tsequence = []
        for i, cmd in enumerate(station.sequence):
            ctx = context.copy()
            ctx.commandIndex = i
            tsequence.append(self.transformStationCommand(cmd, ctx))
        return self.transformStation(station, tsequence, context)

    def exportSegment(self, segment, context):
        tsequence = []
        for i, cmd in enumerate(segment.sequence):
            ctx = context.copy()
            ctx.commandIndex = i
            tsequence.append(self.transformSegmentCommand(cmd, ctx))
        return self.transformSegment(segment, tsequence, context)

    def exportPlan(self, plan):
        plan = copy.deepcopy(plan)
        index = 0
        tsequence = []
        context = DotDict({
            'plan': plan
        })
        for elt in plan.sequence:
            ctx = context.copy()
            if elt.type == 'Station':
                ctx.stationIndex = index
                tsequence.append(self.exportStation(elt, ctx))
            elif elt.type == 'Segment':
                ctx.segmentIndex = index
                ctx.prevStation, ctx.nextStation = self.getBracketingStations(plan, index)
                tsequence.append(self.exportSegment(elt, ctx))
            else:
                print 'exportPlan: cannot process element of type %s in Plan.sequence' % elt.type

            if elt.type == 'Station':
                index += 1

        return self.transformPlan(plan, tsequence, DotDict({}))

    def exportDbPlan(self, dbPlan):
        plan = dbPlan.toXpjson()
        return self.exportPlan(plan)


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

    label = 'XPJSON'

    def exportDbPlan(self, dbPlan):
        return dbPlan.jsonPlan.toDotDict()
