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

from django.conf.urls import url

from xgds_planner2 import views

urlpatterns = [
    url(r'^planIndex\.kml$', views.getPlanIndexKml, {}, name='planner2_planIndexKml'),
    url(r'^planIndexJson$', views.getPlanIndexJson, {}, name='planner2_planIndexJson'),
    url(r'^plan/(?P<plan_id>[^/]+)$', views.plan_save_from_relay, {}, name="planner2_save_plan_from_relay"),
    url(r'^plan/(?P<plan_id>[^/]+)/(?P<jsonPlanId>[^/\.]+)\.json$', views.plan_save_json, {}, name="planner2_plan_save_json"),
    url(r'^plan/save/(?P<plan_id>[^/]+)$', views.plan_save_json, {}, name="planner2_plan_save_json"),
    url(r'^plan/export/ajax/(?P<uuid>[\w-]+)/(?P<name>[^/]+)$', views.planExport, {'isAjax': True, }, name='planner2_planExport_ajax'),
    url(r'^plan/export/(?P<uuid>[\w-]+)/(?P<name>[^/]+)$', views.planExport, {}, name='planner2_planExport'),
    url(r'^plan/export/(?P<uuid>[\w-]+)/(?P<name>[^/]+)/(?P<time>([\w-]+([\w]+[:]+)+[\w]+)*)$', views.planExport, {}, name='planner2_planExportTime'),
    url(r'^schedulePlanActive/(?P<vehicleName>\w+)/(?P<planPK>[\d]+)$', views.schedulePlanActiveFlight, {}, "planner2_schedulePlan_active"),
    url(r'^relaySchedulePlan/$', views.relaySchedulePlan, {}, "planner2_relaySchedulePlan"),
    url(r'plansTreeNodes$', views.plansTreeNodes, {}, 'planner2_plansTreeNodes'),
    url(r'mapJsonPlan/(?P<uuid>[\w-]+)$', views.mapJsonPlan, {}, 'planner2_mapJsonPlan'),
    url(r'mapJsonPlanPK/(?P<pk>[\d]+)$', views.mapJsonPlan, {}, 'planner2_mapJsonPlan'),
    url(r'getLastChangedPlanIdForUser/(?P<username>\w+)$', views.get_last_changed_planID_for_user_json, {}, 'planner2_getLastChangedPlanIdForUser'),
    url(r'^import/xpjson/$', views.planImportXPJson, {}, name='planner2_planImport_xpjson'),
    url(r'^plans/today/json$', views.getTodaysPlansJson, {}, name="planner2_today_plans_json"),

    ]
