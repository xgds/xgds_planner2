# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import glob
import json
from django.shortcuts import render_to_response
from django.http import HttpResponseRedirect, HttpResponseForbidden, Http404, HttpResponse
from django.template import RequestContext
# from django.utils.translation import ugettext, ugettext_lazy as _

HANDLEBARS_TEMPLATES_DIR = os.path.join( os.path.dirname( __file__ ), 'templates/handlebars' )
_template_cache = None

def get_handlebars_templates():
    global _template_cache
    if not _template_cache:
        templates = {}
        for template_file in glob.glob( os.path.join( HANDLEBARS_TEMPLATES_DIR, '*.handlebars' ) ):
            with open(template_file, 'r') as infile:
                template_name = os.path.splitext( os.path.basename(template_file) )[0]
                templates[template_name] = infile.read()
        _template_cache = templates
    return _template_cache
    

def aggregate_handlebars_templates(request):
    """
    Return a JSON object containing all the Hanlepars templates in the 
    appropriate templates directory, indexed by name.
    """
    return HttpResponse( json.dumps( get_handlebars_templates() ), content_type='application/json' )

def plan_editor_app(request):
    templates = get_handlebars_templates()
    
    return render_to_response(
        'planner_app.html', 
        RequestContext(request, {
            'templates': templates,
        }), 
        #context_instance=RequestContext
    )
