# __BEGIN_LICENSE__
#Copyright (c) 2015, United States Government, as represented by the 
#Administrator of the National Aeronautics and Space Administration. 
#All rights reserved.
#
#The xGDS platform is licensed under the Apache License, Version 2.0 
#(the "License"); you may not use this file except in compliance with the License. 
#You may obtain a copy of the License at 
#http://www.apache.org/licenses/LICENSE-2.0.
#
#Unless required by applicable law or agreed to in writing, software distributed 
#under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
#CONDITIONS OF ANY KIND, either express or implied. See the License for the 
#specific language governing permissions and limitations under the License.
# __END_LICENSE__

import re
import datetime
import copy
import logging
import os

import iso8601
from django.db import models
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from geocamUtil.models.UuidField import UuidField, makeUuid
from geocamUtil.models.ExtrasDotField import ExtrasDotField
from geocamUtil.modelJson import modelToDict

from xgds_planner2 import xpjson, settings, statsPlanExporter
# from geocamUtil.loader import getModelByName

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
    name = models.CharField(max_length=192, blank=True)
    notes = models.TextField(blank=True)
    type = models.CharField(max_length=16)

    class Meta:
        abstract = True

    def __unicode__(self):
        return self.name

    def getDict(self):
        return {"name": self.name, "notes": self.notes, "type": self.type}


class Vehicle(AbstractVehicle):
    pass


class PlanExecution(models.Model):
    """
    Relationship table for managing
    flight to plan's many to many relationship.
    """
    start_time = models.DateTimeField(null=True, blank=True)
    planned_start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)

    flight = models.ForeignKey(settings.XGDS_PLANNER2_FLIGHT_MODEL, related_name="plans")
    plan = models.ForeignKey(settings.XGDS_PLANNER2_PLAN_MODEL, related_name="executions")

    class Meta:
        ordering = ['planned_start_time']

    def __unicode__(self):
        return self.id


class AbstractFlight(models.Model):
    uuid = UuidField(unique=True, db_index=True)
    name = models.CharField(max_length=255, blank=True, unique=True, help_text='it is episode name + asset role. i.e. 20130925A_ROV')
    locked = models.BooleanField(blank=True, default=False)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    vehicle = models.ForeignKey(settings.XGDS_PLANNER2_VEHICLE_MODEL, null=True, blank=True)
    notes = models.TextField(blank=True)
    group = models.ForeignKey(settings.XGDS_PLANNER2_GROUP_FLIGHT_MODEL, null=True, blank=True)

    def startFlightExtras(self):
        pass

    def stopFlightExtras(self):
        pass

    def __unicode__(self):
        return self.name

    def getTreeJson(self):
        result = {"title": self.name,
                  "key": self.uuid,
                  "tooltip": self.notes,
                  "data": {"type": self.__class__.__name__,
                           "vehicle": self.vehicle.name
                           }
                  }
        return result

    class Meta:
        abstract = True
        ordering = ['-name']


class Flight(AbstractFlight):
    pass


class AbstractActiveFlight(models.Model):
    flight = models.ForeignKey(settings.XGDS_PLANNER2_FLIGHT_MODEL, unique=True, related_name="active")

    def __unicode__(self):
        return (u'ActiveFlight(%s, %s)' %
                (self.id, repr(self.flight.name)))

    class Meta:
        abstract = True


class ActiveFlight(AbstractActiveFlight):
    """ name collision with PLRP, sorry"""
    pass


class AbstractGroupFlight(models.Model):
    """
    This GroupFlight model represents the overall coordinated
    operation.
    """
    name = models.CharField(max_length=255, blank=True, unique=True, help_text='Usually same as episode name. I.e. 201340925A')
    notes = models.TextField(blank=True)

    class Meta:
        abstract = True

    def __unicode__(self):
        return self.name


class GroupFlight(AbstractGroupFlight):
    pass


class AbstractPlan(models.Model):
    uuid = UuidField(unique=True, db_index=True)
    name = models.CharField(max_length=256)
    dateModified = models.DateTimeField()
    creator = models.ForeignKey(User, null=True, blank=True)

    # the canonical serialization of the plan exchanged with javascript clients
    jsonPlan = ExtrasDotField()

    # a place to put an auto-generated summary of the plan
    summary = models.CharField(max_length=256)

    # allow users to mark plans as deleted.  remember to use this field!
    deleted = models.BooleanField(blank=True, default=False)

    # allow users to mark plans as read only, so when they are opened they cannot be edited
    readOnly = models.BooleanField(blank=True, default=False)

    # cache commonly used stats derived from the plan (relatively expensive to calculate)
    numStations = models.PositiveIntegerField(null=True, blank=True)
    numSegments = models.PositiveIntegerField(null=True, blank=True)
    numCommands = models.PositiveIntegerField(null=True, blank=True)
    lengthMeters = models.FloatField(null=True, blank=True)
    estimatedDurationSeconds = models.FloatField(null=True, blank=True)
    stats = ExtrasDotField()  # a place for richer stats such as numCommandsByType
#     flights = models.ManyToManyField(settings.XGDS_PLANNER2_FLIGHT_MODEL, through='FlightToPlan', symmetrical=False)

    class Meta:
        ordering = ['-dateModified']
        abstract = True

    def get_absolute_url(self):
        return reverse('planner2_planREST', args=[self.id, self.name])

    def extractFromJson(self, overWriteDateModified=True, overWriteUuid=True):
        if overWriteUuid:
            if not self.uuid:
                self.uuid = makeUuid()
            self.jsonPlan.serverId = self.id
        if overWriteDateModified:
            self.jsonPlan.dateModified = (datetime.datetime
                                          .utcnow()
                                          .replace(microsecond=0)
                                          .isoformat()
                                          + 'Z')

        self.name = self.jsonPlan.name
        self.jsonPlan.url = self.get_absolute_url()
#         print 'name is now ' + self.name
        self.jsonPlan.serverId = self.id
        self.dateModified = (iso8601.parse_date(self.jsonPlan.dateModified)
                             .replace(tzinfo=None))
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
            for f in ('numStations', 'numSegments', 'numCommands', 'lengthMeters'):
                setattr(self, f, stats[f])
            for f in ('numCommandsByType',):
                setattr(self.stats, f, stats[f])
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
#         for exporter in self.getExporters():
#             result[exporter.label] = exporter.url
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
                if el.notes:
                    sta['notes'] = el.notes
                stations.append(sta)
        result['stations'] = stations
        return result

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
