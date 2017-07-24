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
# pylint: disable=W0702
import sys
import pytz
import collections
import os
from cStringIO import StringIO
import datetime
import json
import traceback
from uuid import uuid4

from dateutil.parser import parse as dateparser
from django.forms.models import model_to_dict
from django.contrib import messages 
from django.contrib.auth.decorators import login_required
from django.contrib.staticfiles.storage import staticfiles_storage
from django.core.exceptions import ObjectDoesNotExist
from django.core.urlresolvers import reverse
from django.shortcuts import redirect
from django.conf import settings

from django.db.utils import IntegrityError
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
from xgds_planner2.forms import UploadXPJsonForm, CreatePlanForm, ImportPlanForm
from xgds_planner2.models import getPlanSchema
from xgds_planner2.xpjson import loadDocumentFromDict
from xgds_map_server.views import getSearchForms
from xgds_core.views import get_handlebars_templates, addRelay

from xgds_map_server.forms import MapSearchForm

_template_cache = None

PLAN_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_PLAN_MODEL)
PLAN_EXECUTION_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_PLAN_EXECUTION_MODEL)
ACTIVE_FLIGHT_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_ACTIVE_FLIGHT_MODEL)
FLIGHT_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_FLIGHT_MODEL)
GROUP_FLIGHT_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_GROUP_FLIGHT_MODEL)
VEHICLE_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_VEHICLE_MODEL)

def plan_help(request):
    return render(request,
                  'xgds_planner2/planner_help.html',
                  {"settings": settings})


@login_required
def plan_tests(request, plan_id, editable=True):
    templates = get_handlebars_templates(settings.XGDS_PLANNER2_HANDLEBARS_DIRS, 'XGDS_PLANNER2_HANDLEBARS_DIRS')

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
                   'plan_schema_json': planSchema.getJsonSchema(),  # xpjson.dumpDocumentToString(planSchema.getSchema()),
                   'plan_library_json': planSchema.getJsonLibrary(),  # xpjson.dumpDocumentToString(planSchema.getLibrary()),
                   'plan_json': json.dumps(plan_json),
                   'plan_name': plan.name,
                   'plan_index_json': json.dumps(plan_index_json()),
                   'editable': editable,
                   'simulatorUrl': planSchema.simulatorUrl,
                   'simulator': planSchema.simulator,
                   'placemark_circle_url': request.build_absolute_uri(staticfiles_storage.url('xgds_planner2/images/placemark_circle.png')),
                   'placemark_circle_highlighted_url': request.build_absolute_uri(staticfiles_storage.url('xgds_planner2/images/placemark_circle_highlighted.png')),
                   'plan_links_json': json.dumps(plan.getLinks()),
                   'plan_namedURLs_json': json.dumps(plan.namedURLs),
                   })


def aggregate_handlebars_templates(request):
    """
    Return a JSON object containing all the Handlebars templates in the
    appropriate templates directory, indexed by name.
    """
    return HttpResponse(json.dumps(get_handlebars_templates(settings.XGDS_PLANNER2_HANDLEBARS_DIRS), 'XGDS_PLANNER2_HANDLEBARS_DIRS'), content_type='application/json')


def handleCallbacks(request, plan, mode):
    for callback_mode, methodName, callback_type in settings.XGDS_PLANNER2_CALLBACK:
        if callback_mode==mode and callback_type==settings.PYTHON:
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
    plan = PLAN_MODEL.get().objects.get_or_create(pk=plan_id)
    populatePlanFromJson(plan, request.body)
    plan.save()
    
@login_required
def plan_save_json(request, plan_id, jsonPlanId):
    """
    Read and write plan JSON.
    jsonPlanId is ignored.  It's for human-readabilty in the URL
    """
    plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    if request.method == "PUT":
        # this is coming in from the regular plan editor
        populatePlanFromJson(plan, request.body)
        plan.save()
        plan = handleCallbacks(request, plan, settings.SAVE)
        addRelay(plan, None, json.dumps(request.body), reverse('planner2_save_plan_from_relay', kwargs={'plan_id':plan.pk}), update=True)
        return HttpResponse(json.dumps(plan.jsonPlan), content_type='application/json')

    elif request.method == "POST":
        # we are doing a save as
        plan.jsonPlan.creator = request.user.username
        plan.creationDate = datetime.datetime.now(pytz.utc)
        plan.uuid = None
        plan.pk = None
        populatePlanFromJson(plan, request.body)
        plan.name = plan.jsonPlan['planName']
        plan.jsonPlan['name'] = plan.jsonPlan['planName']

        plan.creator = request.user
        plan.jsonPlan.creator = request.user.username

        #make sure it is not read only
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
        addRelay(plan, None, json.dumps(plan.jsonPlan), reverse('planner2_save_plan_from_relay',  kwargs={'plan_id':plan.pk}))

        response = {}
        response["msg"] = "New plan created"
        response["data"] = newid
        
        return HttpResponse(json.dumps(response), content_type='application/json')

    

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

