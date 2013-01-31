# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

"""
Utilities for parsing and modeling XPJSON format plans, plan schemas, and plan libraries.
"""

import os
import json
from collections import deque, Mapping, OrderedDict
import pprint
import re
import logging

import jsonschema
import iso8601

from geocamUtil import dotDict
from geocamUtil.dotDict import DotDict

from xgds_planner2 import xpjsonFields

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_SCHEMA_PATH_PLAN_SCHEMA = os.path.join(THIS_DIR, 'xpjsonSpec', 'xpjsonPlanSchemaDocumentSchema.json')

CRS84 = dotDict.DotDict({
    "type": "name",
    "properties": {
        "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
})

GEOMETRY_TYPE_CHOICES = (
    'Point',
    'MultiPoint',
    'LineString',
    'MultiLineString',
    'Polygon',
    'MultiPolygon',
    'GeometryCollection',
)

VALUE_TYPE_CHOICES = (
    'string',
    'integer',
    'number',
    'boolean',
    'date-time',
    'targetId',
) + GEOMETRY_TYPE_CHOICES


class UnknownParentError(Exception):
    pass


def objToDict(obj):
    if isinstance(obj, (dict, dotDict.DotDict)):
        if hasattr(obj, 'id'):
            print obj.id
        return dict([(k, objToDict(v)) for k, v in obj.iteritems()])
    elif isinstance(obj, list):
        return [objToDict(elt) for elt in obj]
    elif isinstance(obj, (int, float, str, unicode, bool)) or obj is None:
        return obj
    elif hasattr(obj, 'toDict'):
        return obj.toDict()
    else:
        return objToDict(vars(obj))


def prettyDumps(obj):
    return json.dumps(objToDict(obj), indent=4, sort_keys=True)


def isValueOfType(val, valueType):
    """
    Check whether the type of *val* conforms to *valueType*. Supports
    the valueTypes defined in the XPJSON spec as well as some others
    we use in this parsing library.
    """

    if valueType == 'custom':
        return True  # skip validation
    elif valueType == 'string':
        return isinstance(val, (str, unicode))
    elif valueType == 'integer':
        return isinstance(val, int)
    elif valueType == 'number':
        return isinstance(val, (int, float))
    elif valueType == 'boolean':
        return isinstance(val, bool)
    elif valueType == 'date-time':
        # must be explicitly in UTC time zone
        if not val.endswith('Z'):
            return False

        # must conform to ISO 8601 date-time format
        try:
            iso8601.parse_date(val)
            return True
        except iso8601.ParseError:
            return False
    elif valueType in GEOMETRY_TYPE_CHOICES:
        # check that the value is a struct with the proper 'type'
        # field. we could also check that the other fields look valid
        # but that's more complicated.
        return (hasattr(val, 'type')
                and val.type == valueType)
    elif valueType == 'targetId':
        return isinstance(val, (str, unicode))

    # our extra types not defined in XPJSON spec
    elif valueType.startswith('array.'):
        # for example, 'array.integer' -> array of integer
        if not isinstance(val, (list, tuple)):
            return False
        eltType = re.sub(r'^array\.', '', valueType)
        return all((isValueOfType(elt, eltType) for elt in val))
    elif valueType.startswith('dict.'):
        # for example, 'dict.integer' -> object with string member names
        # and integer member values
        if not isinstance(val, (dict, dotDict.DotDict)):
            return False
        vType = re.sub(r'^dict\.', '', valueType)
        return all(((isValueOfType(k, 'string') and isValueOfType(v, vType))
                     for k, v in val.itervalues()))
    elif valueType in ('url',):
        return isinstance(val, (str, unicode))
    else:
        if isinstance(val, (dict, dotDict.DotDict)) and val.type == valueType:
            # for example, 'ParamSpec' -> object with 'type' member equal
            # to 'ParamSpec'
            return True
        else:
            raise KeyError('unknown valueType %s' % valueType)


def getIdDict(lst):
    return dict([(elt.get('id'), elt) for elt in lst])


def loads(s):
    """
    Load a DotDict from the JSON-format string *s*.
    """
    return dotDict.convertToDotDictRecurse(json.loads(s))


def load(f):
    """
    Load a DotDict from the JSON-format file *f*.
    """
    return dotDict.convertToDotDictRecurse(json.load(f))


def loadPath(path):
    """
    Load a DotDict from the JSON-format file at path *path*.
    """
    return load(file(path, 'r'))


class NoSchemaError(Exception):
    pass


def loadDocumentFromDict(docDict, schema=None):
    assert docDict.xpjson == '0.1'
    docTypes = {
        'PlanSchema': PlanSchema,
        'Plan': Plan,
        'PlanLibrary': PlanLibrary
    }
    docParser = docTypes[docDict.type]
    if docDict.type == 'PlanSchema':
        return docParser(docDict)
    else:
        if schema is None:
            raise NoSchemaError(docDict.type)
        return docParser(docDict, schema=schema)


def loadDocument(docPath, schema=None):
    docDict = loadPath(docPath)
    return loadDocumentFromDict(docDict, schema)


def dumpPath(path, obj):
    """
    Dump a DotDict in to the specified path in (pretty indented) JSON format.
    """
    f = open(path, 'w')
    f.write(json.dumps(obj, sort_keys=True, indent=4))
    f.close()


def joinById(localList, parentList):
    localDict = OrderedDict([(elt.id, elt) for elt in localList])
    parentDict = OrderedDict([(elt.id, elt) for elt in parentList])

    joinedDict = parentDict
    joinedDict.update(localDict)

    return joinedDict.values()


class InheritDict(Mapping):
    """
    A dict-like object that implements lazy inheritance.  By default,
    the *localVals* value for a field overrides the *parent* value.

    For fields in *inheritFields*, the resolved value is formed by
    recursive inheritance, basically a union of the local and parent
    values using the joinById() function.

    For fields in *localOnlyFields*, the value is drawn only from
    *localVals*.
    """
    def __init__(self, localVals, parent, inheritFields=[], localOnlyFields=[]):
        self.localDict = dict(localVals)
        self.parent = parent
        self.inheritFields = inheritFields
        self.localOnlyFields = localOnlyFields

    @staticmethod
    def localValOverridesParentVal(getLocalVal, getParentVal):
        try:
            return getLocalVal()
        except KeyError:
            return getParentVal()

    @staticmethod
    def localValInheritsFromParentVal(getLocalVal, getParentVal):
        try:
            localVal = getLocalVal()
            try:
                parentVal = getParentVal()
                return joinById(localVal, parentVal)
            except KeyError:
                return localVal
        except KeyError:
            return getParentVal()

    @staticmethod
    def useLocalValOnly(getLocalVal, getParentVal):
        return getLocalVal()

    def __getitem__(self, key):
        if key in self.inheritFields:
            func = self.localValInheritsFromParentVal
        elif key in self.localOnlyFields:
            func = self.useLocalValOnly
        else:
            func = self.localValOverridesParentVal
        getLocalVal = lambda: self.localDict[key]
        getParentVal = lambda: self.parent[key]
        return func(getLocalVal, getParentVal)

    def __iter__(self):
        possibleKeys = set(self.localDict.iterkeys()).union(self.parent.iterkeys())
        return (k for k in possibleKeys if k in self)

    def __len__(self):
        # O(1) not possible with lazy design
        return sum(1 for _ in iter(self))


def resolveInheritanceLookup(spec, parentSpecLookup,
                             inheritFields=(), localOnlyFields=()):
    if 'parent' in spec:
        parent = parentSpecLookup.get(spec.parent)
        if parent:
            result = (DotDict
                      (InheritDict
                       (spec,
                        parent,
                        inheritFields=inheritFields,
                        localOnlyFields=localOnlyFields)))
            result.pop('parent', None)
            return result
        else:
            raise UnknownParentError(spec.parent)
    else:
        return spec


def resolveSpecInheritance(rawSpecs, inheritFields=[], localOnlyFields=[]):
    rawSpecLookup = getIdDict(rawSpecs)
    q = deque(rawSpecs)
    parentSpecLookup = {}

    while q:
        spec = q.popleft()
        try:
            parentSpecLookup[spec.id] = (resolveInheritanceLookup
                                         (spec, parentSpecLookup,
                                          inheritFields, localOnlyFields))
        except UnknownParentError:
            # parent not processed yet, try again later
            assert spec.parent in rawSpecLookup, spec.parent
            q.append(spec)
            continue

    return parentSpecLookup


def resolveSchemaInheritance(schemaDict):
    # resolve inheritance in paramSpecs
    rawParamSpecs = schemaDict.get('paramSpecs', [])
    paramSpecLookup = resolveSpecInheritance(rawParamSpecs)

    # resolve inheritance in commandSpecs
    rawCommandSpecs = schemaDict.get('commandSpecs', [])
    rawCommandSpecs.append(DotDict({
        'type': 'CommandSpec',
        'id': 'Command',
        'abstract': True,
    }))
    commandSpecLookup = resolveSpecInheritance(rawCommandSpecs,
                                               inheritFields=('params'),
                                               localOnlyFields=('id', 'name', 'abstract'))

    # filter out abstract commandSpecs
    commandSpecs = [commandSpecLookup[spec.id]
                    for spec in rawCommandSpecs
                    if not spec.get('abstract', False)]

    # abstract field no longer needed
    for c in commandSpecs:
        c.pop('abstract', None)

    # resolve inheritance of ParamSpecs found in params field of commandSpecs
    for c in commandSpecs:
        c.params = [resolveInheritanceLookup(p, paramSpecLookup)
                    for p in c.get('params', [])]

    schemaDict.pop('paramSpecs', None)
    schemaDict.commandSpecs = commandSpecs


def getFields(className):
    """
    Lookup up field definitions for the given class from
    xpjsonFields.py.
    """
    cls = getattr(xpjsonFields, className)
    fieldNames = dir(cls)
    return dict([(k, getattr(cls, k))
                 for k in dir(cls)
                 if not k.startswith('_')])


class ParseOpts(object):
    def __init__(self, fillInDefaults=False):
        self.fillInDefaults = fillInDefaults


######################################################################
# XPJSON CLASSES
######################################################################

class TypedObject(object):
    """
    Implements the TypedObject type from the XPJSON spec.
    """
    fields = getFields('TypedObject')

    def __init__(self, objDict,
                 schema=None,
                 schemaParams={},
                 parseOpts=ParseOpts()):
        self.objDict = objDict
        self.schema = schema
        self.schemaParams = schemaParams
        self.parseOpts = parseOpts
        self.checkFields()

    def get(self, fieldName, defaultVal='__unspecified__'):
        result = self.objDict.get(fieldName)
        if result is not None:
            return result
        if defaultVal != '__unspecified__':
            return defaultVal
        if fieldName in self.fields:
            schemaDefault = self.fields[fieldName][1]
            if schemaDefault != 'required':
                return schemaDefault
        return None

    def checkFields(self):
        for fieldName, (valueType, defaultVal, validFuncName) in self.fields.iteritems():
            val = self.get(fieldName)
            if val is None:
                assert defaultVal is not 'required', \
                       'required field %s missing from %s' % (fieldName, self.objDict)
                val = defaultVal
            if val is not None:
                assert isValueOfType(val, valueType), \
                       '%s should have valueType %s in %s' % (fieldName, valueType, self.objDict)
            if val is not None and validFuncName is not None:
                validFunc = getattr(self, validFuncName)
                assert validFunc(val), \
                       '%s should satisfy %s in %s' % (fieldName, validFunc, self.objDict)

            if self.parseOpts.fillInDefaults:
                self.objDict[fieldName] = val

        for fieldName, paramSpec in self.schemaParams.iteritems():
            reason = paramSpec.invalidParamValueReason(self.get(fieldName))
            assert reason is None, \
                   ('%s; %s should match ParamSpec %s in %s'
                    % (reason, fieldName, paramSpec.id, self.objDict))

        for k, v in self.objDict.iteritems():
            if k not in self.fields and k not in self.schemaParams:
                logging.warning('unknown field %s in object %s'
                                % (k, self.objDict))


class ParamSpec(TypedObject):
    """
    Implements the ParamSpec type from the XPJSON spec.
    """
    fields = getFields('ParamSpec')

    def __init__(self, objDict, **kwargs):
        super(ParamSpec, self).__init__(objDict, **kwargs)

        for fieldName in self.fields.keys():
            setattr(self, fieldName, self.get(fieldName))
        if self.choices is None:
            self.enum = None
        else:
            self.enum = [c[0] for c in self.choices]

    def isValidValueType(self, val):
        return val in VALUE_TYPE_CHOICES

    def matchesValueType(self, val):
        return isValueOfType(val, self.get('valueType'))

    def isChoicesValid(self, enum):
        for val, desc in enum:
            if (not isValueOfType(val, self.get('valueType'))
                or not isinstance(desc, (str, unicode))):
                return False
        return True

    def invalidParamValueReason(self, val):
        # None is valid unless value is required, short-circuits other tests
        if not self.required and val is None:
            return None

        if not isValueOfType(val, self.valueType):
            return 'value %s should have type %s' % (val, repr(self.valueType))
        elif self.minimum is not None and val < self.minimum:
            return 'value %s should be exceed minimum %s' % (val, repr(self.minimum))
        elif self.maximum is not None and val > self.maximum:
            return 'value %s should not exceed maximum %s' % (val, repr(self.maximum))
        elif self.enum is not None and val not in self.enum:
            return 'value %s should be one of %s' % (val, repr(self.enum))
        return None

    def isValidParamValue(self, val):
        reason = self.invalidParamValueReason(val)
        if reason:
            logging.warning(reason)
        return reason is not None


class ClassSpec(TypedObject):
    """
    Implements the ClassSpec type from the XPJSON spec.
    """

    fields = getFields('ClassSpec')

    def __init__(self, objDict, **kwargs):
        super(ClassSpec, self).__init__(objDict, **kwargs)
        self.paramLookup = getIdDict([ParamSpec(p, **kwargs)
                                      for p in self.get('params')])


class CommandSpec(ClassSpec):
    """
    Implements the CommandSpec type from the XPJSON spec.
    """

    fields = getFields('CommandSpec')

    def isColorString(self, s):
        # should be in HTML hex format '#rrggbb'
        return re.match('\#[0-9a-fA-F]{6}', s) is not None

    def isValidCommand(self, cmd):
        for fieldName, paramSpec in self.paramLookup.iteritems():
            if not paramSpec.isValidParamValue(cmd.get(fieldName)):
                return False


class Document(TypedObject):
    """
    Implements the Document type from the XPJSON spec.
    """

    fields = getFields('Document')

    def isValidXpjsonVersion(self, val):
        return val == '0.1'


class PlanSchema(Document):
    """
    Implements the PlanSchema type from the XPJSON spec.
    """

    fields = getFields('PlanSchema')

    def __init__(self, objDict, **kwargs):
        resolveSchemaInheritance(objDict)

        super(Document, self).__init__(objDict, **kwargs)

        #schemaSpec = file(JSON_SCHEMA_PATH_PLAN_SCHEMA, 'r')
        #jsonschema.validate(objDict,
        #                    json.load(schemaSpec))

        paramsFields = (
            'planParams',
            'stationParams',
            'segmentParams',
            'targetParams',
        )

        # for example, set self.planParamsLookup = dict of id ->
        # ParamSpec, based on planParams field in input json.
        for fieldName in paramsFields:
            setattr(self, fieldName + 'Lookup',
                    getIdDict([ParamSpec(p, **kwargs)
                               for p in self.get(fieldName)]))

        self.commandSpecLookup = getIdDict([CommandSpec(s, **kwargs)
                                            for s in self.get('commandSpecs')])

    def isValidCommand(self, cmd):
        return self.commandSpecLookup[cmd.type].isValidCommand(cmd)


class PathElement(TypedObject):
    """
    Implements the PathElement type from the XPJSON spec.
    """

    fields = getFields('PathElement')


class Station(PathElement):
    """
    Implements the Station type from the XPJSON spec.
    """

    fields = getFields('Station')

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = kwargs['schema'].stationParamsLookup
        super(Station, self).__init__(objDict, **kwargs)

        self.sequence = [Command(elt, **kwargs)
                         for elt in self.get('sequence')]


class Segment(PathElement):
    """
    Implements the Segment type from the XPJSON spec.
    """

    fields = getFields('Segment')

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = kwargs['schema'].segmentParamsLookup
        super(Segment, self).__init__(objDict, **kwargs)

        self.sequence = [Command(elt, **kwargs)
                         for elt in self.get('sequence')]


class Command(TypedObject):
    """
    Implements the Command type from the XPJSON spec (as well as
    inherited types defined by CommandSpecs in the PlanSchema)
    """

    fields = getFields('Command')

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = (kwargs['schema']
                                  .commandSpecLookup[objDict.type]
                                  .paramLookup)
        super(Command, self).__init__(objDict, **kwargs)


class Site(TypedObject):
    """
    Implements the Site type from the XPJSON spec.
    """

    fields = getFields('Site')


class Platform(TypedObject):
    """
    Implements the Site type from the XPJSON spec.
    """

    fields = getFields('Platform')


class Target(TypedObject):
    """
    Implements the Target type from the XPJSON spec.
    """

    fields = getFields('Target')

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = kwargs['schema'].targetParamsLookup
        super(Target, self).__init__(self, **kwargs)


class Plan(Document):
    """
    Implements the Plan type from the XPJSON spec.
    """

    fields = getFields('Plan')

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = kwargs['schema'].planParamsLookup
        super(Plan, self).__init__(objDict, **kwargs)

        self.site = self.get('site')
        if self.site is not None:
            self.site = Site(self.site, **kwargs)

        self.platform = self.get('platform')
        if self.platform is not None:
            self.platform = Platform(self.platform, **kwargs)

        self.targets = getIdDict([Target(t, **kwargs)
                                  for t in self.get('targets')])

        self.sequence = [self.getSequenceElement(elt, **kwargs)
                         for elt in self.get('sequence')]

    def getSequenceElement(self, elt, **kwargs):
        if elt.type == 'Segment':
            return Segment(elt, **kwargs)
        elif elt.type == 'Station':
            return Station(elt, **kwargs)
        elif elt.type in self.schema.commandSpecLookup:
            return Command(elt, **kwargs)
        else:
            raise ValueError('unknown sequence element type %s in Plan' % elt.type)


class PlanLibrary(Document):
    """
    Implements the PlanLibrary type from the XPJSON spec.
    """

    fields = getFields('PlanLibrary')

    def __init__(self, objDict, **kwargs):
        super(PlanLibrary, self).__init__(objDict, **kwargs)

        self.sites = [Site(s, **kwargs) for s in self.get('sites', [])]
        self.platforms = [Platform(s, **kwargs) for s in self.get('platforms', [])]
        self.stations = [Station(s, **kwargs) for s in self.get('stations', [])]
        self.segments = [Segment(s, **kwargs) for s in self.get('segments', [])]
        self.targets = [Target(s, **kwargs) for s in self.get('targets', [])]
        self.commands = [Command(s, **kwargs) for s in self.get('commands', [])]
