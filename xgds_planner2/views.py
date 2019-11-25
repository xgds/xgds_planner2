# __BEGIN_LICENSE__
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
# __END_LICENSE__
# pylint: disable=W0702
import sys
import pytz
import collections
import os
from cStringIO import StringIO
import datetime
import json
import traceback
import requests
from uuid import uuid4

from dateutil.parser import parse as dateparser
from django.forms.models import model_to_dict
from django.contrib import messages
from django.contrib.staticfiles.storage import staticfiles_storage
from django.core.urlresolvers import reverse
from django.conf import settings

from django.http import (HttpResponseRedirect,
                         HttpResponse,
                         Http404,
                         HttpResponseNotAllowed,
                         HttpResponseBadRequest,
                         JsonResponse)
from django.shortcuts import render, get_object_or_404
from django.template import RequestContext
from django.views.decorators.cache import never_cache

from geocamUtil.datetimeJsonEncoder import DatetimeJsonEncoder
from geocamUtil import timezone
from geocamUtil.models.UuidField import makeUuid
from geocamUtil.KmlUtil import wrapKmlDjango
from geocamUtil.dotDict import convertToDotDictRecurse, DotDict
from geocamUtil.loader import LazyGetModelByName, getClassByName
from geocamUtil.usng.usng import LLtoUTM
from geocamUtil.geomath import calculateUTMDiffMeters
from geocamUtil.modelJson import modelToJson
from geocamUtil.TimeUtil import utcToTimeZone
from geocamUtil.models import SiteFrame

from xgds_planner2 import (models,
                           choosePlanExporter,
                           choosePlanImporter,
                           planImporter,
                           fillIdsPlanExporter)
from xgds_planner2.kmlPlanExporter import KmlPlanExporter
from xgds_planner2.forms import UploadXPJsonForm, CreatePlanForm, ImportPlanForm
from xgds_planner2.models import getPlanSchema
from xgds_planner2.xpjson import loadDocumentFromDict
from xgds_map_server.views import getSearchForms
from xgds_core.views import get_handlebars_templates, addRelay, setState, getAllFlightNames, getActiveFlights, \
    getTodaysGroupFlights, manageFlights
from xgds_core.models import RemoteRestService
from xgds_core.util import insertIntoPath

from geocamUtil.datetimeJsonEncoder import DatetimeJsonEncoder

_template_cache = None

PLAN_MODEL = LazyGetModelByName(settings.XGDS_PLANNER_PLAN_MODEL)
PLAN_EXECUTION_MODEL = LazyGetModelByName(settings.XGDS_PLANNER_PLAN_EXECUTION_MODEL)
ACTIVE_FLIGHT_MODEL = LazyGetModelByName(settings.XGDS_CORE_ACTIVE_FLIGHT_MODEL)
FLIGHT_MODEL = LazyGetModelByName(settings.XGDS_CORE_FLIGHT_MODEL)
GROUP_FLIGHT_MODEL = LazyGetModelByName(settings.XGDS_CORE_GROUP_FLIGHT_MODEL)
VEHICLE_MODEL = LazyGetModelByName(settings.XGDS_CORE_VEHICLE_MODEL)


def plan_help(request):
    return render(request,
                  'xgds_planner2/planner_help.html',
                  {"settings": settings})


def my_module():
    # Get path to module minus the "views" at the end.
    return ".".join(sys.modules[__name__].__name__.split(".")[:-1])


def plan_tests(request, plan_id, editable=True):
    templates = get_handlebars_templates(settings.XGDS_PLANNER_HANDLEBARS_DIRS, 'XGDS_PLANNER_HANDLEBARS_DIRS')

    plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    plan_json = plan.jsonPlan
    if not plan_json.serverId:
        plan_json.serverId = plan.pk
    if "None" in plan_json.url:
        plan_json.url = plan.get_absolute_url()

    planSchema = models.getPlanSchema(plan_json.platform.name)

    return render(request,
                  'xgds_planner2/planner_tests.html',
                  {'templates': templates,
                   'plan_schema_json': planSchema.getJsonSchema(),
                   # xpjson.dumpDocumentToString(planSchema.getSchema()),
                   'plan_library_json': planSchema.getJsonLibrary(),
                   # xpjson.dumpDocumentToString(planSchema.getLibrary()),
                   'plan_json': json.dumps(plan_json),
                   'plan_name': plan.name,
                   'plan_index_json': json.dumps(plan_index_json()),
                   'editable': editable,
                   'simulatorUrl': planSchema.simulatorUrl,
                   'simulator': planSchema.simulator,
                   'placemark_circle_url': request.build_absolute_uri(
                       staticfiles_storage.url('xgds_planner2/images/placemark_circle.png')),
                   'placemark_circle_highlighted_url': request.build_absolute_uri(
                       staticfiles_storage.url('xgds_planner2/images/placemark_circle_highlighted.png')),
                   'plan_links_json': json.dumps(plan.getLinks()),
                   'plan_namedURLs_json': json.dumps(plan.namedURLs),
                   })


def get_rest_services():
    myRestServices = RemoteRestService.objects.filter(module=my_module())
    return myRestServices


