# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from xgds_planner2.planExporter import (TreeWalkPlanExporter,
                                        JsonPlanExporter)
from xgds_planner2 import xpjson

# pylint: disable=W0223


def getCommandId(context):
    return context.schema.commandIdFormat.format(
        plan=context.plan,
        parent=context.parent,
        stationIndex=context.stationIndex,
        command=context.command,
        commandIndex=context.commandIndex
    )


def getStationId(context):
    return context.schema.stationIdFormat.format(
        plan=context.plan,
        station=context.station,
        stationIndex=context.stationIndex
    )


def getSegmentId(context):
    return context.schema.segmentIdFormat.format(
        plan=context.plan,
        segment=context.segment,
        stationIndex=context.stationIndex
    )


def getPlanId(context):
    return context.schema.planIdFormat.format(
        plan=context.plan
    )


class FillIdsPlanExporter(JsonPlanExporter, TreeWalkPlanExporter):
    """
    Fill ids in the plan using the id formats in the schema.

    This is not really intended as an exporter -- we just wanted the
    free tree walk functionality. Should be refactored.
    """

    label = 'XPJSON'
    content_type = 'application/json'

#     def initPlan(self, plan, context):
#         schema should be set before we get here
#         context.schema = xpjson.loadDocument(settings.STATIC_ROOT + planSchema.simplifiedSchemaPath)

    def transformStationCommand(self, command, context):
        command.id = getCommandId(context)
        return command

    def transformSegmentCommand(self, command, context):
        command.id = getCommandId(context)
        return command

    def transformStation(self, station, tsequence, context):
        station.sequence = tsequence
        return station

    def transformSegment(self, segment, tsequence, context):
        segment.sequence = tsequence
        return segment

    def transformPlan(self, plan, tsequence, context):
        plan.sequence = tsequence
        return plan

    def exportStation(self, station, context):
        station.id = getStationId(context)
        return super(FillIdsPlanExporter, self).exportStation(station, context)

    def exportSegment(self, segment, context):
        segment.id = getSegmentId(context)
        return super(FillIdsPlanExporter, self).exportSegment(segment, context)

    def exportPlanInternal(self, plan, context):
        plan.id = getPlanId(context)
        return super(FillIdsPlanExporter, self).exportPlanInternal(plan, context)


def test():
    schema = xpjson.loadDocument('fix')
    plan = xpjson.loadDocument('/Users/mfsmith3/projects/gds/xgds_isru/apps/xgds_kn/planner/plans/K10Black/20100802/HMP_B013A_PLAN-xp.json',
                               schema=schema)
    exporter = FillIdsPlanExporter()
    planDoc = exporter.exportPlan(plan, schema)
    open('/tmp/foo.json', 'wb').write(xpjson.dumpDocumentToString(planDoc))


if __name__ == '__main__':
    test()
