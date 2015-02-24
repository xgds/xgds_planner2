# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

# pylint: disable=W0702
from cStringIO import StringIO
import datetime
import glob
import json
import os
from uuid import uuid4

from django.contrib.auth.decorators import login_required
from django.contrib.staticfiles.storage import staticfiles_storage
from django.core.exceptions import ObjectDoesNotExist
from django.core.urlresolvers import reverse
from django.db.utils import IntegrityError
from django.http import (HttpResponseRedirect,
                         HttpResponse,
                         HttpResponseNotAllowed,
                         HttpResponseBadRequest)
from django.shortcuts import render_to_response, get_object_or_404
from django.template import RequestContext
from django.views.decorators.cache import never_cache

from geocamUtil import timezone
from geocamUtil.KmlUtil import wrapKmlDjango
from geocamUtil.dotDict import convertToDotDictRecurse, DotDict
from geocamUtil.loader import getModelByName
from geocamUtil.usng.usng import LLtoUTM
from geocamUtil.geomath import calculateUTMDiffMeters
from xgds_planner2 import (settings,
                           models,
                           choosePlanExporter,
                           forms,
                           planImporter,
                           fillIdsPlanExporter)
from xgds_planner2.forms import GroupFlightForm
from xgds_planner2.models import getPlanSchema


HANDLEBARS_TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), 'templates/handlebars')
_template_cache = None


def get_plan_model():
    return getModelByName(settings.XGDS_PLANNER2_PLAN_MODEL)


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


def plan_help(request):
    return render_to_response(
        'xgds_planner2/planner_help.html',
        RequestContext(request, {
            "settings": settings
        })
    )


@login_required
def plan_tests(request, plan_id, editable=True):
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
        'xgds_planner2/planner_tests.html',
        RequestContext(request, {
            'templates': templates,
            'settings': settings,
            'plan_schema_json': planSchema.getJsonSchema(),  # xpjson.dumpDocumentToString(planSchema.getSchema()),
            'plan_library_json': planSchema.getJsonLibrary(),  # xpjson.dumpDocumentToString(planSchema.getLibrary()),
            'plan_json': json.dumps(plan_json),
            'plan_name': plan.name,
            'plan_index_json': json.dumps(plan_index_json()),
            'editable': editable,
            'simulatorUrl': planSchema.simulatorUrl,
            'simulator': planSchema.simulator,
            'placemark_circle_url': request.build_absolute_uri(
                staticfiles_storage.url('xgds_planner2/images/placemark_circle.png')
            ),
            'placemark_circle_highlighted_url': request.build_absolute_uri(
                staticfiles_storage.url('xgds_planner2/images/placemark_circle_highlighted.png')
            ),
            'plan_links_json': json.dumps(plan.getLinks())
        }),
        # context_instance=RequestContext
    )


def aggregate_handlebars_templates(request):
    """
    Return a JSON object containing all the Handlebars templates in the
    appropriate templates directory, indexed by name.
    """
    return HttpResponse(json.dumps(get_handlebars_templates()), content_type='application/json')


@login_required
def plan_REST(request, plan_id, jsonPlanId):
    """
    Read and write plan JSON.
    jsonPlanId is ignored.  It's for human-readabilty in the URL
    """
    Plan = get_plan_model()
    plan = Plan.objects.get(pk=plan_id)
    if request.method == "PUT":
        data = json.loads(request.body)
        for k, v in data.iteritems():
            if k == "_simInfo":
                continue
            plan.jsonPlan[k] = v