def aggregate_handlebars_templates(request):
    """
    Return a JSON object containing all the Handlebars templates in the
    appropriate templates directory, indexed by name.
    """
    return HttpResponse(
        json.dumps(get_handlebars_templates(settings.XGDS_PLANNER_HANDLEBARS_DIRS), 'XGDS_PLANNER_HANDLEBARS_DIRS'),
        content_type='application/json')


def handleCallbacks(request, plan, mode):
    for callback_mode, methodName, callback_type in settings.XGDS_PLANNER_CALLBACK:
        if callback_mode == mode and callback_type == settings.PYTHON:
            foundMethod = getClassByName(methodName)
            if foundMethod:
                plan = foundMethod(request, plan)
    return plan


def populatePlanFromJson(plan, rawData):
    data = json.loads(rawData)
    for k, v in data.iteritems():
        if k == "_simInfo":
            continue
        plan.jsonPlan[k] = v
    plan.extractFromJson(overWriteDateModified=True)


def plan_save_from_relay(request, plan_id):
    """ When we receive a relayed plan, handle creation or update of that plan
    """
    try:
        plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    except:
        plan = PLAN_MODEL.get()(pk=plan_id)
    populatePlanFromJson(plan, request.POST['jsonPlan'])
    plan.save()
    return JsonResponse({"status": "success", "planPK": plan.pk})


# TODO - make entry in urls.py for this method!
def get_last_changed_planID_for_user_json(request, username):
    plan = PLAN_MODEL.get().objects.filter(creator__username=username).order_by('-dateModified')[0]
    planMetadata = {"planID": plan.id, "planUUID": plan.uuid, "planName": plan.name,
                    "lastModified": plan.dateModified, "username": username}
    return HttpResponse(json.dumps(planMetadata, cls=DatetimeJsonEncoder), content_type='application/json')


def get_plan_kml(plan):
    exporter = KmlPlanExporter()
    kmlStr = exporter.exportDbPlan(plan, None)
    return kmlStr

def plan_notify_save(plan, notifyFlag):
        restService = RemoteRestService.objects.get(name="notifyPlanSave")
        print "Send save/notify for", plan.name, " to", restService.display_name, restService.serviceUrl
        notifyEvent = {
            "eventType": "save",
            "eventTimestamp": datetime.datetime.now(pytz.utc).isoformat(),
            "userNotification": notifyFlag,
            "planId": plan.pk,
            "planName": plan.name,
            "planContent": plan.jsonPlan,
            "planKml": get_plan_kml(plan)
        }

        headers = {"replyurl": "",
                   "replyids": str(plan.pk),
                   "content-type": "application/json"}
        try:
            resp = requests.post(restService.serviceUrl, data=json.dumps(notifyEvent), headers=headers)
            requestStatus = resp.status_code
        except Exception as e:
            print e
            requestStatus = 500
    
    
def plan_save_json(request, plan_id, jsonPlanId=None):
    """
    Read and write plan JSON.
    Alternately fetch plan contents with a get.
    jsonPlanId is ignored.  It's for human-readabilty in the URL
    """
    plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    if request.method == "GET":
        return HttpResponse(json.dumps(plan.jsonPlan), content_type='application/json')
    elif request.method == "PUT":
        # this is coming in from the regular plan editor
        populatePlanFromJson(plan, request.body)
        plan.jsonPlan.modifier = request.user.username
        plan.save()
        notifySave = plan.jsonPlan["notifySave"]
        if notifySave:
            print "*** NOTIFY SAVE CALLBACK ***"
            plan_notify_save(plan, notifySave)

        plan = handleCallbacks(request, plan, settings.SAVE)
        addRelay(plan, None, json.dumps({"jsonPlan": json.dumps(plan.jsonPlan)}),
                 reverse('planner2_save_plan_from_relay', kwargs={'plan_id': plan.pk}), update=True)
        return HttpResponse(json.dumps(plan.jsonPlan), content_type='application/json')

    elif request.method == "POST":
        # we are doing a save as
        plan.creationDate = datetime.datetime.now(pytz.utc)
        plan.uuid = None
        plan.pk = None
        populatePlanFromJson(plan, request.body)
        plan.name = plan.jsonPlan['planName']
        plan.jsonPlan['name'] = plan.jsonPlan['planName']

        plan.creator = request.user
        plan.jsonPlan.creator = request.user.username
        plan.jsonPlan.modifier = request.user.username

        # make sure it is not read only
        plan.readOnly = False
        plan.save()  # need to save to get the new pk

        newid = plan.pk
        plan.jsonPlan["serverId"] = newid
        plan.jsonPlan["planNumber"] = newid
        plan.jsonPlan.url = plan.get_absolute_url()

        # we still need to renumber the plan
        schema = models.getPlanSchema(plan.jsonPlan.platform['name'])
        exporter = fillIdsPlanExporter.FillIdsPlanExporter()
        planDict = convertToDotDictRecurse(plan.jsonPlan)
        updateAllUuids(planDict)
        plan.jsonPlan = json.dumps(exporter.exportPlan(planDict, schema.schema))
        plan.uuid = planDict.uuid

        plan.save()
        handleCallbacks(request, plan, settings.SAVE)
        addRelay(plan, None, json.dumps({"jsonPlan": plan.jsonPlan}),
                 reverse('planner2_save_plan_from_relay', kwargs={'plan_id': plan.pk}))

        #         response = {}
        #         response["msg"] = "New plan created"
        #         response["data"] = newid

        return HttpResponse(plan.jsonPlan, content_type='application/json')


