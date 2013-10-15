# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from xgds_planner2 import settings
from geocamUtil import loader


class ExporterInfo(object):
    def __init__(self, formatCode, extension, exporterClass):
        self.formatCode = formatCode
        self.extension = extension
        self.exporterClass = exporterClass
        self.label = exporterClass.label
        self.url = None


PLAN_EXPORTERS = []
PLAN_EXPORTERS_BY_FORMAT = {}
for _formatCode, _extension, _exporterClassName in settings.XGDS_PLANNER_PLAN_EXPORTERS:
    _exporterInfo = ExporterInfo(_formatCode,
                                 _extension,
                                 loader.getClassByName(_exporterClassName))
    PLAN_EXPORTERS.append(_exporterInfo)
    PLAN_EXPORTERS_BY_FORMAT[_formatCode] = _exporterInfo
