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

from geocamUtil.SettingsUtil import getOrCreateArray
"""
This app may define some new parameters that can be modified in the
Django settings module.  Let's say one such parameter is FOO.  The
default value for FOO is defined in this file, like this:

  FOO = 'my default value'

If the admin for the site doesn't like the default value, they can
override it in the site-level settings module, like this:

  FOO = 'a better value'

Other modules can access the value of FOO like this:

  from django.conf import settings
  print settings.FOO

Don't try to get the value of FOO from django.conf.settings.  That
settings object will not know about the default value!


###
# DJANGO-PIPELINE ADDENDUM:

For this module to work, the site-level config file (siteSettings.py), must
merge the XGDS_PLANNER_PIPELINE_JS and XGDS_PLANNER_PIPELINE_CSS settings
into global PIPELINE_{JS|CSS} settings dicts.

If no other django-pipeline includes are defined,
the relevant siteSettings.py section might look like this:

PIPELINE_JS = {}
PIPELINE_JS.update(plannerSettings.XGDS_PLANNER_PIPELINE_JS)

PIPELINE_CSS = {}
PIPELINE_CSS.update(plannerSettings.XGDS_PLANNER_PIPELINE_CSS)

#
###
"""

import os
from geocamUtil.SettingsUtil import getOrCreateDict

XGDS_PLANNER_OFFLINE = False  # Don't load google earth if this is true
XGDS_PLANNER_MAP_ROTATION_HANDLES = True
XGDS_PLANNER_DIRECTIONAL_STATIONS = True

#                              'external/js/jquery/jquery.migrate.min.js',

XGDS_PLANNER_PIPELINE_JS = {
    'planner_app': {
        'source_filenames': ('jquery/dist/jquery.min.js',
                             'jquery-migrate-official/src/migrate.js',
                             'jquery-ui/jquery-ui.min.js',
                             'handlebars/dist/handlebars.min.js',
                             'backbone/backbone.js',
                             'backbone.wreqr/lib/backbone.wreqr.min.js',
                             'backbone.babysitter/lib/backbone.babysitter.min.js',
                             'backbone-relational/backbone-relational.js',
                             'backbone-forms/distribution/backbone-forms.min.js',
                             'marionette/lib/backbone.marionette.min.js',
                             'string-format/lib/string-format.js',
                             'usng/usng.js',
                             'proj4/dist/proj4.js',
                             'xgds_map_server/js/util/handlebars-helpers.js',
                             'xgds_map_server/js/util/geo.js',
                             'xgds_map_server/js/util/forms.js',
                             'xgds_planner2/js/plannerApp.js',
                             'xgds_planner2/js/plannerModels.js',
                             'xgds_planner2/js/olPlannerStyles.js',
                             'xgds_planner2/js/plannerLinksViews.js',
                             'xgds_planner2/js/plannerToolsViews.js',
                             'xgds_planner2/js/plannerScheduleViews.js',
                             'xgds_planner2/js/plannerViews.js',
                             'xgds_planner2/js/map_viewer/olMapViews.js',
                             'xgds_planner2/js/olStationViews.js',
                             'xgds_planner2/js/olSegmentViews.js',
                             'xgds_planner2/js/olPlanViews.js',
                             'xgds_planner2/js/simulatorDriver.js'
                             ),
        'output_filename': 'js/compiled_planner_app.js'
    },
    'custom_map': {'source_filenames': ('xgds_map_server/js/map_viewer/olShowMapCoords.js',
                                        'xgds_map_server/js/map_viewer/olInitialLayers.js',
                                        'xgds_planner2/js/uploadJson.js',
                                        ),
      'output_filename': 'js/custom_map.js',
      },

    # must create 'simulator' entry in top-level siteSettings.py
    #TODO update, qunit is installed with bower
    'xgds_planner2_testing': {
        'source_filenames': (
            'external/js/qunit-1.12.0.js',
            'xgds_planner2/js/tests.js',
        ),
        'output_filename': 'js/planner_tests.js'
    }
}

