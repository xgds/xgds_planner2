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

from django.conf import settings
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
    # _formatCode, _extension, _exporterClassName, _customLabel
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