def updateAllUuids(planDict):
    planDict.uuid = makeUuid()
    for element in planDict.sequence:
        element.uuid = makeUuid()
        if hasattr(element, 'sequence'):
            for child in element.sequence:
                if hasattr(child, 'uuid'):
                    child.uuid = makeUuid()
    return planDict


def plan_detail_doc(request, plan_id=None):
    plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    plan_json = plan.jsonPlan
    if not plan_json.serverId:
        plan_json.serverId = plan.pk
    if "None" in plan_json.url:
        plan_json.url = plan.get_absolute_url()

    planSchema = models.getPlanSchema(plan_json.platform.name)
    return render(request,
                  'xgds_planner2/planDetailDoc.html',
                  {'plan_json': plan_json,
                   'plan_schema': json.loads(planSchema.getJsonSchema()),
                   'plan_library': json.loads(planSchema.getJsonLibrary())})


def fixTimezonesInPlans():
    # we added timezone to the site frame in the library but may have created plans without that -- patch them
    for plan in PLAN_MODEL.get().objects.all():
        try:
            plan_timezone = plan.jsonPlan.site.alternateCrs.properties.timezone
        except AttributeError:
            print 'no timezone for ' + str(plan.id)
            for sf in SiteFrame.objects.all():
                if sf.name == str(plan.jsonPlan.site.name):
                    plan.jsonPlan.site.alternateCrs.properties.timezone = sf.timezone
                    plan.save()
                    break;


def plan_bearing_distance_view(request, plan_id, crs=False):
    plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    return render(request,
                  'xgds_planner2/bearingDistancePlan.html',
                  {'plan_uuid': plan.uuid,
                   'crs_coords': crs,
                   'handlebar_path': settings.XGDS_PLANNER_PLAN_BEARING_HANDLEBAR_PATH})


def plan_bearing_distance_top_view(request, plan_id):
    plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    return render(request,
                  'xgds_planner2/bearingDistancePlanTop.html',
                  {'plan_uuid': plan.uuid,
                   'handlebar_path': 'xgds_planner2/templates/xgds_planner2/bearingDistancePlanTop.handlebars'})


def plan_editor_app(request, plan_id=None, editable=True):
    templates = get_handlebars_templates(settings.XGDS_PLANNER_HANDLEBARS_DIRS, 'XGDS_PLANNER_HANDLEBARS_DIRS')

    plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    dirty = False
    if not plan.jsonPlan.serverId:
        plan.jsonPlan.serverId = plan.pk
        dirty = True
    if "None" in plan.jsonPlan.url:
        plan.jsonPlan.url = plan.get_absolute_url()
        dirty = True

    if dirty:
        plan.save()

    planSchema = models.getPlanSchema(plan.jsonPlan.platform.name)
    pe = None
    try:
        if plan.executions and plan.executions.count() > 0:
            pe = json.dumps(plan.executions.all()[0].toSimpleDict(), cls=DatetimeJsonEncoder)
    except:
        pass

    # Remove build_absolute_uri from placemark pngs below. Should not need since rendering in browser and it appears to
    # break portmapping through router (e.g. at TRAC).
    context = {
        'templates': templates,
        'app': 'xgds_planner2/js/plannerApp.js',
        # 'saveSearchForm': MapSearchForm(),
        'searchForms': getSearchForms(),
        'flight_names': json.dumps(getAllFlightNames()),
        'plan_schema_json': planSchema.getJsonSchema(),  # xpjson.dumpDocumentToString(planSchema.getSchema()),
        'plan_library_json': planSchema.getJsonLibrary(),  # xpjson.dumpDocumentToString(planSchema.getLibrary()),
        'plan_json': json.dumps(plan.jsonPlan),
        'plan_name': plan.name,
        'plan_execution': pe,
        'plan_index_json': json.dumps(plan_index_json()),
        'editable': editable and not plan.readOnly,
        'simulatorUrl': planSchema.simulatorUrl,
        'simulator': planSchema.simulator,
        'placemark_circle_url': staticfiles_storage.url('xgds_planner2/images/placemark_circle.png'),
        'placemark_circle_highlighted_url': staticfiles_storage.url('xgds_planner2/images/placemark_circle_highlighted.png'),
        'placemark_directional_url': staticfiles_storage.url('xgds_planner2/images/placemark_directional.png'),
        'placemark_selected_directional_url': staticfiles_storage.url('xgds_planner2/images/placemark_directional_highlighted.png'),
        'plan_links_json': json.dumps(plan.getLinks()),
        'help_content_path': 'xgds_planner2/help/editPlan.rst',
        'title': 'List %ss' % settings.XGDS_PLANNER_PLAN_MONIKER
    }

    updated_context = getClassByName(settings.XGDS_PLANNER_EDITOR_CONTEXT_METHOD)(context)

    return render(request,
                  'xgds_planner2/planner_app.html',
                  updated_context)


