# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import re
import datetime
import copy
import sys
import logging

import iso8601
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from geocamUtil.models.UuidField import UuidField, makeUuid
from geocamUtil.models.ExtrasDotField import ExtrasDotField

from xgds_planner2 import xpjson, settings, statsPlanExporter

SCHEMA = xpjson.loadDocument(settings.XGDS_PLANNER_SCHEMA_PATH)
LIBRARY = xpjson.loadDocument(settings.XGDS_PLANNER_LIBRARY_PATH, schema=SCHEMA)

_schema = 'xgds_planner2/schema.json'
_library = 'xgds_planner2/library.json'
SIMPLIFIED_SCHEMA_PATH = settings.STATIC_ROOT + _schema
SIMPLIFIED_LIBRARY_PATH = settings.STATIC_ROOT + _library
SIMPLIFIED_SCHEMA_URL = settings.STATIC_URL + _schema
SIMPLIFIED_LIBRARY_URL = settings.STATIC_URL + _library

def getModelByName(name):
    appName, modelName = name.split('.', 1)
    modelsName = appName + '.models'
    __import__(modelsName)
    modelsModule = sys.modules[modelsName]
    return getattr(modelsModule, modelName)

class Plan(models.Model):
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
        return reverse( 'planner2_planREST', args=[self.id, self.jsonPlan.id] )

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

        self.jsonPlan.url = self.get_absolute_url()
        self.name = self.jsonPlan.name
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
            stats = exporter.exportDbPlan(self)
            for f in ('numStations', 'numSegments', 'numCommands', 'lengthMeters'):
                setattr(self, f, stats[f])
            for f in ('numCommandsByType',):
                setattr(self.stats, f, stats[f])

            self.summary = statsPlanExporter.getSummary(stats)
        except:
            logging.warning('extractFromJson: could not extract stats from plan %s' % self.uuid)
            raise # FIX

        return self

    def getSummaryOfCommandsByType(self):
        return statsPlanExporter.getSummaryOfCommandsByType(self.stats)

    def toXpjson(self):
        return xpjson.loadDocumentFromDict(self.jsonPlan,
                                           schema=SCHEMA)

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
        import sys
        print >> sys.stderr, result
        return result

    def __unicode__(self):
        if self.name:
            return self.name
        else:
            return 'Unnamed plan ' + self.uuid

class PlanSchema(models.Model):
    platform = models.CharField(max_length=24)
    schemaUrl = models.CharField(max_length=512)
    libraryUrl = models.CharField(max_length=512)
    