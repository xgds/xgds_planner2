#!/usr/bin/env python
#  __BEGIN_LICENSE__
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
# __END_LICENSE__
import os

import django
django.setup()
from django.conf import settings

from shutil import copy

from xgds_planner2 import compileXpjson

if __name__=='__main__':
    for name, plan_definition in settings.XGDS_PLANNER_SCHEMAS.iteritems():
        copy(os.path.join(settings.PROJ_ROOT, plan_definition['schemaSource']), os.path.join(settings.STATIC_ROOT, 'xgds_planner2/'))
        copy(os.path.join(settings.PROJ_ROOT, plan_definition['librarySource']), os.path.join(settings.STATIC_ROOT, 'xgds_planner2/'))
    compileXpjson.compileXpjson()
