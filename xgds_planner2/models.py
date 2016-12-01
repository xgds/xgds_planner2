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
import re
import datetime
import pytz
from dateutil.parser import parse as dateparser

import copy
import logging
import os

from django.contrib.contenttypes.fields import GenericRelation
from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from geocamUtil.models.UuidField import UuidField, makeUuid
from geocamUtil.models.ExtrasDotField import ExtrasDotField
from geocamUtil.modelJson import modelToDict
from geocamUtil.dotDict import DotDict

from xgds_planner2 import xpjson, statsPlanExporter
from geocamUtil.loader import LazyGetModelByName
from geocamPycroraptor2.views import getPyraptordClient, stopPyraptordServiceIfRunning

from xgds_core.models import NamedURL

# pylint: disable=C1001,E1101

# SCHEMA = xpjson.loadDocument(settings.XGDS_PLANNER_SCHEMA_PATH)
# LIBRARY = xpjson.loadDocument(settings.XGDS_PLANNER_LIBRARY_PATH, schema=SCHEMA)
#
# _schema = 'xgds_planner2/schema.json'
# _library = 'xgds_planner2/library.json'
# SIMPLIFIED_SCHEMA_PATH = settings.STATIC_ROOT + _schema
# SIMPLIFIED_LIBRARY_PATH = settings.STATIC_ROOT + _library
# SIMPLIFIED_SCHEMA_URL = settings.STATIC_URL + _schema
# SIMPLIFIED_LIBRARY_URL = settings.STATIC_URL + _library

PLAN_SCHEMA_CACHE = {}


class AbstractVehicle(models.Model):
    name = models.CharField(max_length=192, blank=True, db_index=True)
    notes = models.TextField(blank=True)
    type = models.CharField(max_length=16, db_index=True)

    class Meta:
        abstract = True

    def __unicode__(self):
        return self.name

    def getDict(self):
        return {"name": self.name, "notes": self.notes, "type": self.type}


class Vehicle(AbstractVehicle):
    pass


DEFAULT_FLIGHT_FIELD = lambda: models.ForeignKey('xgds_planner2.Flight', null=True, blank=True)  #, related_name="plans")
DEFAULT_PLAN_FIELD = lambda: models.ForeignKey('xgds_planner2.Plan', null=True, blank=True)  #, related_name="executions")


class AbstractPlanExecution(models.Model):
    """
    Relationship table for managing
    flight to plan's many to many relationship.
    """
    start_time = models.DateTimeField(null=True, blank=True, db_index=True)
    planned_start_time = models.DateTimeField(null=True, blank=True, db_index=True)
    end_time = models.DateTimeField(null=True, blank=True, db_index=True)

    flight = 'set to DEFAULT_FLIGHT_FIELD() or similar in derived classes'
    plan = 'set to DEFAULT_PLAN_FIELD() or similar in derived classes'

    def toSimpleDict(self):
        result = {}
        result['pk'] = self.pk
        result['start_time'] = self.start_time
        result['planned_start_time'] = self.planned_start_time
        result['end_time'] = self.end_time
        if self.plan:    
            result['plan'] = self.plan.pk
        else:
            result['plan'] = None
        if self.flight:
            result['flight'] = self.flight.name
        else:
            result['flight'] = None
        return result
    
    def __unicode__(self):
        return str(self.pk)
    
    class Meta:
        abstract = True
        ordering = ['planned_start_time']


class PlanExecution(AbstractPlanExecution):
    flight = DEFAULT_FLIGHT_FIELD()
    plan = DEFAULT_PLAN_FIELD()


DEFAULT_VEHICLE_FIELD = lambda: models.ForeignKey(Vehicle, null=True, blank=True)
DEFAULT_GROUP_FLIGHT_FIELD = lambda: models.ForeignKey('xgds_planner2.GroupFlight', null=True, blank=True)


