# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from xgds_planner2 import settings
from geocamUtil import loader


class ExporterInfo(object):
    def __init__(self, formatCode, extension, exporterClass, customLabel=None):
        self.formatCode = formatCode
        self.extension = extension
        self.exporterClass = exporterClass
        if customLabel:
            self.label = customLabel
        else:
            self.label = exporterClass.label
        self.url = None


PLAN_EXPORTERS = []
PLAN_EXPORTERS_BY_FORMAT = {}
for exporterInfo in settings.XGDS_PLANNER_PLAN_EXPORTERS:
    #_formatCode, _extension, _exporterClassName, _customLabel
    _formatCode = exporterInfo[0]
    _extension = exporterInfo[1]
    _exporterClassName = exporterInfo[2]
    _customLabel = None
    if len(exporterInfo) > 3:
        _customLabel = exporterInfo[3]
    _exporterInfo = ExporterInfo(_formatCode,
                                 _extension,
                                 loader.getClassByName(_exporterClassName),
                                 _customLabel)
    PLAN_EXPORTERS.append(_exporterInfo)
    PLAN_EXPORTERS_BY_FORMAT[_formatCode] = _exporterInfo