#         print json.dumps(data, indent=4, sort_keys=True)
        plan.extractFromJson(overWriteDateModified=True)
        plan.save()

    elif request.method == "POST":
        # we are doing a save as
        plan.jsonPlan.creator = request.user.username
        plan.creationDate = datetime.datetime.utcnow()
        plan.uuid = None
        plan.id = None
        data = json.loads(request.body)
        for k, v in data.iteritems():
            if k == "_simInfo":
                continue
            plan.jsonPlan[k] = v
        plan.extractFromJson(overWriteDateModified=True, overWriteUuid=True)
        plan.name = plan.jsonPlan['planName']
        plan.jsonPlan['name'] = plan.jsonPlan['planName']

        # TODO I don't understand why this did not work above
        plan.creator = request.user
        plan.jsonPlan.creator = request.user.username
        
        #make sure it is not read only
        plan.readOnly = False
        plan.save()

        newid = plan.id
        plan.jsonPlan["serverId"] = newid
        plan.jsonPlan["planNumber"] = newid
        plan.jsonPlan.url = plan.get_absolute_url()

        # we still need to renumber the plan
        schema = models.getPlanSchema(plan.jsonPlan.platform['name'])
        exporter = fillIdsPlanExporter.FillIdsPlanExporter()
        planDict = convertToDotDictRecurse(plan.jsonPlan)
        plan.jsonPlan = json.dumps(exporter.exportPlan(planDict, schema.schema))
        plan.jsonPlan['uuid'] = plan.uuid

        plan.save()
        response = {}
        response["msg"] = "New plan created"
        response["data"] = newid
        return HttpResponse(json.dumps(response), content_type='application/json')

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


@login_required
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
            'plans': Plan.objects.filter(deleted=False),
            'flight_names': getAllFlightNames(),
            'exporters': choosePlanExporter.PLAN_EXPORTERS
        },
        context_instance=RequestContext(request))


def plan_index_json():
    Plan = get_plan_model()
    plan_objs = Plan.objects.filter(deleted=False)
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


def planExport(request, uuid, name, time=None):
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
            context = DotDict({'startTime': datetime.datetime.strptime(time, '%Y-%m-%d-%H-%M')})
            exporter.initPlan(dbPlan, context)
        except:
            pass
    return exporter.getHttpResponse(dbPlan, attachmentName=name)


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
            dbPlan.jsonPlan.name = planId
            dbPlan.name = planId

            dbPlan.save()

            # redirect to plan editor on newly created plan
            return HttpResponseRedirect(reverse('planner2_edit', args=[dbPlan.id]))
    else:
        return HttpResponseNotAllowed(['GET', 'POST'])
    return render_to_response(request,
                              'xgds_planner2/planCreate.html',
                              {'form': form})


@login_required
def plan_delete(request):
    PLAN = get_plan_model()
    picks = request.POST.getlist('picks')
    for i in picks:
        plan = PLAN.objects.get(id=i)
        if plan:
            plan.deleted = True
            plan.save()
    return HttpResponseRedirect(reverse('planner2_index'))


@never_cache
def getPlanIndexKml(request):
    out = StringIO()
    out.write('<Document>\n')
    PLAN = get_plan_model()
    plans = PLAN.objects.filter(deleted=False)
    plans = list(reversed(sorted(plans, key=lambda plan: (plan.getEscapedId(), plan.escapedName()))))
    for plan in plans:
        fname = '%s.kml' % plan.escapedName()
        relUrl = reverse('planner2_planExport', args=[plan.uuid, fname])
        url = request.build_absolute_uri(relUrl)
        print(url)
        out.write("""
<NetworkLink>
  <name>%(name)s</name>
  <visibility>0</visibility>
  <Link>
    <href>%(url)s</href>
  </Link>
</NetworkLink>
"""
                  % dict(name=plan.getEscapedId() + ' - ' + plan.escapedName(), url=url))
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
    GroupFlightModel = getModelByName(settings.XGDS_PLANNER2_GROUP_FLIGHT_MODEL)
    return GroupFlightModel.objects.exclude(name="").order_by('name')


def getAllFlights(today=False, reverseOrder=False):
    orderby = 'name'
    if reverseOrder:
        orderby = '-name'
    FlightModel = getModelByName(settings.XGDS_PLANNER2_FLIGHT_MODEL)
    if not today:
        return FlightModel.objects.all().order_by(orderby)
    else:
        now = timezone.localtime(datetime.datetime.utcnow())
        todayname = "%04d%02d%02d" % (now.year, now.month, now.day)
        return FlightModel.objects.filter(name__startswith=(todayname)).order_by(orderby)