def plan_bearing_distance_view(request, plan_id):
    plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    return render(request,
                  'xgds_planner2/bearingDistancePlan.html',
                  {'plan_uuid': plan.uuid,
                   'handlebar_path': settings.XGDS_PLANNER2_PLAN_BEARING_HANDLEBAR_PATH})

def plan_bearing_distance_top_view(request, plan_id):
    plan = PLAN_MODEL.get().objects.get(pk=plan_id)
    return render(request,
                  'xgds_planner2/bearingDistancePlanTop.html',
                  {'plan_uuid': plan.uuid,
                   'handlebar_path': 'xgds_planner2/templates/xgds_planner2/bearingDistancePlanTop.handlebars'})
    
@login_required
def plan_editor_app(request, plan_id=None, editable=True):
    templates = get_handlebars_templates(settings.XGDS_PLANNER2_HANDLEBARS_DIRS, 'XGDS_PLANNER2_HANDLEBARS_DIRS')

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

    context = {
            'templates': templates,
            'app': 'xgds_planner2/js/plannerApp.js',
            'saveSearchForm': MapSearchForm(),
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
            'placemark_circle_url': request.build_absolute_uri(
                staticfiles_storage.url('xgds_planner2/images/placemark_circle.png')
            ),
            'placemark_circle_highlighted_url': request.build_absolute_uri(
                staticfiles_storage.url('xgds_planner2/images/placemark_circle_highlighted.png')
            ),
            'placemark_directional_url': request.build_absolute_uri(
                staticfiles_storage.url('xgds_planner2/images/placemark_directional.png')
            ),
            'placemark_selected_directional_url': request.build_absolute_uri(
                staticfiles_storage.url('xgds_planner2/images/placemark_directional_highlighted.png')
            ),
            'plan_links_json': json.dumps(plan.getLinks())
        }

    return render(request,
                  'xgds_planner2/planner_app.html',
                  getClassByName(settings.XGDS_PLANNER2_EDITOR_CONTEXT_METHOD)(context))


