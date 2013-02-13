# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from xgds_planner2.planExporter import JsonPlanExporter, TreeWalkPlanExporter


class StatsPlanExporter(JsonPlanExporter, TreeWalkPlanExporter):
    """
    Returns summary statistics.
    """

    label = 'Summary Stats (JSON)'

    def __init__(self):
        self.numStations = 0
        self.numSegments = 0
        self.numCommands = 0
        self.numCommandsByType = {}

    def transformPlan(self, plan, tsequence, context):
        return {
            'numStations': self.numStations,
            'numSegments': self.numSegments,
            'numCommands': self.numCommands,
            'numCommandsByType': self.numCommandsByType
        }

    def transformStation(self, station, tsequence, context):
        self.numStations += 1

    def transformSegment(self, segment, tsequence, context):
        self.numSegments += 1

    def transformStationCommand(self, command, context):
        self.numCommands += 1

        n = self.numCommandsByType.get(command.type, 0)
        self.numCommandsByType[command.type] = n + 1

    def transformSegmentCommand(self, command, context):
        self.transformStationCommand(command, context)


def getSummaryOfCommandsByType(stats):
    lst = []
    counts = stats.numCommandsByType
    for commandType in sorted(counts.keys()):
        n = counts[commandType]
        lst.append('%s:&nbsp;%s' % (commandType, n))
    return ' '.join(lst)


def getSummary(stats):
    lst = ['Stn:&nbsp;%s' % stats['numStations'],
           'Cmd:&nbsp;%s' % stats['numCommands']]
    lst.append(getSummaryOfCommandsByType(stats))
    return ' '.join(lst)
