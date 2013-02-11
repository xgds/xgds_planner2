# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

"""
This app may define some new parameters that can be modified in the
Django settings module.  Let's say one such parameter is FOO.  The
default value for FOO is defined in this file, like this:

  FOO = 'my default value'

If the admin for the site doesn't like the default value, they can
override it in the site-level settings module, like this:

  FOO = 'a better value'

Other modules can access the value of FOO like this:

  from xgds_planner2 import settings
  print settings.FOO

Don't try to get the value of FOO from django.conf.settings.  That
settings object will not know about the default value!
"""

XGDS_PLANNER_OFFLINE = False  # Don't load google earth if this is true
XGDS_PLANNER_TEMPLATE_DEBUG = True  # If this is true, handlebars templates will not be cached.

XGDS_PLANNER_PIPELINE_JS = {
    'planner_app': {
        'source_filenames': (

            'external/js/jquery-1.9.0.min.js',
            'external/js/lodash.js',
            'external/js/handlebars.js',
            'external/js/backbone.js',
            'external/js/backbone.marionette.js',
            'external/js/bootstrap.min.js',

            'xgds_planner2/js/app.js',
            'xgds_planner2/js/models.js',
            'xgds_planner2/js/views.js',
            'xgds_planner2/js/mapviews.js',
            'xgds_planner2/js/router.js',
        ),
        'output_filenames': 'js/planner_app.js'
    },
}

XGDS_PLANNER_PIPELINE_CSS = {
    'planner_app': {
        'source_filenames': (
            'external/css/bootstrap.css',
            'xgds_planner2/css/planner.css',
        ),
        'output_filenames': 'css/planner_app.css',
    },
}
