
**Import {{settings.XGDS_PLANNER_PLAN_MONIKER }}** lets you create a new {{settings.XGDS_PLANNER_PLAN_MONIKER }} via an import.

Import {{settings.XGDS_PLANNER_PLAN_MONIKER }} currently supports:
 * kml files containing a LineString
 * csv files with column headers including latitude and longitude, and optionally name and notes.  Extra columns may be present but they will be ignored
 * xpJson files exported from xGDS

The options are the same as when creating a new {{settings.XGDS_PLANNER_PLAN_MONIKER }}.

Options
-------

{{settings.XGDS_PLANNER_PLAN_MONIKER }} number:
    Used to generate the original name and ids within the {{settings.XGDS_PLANNER_PLAN_MONIKER }}.

{{settings.XGDS_PLANNER_PLAN_MONIKER }} version:
    Used to set the original version and ids within the {{settings.XGDS_PLANNER_PLAN_MONIKER }}.

Platform:
    What vehicle this {{settings.XGDS_PLANNER_PLAN_MONIKER }} is for.

Region:
    What region on the map contains this {{settings.XGDS_PLANNER_PLAN_MONIKER }}.

Sourcefile:
    The kml, csv or xpJson file you wish to import.


.. o __BEGIN_LICENSE__
.. o  Copyright (c) 2015, United States Government, as represented by the
.. o  Administrator of the National Aeronautics and Space Administration.
.. o  All rights reserved.
.. o
.. o  The xGDS platform is licensed under the Apache License, Version 2.0
.. o  (the "License"); you may not use this file except in compliance with the License.
.. o  You may obtain a copy of the License at
.. o  http://www.apache.org/licenses/LICENSE-2.0.
.. o
.. o  Unless required by applicable law or agreed to in writing, software distributed
.. o  under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
.. o  CONDITIONS OF ANY KIND, either express or implied. See the License for the
.. o  specific language governing permissions and limitations under the License.
.. o __END_LICENSE__