class AbstractFlight(models.Model):
    uuid = UuidField(unique=True, db_index=True)
    name = models.CharField(max_length=255, blank=True, unique=True, help_text='it is episode name + asset role. i.e. 20130925A_ROV', db_index=True)
    locked = models.BooleanField(blank=True, default=False)
    start_time = models.DateTimeField(null=True, blank=True, db_index=True)
    end_time = models.DateTimeField(null=True, blank=True, db_index=True)
    timezone = models.CharField(null=True, blank=False, max_length=128, default=settings.TIME_ZONE)

    vehicle = 'set to DEFAULT_VEHICLE_FIELD() or similar in derived classes'
    notes = models.TextField(blank=True)
    group = 'set to DEFAULT_GROUP_FLIGHT_FIELD() or similar in derived classes'

    @classmethod
    def cls_type(cls):
        return 'Flight'
    
    def hasStarted(self):
        return (self.start_time != None)
    
    def hasEnded(self):
        if self.hasStarted():
            return (self.end_time != None)
        return False

    def startFlightExtras(self, request):
        pass

    def stopFlightExtras(self, request):
        pass

    def thumbnail_time_url(self, event_time):
        return self.thumbnail_url()

    def thumbnail_url(self):
        return ''

    def view_time_url(self, event_time):
        return self.view_url()
    
    def view_url(self):
        return ''
    
    def __unicode__(self):
        return self.name

    def getTreeJsonChildren(self):
        children = []
        if self.track:
            children.append({"title": settings.GEOCAM_TRACK_TRACK_MONIKIER, 
                             "selected": False, 
                             "tooltip": "Tracks for " + self.name, 
                             "key": self.uuid + "_tracks", 
                             "data": {"json": reverse('geocamTrack_mapJsonTrack', kwargs={'uuid': str(self.track.uuid)}),
                                     "sseUrl": "", 
                                     "type": 'MapLink', 
                                     }
                            })
        if self.plans:
            myplan = self.plans[0].plan
            children.append({"title": settings.XGDS_PLANNER2_PLAN_MONIKER, 
                             "selected": False, 
                             "tooltip": "Plan for " + self.name, 
                             "key": self.uuid + "_plan", 
                             "data": {"json": reverse('planner2_mapJsonPlan', kwargs={'uuid': str(myplan.uuid)}),
                                     "sseUrl": "", 
                                     "type": 'MapLink', 
                                     }
                             })
        return children
    
    def getTreeJson(self):
        result = {"title": self.name,
                  "lazy": True,
                  "key": self.uuid,
                  "tooltip": self.notes,
                  "folder": True, 
                  "data": {"type": self.__class__.__name__,
                           "vehicle": self.vehicle.name,
                           "href": '', # TODO add url to the flight summary page when it exists
                           "childNodesUrl": reverse('planner2_flightTreeNodes', kwargs={'flight_id': self.id})
                           }
                  #"children": self.getTreeJsonChildren()
                  }
        
        return result
    
    @property
    def plans(self):
        return LazyGetModelByName(settings.XGDS_PLANNER2_PLAN_EXECUTION_MODEL).get().objects.filter(flight=self)

    def stopTracking(self):
        if settings.PYRAPTORD_SERVICE is True:
            pyraptord = getPyraptordClient()
            serviceName = self.vehicle.name + "TrackListener"
            stopPyraptordServiceIfRunning(pyraptord, serviceName)
            #TODO remove the current position for that track

    def startTracking(self):
        #TODO define
        pass

    class Meta:
        abstract = True
        ordering = ['-name']


class Flight(AbstractFlight):
    vehicle = DEFAULT_VEHICLE_FIELD()
    group = DEFAULT_GROUP_FLIGHT_FIELD()
    summary = models.CharField(max_length=1024, blank=True, null=True)


DEFAULT_ONE_TO_ONE_FLIGHT_FIELD = lambda: models.OneToOneField(Flight, related_name="active", null=True, blank=True)


class AbstractActiveFlight(models.Model):
    flight = 'set to DEFAULT_ONE_TO_ONE_FLIGHT_FIELD() or similar in derived classes'

    def __unicode__(self):
        return (u'ActiveFlight(%s, %s)' %
                (self.pk, repr(self.flight.name)))

    class Meta:
        abstract = True


class ActiveFlight(AbstractActiveFlight):
    flight = DEFAULT_ONE_TO_ONE_FLIGHT_FIELD()


class AbstractGroupFlight(models.Model):
    """
    This GroupFlight model represents the overall coordinated
    operation.
    """
    name = models.CharField(max_length=255, blank=True, unique=True, help_text='Usually same as episode name. I.e. 201340925A', db_index=True)
    notes = models.TextField(blank=True)

    def thumbnail_url(self):
        return ''

    def thumbnail_time_url(self, event_time):
        return self.thumbnail_url()

    def view_time_url(self, event_time):
        return '' #TODO implement
    
    def view_url(self):
        return '' #TODO implement

    def summary_url(self):
        return self.view_url()

    @property
    def flights(self):
        #TODO implement
        return None

    class Meta:
        abstract = True

    def __unicode__(self):
        return self.name


class GroupFlight(AbstractGroupFlight):
    @property
    def flights(self):
        return self.flight_set.all()


