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
from collections import deque, Mapping
import pprint
import re
import logging

import jsonschema
import iso8601

from geocamUtil import dotDict

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
    'date-time'
) + GEOMETRY_TYPE_CHOICES


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
    else:
        if isinstance(val, (dict, dotDict.DotDict)) and val.type == valueType:
            # for example, 'ParamSpec' -> object with 'type' member equal
            # to 'ParamSpec'
            return True
        else:
            raise KeyError('unknown valueType %s' % valueType)


def isGeometryType(s):
    return s in GEOMETRY_TYPE_CHOICES


def getIdDict(lst):
    return dict([(elt.get('id'), elt) for elt in lst])


def loads(s):
    """
    Load a Document from the JSON-format string *s*.
    """
    return dotDict.convertToDotDictRecurse(json.loads(s))

def load(f):
    """
    Load a Document from the JSON-format file *f*.
    """
    return dotDict.convertToDotDictRecurse(json.load(f))

def loadPath(path):
    """
    Load an XPJSON plan schema from the JSON-format file at path *path*.
    """
    return load(file(path, 'r'))


class InheritDict(Mapping):
    """
    A dict-like object that draws from localVals first
    then falls back to parent (if not None).

    Used to implement lazy inheritance of ClassSpec params.
    """
    def __init__(self, localVals, parent):
        self.localDict = dict(localVals)
        self.parent = parent

    def __getitem__(self, key):
        try:
            return self.localDict[key]
        except KeyError:
            return self.parent[key]

    def __iter__(self):
        for k in self.localDict.iterkeys():
            yield k
        for k in self.parent.iterkeys():
            if k not in self.localDict:
                yield k

    def __len__(self):
        # unfortunately O(1) not possible with lazy design
        return sum(1 for _ in iter(self))


class TypedObject(object):
    """
    Implements the TypedObject type from the XPJSON spec.
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = {
        'type': ('string', 'required', None),
        'name': ('string', None, None),
        'description': ('string', None, None),
        'id': ('string', None, None),
    }

    def __init__(self, objDict, schema=None, schemaParams={}):
        self.objDict = objDict
        self.schema = schema
        self.schemaParams = schemaParams
        self.checkFields()

    def get(self, fieldName, defaultVal='__unspecified__'):
        if defaultVal == '__unspecified__':
            if fieldName in self.fields:
                defaultVal = self.fields[fieldName][1]
            else:
                defaultVal = None
        return self.objDict.get(fieldName, defaultVal)

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

        for fieldName, paramSpec in self.schemaParams.iteritems():
            reason = paramSpec.invalidParamValueReason(self.get(fieldName))
            assert reason is None, \
                   ('%s; %s should match ParamSpec %s in %s'
                    % (reason, fieldName, paramSpec.id, self.objDict))

        for k, v in self.objDict.iteritems():
            if k not in self.fields and k not in self.schemaParams:
                print ('unknown field %s in object with id %s'
                       % (k, self.objDict.get('id')))


class ObjectWithInheritance(TypedObject):
    """
    A TypedObject that implements lazy inheritance based on the 'parent'
    member in its objDict.
    """

    nonInheritedFields = set(('id', 'name', 'abstract'))

    def __init__(self, objDict, parentLookup):
        self.parentLookup = parentLookup
        self.parent = parentLookup.get(objDict.get('parent'))
        super(ObjectWithInheritance, self).__init__(objDict)

    def get(self, fieldName, defaultVal=None):
        result = self.objDict.get(fieldName, '__not_set__')
        if result == '__not_set__':
            if self.parent is not None and fieldName not in self.nonInheritedFields:
                return self.parent.get(fieldName, defaultVal)
            else:
                return defaultVal
        else:
            return result


class ParamSpec(ObjectWithInheritance):
    """
    Implements the ParamSpec type from the XPJSON spec.
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = TypedObject.fields.copy()
    fields.update({
        'valueType': ('custom', 'required', 'isValidValueType'),
        'minimum': ('custom', None, 'matchesValueType'),
        'maximum': ('custom', None, 'matchesValueType'),
        'choices': ('custom', None, 'isEnumValid'),
        'default': ('custom', None, 'matchesValueType'),
        'required': ('boolean', True, None),
        'visible': ('boolean', True, None),
        'editable': ('boolean', True, None),
    })

    def __init__(self, objDict, parentLookup):
        super(ParamSpec, self).__init__(objDict, parentLookup)

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

    def isEnumValid(self, enum):
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