def addToEditorContext(context):
    '''Override and register your method in XGDS_PLANNER_EDITOR_CONTEXT_METHOD if you want to add to the context
    Must add a json dictionary called extras; contents of this dictionary will be inserted into appOptions.
    '''
    return context


def planIndex(request):
    """
    For the moment this is a handy classic-Django place to hang links to
    new server-side planner features.  It could certainly be replaced or
    complemented with a nice index API method for rich JavaScript
    clients.
    """
    context = {'plans': PLAN_MODEL.get().objects.filter(deleted=False),
               'flight_names': getAllFlightNames(),
               'exporters': choosePlanExporter.PLAN_EXPORTERS,
               'rest_services': get_rest_services(),
               'help_content_path': 'xgds_planner2/help/index.rst',
               'title': 'List %ss' % settings.XGDS_PLANNER_PLAN_MONIKER
               }

    updated_context = getClassByName(settings.XGDS_PLANNER_EDITOR_CONTEXT_METHOD)(context)

    return render(request,
                  'xgds_planner2/planIndex.html',
                  updated_context,
                  )


def plan_index_json():
    plan_objs = PLAN_MODEL.get().objects.filter(deleted=False)
    plans_json = []
    for plan in plan_objs:
        plans_json.append({
            'id': plan.pk,
            'uuid': plan.uuid,
            'name': plan.name,
            'url': plan.get_absolute_url(),
            'dateModified': plan.dateModified.isoformat(),
            'creator': plan.creator.username if plan.creator else "",
            'numStations': plan.numStations,
            'numSegments': plan.numSegments,
            'numCommands': plan.numCommands,
            'lengthMeters': plan.lengthMeters,
            'estimatedDurationsSeconds': plan.estimatedDurationSeconds
        })

    return plans_json


def getPlanIndexJson(request):
    return HttpResponse(json.dumps(plan_index_json()),
                        content_type='application/json')


def getDbPlan(uuid, idIsPK=False):
    if idIsPK:
        try:
            return get_object_or_404(PLAN_MODEL.get(), id=uuid)
        except:
            return get_object_or_404(PLAN_MODEL.get(), uuid=uuid)
    else:
        return get_object_or_404(PLAN_MODEL.get(), uuid=uuid)


def planExport(request, uuid, name, time=None, outputDirectory=None, isAjax=False, idIsPK=False):
    """
    Normally plan export urls are built up by the planExporter.url
    but some exporters (pml) can take a time.
    """
    dbPlan = getDbPlan(uuid, idIsPK)

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
            return HttpResponseBadRequest(
                'could not infer export format to use: "format" query parameter not set and extension not recognized for filename "%s"' % name)

    exporter = exporterClass()
    if time:
        try:
            thetime = dateparser(time)
            context = DotDict({'startTime': thetime.astimezone(pytz.utc)})
            exporter.initPlan(dbPlan, context)
        except:
            pass

    if outputDirectory:
        # output the exported file to a directory
        exporter.exportDbPlanToPath(dbPlan, os.path.join(outputDirectory, name), request)
        return True
    elif not isAjax:
        return exporter.getHttpResponse(dbPlan, name, request)
    else:
        return exporter.getHttpResponse(dbPlan, None, request)


def planCreate(request):
    if request.method == 'GET':
        form = CreatePlanForm()
    elif request.method == 'POST':
        form = CreatePlanForm(request.POST)
        if form.is_valid():
            # add plan entry to database
            meta = dict([(f, form.cleaned_data[f])
                         for f in ('planNumber', 'planVersion')])
            meta['creator'] = request.user.username
            importer = planImporter.BlankPlanImporter()
            planSchema = models.getPlanSchema(form.cleaned_data['platform'])

            # set the site
            siteID = form.cleaned_data['site']
            if siteID:
                sites = planSchema.getLibrary().sites
                for site in sites:
                    if site.id == siteID:
                        # TODO FIX this has all sorts of formatting problems /n inserted.
                        # meta['site'] = xpjson.dumpDocumentToString(site)

                        hackSite = {"type": "Site",
                                    "name": site.name,
                                    "id": site.id,
                                    "notes": site.notes}
                        if site.bbox:
                            hackSite["bbox"] = site.bbox
                        if site.alternateCrs:
                            hackSite["alternateCrs"] = site.alternateCrs
                        meta['site'] = hackSite
                        break

            dbPlan = importer.importPlan('tempName',
                                         buf=None,
                                         meta=meta,
                                         planSchema=planSchema)

            # bit of a hack, setting the name from the id
            planId = dbPlan.jsonPlan.id
            dbPlan.jsonPlan["name"] = planId
            dbPlan.jsonPlan["uuid"] = dbPlan.uuid  # makeUuid()
            dbPlan.name = planId

            dbPlan.save()
            handleCallbacks(request, dbPlan, settings.SAVE)

            # redirect to plan editor on newly created plan
            return HttpResponseRedirect(reverse('planner2_edit', args=[dbPlan.pk]))
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])
    return render(request,
                  'xgds_planner2/planCreate.html',
                  {'form': form,
                   'title': 'List %ss' % settings.XGDS_PLANNER_PLAN_MONIKER,
                   'help_content_path': 'xgds_planner2/help/planCreate.rst',
                   'siteLabel': 'Create'})


