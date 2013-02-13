# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import glob
import json

from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponseForbidden, Http404, HttpResponse
from django.template import RequestContext

from xgds_planner2 import settings, models

HANDLEBARS_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'templates/handlebars')
_template_cache = None


def get_handlebars_templates():
    global _template_cache
    if settings.XGDS_PLANNER_TEMPLATE_DEBUG or not _template_cache:
        templates = {}
        for template_file in glob.glob(os.path.join(HANDLEBARS_TEMPLATES_DIR, '*.handlebars')):
            with open(template_file, 'r') as infile:
                template_name = os.path.splitext(os.path.basename(template_file))[0]
                templates[template_name] = infile.read()
        _template_cache = templates
    return _template_cache


def aggregate_handlebars_templates(request):
    """
    Return a JSON object containing all the Handlebars templates in the
    appropriate templates directory, indexed by name.
    """
    return HttpResponse(json.dumps(get_handlebars_templates()), content_type='application/json')


def plan_editor_app(request):
    templates = get_handlebars_templates()

    with open(os.path.join(os.path.dirname(__file__), 'xpjsonSpec/examplePlanSchema.json')) as plan_schema_file:
        plan_schema_json = plan_schema_file.read()

    plan_json = models.Plan.objects.latest('pk').jsonPlan

    return render_to_response(
        'xgds_planner2/planner_app.html',
        RequestContext(request, {
            'templates': templates,
            'settings': settings,
            'plan_schema_json': plan_schema_json,
            'plan_json': plan_json,
        }),
        # context_instance=RequestContext
    )


def planIndex(request):
    """
    For the moment this is a handy classic-Django place to hang links to
    new server-side planner features.  It could certainly be replaced or
    complemented with a nice index API method for rich JavaScript
    clients.
    """
    return render_to_response(
        'xgds_planner2/planIndex.html',
        {
            'plans': models.Plan.objects.all()
        },
        context_instance=RequestContext(request))


def getPlan(uuid):
    return get_object_or_404(models.Plan, uuid=uuid)


def jsonText(obj, compact=False):
    if compact:
        return json.dumps(obj, separators=',:')
    else:
        return json.dumps(obj, sort_keys=True, indent=4)


def jsonResponse(obj, compact=False):
    text = jsonText(obj, compact)
    return HttpResponse(text, content_type='application/json')


def planExport(request, uuid, name):
    dbPlan = getPlan(uuid)

    formatCode = request.GET.get('format')
    if formatCode is not None:
        # user explicitly specified e.g. '?format=kml'
        exporterClass = models.PLAN_EXPORTERS_BY_FORMAT.get(formatCode)
        if exporterClass is None:
            return HttpResponseInvalidRequest('invalid export format %s' % formatCode)
    else:
        # filename ends with e.g. '.kml'
        for entry in models.PLAN_EXPORTERS:
            if name.endswith(entry['extension']):
                exporterClass = entry['exporterClass']

    exporter = exporterClass()
    return exporter.getHttpResponse(dbPlan)