class ClassSpec(ObjectWithInheritance):
    """
    Implements the ClassSpec type from the XPJSON spec.
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = TypedObject.fields.copy()
    fields.update({
        'parent': ('string', None, None),
        'abstract': ('boolean', False, None),
        'params': ('array.ParamSpec', [], None),
    })

    def __init__(self, objDict, parentLookup, paramSpecLookup):
        self.paramSpecLookup = paramSpecLookup
        super(ClassSpec, self).__init__(objDict, parentLookup)
        self.paramLookup = getIdDict([ParamSpec(p, self.paramSpecLookup)
                                      for p in self.get('params')])
        if self.parent is not None:
            self.paramLookup = InheritDict(self.paramLookup,
                                           self.parent.paramLookup)


class CommandSpec(ClassSpec):
    """
    Implements the CommandSpec type from the XPJSON spec.
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = ClassSpec.fields.copy()
    fields.update({
        'blocking': ('boolean', True, None),
        'scopeTerminate': ('boolean', True, None),
        'allowedInPlan': ('boolean', True, None),
        'allowedInStation': ('boolean', True, None),
        'allowedInSegment': ('boolean', True, None),
        'color': ('string', 'isColorString', None),
    })

    def __init__(self, objDict, parentLookup, paramSpecLookup):
        super(CommandSpec, self).__init__(objDict, parentLookup, paramSpecLookup)

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

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = TypedObject.fields.copy()
    fields.update({
        'xpjson': ('string', 'required', 'isValidXpjsonVersion'),
        'subject': ('array.string', None, None),
        'creator': ('string', None, None),
        'contributors': ('array.string', None, None),
        'dateCreated': ('date-time', None, None),
        'dateModified': ('date-time', None, None),
    })

    def __init__(self, objDict, schema=None):
        super(Document, self).__init__(objDict, schema=schema)

    def isValidXpjsonVersion(self, val):
        return val == '0.1'


class PlanSchema(Document):
    """
    Implements the PlanSchema type from the XPJSON spec.
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = Document.fields.copy()
    fields.update({
        'paramSpecs': ('array.ParamSpec', [], None),
        'commandSpecs': ('array.CommandSpec', [], None),
        'planParams': ('array.ParamSpec', [], None),
        'targetParams': ('array.ParamSpec', [], None),
        'stationParams': ('array.ParamSpec', [], None),
        'segmentParams': ('array.ParamSpec', [], None),
        'stationGeometryType': ('string', 'Point', None),
        'segmentGeometryType': ('string', 'LineString', None),
        'planIdFormat': ('string', None, None),
        'pathElementIdFormat': ('string', None, None),
        'commandIdFormat': ('string', None, None),
    })

    def __init__(self, objDict, validate=True):
        super(Document, self).__init__(objDict)

        if validate:
            schemaSpec = file(JSON_SCHEMA_PATH_PLAN_SCHEMA, 'r')
            jsonschema.validate(objDict,
                                json.load(schemaSpec))

        self.paramSpecLookup = {}
        for p in self.get('paramSpecs'):
            self.paramSpecLookup[p.id] = ParamSpec(p, self.paramSpecLookup)

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
                    getIdDict([ParamSpec(p, self.paramSpecLookup)
                               for p in self.get(fieldName)]))

        self.commandSpecLookup = {}
        for s in self.get('commandSpecs'):
            self.commandSpecLookup[s.id] = (CommandSpec
                                              (s,
                                               self.commandSpecLookup,
                                               self.paramSpecLookup))

    def isValidCommand(self, cmd):
        return self.commandSpecLookup[cmd.type].isValidCommand(cmd)

    def isValidPlan(self, plan):
        pass


class PathElement(TypedObject):
    """
    Implements the PathElement type from the XPJSON spec.
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = TypedObject.fields.copy()
    fields.update({
        'geometry': ('custom', None, None),
        'sequence': ('array.custom', [], None),
        'libraryId': ('string', None, None),
    })