def addToEditorContext(context):
    '''Override and register your method in XGDS_PLANNER2_EDITOR_CONTEXT_METHOD if you want to add to the context
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
               'exporters': choosePlanExporter.PLAN_EXPORTERS
               }
    return render(request,
                  'xgds_planner2/planIndex.html',
                  getClassByName(settings.XGDS_PLANNER2_EDITOR_CONTEXT_METHOD)(context),
                  )


def plan_index_json():
    plan_objs = PLAN_MODEL.get().objects.filter(deleted=False)
    plans_json = []
    for plan in plan_objs:
        plans_json.append({
            'id': plan.pk,
            'name': plan.name,
            'url': plan.get_absolute_url()
        })

    return plans_json


def getDbPlan(uuid):
    return get_object_or_404(PLAN_MODEL.get(), uuid=uuid)


def planExport(request, uuid, name, time=None, outputDirectory=None, isAjax=False):
    """
    Normally plan export urls are built up by the planExporter.url
    but some exporters (pml) can take a time.
    """
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
    if time:
        try:
            thetime = dateparser(time)
            context = DotDict({'startTime': thetime.astimezone(pytz.utc)})
            exporter.initPlan(dbPlan, context)
        except:
            pass
        
    if outputDirectory:
        # output the exported file to a directory
        exporter.exportDbPlanToPath(dbPlan, os.path.join(outputDirectory, name))
        return True
    elif not isAjax:
        return exporter.getHttpResponse(dbPlan, attachmentName=name)
    else:
        return exporter.getHttpResponse(dbPlan, attachmentName=None)


@login_required
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
            dbPlan.jsonPlan["uuid"] = dbPlan.uuid # makeUuid()
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
                   'siteLabel':'Create'})


@login_required
def planImport(request):
    if request.method == 'GET':
        messages.info(request, 'You can create a ' +  settings.XGDS_PLANNER2_PLAN_MONIKER + ' by importing a kml file containing a LineString.')
        messages.info(request, 'Alternately you can import a csv file, which must have column headers of latitude and longitude.')
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
            dbPlan.jsonPlan["uuid"] = dbPlan.uuid # makeUuid()
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
                   'siteLabel': 'Import'})

@login_required
def plan_delete(request):
    picks = request.POST.getlist('picks')
    for i in picks:
        plan = PLAN_MODEL.get().objects.get(id=i)
        if plan:
            plan.deleted = True
            plan.save()
            handleCallbacks(request, plan, settings.DELETE)
            
    return HttpResponseRedirect(reverse('planner2_index'))


@never_cache
def getPlanIndexKml(request):
    out = StringIO()
    out.write('<Document>\n')
    plans = PLAN_MODEL.get().objects.filter(deleted=False)
    plans = list(reversed(sorted(plans, key=lambda plan: (plan.escapedName(),))))
    for plan in plans:
        fname = '%s.kml' % plan.escapedName()
        relUrl = reverse('planner2_planExport', args=[plan.uuid, fname])
        url = request.build_absolute_uri(relUrl)
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


def processNameToDate(flight):
    result = {}
    if (len(flight.name) >= 8):
        year = flight.name[0:4].encode()
        month = flight.name[4:6].encode()
        day = flight.name[6:8].encode()
        result = {"year": year, "month": month, "day": day}
    return result


def getGroupFlights():
    return GROUP_FLIGHT_MODEL.get().objects.exclude(name="").order_by('name')


def getAllFlights(today=False, reverseOrder=False):
    orderby = 'name'
    if reverseOrder:
        orderby = '-name'
    if not today:
        return FLIGHT_MODEL.get().objects.all().order_by(orderby)
    else:
        now = timezone.localtime(datetime.datetime.now(pytz.utc))
        todayname = "%04d%02d%02d" % (now.year, now.month, now.day)
        return FLIGHT_MODEL.get().objects.filter(name__startswith=(todayname)).order_by(orderby)
    
def getAllGroupFlights(today=False, reverseOrder=False):
    orderby = 'name'
    if reverseOrder:
        orderby = '-name'
    if not today:
        return GROUP_FLIGHT_MODEL.get().objects.all().order_by(orderby)
    else:
        now = timezone.localtime(datetime.datetime.now(pytz.utc))
        todayname = "%04d%02d%02d" % (now.year, now.month, now.day)
        return GROUP_FLIGHT_MODEL.get().objects.filter(name__startswith=(todayname)).order_by(orderby)


def getAllFlightNames(year="ALL", onlyWithPlan=False, reverseOrder=False):
    orderby = 'name'
    if reverseOrder:
        orderby = '-name'
    flightList = FLIGHT_MODEL.get().objects.exclude(name="").order_by(orderby)
    flightNames = ["-----"]
    if flightList:
        for flight in flightList:
            if (flight.name):
                flightNames.append(flight.name)
    return flightNames


@login_required
def updateTodaySession(request):
    if not request.is_ajax() or not request.method == 'POST':
        return HttpResponseNotAllowed(['POST'])
    todayChecked = request.POST.get('today')
    todayValue = todayChecked == unicode('true')
    request.session['today'] = todayValue
    return HttpResponse('ok')


@login_required
def manageFlights(request, errorString=""):
    today = request.session.get('today', False)
    return render(request,
                  "xgds_planner2/ManageFlights.html",
                  {'groups': getAllGroupFlights(today=today),
                   "errorstring": errorString},
                  )


@login_required
def listFlownFlights(request, errorString=""):
    today = request.session.get('today', False)
    return render(request,
                  "xgds_planner2/ListFlownFlights.html",
                  {'groups': getAllGroupFlights(today=today),
                   "errorstring": errorString},
                  )


def manageHelp(request):
    return render(request,
                  "xgds_planner2/ManageFlightHelp.html")


def oltest(request):
    return render(request, "xgds_planner2/oltest.html")


def startFlightTracking(request, flightName):
    try:
        flight = FLIGHT_MODEL.get().objects.get(name=flightName)
        if settings.GEOCAM_TRACK_SERVER_TRACK_PROVIDER:
            flight.startTracking()
            messages.info(request, "Tracking started: " + flightName)
        else:
            messages.error(request, "This server is not a tracking provider")
    except FLIGHT_MODEL.get().DoesNotExist:
        messages.error(request, 'Flight not found: ' + flightName)
    return redirect(reverse('error'))

def stopFlightTracking(request, flightName):
    try:
        flight = FLIGHT_MODEL.get().objects.get(name=flightName)
        if settings.GEOCAM_TRACK_SERVER_TRACK_PROVIDER:
            flight.stopTracking()
            messages.info(request, "Tracking stopped: " + flightName)
        else:
            messages.error(request, "This server is not a tracking provider")
    except FLIGHT_MODEL.get().DoesNotExist:
        messages.error(request, 'Flight not found: ' + flightName)
    return redirect(reverse('error'))

@login_required
def startFlight(request, uuid):
    errorString = ""
    try:
        flight = FLIGHT_MODEL.get().objects.get(uuid=uuid)
        if settings.GEOCAM_TRACK_SERVER_TRACK_PROVIDER:
            if not flight.start_time:
                flight.start_time = datetime.datetime.now(pytz.utc)
            flight.end_time = None
            flight.save()
    except FLIGHT_MODEL.get().DoesNotExist:
        errorString = "Flight not found"

    if flight:
        foundFlight = ACTIVE_FLIGHT_MODEL.get().objects.filter(flight__pk=flight.pk)
        if not foundFlight:
            if settings.GEOCAM_TRACK_SERVER_TRACK_PROVIDER:
                newlyActive = ACTIVE_FLIGHT_MODEL.get()(flight=flight)
                newlyActive.save()

        flight.startFlightExtras(request)
    return manageFlights(request, errorString)


@login_required
def stopFlight(request, uuid):
    errorString = ""
    try:
        flight = FLIGHT_MODEL.get().objects.get(uuid=uuid)
        if not flight.start_time:
            errorString = "Flight has not been started"
        else:
            flight.end_time = datetime.datetime.now(pytz.utc)
            flight.save()
            flight.stopFlightExtras(request)

            # kill the plans
            for pe in flight.plans.all():
                if pe.start_time:
                    pe.end_time = flight.end_time
                    pe.save()
            try:
                active = ACTIVE_FLIGHT_MODEL.get().objects.get(flight__pk=flight.pk)
                active.delete()
            except ObjectDoesNotExist:
                errorString = 'Flight IS NOT ACTIVE'

    except:
        traceback.print_exc()
        errorString = "Flight not found"
    return manageFlights(request, errorString)

@login_required
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
                local_date = utcToTimeZone(original_schedule_date, str(firstPlan.jsonPlan.site.alternateCrs.properties.timezone))
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
                    
                    if settings.XGDS_PLANNER2_SCHEDULE_EXTRAS_METHOD:
                        pe = getClassByName(settings.XGDS_PLANNER2_SCHEDULE_EXTRAS_METHOD)(request, pe)
                        
                    pe.save()
                    lastPlanExecution = pe
        except:
            traceback.print_exc()
            return HttpResponse(json.dumps({'Success':"False", 'msg': 'Plan not scheduled'}), content_type='application/json', status=406)
            pass
    if redirect:
        return HttpResponseRedirect(reverse('planner2_index'))
    else:
        if lastPlanExecution:
            return HttpResponse(json.dumps(lastPlanExecution.toSimpleDict(), cls=DatetimeJsonEncoder), content_type='application/json')
        return HttpResponse(json.dumps({'Success':"True", 'msg': 'Plan scheduled'}), content_type='application/json')


@login_required
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


@login_required
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


@login_required
def deletePlanExecution(request, pe_id):
    errorString = ""
    try:
        pe = PLAN_EXECUTION_MODEL.get().objects.get(pk=pe_id)
        pe.delete()
    except:
        errorString = "Plan Execution not found"
    return manageFlights(request, errorString)


@login_required
def addGroupFlight(request):
    from xgds_planner2.forms import GroupFlightForm
    errorString = None
    groupFlight = None
    newFlights = []

    if request.method != 'POST':
        groupFlightForm = GroupFlightForm()
        return render(request,
                      "xgds_planner2/AddGroupFlight.html", 
                      {'groupFlightForm': groupFlightForm,
                       'groupFlights': getGroupFlights(),
                       'errorstring': errorString})

    if request.method == 'POST':
        form = GroupFlightForm(request.POST)
        if form.is_valid():
            groupFlight = GROUP_FLIGHT_MODEL.get()()
            groupFlight.name = form.cleaned_data['date'].strftime('%Y%m%d') + form.cleaned_data['prefix']
            groupFlight.notes = form.cleaned_data['notes']
            try:
                groupFlight.save()
            except IntegrityError, strerror:
                errorString = "Problem Creating Group Flight: {%s}" % strerror
                return render(request,
                              "xgds_planner2/AddGroupFlight.html",
                              {'groupFlightForm': form,
                               'groupFlights': getGroupFlights(),
                               'errorstring': errorString},
                              )

            for vehicle in form.cleaned_data['vehicles']:
                newFlight = FLIGHT_MODEL.get()()
                newFlight.group = groupFlight

                newFlight.vehicle = VEHICLE_MODEL.get().objects.get(name=vehicle)
                newFlight.name = groupFlight.name + "_" + vehicle

                newFlight.locked = False
                newFlight.uuid = uuid4()

                try:
                    newFlight.save(force_insert=True)
                    newFlights.append(newFlight)
                except IntegrityError, strerror:
                    errorString = "Problem Creating Flight: {%s}" % strerror
                    return render(request,
                                  "xgds_planner2/AddGroupFlight.html",
                                  {'groupFlightForm': form,
                                   'groupFlights': getGroupFlights(),
                                   'errorstring': errorString},
                                  )
        else:
            errorString = form.errors
            return render(request,
                          "xgds_planner2/AddGroupFlight.html", 
                          {'groupFlightForm': form,
                           'groupFlights': getGroupFlights(),
                           'errorstring': errorString},
                          )

    # add relay ...
    if groupFlight:
        addRelay(groupFlight, None, json.dumps({'name': groupFlight.name, 'id': groupFlight.pk, 'notes': groupFlight.notes}), reverse('planner2_relayAddGroupFlight'))
        for f in newFlights:
            addRelay(f, None, json.dumps({'group_id': groupFlight.pk, 'vehicle_id': f.vehicle.pk, 'name': f.name, 'uuid': str(f.uuid), 'id': f.id}), reverse('planner2_relayAddFlight'))
            
    return HttpResponseRedirect(reverse('planner2_manage', args=[]))


def relayAddFlight(request):
    """ Add a flight with same pk and uuid from the post dictionary
    """
    try:
        try:
            flightName = request.POST.get('name')
            preexisting= FLIGHT_MODEL.get().get(name=flightName)
            preexisting.name = 'BAD' + preexisting.name
            preexisting.save()

            #TODO this should never happen, we should not have flights on multiple servers with the same name
            print '********DUPLICATE FLIGHT***** %s WAS ATTEMPTED TO RELAY WITH PK %d' % (flightName, request.POST.get('id'))
        except:
            pass
        
        # we are good it does not exist
        form_dict = json.loads(request.POST.get('serialized_form'))
        newFlight = FLIGHT_MODEL.get()(**form_dict)
        newFlight.save()
        return JsonResponse(model_to_dict(newFlight))
    except Exception, e:
        traceback.print_exc()
        return JsonResponse({'status': 'fail', 'exception': str(e)}, status=406)


def relayAddGroupFlight(request):
    """ Add a group flight with same pk and uuid from the post dictionary
    """
    try:        
        try:
            gfName = request.POST.get('name')
            preexisting= GROUP_FLIGHT_MODEL.get().get(name=gfName)
            preexisting.name = 'BAD' + preexisting.name
            preexisting.save()
            #TODO this should never happen, we should not have flights on multiple servers with the same name
            print '********DUPLICATE GROUP FLIGHT***** %s WAS ATTEMPTED TO RELAY WITH PK %d' % (gfName, request.POST.get('id'))
        except:
            pass

        form_dict = json.loads(request.POST.get('serialized_form'))
        newGroupFlight = GROUP_FLIGHT_MODEL.get()(**form_dict)
        newGroupFlight.save()
        return JsonResponse(model_to_dict(newGroupFlight))
    except Exception, e:
        traceback.print_exc()
        return JsonResponse({'status': 'fail', 'exception': str(e)}, status=406)


def getSiteFrames():
    if not settings.XGDS_PLANNER2_SITE_FRAMES:
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
                            settings.XGDS_PLANNER2_SITE_FRAMES.append(site)
                    except:
                        pass
    return settings.XGDS_PLANNER2_SITE_FRAMES


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


@login_required
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


def mapJsonPlan(request, uuid):
    PLAN_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_PLAN_MODEL)
    try:
        plan = PLAN_MODEL.get().objects.get(uuid=uuid)
        json_data = json.dumps([plan.toMapDict()], indent=4)
        return HttpResponse(content=json_data,
                            content_type="application/json")
    except:
        return HttpResponse(content={},
                            content_type="application/json")


def getActiveFlights(vehicle=None):
    ACTIVE_FLIGHTS_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_ACTIVE_FLIGHT_MODEL)

    if not vehicle:
        return ACTIVE_FLIGHTS_MODEL.get().objects.all()
    else:
        # filter by vehicle
        return ACTIVE_FLIGHTS_MODEL.get().objects.filter(flight__vehicle=vehicle)

def getActiveFlightFlights(vehicle=None):
    activeFlights = getActiveFlights(vehicle)
    flights = FLIGHT_MODEL.get().objects.filter(active__in=activeFlights)
    return flights

def activeFlightsTreeNodes(request):
    activeFlights = getActiveFlights()
    result = []
    for aFlight in activeFlights:
        result.append(aFlight.flight.getTreeJson())
    json_data = json.dumps(result, indent=4)
    return HttpResponse(content=json_data,
                        content_type="application/json")


def completedFlightsTreeNodes(request):
    flights = FLIGHT_MODEL.get().objects.exclude(end_time__isnull=True)
    result = []
    for f in flights:
        result.append(f.getTreeJson())
    json_data = json.dumps(result, indent=4)
    return HttpResponse(content=json_data,
                        content_type="application/json")
    
def flightTreeNodes(request, flight_id):
    flight = FLIGHT_MODEL.get().objects.get(id=flight_id)
    json_data = json.dumps(flight.getTreeJsonChildren(), indent=4)
    return HttpResponse(content=json_data,
                        content_type="application/json")

def plansTreeNodes(request):
    plans = PLAN_MODEL.get().objects.filter(deleted=False)
    result = []
    for plan in plans:
        result.append(plan.getTreeJson())
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
    PLAN_MODEL = LazyGetModelByName(settings.XGDS_PLANNER2_PLAN_MODEL)
    try:
        form = UploadXPJsonForm(request.POST, request.FILES)
        if form.is_valid():
            planUuid = form.cleaned_data['planUuid']
            try:
                plan = PLAN_MODEL.get().objects.get(uuid=planUuid)
            except:
                return HttpResponse(json.dumps({'Success':"False", 'responseText': 'Wrong UUID, plan not found'}), content_type='application/json', status=406)
            incoming = request.FILES['file']
            newJson = handle_uploading_xpjson(incoming)
            if (len(newJson) > 0):
                newJsonObj = json.loads(newJson, 'UTF-8')
                foundUuid = newJsonObj['uuid']
                if (foundUuid != planUuid):
                    return HttpResponse(json.dumps({'Success':"False", 'responseText': 'Loaded JSON is for a different plan; UUID of plans do not match.'}), content_type='application/json', status=406)
                isValid = validateJson(newJsonObj)
                if isValid == True:
                    updateJson(plan, newJsonObj)
                    return HttpResponse(json.dumps({'Success':"True"}))
                else:
                    return HttpResponse(json.dumps({'Success':"False", 'responseText': isValid}), content_type='application/json', status=406)
            else:
                return HttpResponse(json.dumps({'Success':"False", 'responseText': 'JSON Empty'}), content_type='application/json', status=406)
    except Exception:
        traceback.print_exc()
        exc_type, exc_value, exc_traceback = sys.exc_info()
        return HttpResponse(json.dumps({'Success':"False", 'responseText': exc_value['message']}), content_type='application/json', status=406)

def getTodaysGroupFlights():
    today = timezone.localtime(timezone.now()).date()
    return GROUP_FLIGHT_MODEL.get().objects.filter(name__startswith=today.strftime('%Y%m%d'))

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


def getGroupFlightSummary(request, groupFlightName):
    try:
        group = GROUP_FLIGHT_MODEL.get().objects.get(name=groupFlightName)
        return render(request,
                      "xgds_planner2/groupFlightSummary.html",
                      {'groupFlight': group},
                      )
    except:
        raise Http404("%s %s does not exist" % (settings.XGDS_PLANNER2_GROUP_FLIGHT_MONIKER, groupFlightName))
