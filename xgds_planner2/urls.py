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

from django.conf.urls import url, include

from xgds_planner2 import views

urlpatterns = [
    url(r'^index/$', views.planIndex, {}, name='planner2_index'),
    url(r'^edit/(?P<plan_id>[^/]+)$', views.plan_editor_app, {}, name='planner2_edit'),
    url(r'^test/(?P<plan_id>[^/]+)$', views.plan_tests, {}, name='planner2_tests'),
    url(r'^doc/(?P<plan_id>[^/]+)$', views.plan_detail_doc, {}, name='planner2_doc'),
    url(r'^plan/bearingDistance/(?P<plan_id>[^/]+)$', views.plan_bearing_distance_view, {}, name='plan_bearing_distance'),
    url(r'^plan/bearingDistance/crs/(?P<plan_id>[^/]+)$', views.plan_bearing_distance_view, {'crs':True}, name='plan_bearing_distance_crs'),
    url(r'^plan/bearingDistanceTop/(?P<plan_id>[^/]+)$', views.plan_bearing_distance_top_view, {}, name='plan_bearing_distance_top'),
    url(r'^plan/create/$', views.planCreate, {}, name='planner2_planCreate'),
    url(r'^help/$', views.plan_help, {}, name='planner2_help'),
    url(r'^delete/$', views.plan_delete, {}, name="planner2_delete"),
    url(r'^toggleReadOnly/$', views.toggleReadOnly, {}, name="planner2_toggleReadOnly"),
    url(r'^schedulePlans/$', views.schedulePlans, {}, "planner2_schedulePlans"),
    url(r'^schedulePlan/$', views.schedulePlans, {'redirect': False}, "planner2_schedulePlan_ajax"),
    url(r'startPlan/(?P<pe_id>[\w-]+)$', views.startPlan, {}, 'planner2_startPlan'),
    url(r'stopPlan/(?P<pe_id>[\w-]+)$', views.stopPlan, {}, 'planner2_stopPlan'),
    url(r'deletePlanExecution/(?P<pe_id>[\w-]+)$', views.deletePlanExecution, {}, 'planner2_deletePlanExecution'),
    url(r'^import/$', views.planImport, {}, name='planner2_planImport'),

    # Including these in this order ensures that reverse will return the non-rest urls for use in our server
    url(r'^rest/', include('xgds_planner2.restUrls')),
    url('', include('xgds_planner2.restUrls')),

    ]