def getAllFlightNames(year="ALL", onlyWithPlan=False, reverseOrder=False):
    orderby = 'name'
    if reverseOrder:
        orderby = '-name'
    FlightModel = getModelByName(settings.XGDS_PLANNER2_FLIGHT_MODEL)
    flightList = FlightModel.objects.exclude(name="").order_by(orderby)
    flightNames = ["-----"]
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
    return render_to_response("xgds_planner2/ManageFlights.html",
                              {'flights': getAllFlights(today=today),
                               "errorstring": errorString},
                              context_instance=RequestContext(request))


def manageHelp(request):
    return render_to_response("xgds_planner2/ManageFlightHelp.html", {},
                              context_instance=RequestContext(request))


def oltest(request):
    return render_to_response("xgds_planner2/oltest.html", {},
                              context_instance=RequestContext(request))

@login_required
def startFlight(request, uuid):
    errorString = ""
    FlightModel = getModelByName(settings.XGDS_PLANNER2_FLIGHT_MODEL)
    try:
        flight = FlightModel.objects.get(uuid=uuid)
        flight.start_time = datetime.datetime.utcnow()
        flight.end_time = None
        flight.save()
    except FlightModel.DoesNotExist:
        errorString = "Flight not found"

    if flight:
        foundFlight = models.ActiveFlight.objects.filter(flight__id=flight.id)
        if not foundFlight:
            newlyActive = models.ActiveFlight(flight=flight)
            newlyActive.save()

        flight.startFlightExtras(request)
    return manageFlights(request, errorString)


@login_required
def stopFlight(request, uuid):
    errorString = ""
    FlightModel = getModelByName(settings.XGDS_PLANNER2_FLIGHT_MODEL)
    try:
        flight = FlightModel.objects.get(uuid=uuid)
        if not flight.start_time:
            errorString = "Flight has not been started"
        else:
            flight.end_time = datetime.datetime.utcnow()
            flight.save()
            flight.stopFlightExtras(request)

            # kill the plans
            for pe in flight.plans.all():
                if pe.start_time:
                    pe.end_time = flight.end_time
                    pe.save()
            try:
                active = models.ActiveFlight.objects.get(flight__id=flight.id)
                active.delete()
            except ObjectDoesNotExist:
                errorString = 'Flight IS NOT ACTIVE'

    except:
        errorString = "Flight not found"
    return manageFlights(request, errorString)


@login_required
def schedulePlans(request):
    flight = None
    if request.method == 'POST':
        try:
            pids = request.POST['planIds']
            planIds = []
            for item in pids.split(","):
                planIds.append(int(item))

            schedule_date_string = request.POST['schedule_date']
            original_schedule_date = None
            if schedule_date_string:
                # convert to utc
                original_schedule_date = datetime.datetime.strptime(schedule_date_string, '%m/%d/%Y %H:%M')
                schedule_date = timezone.convertToUtc(original_schedule_date)

            flight_name = request.POST['flight']
            FlightModel = getModelByName(settings.XGDS_PLANNER2_FLIGHT_MODEL)
            try:
                flight = FlightModel.objects.get(name=flight_name)
            except FlightModel.DoesNotExist:
                # see if we can look it up by date
                if original_schedule_date:
                    prefix = "%04d%02d%02d" % (original_schedule_date.year, original_schedule_date.month, original_schedule_date.day)
                    flights = FlightModel.objects.filter(name__startswith=prefix)
                    if flights:
                        # pick the first one
                        flight = flights[0]
                    else:
                        # it does not exist we better make one
                        GroupFlightModel = getModelByName(settings.XGDS_PLANNER2_GROUP_FLIGHT_MODEL)
                        groupFlight = GroupFlightModel()
                        prefix = prefix + "A"
                        groupFlight.name = prefix
                        groupFlight.save()
                        VehicleModel = getModelByName(settings.XGDS_PLANNER2_VEHICLE_MODEL)
                        for vehicle in VehicleModel.objects.all():
                            newFlight = FlightModel()
                            newFlight.group = groupFlight
                            newFlight.vehicle = vehicle
                            newFlight.name = prefix + "_" + vehicle.name
                            newFlight.locked = False
                            newFlight.uuid = uuid4()
                            newFlight.save(force_insert=True)
                            if not flight:
                                flight = newFlight

            if flight:
                PlanModel = get_plan_model()
                plans = PlanModel.objects.filter(id__in=planIds)

                for plan in plans:
                    pe = models.PlanExecution()
                    pe.planned_start_time = schedule_date
                    pe.flight = flight
                    pe.plan = plan
                    pe.save()
        except:
            pass

    return HttpResponseRedirect(reverse('planner2_index'))


