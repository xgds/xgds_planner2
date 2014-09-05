# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.conf.urls import url, patterns

from xgds_planner2 import views

urlpatterns = patterns(
    '',

    # url(r'^$', direct_to_template, {'template': 'planner_app.html'}, name='planner2'),
    url(r'^planIndex\.kml$', views.getPlanIndexKml,{'readOnly': True, 'loginRequired': False}, name='planner2_planIndexKml'),
    url(r'^index/$', views.planIndex, {}, name='planner2_index'),
    url(r'^edit/(?P<plan_id>[^/]+)$', views.plan_editor_app, {}, name='planner2_edit'),
    url(r'^test/(?P<plan_id>[^/]+)$', views.plan_tests, {}, name='planner2_tests'),
    url(r'^doc/(?P<plan_id>[^/]+)$', views.plan_detail_doc, {}, name='planner2_doc'),
    url(r'^plan/(?P<plan_id>[^/]+)/(?P<jsonPlanId>[^/\.]+)\.json$', views.plan_REST, {}, name="planner2_planREST"),
    url(r'^plan/export/(?P<uuid>[\w-]+)/(?P<name>[^/]+)$', views.planExport, {'readOnly': True, 'loginRequired': False}, name='planner2_planExport'),
    url(r'^plan/create/$', views.planCreate, {}, name='planner2_planCreate'),
    url(r'^help/$', views.plan_help, {}, name='planner2_help'),
    url(r'^delete/$', views.plan_delete, {}, name="planner2_delete"),
    url(r'^manageFlight/$', views.manageFlight, {}, "planner2_manageFlight"),
    url(r'startFlight/$', views.startFlight, {'loginRequired': True}, 'planner2_startFlight'),
    url(r'stopFlight/$', views.stopFlight, {'loginRequired': True}, 'planner2_stopFlight'),
    url(r'^addGroupFlight/$', views.addGroupFlight, {}, "planner2_addGroupFlight"),


    # url(r'^templates.json$', views.aggregate_handlebars_templates, {}, name='planner_handlebars_templates'),

)
