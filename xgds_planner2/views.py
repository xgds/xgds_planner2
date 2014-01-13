# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import os
import glob
import json
import logging

from django.shortcuts import render, render_to_response, get_object_or_404
from django.http import (HttpResponseRedirect,
                         HttpResponse,
                         HttpResponseNotAllowed,
                         HttpResponseBadRequest)
from django.template import RequestContext
from django.core.urlresolvers import reverse
from django.contrib.auth.decorators import login_required

from xgds_planner2 import (settings,
                           models,
                           choosePlanExporter,
                           forms,
                           planImporter)

HANDLEBARS_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'templates/handlebars')
_template_cache = None

def get_plan_model():
    return models.getModelByName(settings.XGDS_PLANNER2_PLAN_MODEL)

def get_handlebars_templates(inp=HANDLEBARS_TEMPLATES_DIR):
    global _template_cache
    if settings.XGDS_PLANNER_TEMPLATE_DEBUG or not _template_cache:
        templates = {}
        for template_file in glob.glob(os.path.join(inp, '*.handlebars')):
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


def plan_REST(request, plan_id, jsonPlanId):
    """
    Read and write plan JSON.
    jsonPlanId is ignored.  It's for human-readabilty in the URL
    """
    Plan = get_plan_model()
    plan = Plan.objects.get(pk=plan_id)
    if request.method == "PUT":
        data = json.loads(request.raw_post_data)
        for k, v in data.iteritems():
            if k == "_simInfo":
                continue
            plan.jsonPlan[k] = v
#         print json.dumps(data, indent=4, sort_keys=True)
        plan.extractFromJson(overWriteDateModified=True)
        plan.save()
    return HttpResponse(json.dumps(plan.jsonPlan), content_type='application/json')

# with open(os.path.join(settings.STATIC_ROOT, 'xgds_planner2/schema.json')) as schemafile:
#     SCHEMA = schemafile.read()
# with open(os.path.join(settings.STATIC_ROOT, 'xgds_planner2/library.json')) as libraryfile:
#     LIBRARY = libraryfile.read()


def plan_detail_doc(request, plan_id=None):
    Plan = get_plan_model()
    plan = Plan.objects.get(pk=plan_id)
    plan_json = plan.jsonPlan
    if not plan_json.serverId:
        plan_json.serverId = plan.id
    if "None" in plan_json.url:
        plan_json.url = plan.get_absolute_url()

    planSchema = models.getPlanSchema(plan_json.platform.name)
    return render_to_response(
        'xgds_planner2/planDetailDoc.html',
        RequestContext(request,
                       {'plan_json': plan_json,
                        'plan_schema': json.loads(planSchema.getJsonSchema()),
                        'plan_library': json.loads(planSchema.getJsonLibrary())}))


def plan_editor_app(request, plan_id=None, editable=True):
    Plan = get_plan_model()
    templates = get_handlebars_templates()

    plan = Plan.objects.get(pk=plan_id)
    plan_json = plan.jsonPlan
    if not plan_json.serverId:
        plan_json.serverId = plan.id
    if "None" in plan_json.url:
        plan_json.url = plan.get_absolute_url()

    planSchema = models.getPlanSchema(plan_json.platform.name)
#     print planSchema.getJsonSchema();
    return render_to_response(
        'xgds_planner2/planner_app.html',
        RequestContext(request, {
            'templates': templates,
            'settings': settings,
            'plan_schema_json': planSchema.getJsonSchema(),  # xpjson.dumpDocumentToString(planSchema.getSchema()),
            'plan_library_json': planSchema.getJsonLibrary(),  # xpjson.dumpDocumentToString(planSchema.getLibrary()),
            'plan_json': json.dumps(plan_json),
            'plan_name': plan.name,
            'plan_index_json': json.dumps(plan_index_json()),
            'editable': editable,
            'simulatorPath': os.path.join(settings.STATIC_URL, planSchema.simulatorPath),
            'simulator': planSchema.simulator,
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
    Plan = get_plan_model()
    return render_to_response(
        'xgds_planner2/planIndex.html',
        {
            'plans': Plan.objects.all(),
            'exporters': choosePlanExporter.PLAN_EXPORTERS
        },
        context_instance=RequestContext(request))


def plan_index_json():
    Plan = get_plan_model()
    plan_objs = Plan.objects.all()
    plans_json = []
    for plan in plan_objs:
        plans_json.append({
            'id': plan.id,
            'name': plan.name,
            'url': plan.get_absolute_url()
        })

    return plans_json


def getDbPlan(uuid):
    Plan = get_plan_model()
    return get_object_or_404(Plan, uuid=uuid)


def planExport(request, uuid, name):
    dbPlan = getDbPlan(uuid)

    formatCode = request.GET.get('format')
    if formatCode is not None:
        # user explicitly specified e.g. '?format=kml'
        exporterClass = choosePlanExporter.PLAN_EXPORTERS_BY_FORMAT.get(formatCode)
        if exporterClass is None:
            return HttpResponseBadRequest('invalid export format %s' % formatCode)
    else:
        # filename ends with e.g. '.kml'
        exporterClass = None
        for entry in choosePlanExporter.PLAN_EXPORTERS:
            if name.endswith(entry.extension):
                exporterClass = entry.exporterClass
        if exporterClass is None:
            return HttpResponseBadRequest('could not infer export format to use: "format" query parameter not set and extension not recognized for filename "%s"' % name)

    exporter = exporterClass()
    return exporter.getHttpResponse(dbPlan)


@login_required
def planCreate(request):
    if request.method == 'GET':
        form = forms.CreatePlanForm()
    elif request.method == 'POST':
        form = forms.CreatePlanForm(request.POST)
        if form.is_valid():
            # add plan entry to database
            meta = dict([(f, form.cleaned_data[f])
                         for f in ('planNumber', 'planVersion')])
            meta['creator'] = request.user.username
            importer = planImporter.BlankPlanImporter()
            planSchema = models.getPlanSchema(form.cleaned_data['platform'])
            dbPlan = importer.importPlan('tempName',
                                         buf=None,
                                         meta=meta,
                                         planSchema=planSchema)
            

            # bit of a hack, setting the name from the id
            planId = dbPlan.jsonPlan.id
            dbPlan.jsonPlan.name = planId
            dbPlan.name = planId

            dbPlan.save()

            # redirect to plan editor on newly created plan
            return HttpResponseRedirect(reverse('planner2_edit', args=[dbPlan.id]))
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])
    return render(request,
                  'xgds_planner2/planCreate.html',
                  {'form': form})