@login_required
def startPlan(request, pe_id):
    errorString = ""
    try:
        pe = models.PlanExecution.objects.get(id=pe_id)
        pe.start_time = datetime.datetime.utcnow()
        pe.end_time = None
        pe.save()
    except:
        errorString = "Plan Execution not found"
    return manageFlights(request, errorString)


@login_required
def stopPlan(request, pe_id):
    errorString = ""
    try:
        pe = models.PlanExecution.objects.get(id=pe_id)
        if pe.start_time:
            pe.end_time = datetime.datetime.utcnow()
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
        pe = models.PlanExecution.objects.get(id=pe_id)
        pe.delete()
    except:
        errorString = "Plan Execution not found"
    return manageFlights(request, errorString)


@login_required
def addGroupFlight(request):
    errorString = None

    if request.method != 'POST':
        groupFlightForm = GroupFlightForm()

        today = datetime.datetime.utcnow()
        groupFlightForm.year = today.year
        groupFlightForm.month = today.month - 1
        groupFlightForm.day = today.day
        return render_to_response("xgds_planner2/AddGroupFlight.html", {'groupFlightForm': groupFlightForm,
                                                                        'groupFlights': getGroupFlights(),
                                                                        'errorstring': errorString},
                                  context_instance=RequestContext(request))
    if request.method == 'POST':
        form = GroupFlightForm(request.POST)
        if form.is_valid():
            GroupFlightModel = getModelByName(settings.XGDS_PLANNER2_GROUP_FLIGHT_MODEL)
            groupFlight = GroupFlightModel()
            groupFlight.name = form.cleaned_data['date'].strftime('%Y%m%d') + form.cleaned_data['prefix']
            groupFlight.notes = form.cleaned_data['notes']
            try:
                groupFlight.save()
            except IntegrityError, strerror:
                errorString = "Problem Creating Group Flight: {%s}" % strerror
                return render_to_response("xgds_planner2/AddGroupFlight.html",
                                          {'groupFlightForm': form,
                                           'groupFlights': getGroupFlights(),
                                           'errorstring': errorString},
                                          context_instance=RequestContext(request))

            for vehicle in form.cleaned_data['vehicles']:
                FlightModel = getModelByName(settings.XGDS_PLANNER2_FLIGHT_MODEL)
                newFlight = FlightModel()
                newFlight.group = groupFlight

                VehicleModel = getModelByName(settings.XGDS_PLANNER2_VEHICLE_MODEL)
                newFlight.vehicle = VehicleModel.objects.get(name=vehicle)
                newFlight.name = groupFlight.name + "_" + vehicle

                newFlight.locked = False
                newFlight.uuid = uuid4()

                try:
                    newFlight.save(force_insert=True)
                except IntegrityError, strerror:
                    errorString = "Problem Creating Flight: {%s}" % strerror
                    return render_to_response("xgds_planner2/AddGroupFlight.html",
                                              {'groupFlightForm': form,
                                               'groupFlights': getGroupFlights(),
                                               'errorstring': errorString},
                                              context_instance=RequestContext(request))
        else:
            errorString = form.errors
            return render_to_response("xgds_planner2/AddGroupFlight.html", {'groupFlightForm': form,
                                                                            'groupFlights': getGroupFlights(),
                                                                            'errorstring': errorString},
                                      context_instance=RequestContext(request))

    return HttpResponseRedirect(reverse('planner2_manage', args=[]))


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
        Plan = get_plan_model()
        for item in pids:
            try:
                id = int(item)
                plan = Plan.objects.get(id=id)
                plan.readOnly = not plan.readOnly
                plan.save()
            except:
                pass
    return HttpResponseRedirect(reverse('planner2_index'))
