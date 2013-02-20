# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

from django.conf.urls.defaults import url, patterns
from django.views.generic.simple import direct_to_template

from xgds_planner2 import views

urlpatterns = patterns(
    '',

    #url(r'^$', direct_to_template, {'template': 'planner_app.html'}, name='planner2'),
    url(r'^index/$', views.planIndex, {}, name='planner2_index'),
    url(r'^edit/(?P<plan_name>[^/]+)$', views.plan_editor_app, {}, name='planner2j_edit'),
    url(r'^plan/(?P<name>[^/]+)\.json$', views.plan_REST, {}, name="planner2_planREST"),
    url(r'^plan/export/(?P<uuid>[\w-]+)/(?P<name>[^/]+)$', views.planExport, {}, name='planner2_planExport'),
    #url(r'^templates.json$', views.aggregate_handlebars_templates, {}, name='planner_handlebars_templates'),

)
