# __BEGIN_LICENSE__
#Copyright (c) 2015, United States Government, as represented by the 
#Administrator of the National Aeronautics and Space Administration. 
#All rights reserved.
#
#The xGDS platform is licensed under the Apache License, Version 2.0 
#(the "License"); you may not use this file except in compliance with the License. 
#You may obtain a copy of the License at 
#http://www.apache.org/licenses/LICENSE-2.0.
#
#Unless required by applicable law or agreed to in writing, software distributed 
#under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
#CONDITIONS OF ANY KIND, either express or implied. See the License for the 
#specific language governing permissions and limitations under the License.
# __END_LICENSE__

from geocamUtil.loader import getClassByName

from django.conf import settings


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
