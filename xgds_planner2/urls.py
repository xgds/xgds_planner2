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
    url(r'^index/$', views.planIndex, {}, name='planner2_index'),
    url(r'^edit/(?P<plan_id>[^/]+)$', views.plan_editor_app, {}, name='planner2_edit'),
    url(r'^test/(?P<plan_id>[^/]+)$', views.plan_tests, {}, name='planner2_tests'),
    url(r'^doc/(?P<plan_id>[^/]+)$', views.plan_detail_doc, {}, name='planner2_doc'),
    url(r'^plan/(?P<plan_id>[^/]+)$', views.plan_save_from_relay, {}, name="planner2_save_plan_from_relay"),
    url(r'^plan/(?P<plan_id>[^/]+)/(?P<jsonPlanId>[^/\.]+)\.json$', views.plan_save_json, {}, name="planner2_plan_save_json"),
    url(r'^rest/plan/(?P<plan_id>[^/]+)$', views.plan_save_json, {}, name="planner2_plan_save_json"),
    url(r'^plan/bearingDistance/(?P<plan_id>[^/]+)$', views.plan_bearing_distance_view, {}, name='plan_bearing_distance'),
    url(r'^plan/bearingDistanceTop/(?P<plan_id>[^/]+)$', views.plan_bearing_distance_top_view, {}, name='plan_bearing_distance_top'),
    url(r'^plan/export/ajax/(?P<uuid>[\w-]+)/(?P<name>[^/]+)$', views.planExport, {'isAjax': True, }, name='planner2_planExport_ajax'),
    url(r'^plan/export/(?P<uuid>[\w-]+)/(?P<name>[^/]+)$', views.planExport, {}, name='planner2_planExport'),
    url(r'^plan/export/(?P<uuid>[\w-]+)/(?P<name>[^/]+)/(?P<time>([\w-]+([\w]+[:]+)+[\w]+)*)$', views.planExport, {}, name='planner2_planExportTime'),
    url(r'^plan/create/$', views.planCreate, {}, name='planner2_planCreate'),
    url(r'^help/$', views.plan_help, {}, name='planner2_help'),
    url(r'^delete/$', views.plan_delete, {}, name="planner2_delete"),
    url(r'^toggleReadOnly/$', views.toggleReadOnly, {}, name="planner2_toggleReadOnly"),
    url(r'^list/$', views.listFlownFlights, {}, "planner2_flownFlights"),
    url(r'^updateToday/$', views.updateTodaySession, {}, "planner2_updateToday"),
    url(r'startFlight/(?P<uuid>[\w-]+)$', views.startFlight, {}, 'planner2_startFlight'),
    url(r'stopFlight/(?P<uuid>[\w-]+)$', views.stopFlight, {}, 'planner2_stopFlight'),
    url(r'startTracking/(?P<flightName>\w+)$', views.startFlightTracking, {}, 'planner2_startFlightTracking'),
    url(r'stopTracking/(?P<flightName>\w+)$', views.stopFlightTracking, {}, 'planner2_stopFlightTracking'),
    url(r'^addGroupFlight/$', views.addGroupFlight, {}, "planner2_addGroupFlight"),
    url(r'^relayAddFlight/$', views.relayAddFlight, {}, "planner2_relayAddFlight"),
    url(r'^relayAddGroupFlight/$', views.relayAddGroupFlight, {}, "planner2_relayAddGroupFlight"),
    url(r'^schedulePlans/$', views.schedulePlans, {}, "planner2_schedulePlans"),
    url(r'^schedulePlan/$', views.schedulePlans, {'redirect': False}, "planner2_schedulePlan_ajax"),
    url(r'startPlan/(?P<pe_id>[\w-]+)$', views.startPlan, {}, 'planner2_startPlan'),
    url(r'stopPlan/(?P<pe_id>[\w-]+)$', views.stopPlan, {}, 'planner2_stopPlan'),
    url(r'deletePlanExecution/(?P<pe_id>[\w-]+)$', views.deletePlanExecution, {}, 'planner2_deletePlanExecution'),
    url(r'^manage/$', views.manageFlights, {}, "planner2_manage"),
    url(r'manage/help$', views.manageHelp, {}, 'planner2_manageFlightHelp'),
    # url(r'^templates.json$', views.aggregate_handlebars_templates, {}, name='planner_handlebars_templates'),
    url(r'oltest$', views.oltest, {}, 'planner2_oltest'),
    url(r'plansTreeNodes$', views.plansTreeNodes, {}, 'planner2_plansTreeNodes'),
    url(r'activeFlightsTreeNodes$', views.activeFlightsTreeNodes, {}, 'planner2_activeFlightsTreeNodes'),
    url(r'completedFlightsTreeNodes$', views.completedFlightsTreeNodes, {}, 'planner2_completedFlightsTreeNodes'),
    url(r'flightTreeNodes/(?P<flight_id>\d+)$', views.flightTreeNodes, {}, 'planner2_flightTreeNodes'),
    url(r'mapJsonPlan/(?P<uuid>[\w-]+)$', views.mapJsonPlan, {}, 'planner2_mapJsonPlan'),
    url(r'rest/mapJsonPlanPK/(?P<pk>[\d]+)$', views.mapJsonPlan, {}, 'planner2_mapJsonPlan'),
    url(r'rest/getLastChangedPlanIdForUser/(?P<username>\w+)$', views.get_last_changed_planID_for_user_json, {}, 'planner2_getLastChangedPlanIdForUser'),
    url(r'^import/xpjson/$', views.planImportXPJson, {}, name='planner2_planImport_xpjson'),
    url(r'^import/$', views.planImport, {}, name='planner2_planImport'),
    url(r'^summary/(?P<groupFlightName>\w+)$', views.getGroupFlightSummary, name="planner2_group_flight_summary"),
    url(r'^plans/today/json$', views.getTodaysPlansJson, {}, name="planner2_today_plans_json"),

    ]
