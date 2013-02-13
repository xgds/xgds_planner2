# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

import re
import datetime

import iso8601
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from geocamUtil.models.UuidField import UuidField, makeUuid
from geocamUtil.models.ExtrasField import ExtrasField

from xgds_planner2 import xpjson, settings

def getModClass(name):
    """converts 'xgds_planner.forms.PlanMetaForm' to ['xgds_planner.forms', 'PlanMetaForm']"""
    try:
        dot = name.rindex('.')
    except ValueError:
        return name, ''
    return name[:dot], name[dot + 1:]


def getClassByName(qualifiedName):
    """converts 'xgds_planner.forms.PlanMetaForm' to the PlanMetaForm class object in
    module xgds_planner.forms"""
    modName, klassName = getModClass(qualifiedName)
    __import__(modName)
    mod = sys.modules[modName]
    return getattr(mod, klassName)


SCHEMA = xpjson.loadDocument(settings.XGDS_PLANNER_SCHEMA_PATH)

PLAN_EXPORTERS = []
PLAN_EXPORTERS_BY_FORMAT = {}
for formatCode, extension, exporterClassName in XGDS_PLANNER_PLAN_EXPORTERS:
    exporterClass = getModClass(exporterClassName)
    PLAN_EXPORTERS.append({'formatCode': formatCode,
                           'extension': extension,
                           'exporterClass': exporterClass})
    PLAN_EXPORTERS_BY_FORMAT[formatCode] = exporterClass


class Plan(models.Model):
    uuid = UuidField(primary_key=True)
    name = models.CharField(max_length=64)
    dateModified = models.DateTimeField()
    creator = models.ForeignKey(User, null=True, blank=True)

    # the canonical serialization of the plan exchanged with javascript clients
    jsonPlan = ExtrasField()

    def extractFromJson(self, overWriteDateModified=True):
        if overWriteDateModified:
            self.jsonPlan.dateModified = datetime.datetime.utcnow().isoformat() + 'Z'

        self.name = self.jsonPlan.name
        self.dateModified = (iso8601.parse_date(self.jsonPlan.dateModified)
                             .replace(tzinfo=None))
        plannerUsers = User.objects.filter(username=self.jsonPlan.creator)
        if plannerUsers:
            self.creator = plannerUsers[0]
        else:
            self.creator = None

        return self

    def toXpjson(self):
        return xpjson.loadDocumentFromDict(self.jsonPlan.toDotDict(),
                                           schema=SCHEMA)

    def escapedName(self):
        name = re.sub(r'[^\w]', '', self.name)
        if name == '':
            return 'plan'
        else:
            return name

    def plannerXpjsonUrl(self):
        return reverse('planner2_planPlannerXpjson', args=[self.uuid, self.escapedName()])

    def expandedXpjsonUrl(self):
        return reverse('planner2_planExpandedXpjson', args=[self.uuid, self.escapedName()])

    def kmlUrl(self):
        return reverse('planner2_planKml', args=[self.uuid, self.escapedName()])

    def __unicode__(self):
        if self.name:
            return self.name
        else:
            return 'Unnamed plan ' + self.uuid


@receiver(pre_save, sender=Plan)
def beforePlanSave(sender, instance, raw, using, **kwargs):
    "Trigger field extraction before saving"
    instance.extractFromJson()