def planImport(request):
    if request.method == 'GET':
        messages.info(request, 'Create a ' + settings.XGDS_PLANNER_PLAN_MONIKER + ' by importing:')
        messages.info(request, 'a kml file containing a LineString')
        messages.info(request, 'a csv file, with column headers of latitude and longitude, and optional name and notes')
        messages.info(request, 'an xpJson file')
        form = ImportPlanForm()
    elif request.method == 'POST':
        form = ImportPlanForm(request.POST, request.FILES)
        if form.is_valid():
            # add plan entry to database
            meta = dict([(f, form.cleaned_data[f])
                         for f in ('planNumber', 'planVersion')])
            meta['creator'] = request.user.username
            planSchema = models.getPlanSchema(form.cleaned_data['platform'])

            # set the site
            siteID = form.cleaned_data['site']
            if siteID:
                sites = planSchema.getLibrary().sites
                for site in sites:
                    if site.id == siteID:
                        # TODO FIX this has all sorts of formatting problems /n inserted.
                        # meta['site'] = xpjson.dumpDocumentToString(site)

                        hackSite = {"type": "Site",
                                    "name": site.name,
                                    "id": site.id,
                                    "notes": site.notes}
                        if site.bbox:
                            hackSite["bbox"] = site.bbox
                        if site.alternateCrs:
                            hackSite["alternateCrs"] = site.alternateCrs
                        meta['site'] = hackSite
                        break

            importer = choosePlanImporter.chooseImporter(form.cleaned_data['sourceFile'].name)
            f = request.FILES['sourceFile']
            buf = ''.join([chunk for chunk in f.chunks()])

            dbPlan = importer.importPlan('tempName',
                                         buf=buf,
                                         meta=meta,
                                         planSchema=planSchema)

            # bit of a hack, setting the name from the id
            planId = dbPlan.jsonPlan.id
            dbPlan.jsonPlan["name"] = planId
            dbPlan.jsonPlan["uuid"] = dbPlan.uuid  # makeUuid()
            dbPlan.name = planId

            dbPlan.save()
            handleCallbacks(request, dbPlan, settings.SAVE)

            # redirect to plan editor on newly created plan
            return HttpResponseRedirect(reverse('planner2_edit', args=[dbPlan.pk]))
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])
    return render(request,
                  'xgds_planner2/planCreate.html',
                  {'form': form,
                   'title': 'List %ss' % settings.XGDS_PLANNER_PLAN_MONIKER,
                   'help_content_path': 'xgds_planner2/help/import.rst',
                   'siteLabel': 'Import'})


def plan_delete(request):
    picks = request.POST.getlist('picks[]')
    for i in picks:
        try:
            plan = PLAN_MODEL.get().objects.get(id=int(i))
            if plan:
                plan.deleted = True
                plan.save()
                handleCallbacks(request, plan, settings.DELETE)
        except:
            traceback.print_exc()

    return JsonResponse({"status": "success", "picks": picks})


@never_cache
def getPlanIndexKml(request):
    out = StringIO()
    out.write('<Document>\n')
    plans = PLAN_MODEL.get().objects.filter(deleted=False)
    plans = list(reversed(sorted(plans, key=lambda plan: (plan.escapedName(),))))
    for plan in plans:
        fname = '%s.kml' % plan.escapedName()
        relUrl = reverse('planner2_planExport', args=[plan.uuid, fname])
        restUrl = insertIntoPath(relUrl, 'rest')
        url = request.build_absolute_uri(restUrl)
        #         print(url)
        out.write("""
<NetworkLink>
  <name>%(name)s</name>
  <visibility>0</visibility>
  <Link>
    <href>%(url)s</href>
  </Link>
</NetworkLink>
"""
                  % dict(name=plan.escapedName(), url=url))
    out.write('</Document>')
    return wrapKmlDjango(out.getvalue())


def oltest(request):
    return render(request, "xgds_planner2/oltest.html")