XGDS_PLANNER_PIPELINE_CSS = {
    'planner_app': {
        'source_filenames': (
                             'jquery-ui/themes/base/jquery-ui.css',
                             # for some reason compressing this in the css does not work so it's separate in the planner_app
                             # 'backbone-forms/distribution/templates/old.css',
                             'xgds_planner2/css/planner.css',
                             #'xgds_planner2/css/forms_adjust.css',
                             ),
        'output_filename': 'css/planner_app.css',
        'template_name': 'xgds_planner2/pipelineCSS.css',
    },
    'xgds_planner2_testing': {
        'source_filenames': (
            'qunit/qunit/qunit.css',
        ),
        'output_filename': 'css/planner_tests.css',
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
    ('csv', '.csv', 'xgds_planner2.csvPlanImporter.CSVPlanImporter'),
)

# kml root from xgds_map_server
XGDS_PLANNER2_LAYER_FEED_URL = "/xgds_map_server/treejson/"

XGDS_PLANNER2_LINE_WIDTH_PIXELS = 3


XGDS_PLANNER2_PLAN_MODEL = "xgds_planner2.Plan"
XGDS_PLANNER2_PLAN_MONIKER = "Plan"
XGDS_PLANNER2_FLIGHT_MODEL = "xgds_planner2.Flight"
XGDS_PLANNER2_ACTIVE_FLIGHT_MODEL = "xgds_planner2.ActiveFlight"
XGDS_PLANNER2_GROUP_FLIGHT_MODEL = "xgds_planner2.GroupFlight"
XGDS_PLANNER2_VEHICLE_MODEL = 'xgds_planner2.Vehicle'
XGDS_PLANNER2_FLIGHT_MONIKER = "Flight"
XGDS_PLANNER2_GROUP_FLIGHT_MONIKER = "Group Flight"
XGDS_PLANNER2_PLAN_EXECUTION_MODEL = "xgds_planner2.PlanExecution"
XGDS_PLANNER2_STATION_MONIKER = "Station"
XGDS_PLANNER2_STATION_MONIKER_PLURAL = "Stations"
XGDS_PLANNER2_SEGMENT_MONIKER = "Segment"
XGDS_PLANNER2_SEGMENT_MONIKER_PLURAL = "Segments"
XGDS_PLANNER2_COMMAND_MONIKER = "Command"
XGDS_PLANNER2_COMMAND_MONIKER_PLURAL = "Commands"

#TODO to have a default site frame in the creation form, set this to the site id from your plan library.
XGDS_PLANNER2_DEFAULT_SITE = None


# Method to add stuff to context for plan editor, override and register your own method if you need it.
# It must add a json dictionary called extras
XGDS_PLANNER2_EDITOR_CONTEXT_METHOD = 'xgds_planner2.views.addToEditorContext'

# Method to add stuff to planExecution if you are not doing the basic planExecution.
# This gets invoked from schedulePlans call in views.py
XGDS_PLANNER2_SCHEDULE_EXTRAS_METHOD = None


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

XGDS_PLANNER2_HANDLEBARS_DIRS = [os.path.join('xgds_planner2', 'templates', 'handlebars'),
                                 os.path.join('xgds_map_server', 'templates', 'handlebars', 'search')]

XGDS_PLANNER2_PLAN_BEARING_HANDLEBAR_PATH = 'xgds_planner2/templates/xgds_planner2/bearingDistancePlan.handlebars'
# XGDS_PLANNER2_LINKS_LOADED_CALLBACK: The fully qualified name of an
# extra JavaScript callback to call after the links tab is loaded.
XGDS_PLANNER2_LINKS_LOADED_CALLBACK = 'null'

# This is used to hold a map of site frames, so we can convert lat/long to the closest site frame.
# It is initialized by calling views.getSiteFrames().
XGDS_PLANNER2_SITE_FRAMES = []

XGDS_MAP_SERVER_JS_MAP = getOrCreateDict('XGDS_MAP_SERVER_JS_MAP')
XGDS_MAP_SERVER_JS_MAP['Plan'] = {'ol': 'xgds_planner2/js/olPlanMap.js',
                                  'model': XGDS_PLANNER2_PLAN_MODEL,
                                  'hiddenColumns': ['stations', 'type', 'id']}

XGDS_DATA_MASKED_FIELDS = getOrCreateDict('XGDS_DATA_MASKED_FIELDS')
XGDS_DATA_MASKED_FIELDS['xgds_planner2'] = {'Plan': ['uuid',
                                                     'dateModified',
                                                     'jsonPlan',
                                                     'deleted',
                                                     'readOnly',
                                                     'numStations',
                                                     'numSegments',
                                                     'numCommands',
                                                     'stats'
                                                     ]
                                            }
# If you have callbacks to be connected to the planner, register them as follows
# XGDS_PLANNER2_CALLBACK = [(MODIFY,'my.planner.modify.callback', PYTHON),
#                           (SAVE,'my.planner.save.callback', JAVASCRIPT)] 
# they will be executed in order either when the plan is modified or when the plan is saved.
# If it is a Python method, it will happen on the back end after modification or save.
# If it is a javascript method, it will happen on the front end after modification or save.
# If it is an 'exec' method, it will happen on the back end after modification or save.
MODIFY = 'Modify'
SAVE = 'Save'
DELETE = 'Delete'
JAVASCRIPT = 'JavaScript'
PYTHON = 'Python'
EXEC = 'Exec'
XGDS_PLANNER2_CALLBACK = []

# If you will be plotting values in the flot plot chart, register functions here.
# You must also then include the javascript library that has that function implemented.
# Dictionary should be: legible name: namespace of library

XGDS_PLANNER2_PLOTS = {}

# Uncomment the below to see plannerSamplePlot.js, and include it in planner_app_base
# XGDS_PLANNER2_PLOTS['Sample'] = 'sample_plot'

# Turn on to enable plan validation support and UI
XGDS_PLANNER2_VALIDATION = False