class AbstractPlan(models.Model):
    uuid = UuidField(unique=True, db_index=True)
    name = models.CharField(max_length=256, db_index=True)
    dateModified = models.DateTimeField(db_index=True)
    creator = models.ForeignKey(User, null=True, blank=True, db_index=True)

    # the canonical serialization of the plan exchanged with javascript clients
    jsonPlan = ExtrasDotField()

    # a place to put an auto-generated summary of the plan
    summary = models.CharField(max_length=256)

    # allow users to mark plans as deleted.  remember to use this field!
    deleted = models.BooleanField(blank=True, default=False)

    # allow users to mark plans as read only, so when they are opened they cannot be edited
    readOnly = models.BooleanField(blank=True, default=False)

    # cache commonly used stats derived from the plan (relatively expensive to calculate)
    numStations = models.PositiveIntegerField(default=0)
    numSegments = models.PositiveIntegerField(default=0)
    numCommands = models.PositiveIntegerField(default=0)
    lengthMeters = models.FloatField(null=True, blank=True)
    estimatedDurationSeconds = models.FloatField(null=True, blank=True)
    stats = ExtrasDotField()  # a place for richer stats such as numCommandsByType
    namedURLs = GenericRelation(NamedURL)

    class Meta:
        ordering = ['-dateModified']
        abstract = True

    def get_absolute_url(self):
        return reverse('planner2_planREST', args=[self.pk, self.name])

    def extractFromJson(self, overWriteDateModified=True, overWriteUuid=True):
        if overWriteUuid:
            if not self.uuid:
                self.uuid = makeUuid()
                self.jsonPlan.uuid = self.uuid
            self.jsonPlan.serverId = self.pk
        if overWriteDateModified:
            self.jsonPlan.dateModified = (datetime.datetime
                                          .now(pytz.utc)
                                          .replace(microsecond=0)
                                          .isoformat())
            self.jsonPlan.dateModified = self.jsonPlan.dateModified[:-6]+'Z'

        self.name = self.jsonPlan.name
        self.jsonPlan.url = self.get_absolute_url()
        self.jsonPlan.serverId = self.pk
        self.dateModified = dateparser(self.jsonPlan.dateModified).replace(tzinfo=pytz.utc)
        plannerUsers = User.objects.filter(username=self.jsonPlan.creator)
        if plannerUsers:
            self.creator = plannerUsers[0]
        else:
            self.creator = None

        # fill in stats
        try:
            exporter = statsPlanExporter.StatsPlanExporter()
#             print ' about to do stats'
            stats = exporter.exportDbPlan(self)
            for f in ('numStations', 'numSegments', 'numCommands', 'lengthMeters', 'estimatedDurationSeconds'):
                setattr(self, f, stats[f])
            self.stats.numCommandsByType = stats["numCommandsByType"]
            self.summary = statsPlanExporter.getSummary(stats)
        except:
            logging.warning('extractFromJson: could not extract stats from plan %s',
                            self.uuid)
            raise  # FIX
        return self

    def getSummaryOfCommandsByType(self):
        return statsPlanExporter.getSummaryOfCommandsByType(self.stats)

    # TODO test
    def toXpjson(self):
        platform = self.jsonPlan['platform']
        if platform:
            planSchema = getPlanSchema(platform[u'name'])
            return xpjson.loadDocumentFromDict(self.jsonPlan,
                                               schema=planSchema.getSchema())
        logging.warning('toXpjson: could not convert to xpjson, probably no schema %s',
                        self.uuid)
        raise  # FIX

    def escapedName(self):
        name = re.sub(r'[^\w]', '', self.name)
        if name == '':
            return 'plan'
        else:
            if self.jsonPlan and self.jsonPlan.planVersion:
                return name + "_" + self.jsonPlan.planVersion
            return name

    def getExportUrl(self, extension):
        return reverse('planner2_planExport',
                       kwargs={'uuid': self.uuid, 'name': self.escapedName() + extension})

    def getExporters(self):
        import choosePlanExporter  # delayed import avoids import loop
        result = []
        for exporterInfo in choosePlanExporter.PLAN_EXPORTERS:
            info = copy.deepcopy(exporterInfo)
            info.url = self.getExportUrl(info.extension)
            result.append(info)
        return result

    def getLinks(self):
        """
        The links tab wil be populated with the name, value contents of this dictionary as links,
        name is the string displayed and link is what will be opened
        """
        result = {}
        result["KML"] = reverse('planner2_planExport', kwargs={'uuid': self.uuid, 'name': self.name + '.kml'})
        for exporter in self.getExporters():
            result[exporter.label] = exporter.url
        return result
    

    def getEscapedId(self):
        if self.jsonPlan and self.jsonPlan.id:
            result = re.sub(r'[^\w]', '', self.jsonPlan.id)
            result = re.sub('_PLAN$', '', result)
            return result
        else:
            return None

    def toMapDict(self):
        """
        Return a reduced dictionary that will be turned to JSON for rendering in a map
        Here we are just interested in the route plan and not in activities
        We just include stations
        """
        result = {}
        result['id'] = self.uuid
        result['author'] = self.jsonPlan.creator
        result['name'] = self.jsonPlan.name
        result['type'] = 'AbstractPlan'
        if self.jsonPlan.notes:
            result['notes'] = self.jsonPlan.notes
        else:
            result['notes'] = ''

        stations = []
        seq = self.jsonPlan.sequence
        for el in seq:
            if el.type == "Station":
                sta = {}
                sta['id'] = el.id
                sta['coords'] = el.geometry.coordinates
                sta['notes'] = ''
                if hasattr(el, 'notes'):
                    if el.notes:
                        sta['notes'] = el.notes
                stations.append(sta)
        result['stations'] = stations
        return result

    def getTreeJson(self):
        result = {"title": self.name,
                  "key": self.uuid,
                  "tooltip": self.jsonPlan.notes,
                  "data": {"type": "MapLink",  # we cheat so this will be 'live'
                           "json": reverse('planner2_mapJsonPlan', kwargs={'uuid': str(self.uuid)}),
                           "href": reverse('planner2_edit', kwargs={'plan_id': str(self.pk)})
                           }
                  }
        return result
    
    @property
    def executions(self):
        return LazyGetModelByName(settings.XGDS_PLANNER2_PLAN_EXECUTION_MODEL).get().objects.filter(plan=self)


    def __unicode__(self):
        if self.name:
            return self.name
        else:
            return 'Unnamed plan ' + self.uuid