def schedulePlans(request, redirect=True):
    flight = None
    lastPlanExecution = None
    pe = None
    if request.method == 'POST':
        try:
            pids = request.POST['planIds']
            planIds = []
            for item in pids.split(","):
                planIds.append(int(item))
            plans = PLAN_MODEL.get().objects.filter(id__in=planIds)

            if 'planExecutionId' in request.POST and request.POST['planExecutionId'] != '':
                pe = PLAN_EXECUTION_MODEL.get().objects.get(pk=int(request.POST['planExecutionId']))

            schedule_date_string = request.POST['schedule_date']
            original_schedule_date = None
            prefix = None
            if schedule_date_string:
                # read the date; it comes in as UTC
                original_schedule_date = dateparser(schedule_date_string)
                original_schedule_date = pytz.utc.localize(original_schedule_date)
                schedule_date = original_schedule_date
                if pe:
                    firstPlan = pe.plan
                else:
                    firstPlan = plans[0]
                local_date = utcToTimeZone(original_schedule_date,
                                           str(firstPlan.jsonPlan.site.alternateCrs.properties.timezone))
                prefix = "%04d%02d%02d" % (local_date.year, local_date.month, local_date.day)

            flight_name = request.POST['flight']

            # see if flight name matches prefix, if not go by the date
            if prefix and flight_name:
                if not flight_name.startswith(prefix):
                    flight_name = None

            try:
                flight = FLIGHT_MODEL.get().objects.get(name=flight_name)
            except FLIGHT_MODEL.get().DoesNotExist:
                # see if we can look it up by date
                if original_schedule_date:
                    flights = FLIGHT_MODEL.get().objects.filter(name__startswith=prefix)
                    if flights:
                        # pick the first one
                        flight = flights[0]
                    else:
                        # it does not exist we better make one
                        prefix = prefix + "A"
                        groupFlight, created = GROUP_FLIGHT_MODEL.get().objects.get_or_create(name=prefix)
                        for vehicle in VEHICLE_MODEL.get().objects.all():
                            newFlight = FLIGHT_MODEL.get()()
                            newFlight.group = groupFlight
                            newFlight.vehicle = vehicle
                            newFlight.name = prefix + "_" + vehicle.name
                            newFlight.locked = False
                            newFlight.uuid = uuid4()
                            newFlight.save(force_insert=True)
                            if not flight:
                                flight = newFlight

            if flight:
                for plan in plans:
                    if not pe:
                        pe = PLAN_EXECUTION_MODEL.get()()
                    pe.planned_start_time = schedule_date
                    pe.flight = flight
                    pe.plan = plan

                    if settings.XGDS_PLANNER_SCHEDULE_EXTRAS_METHOD:
                        pe = getClassByName(settings.XGDS_PLANNER_SCHEDULE_EXTRAS_METHOD)(request, pe)

                    pe.save()

                    # relay the new plan execution
                    peDict = pe.toSimpleDict()
                    del peDict['flight']
                    del peDict['plan']
                    addRelay(pe, None, json.dumps(peDict, cls=DatetimeJsonEncoder),
                             reverse('planner2_relaySchedulePlan'))

                    lastPlanExecution = pe
        except:
            traceback.print_exc()
            return HttpResponse(json.dumps({'Success': "False", 'msg': 'Plan not scheduled'}),
                                content_type='application/json', status=406)
            pass
    if redirect:
        return HttpResponseRedirect(reverse('planner2_index'))
    else:
        if lastPlanExecution:
            return HttpResponse(json.dumps(lastPlanExecution.toSimpleDict(), cls=DatetimeJsonEncoder),
                                content_type='application/json')
        return HttpResponse(json.dumps({'Success': "True", 'msg': 'Plan scheduled'}), content_type='application/json')


def schedulePlanActiveFlight(request, vehicleName, planPK):
    ''' This is to support scheduling a new plan from sextantwebapp, which got the active plan from the last scheduled plan execution'''
    try:
        vehicle = VEHICLE_MODEL.get().objects.get(name=vehicleName)
        activeFlights = getActiveFlights(vehicle=vehicle)
        flight = activeFlights[0].flight  # there can be only one
        # we must have existing plan executions, let's copy the last one
        if not flight.plans:
            # it might not have come from this vehicle
            groupFlights = getTodaysGroupFlights()
            if groupFlights:
                for gf in groupFlights.all():
                    for flight in gf.flights.all():
                        if flight.plans:
                            lastPE = flight.plans.last()
        else:
            lastPE = flight.plans.last()

        if not lastPE:
            # make a totally new one. should never be able to get to this state.
            lastPE = PLAN_EXECUTION_MODEL.get()()
            lastPE.flight = flight

            if settings.XGDS_PLANNER_SCHEDULE_EXTRAS_METHOD:
                # this will fail we don't have what we need ...
                lastPE = getClassByName(settings.XGDS_PLANNER_SCHEDULE_EXTRAS_METHOD)(request, lastPE)

        lastPE.pk = None
        lastPE.plan_id = planPK
        lastPE.planned_start_time = timezone.now()
        lastPE.start_time = None
        lastPE.end_time = None
        lastPE.save()

        peDict = lastPE.toSimpleDict()
        del peDict['flight']
        del peDict['plan']
        addRelay(lastPE, None, json.dumps(peDict, cls=DatetimeJsonEncoder), reverse('planner2_relaySchedulePlan'))
        return JsonResponse(peDict);

    except Exception, e:
        return JsonResponse({'status': 'fail', 'exception': str(e)}, status=406)


def relaySchedulePlan(request):
    """ Schedule a plan with same plan execution pk from the post dictionary
        requires the flight, plan and ev all exist.
    """
    try:
        form_dict = json.loads(request.POST.get('serialized_form'))

        try:
            id = form_dict['id']
            preexisting = PLAN_EXECUTION_MODEL.get().get(pk=id)

            # TODO this should never happen, we should not have flights on multiple servers with the same name
            print '********DUPLICATE PLAN EXECUTION ***** WAS ATTEMPTED TO RELAY WITH PK %d' % (id)
        except:
            pass

        # we are good it does not exist
        newPlanExecution = PLAN_EXECUTION_MODEL.get()(**form_dict)
        newPlanExecution.save()
        return JsonResponse(model_to_dict(newPlanExecution))

    except Exception, e:
        traceback.print_exc()
        return JsonResponse({'status': 'fail', 'exception': str(e)}, status=406)


