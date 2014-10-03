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


###
# DJANGO-PIPELINE ADDENDUM:

For this module to work, the site-level config file (siteSettings.py), must
merge the XGDS_PLANNER_PIPELINE_JS and XGDS_PLANNER_PIPELINE_CSS settings
into global PIPELINE_{JS|CSS} settings dicts.

If no other django-pipeline includes are defined,
the relevant siteSettings.py secion might look like this:

PIPELINE_JS = {}
PIPELINE_JS.update(plannerSettings.XGDS_PLANNER_PIPELINE_JS)

PIPELINE_CSS = {}
PIPELINE_CSS.update(plannerSettings.XGDS_PLANNER_PIPELINE_CSS)

#
###
"""

import os

XGDS_PLANNER_OFFLINE = False  # Don't load google earth if this is true
XGDS_PLANNER_TEMPLATE_DEBUG = True  # If this is true, handlebars templates will not be cached.
XGDS_PLANNER_MAP_ROTATION_HANDLES = True
XGDS_PLANNER_DIRECTIONAL_STATIONS = True

XGDS_PLANNER_PIPELINE_JS = {
    'planner_app': {
        'source_filenames': (

            'external/js/jquery/jquery.min.js',
            'external/js/jquery/jquery.migrate.min.js',
            'external/js/jquery/jquery-ui.js',
            'external/js/lodash.js',
            'external/js/handlebars.js',
            'external/js/backbone.js',
            'external/js/backbone.marionette.js',
            'external/js/backbone-relational.js',
            'external/js/backbone-forms.0.13.0.js',
            'external/js/bootstrap.min.js',
            'external/js/extensions-0.2.1.pack.js',
            'external/js/string-format.js',
            'external/js/kmltree.min.js',
            'external/js/usng.js',
            'external/js/proj4-2.2.1.js',

            'xgds_planner2/js/handlebars-helpers.js',
            'xgds_planner2/js/geo.js',
            'xgds_planner2/js/forms.js',
            'xgds_planner2/js/app.js',
            'xgds_planner2/js/models.js',
            'xgds_planner2/js/views.js',
            'xgds_planner2/js/mapviews.js',
            'xgds_planner2/js/router.js',
            'xgds_planner2/js/simulatorDriver.js',
        ),
        'output_filenames': 'js/planner_app.js'
    },
    # must create 'simulator' entry in top-level siteSettings.py
    'xgds_planner2_testing': {
        'source_filenames': (
            'external/js/qunit-1.12.0.js',
            'xgds_planner2/js/tests.js',
        ),
        'output_filenames': 'js/planner_tests.js'
    }
}

XGDS_PLANNER_PIPELINE_CSS = {
    'planner_app': {
        'source_filenames': (
            'external/css/bootstrap.css',
            'external/css/backbone.forms.default.css',
            'external/css/kmltree.css',
            'external/css/jquery/jquery-ui.css',
            'xgds_planner2/css/planner.css',
        ),
        'output_filenames': 'css/planner_app.css',
        'template_name': 'xgds_planner2/pipelineCSS.css',
    },
    'xgds_planner2_testing': {
        'source_filenames': (
            'external/css/qunit-1.12.0.css',
        ),
        'output_filenames': 'css/planner_tests.css',
    },
}

_thisDir = os.path.dirname(__file__)

# list of (formatCode, extension, exporterClass)
XGDS_PLANNER_PLAN_EXPORTERS = (
    ('xpjson', '.json', 'xgds_planner2.planExporter.XpjsonPlanExporter'),
    ('kml', '.kml', 'xgds_planner2.kmlPlanExporter.KmlPlanExporter'),
    ('stats', '-stats.json', 'xgds_planner2.statsPlanExporter.StatsPlanExporter'),
    ('pml', '.pml', 'xgds_planner2.pmlPlanExporter.PmlPlanExporter'),
)

# list of (formatCode, extension, importerClass)
XGDS_PLANNER_PLAN_IMPORTERS = (
    ('kml', '.kml', 'xgds_planner2.kmlPlanImporter.KmlLineStringPlanImporter'),
)

# kml root from xgds_map_server
XGDS_PLANNER_LAYER_FEED_URL = "/xgds_map_server/feed/all/?logo=0"

XGDS_PLANNER2_PLAN_MODEL = "xgds_planner2.Plan"
XGDS_PLANNER2_FLIGHT_MODEL = "xgds_planner2.Flight"
XGDS_PLANNER2_GROUP_FLIGHT_MODEL = "xgds_planner2.GroupFlight"
XGDS_PLANNER2_VEHICLE_MODEL = 'xgds_planner2.Vehicle'

# OVERRIDE this in your sitesettings to have a custom plan create, note that since it's in site settings you can't have a reverse lookup.
XGDS_PLANNER2_CREATE_URL = "/xgds_planner2/plan/create"

# Schema used to be set in the settings, now they are set in the PlanSchema database table.
# XGDS_PLANNER_SCHEMAS = [
# ]

# XGDS_PLANNER_SCHEMAS: A list of XPJSON schemas available in the
# planner. Notes:
#
# * @schemaSource and @librarySource are paths relative to the PROJ_ROOT
#   base directory for the site. They point to the XPJSON PlanSchema and
#   PlanLibrary source files.  One of the steps within 'manage.py prep'
#   is 'prepapps'. During that step, those files are processed by
#   compileXpjson.py and the simplified/canonical versions are written
#   to the build/static/xgds_planner2 directory.  The client-side JS
#   reads the simplified versions from there.
#
# * @simulatorUrl is relative to STATIC_URL. It should point to a JavaScript
#   file that defines the simulator model for the schema. The model is loaded
#   as part of the client-side planner JS.
#
# * @simulator is the JavaScript name of the simulator module defined by
#   the file at @simulatorUrl.
#
XGDS_PLANNER_SCHEMAS = {
    "test": {
        "schemaSource": "apps/xgds_planner2/testing/examplePlanSchema.json",
        "librarySource": "apps/xgds_planner2/testing/examplePlanLibrary.json",
        "simulatorUrl": "xgds_planner2/testing/exampleSimulator.js",
        "simulator": "xgds_planner2.ExampleSimulator",
    }
}


# XGDS_PLANNER_COMMAND_RENDERER_SCRIPTS javascript files to be included by the  mapviews.js
# to support custom command rendering
XGDS_PLANNER_COMMAND_RENDERER_SCRIPTS = ()

# XGDS_PLANNER_COMMAND_RENDERERS - A dict of Command type to javascript file to be used in the mapviews.js
# to render a command in a custom way.
# see xgds_kn for example
XGDS_PLANNER_COMMAND_RENDERERS = {}

# XGDS_PLANNER_EARTH_LOADED_CALLBACK: The fully qualified name of an
# extra JavaScript callback to call after Google Earth is loaded.
XGDS_PLANNER_EARTH_LOADED_CALLBACK = 'null'

# If this is defined (true) then include the scheduling & flight management features in display
# IMPORTANT YOU MUST INCLUDE THIS IN SITE SETTINGS
# TEMPLATE_CONTEXT_PROCESSORS = (global_settings.TEMPLATE_CONTEXT_PROCESSORS + (
#     ...
#     'geocamUtil.context_processors.settings'
XGDS_PLANNER2_SCHEDULE_INCLUDED = None

# Test skipping variables. Set to true if code somewhere else overrides
# some functionality in the planner.
XGDS_PLANNER2_TEST_SKIP_INDEX = False
XGDS_PLANNER2_TEST_SKIP_EDIT = False
XGDS_PLANNER2_TEST_SKIP_DOC = False
XGDS_PLANNER2_TEST_SKIP_PLAN_REST = False
XGDS_PLANNER2_TEST_SKIP_PLAN_EXPORT = False
XGDS_PLANNER2_TEST_SKIP_CREATE_PLAN_PAGE = False
XGDS_PLANNER2_TEST_SKIP_CREATE_PLAN = False

# This is used to hold a map of site frames, so we can convert lat/long to the closest site frame.
# It is initialized by calling views.getSiteFrames().
XGDS_PLANNER2_SITE_FRAMES = []
