# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
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

from xgds_planner2 import xpjson, settings, statsPlanExporter

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


class AbstractPlan(models.Model):
    uuid = UuidField(unique=True, db_index=True)
    name = models.CharField(max_length=256)
    dateModified = models.DateTimeField()
    creator = models.ForeignKey(User, null=True, blank=True)

    # the canonical serialization of the plan exchanged with javascript clients
    jsonPlan = ExtrasDotField()

    # a place to put an auto-generated summary of the plan
    summary = models.CharField(max_length=256)

    # cache commonly used stats derived from the plan (relatively expensive to calculate)
    numStations = models.PositiveIntegerField(null=True, blank=True)
    numSegments = models.PositiveIntegerField(null=True, blank=True)
    numCommands = models.PositiveIntegerField(null=True, blank=True)
    lengthMeters = models.FloatField(null=True, blank=True)
    estimatedDurationSeconds = models.FloatField(null=True, blank=True)
    stats = ExtrasDotField()  # a place for richer stats such as numCommandsByType

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
            return name

    def getExportUrl(self, extension):
        return reverse('planner2_planExport',
                       args=[self.uuid, self.escapedName() + extension])

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
