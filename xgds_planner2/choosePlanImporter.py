# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import sys

from geocamUtil.loader import getClassByName

from xgds_planner2 import settings


def getModClass(name):
    """converts 'xgds_planner.forms.PlanMetaForm' to ['xgds_planner.forms', 'PlanMetaForm']"""
    try:
        dot = name.rindex('.')
    except ValueError:
        return name, ''
    return name[:dot], name[dot + 1:]


class ImporterInfo(object):
    def __init__(self, formatCode, extension, importerClass):
        self.formatCode = formatCode
        self.extension = extension
        self.importerClass = importerClass
        self.label = importerClass.label

PLAN_IMPORTERS = []
PLAN_IMPORTERS_BY_FORMAT = {}
for _formatCode, _extension, _importerClassName in settings.XGDS_PLANNER_PLAN_IMPORTERS:
    _importerInfo = ImporterInfo(_formatCode,
                                 _extension,
                                 getClassByName(_importerClassName))
    PLAN_IMPORTERS.append(_importerInfo)
    PLAN_IMPORTERS_BY_FORMAT[_formatCode] = _importerInfo


def chooseImporter(name, formatCode=None):
    if formatCode is not None:
        importerClass = PLAN_IMPORTERS_BY_FORMAT.get(formatCode)
    else:
        importerClass = None
        for entry in PLAN_IMPORTERS:
            if name.endswith(entry.extension):
                importerClass = entry.importerClass
                break
    return importerClass