def startPlan(request, pe_id):
    errorString = ""
    try:
        pe = PLAN_EXECUTION_MODEL.get().objects.get(pk=pe_id)
        pe.start_time = datetime.datetime.now(pytz.utc)
        pe.end_time = None
        pe.save()
    except:
        errorString = "Plan Execution not found"
    return manageFlights(request, errorString)


def stopPlan(request, pe_id):
    errorString = ""
    try:
        pe = PLAN_EXECUTION_MODEL.get().objects.get(pk=pe_id)
        if pe.start_time:
            pe.end_time = datetime.datetime.now(pytz.utc)
            pe.save()
        else:
            errorString = "Plan has not been started."
    except:
        errorString = "Plan Execution not found"
    return manageFlights(request, errorString)


def deletePlanExecution(request, pe_id):
    errorString = ""
    try:
        pe = PLAN_EXECUTION_MODEL.get().objects.get(pk=pe_id)
        pe.delete()
    except:
        errorString = "Plan Execution not found"
    return manageFlights(request, errorString)


def getSiteFrames():
    if not settings.XGDS_PLANNER_SITE_FRAMES:
        platforms = sorted(settings.XGDS_PLANNER_SCHEMAS.keys())
        try:
            platforms.remove("test")
        except ValueError:
            pass

        for platform in platforms:
            schema = getPlanSchema(platform)
            library = schema.getLibrary()
            sites = library.sites
            if sites:
                for site in sites:
                    try:
                        if site.alternateCrs:
                            settings.XGDS_PLANNER_SITE_FRAMES.append(site)
                    except:
                        pass
    return settings.XGDS_PLANNER_SITE_FRAMES


def getClosestSiteFrame(lat, lon):
    """ Return the site frame with centroid closest to the given location"""
    if getSiteFrames():
        if len(getSiteFrames()) == 1:
            return getSiteFrames()[0]

        # first convert point to UTM
        UTM_location = LLtoUTM(lat, lon)
        myUTM = (UTM_location[0], UTM_location[1])
        # return (UTMEasting, UTMNorthing, zoneNumber, zoneLetter)

        #  "alternateCrs": {
        #                 "type": "roversw",
        #                 "properties": {
        #                     "originNorthing": 4141835,
        #                     "originEasting": 582724,
        #                     "projection": "utm",
        #                     "zone": 10,
        #                     "zoneLetter": "N",
        closestSite = None
        smallestDiff = None
        for site in getSiteFrames():
            properties = site.alternateCrs['properties']
            oEasting = properties[unicode('originEasting')]
            oNorthing = properties[unicode('originNorthing')]
            diff = calculateUTMDiffMeters(myUTM, (oEasting, oNorthing))
            if smallestDiff:
                if diff < smallestDiff:
                    smallestDiff = diff
                    closestSite = site
            else:
                smallestDiff = diff
                closestSite = site
        return closestSite

    return None


def toggleReadOnly(request):
    """ Toggle the read only state of plans"""
    if request.method == 'POST':
        pids = request.POST.getlist('pids[]')
        for item in pids:
            try:
                plan = PLAN_MODEL.get().objects.get(id=int(item))
                plan.readOnly = not plan.readOnly
                plan.save()
            except:
                pass
    return HttpResponseRedirect(reverse('planner2_index'))


def externalServiceExport(request):
    """ export selected plan JSON to an external HTTP/REST based service"""
    if request.method == 'POST':
        serviceName = request.POST.get('serviceName')
        pids = request.POST.getlist('pids[]')
        restService = RemoteRestService.objects.get(name=serviceName)
        print "Exporting plan(s)", pids, " to", restService.display_name, restService.serviceUrl
        planNameList = []
        planContentList = []
        for item in pids:
            try:
                plan = PLAN_MODEL.get().objects.get(id=int(item))
                planContentList.append(plan.jsonPlan)
                planNameList.append(plan.name)
            except:
                pass

        headers = {"replyurl": reverse("planner2_report_export_status"),
                   "replyids": json.dumps(pids),
                   "content-type": "application/json"}
        try:
            resp = requests.post(restService.serviceUrl, data=json.dumps(planContentList), headers=headers)
            requestStatus = resp.status_code
            if requestStatus != 200:
                print "Error status code from external service:", requestStatus, resp.text
        except Exception as e:
            print e
            requestStatus = 500

        result = {"status":requestStatus, "planNames":planNameList, "serviceName":serviceName,
                  "serviceDisplayName":restService.display_name}
    return HttpResponse(content=json.dumps(result),
                        content_type="application/json")


def reportExportStatus(request):
    if request.method == 'POST':
        exportStatus = request.POST.get('exportStatus')

    return HttpResponse(content="OK",
                        content_type="application/json")