class Plan(AbstractPlan):
    pass


# PlanSchema used to be a database model, but is now a normal Python
# class built from the Django settings.  This will not change during
# runtime so we should cache these in PLAN_SCHEMA_CACHE.
class PlanSchema:
    def __init__(self, platform, schemaDict):
        self.platform = platform
        self.schemaSource = settings.PROJ_ROOT + schemaDict['schemaSource']
        self.librarySource = settings.PROJ_ROOT + schemaDict['librarySource']
        self.simulatorUrl = settings.STATIC_URL + schemaDict['simulatorUrl']
        self.simulator = schemaDict['simulator']

        schemaSuffix = os.path.join('xgds_planner2', os.path.basename(self.schemaSource))
        librarySuffix = os.path.join('xgds_planner2', os.path.basename(self.librarySource))

        self.simplifiedSchemaPath = os.path.join(settings.STATIC_ROOT, schemaSuffix)
        self.simplifiedLibraryPath = os.path.join(settings.STATIC_ROOT, librarySuffix)

        self.schemaUrl = os.path.join(settings.STATIC_URL, schemaSuffix)
        self.libraryUrl = os.path.join(settings.STATIC_URL, librarySuffix)

        self.schema = None
        self.library = None
        self.jsonSchema = None
        self.jsonLibrary = None

    def getJsonSchema(self):
        if not self.jsonSchema:
            try:
                with open(self.simplifiedSchemaPath) as schemaFile:
                    self.jsonSchema = schemaFile.read()
            except:  # pylint: disable=W0702
                logging.warning('could not load XPJSON schema from ' + self.simplifiedSchemaPath)
                raise
        return self.jsonSchema

    def getSchema(self):
        if not self.schema:
            try:
                self.schema = xpjson.loadDocument(self.simplifiedSchemaPath)
            except:  # pylint: disable=W0702
                logging.warning('could not load XPJSON schema from ' + self.simplifiedSchemaPath)
                raise
        return self.schema

    def getJsonLibrary(self):
        if not self.jsonLibrary:
            try:
                with open(self.simplifiedLibraryPath) as libraryFile:
                    self.jsonLibrary = libraryFile.read()
            except:  # pylint: disable=W0702
                logging.warning('could not load XPJSON library from ' + self.simplifiedLibraryPath)
                raise
        return self.jsonLibrary

    def getLibrary(self):
        if not self.library:
            try:
                self.library = xpjson.loadDocument(self.simplifiedLibraryPath,
                                                   schema=self.getSchema(),
                                                   fillInDefaults=True)
            except:  # pylint: disable=W0702
                logging.warning('could not load XPJSON library from ' + self.simplifiedLibraryPath)
                raise
        return self.library


def loadSchema(platform):
    schemaDict = settings.XGDS_PLANNER_SCHEMAS[platform]
    schema = PlanSchema(platform, schemaDict)
    schema.getSchema()
    schema.getJsonSchema()
    schema.getLibrary()
    schema.getJsonLibrary()
    return schema


# get the cached plan schema, building it if need be.
def getPlanSchema(platform):
    result = PLAN_SCHEMA_CACHE.get(platform)
    if not result:
        try:
            result = loadSchema(platform)
            PLAN_SCHEMA_CACHE[platform] = result
        except:
            logging.warning('could not find plan schema for platform %s', platform)
            raise
    return result
