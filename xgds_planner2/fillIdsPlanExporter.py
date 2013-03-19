# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from xgds_planner2.planExporter import (TreeWalkPlanExporter,
                                        JsonPlanExporter)
from xgds_planner2 import xpjson, settings, models


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

    def initPlan(self, plan, context):
        context.schema = xpjson.loadDocument(models.SIMPLIFIED_SCHEMA_PATH)

    def transformStationCommand(self, command, context):
        command.id = getCommandId(context)
        return command

    def transformSegmentCommand(self, command, context):
        command.id = getCommandId(context)
        return command

    def transformStation(self, station, tsequence, context):
        station.id = getStationId(context)
        station.sequence = tsequence
        return station

    def transformSegment(self, segment, tsequence, context):
        segment.id = getSegmentId(context)
        segment.sequence = tsequence
        return segment

    def transformPlan(self, plan, tsequence, context):
        plan.id = getPlanId(context)
        plan.sequence = tsequence
        return plan


def test():
    schema = xpjson.loadDocument(models.SIMPLIFIED_SCHEMA_PATH)
    plan = xpjson.loadDocument('/Users/mfsmith3/projects/gds/xgds_isru/apps/xgds_kn/planner/plans/K10Black/20100802/HMP_B013A_PLAN-xp.json',
                               schema=schema)
    exporter = FillIdsPlanExporter()
    planDoc = exporter.exportPlan(plan)
    open('/tmp/foo.json', 'wb').write(xpjson.dumpDocumentToString(planDoc))


if __name__ == '__main__':
    test()