def mapJsonPlan(request, uuid=None, pk=None):
    ''' Return the json of the plan via uuid or pk '''
    PLAN_MODEL = LazyGetModelByName(settings.XGDS_PLANNER_PLAN_MODEL)
    try:
        if uuid:
            plan = PLAN_MODEL.get().objects.get(uuid=uuid)
        elif pk:
            plan = PLAN_MODEL.get().objects.get(pk=pk)
        json_data = json.dumps(plan.jsonPlan, indent=4)
        return HttpResponse(content=json_data,
                            content_type="application/json")
    except:
        return HttpResponse(content={},
                            content_type="application/json")


def plansTreeNodes(request):
    plans = PLAN_MODEL.get().objects.filter(deleted=False)
    result = []
    for plan in plans:
        result.append(plan.get_tree_json())
    json_data = json.dumps(result, indent=4)
    return HttpResponse(content=json_data,
                        content_type="application/json")


def validateJson(newJsonObj):
    ''' Validate input json against defined schema
    '''
    try:
        theSchema = getPlanSchema(newJsonObj['platform']['name'])
        loadDocumentFromDict(convertToDotDictRecurse(newJsonObj), theSchema.schema)
        return True
    except Exception, e:
        return "Invalid JSON: " + str(e)


def handle_uploading_xpjson(f):
    buff = []
    for chunk in f.chunks():
        buff.append(chunk)
    return ''.join(buff)


def updateDictionary(original, updated):
    for key, value in updated.iteritems():
        if isinstance(value, collections.Mapping):
            r = updateDictionary(original.get(key, {}), value)
            original[key] = r
        else:
            original[key] = updated[key]
    return original


def replaceElement(sequence, newElement):
    seekUuid = newElement['uuid']
    for index, el in enumerate(sequence):
        if (el['uuid'] == seekUuid):
            sequence[index] = newElement
            return


def updateJson(plan, newJsonObj):
    mergedJson = plan.jsonPlan
    originalSequence = mergedJson['sequence']
    incomingSequence = newJsonObj['sequence']
    del newJsonObj['sequence']

    # first deal with the top level plan; we have already verified its uuid 
    updateDictionary(mergedJson, newJsonObj)

    # then deal with all of the nested elements in the sequence
    for pathElement in incomingSequence:
        replaceElement(originalSequence, pathElement)

    plan.save()
    # does not call the callbacks here; this is probably called DURING a callback


def planImportXPJson(request):
    PLAN_MODEL = LazyGetModelByName(settings.XGDS_PLANNER_PLAN_MODEL)
    try:
        form = UploadXPJsonForm(request.POST, request.FILES)
        if form.is_valid():
            planUuid = form.cleaned_data['planUuid']
            try:
                plan = PLAN_MODEL.get().objects.get(uuid=planUuid)
            except:
                return HttpResponse(json.dumps({'Success': "False", 'responseText': 'Wrong UUID, plan not found'}),
                                    content_type='application/json', status=406)
            incoming = request.FILES['file']
            newJson = handle_uploading_xpjson(incoming)
            if (len(newJson) > 0):
                newJsonObj = json.loads(newJson, 'UTF-8')
                foundUuid = newJsonObj['uuid']
                if (foundUuid != planUuid):
                    return HttpResponse(json.dumps({'Success': "False",
                                                    'responseText': 'Loaded JSON is for a different plan; UUID of plans do not match.'}),
                                        content_type='application/json', status=406)
                isValid = validateJson(newJsonObj)
                if isValid == True:
                    updateJson(plan, newJsonObj)
                    return HttpResponse(json.dumps({'Success': "True"}))
                else:
                    return HttpResponse(json.dumps({'Success': "False", 'responseText': isValid}),
                                        content_type='application/json', status=406)
            else:
                return HttpResponse(json.dumps({'Success': "False", 'responseText': 'JSON Empty'}),
                                    content_type='application/json', status=406)
    except Exception:
        traceback.print_exc()
        exc_type, exc_value, exc_traceback = sys.exc_info()
        return HttpResponse(json.dumps({'Success': "False", 'responseText': exc_value['message']}),
                            content_type='application/json', status=406)


def getTodaysPlans():
    letters = []
    plans = []

    groupFlights = getTodaysGroupFlights()
    if groupFlights:
        for gf in groupFlights.all():
            letter = gf.name[-1]
            for flight in gf.flights.all():
                if flight.plans:
                    plan = flight.plans.last().plan
                    if letter not in letters:
                        letters.append(letter)
                        plans.append(plan)
    return zip(letters, plans)


def getTodaysPlanFiles(request, fileFormat='.kml'):
    todaysPlans = getTodaysPlans()
    letters = []
    plankmls = []
    for theTuple in todaysPlans:
        letters.append(theTuple[0])
        plankmls.append(theTuple[1].getExportUrl(fileFormat))
    if not letters:
        messages.error(request, "No Planned Traverses found for today. Tell team to schedule in xGDS.")
        return None
    else:
        return zip(letters, plankmls)


def getTodaysPlansJson(request):
    todaysPlans = getTodaysPlans()
    result = {}
    if todaysPlans:
        for theTuple in todaysPlans:
            result[theTuple[0]] = theTuple[1].jsonPlan
    return JsonResponse(result, encoder=DatetimeJsonEncoder)