class Station(PathElement):
    """
    Implements the Station type from the XPJSON spec.
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = PathElement.fields.copy()
    fields.update({
        # 'geometry': ('Point', None, None),
    })

    def __init__(self, objDict, schema):
        super(Station, self).__init__(objDict,
                                      schema=schema,
                                      schemaParams=schema.stationParamsLookup)

        self.sequence = [Command(elt, self.schema)
                         for elt in self.get('sequence')]


class Segment(PathElement):
    """
    Implements the Segment type from the XPJSON spec.
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = PathElement.fields.copy()
    fields.update({
        # 'geometry': ('Point', None, None),
    })

    def __init__(self, objDict, schema):
        super(Segment, self).__init__(objDict,
                                      schema=schema,
                                      schemaParams=schema.segmentParamsLookup)

        self.sequence = [Command(elt, self.schema)
                         for elt in self.get('sequence')]


class Command(TypedObject):
    """
    Implements the Command type from the XPJSON spec (as well as
    inherited types defined by CommandSpecs in the PlanSchema)
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = TypedObject.fields.copy()
    fields.update({
        'libraryId': ('string', None, None),
    })

    def __init__(self, objDict, schema):
        schemaParams = (schema
                        .commandSpecLookup[objDict.type]
                        .paramLookup)
        super(Command, self).__init__(objDict,
                                      schema=schema,
                                      schemaParams=schemaParams)


class Site(TypedObject):
    """
    Implements the Site type from the XPJSON spec.
    """
    # fieldName: (valueType, defaultVal, validFuncName)
    fields = TypedObject.fields.copy()
    fields.update({
        'crs': ('custom', CRS84, None),
        'bbox': ('custom', None, None),
    })


class Platform(TypedObject):
    """
    Implements the Site type from the XPJSON spec.
    """
    # no extra fields beyond TypedObject
    pass


class Target(TypedObject):
    """
    Implements the Target type from the XPJSON spec.
    """
    # fieldName: (valueType, defaultVal, validFuncName)
    fields = TypedObject.fields.copy()
    fields.update({
        'geometry': ('custom', 'required', None),
    })


class Plan(Document):
    """
    Implements the Plan type from the XPJSON spec.
    """

    # fieldName: (valueType, defaultVal, validFuncName)
    fields = Document.fields.copy()
    fields.update({
        'schemaUrl': ('string', None, None),
        'libraryUrls': ('array.string', None, None),
        'planNumber': ('integer', None, None),
        'planVersion': ('string', None, None),
        'site': ('Site', None, None),
        'platform': ('Platform', None, None),
        'targets': ('array.Target', [], None),
        'sequence': ('array.custom', [], None),
    })

    def __init__(self, objDict, schema):
        super(Plan, self).__init__(objDict, schema=schema)

        self.site = self.get('site')
        if self.site is not None:
            self.site = Site(self.site, schema=self.schema)

        self.platform = self.get('platform')
        if self.platform is not None:
            self.platform = Platform(self.platform, schema=self.schema)

        self.targets = getIdDict([Target(t) for t in self.get('targets')])

        self.sequence = [self.getSequenceElement(elt) for elt in self.get('sequence')]

    def getSequenceElement(self, elt):
        if elt.type == 'Segment':
            return Segment(elt, self.schema)
        elif elt.type == 'Station':
            return Station(elt, self.schema)
        elif elt.type in self.schema.commandSpecLookup:
            return Command(elt, self.schema)
        else:
            raise ValueError('unknown element type %s' % elt.type)
