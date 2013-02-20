# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

"""
Utilities for parsing and modeling XPJSON format plans, plan schemas, and plan libraries.
"""

import sys
import os
import json
from collections import deque, Mapping, OrderedDict
import pprint
import re
import logging

import iso8601

from django.core.validators import URLValidator
from django.core.exceptions import ValidationError

from geocamUtil import dotDict
from geocamUtil.dotDict import DotDict

THIS_MODULE = sys.modules[__name__]
THIS_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_SCHEMA_PATH_PLAN_SCHEMA = os.path.join(THIS_DIR, 'xpjsonSpec', 'xpjsonPlanSchemaDocumentSchema.json')

EXAMPLE_PLAN_SCHEMA_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlanSchema.json')
EXAMPLE_PLAN_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlan.json')
EXAMPLE_PLAN_LIBRARY_PATH = os.path.join(THIS_DIR, 'xpjsonSpec', 'examplePlanLibrary.json')

CRS84 = dotDict.DotDict({
    "type": "name",
    "properties": {
        "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
})

URL_VALIDATOR = URLValidator(verify_exists=False)

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

# TypedObject subclasses register themselves in this set
TYPED_OBJECT_CLASSES = set()


class UnknownParentError(Exception):
    pass


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
    elif valueType == 'targetId':
        return isinstance(val, (str, unicode))
    elif valueType.startswith('array.'):
        # for example, 'array.integer' -> array of integer
        if not isinstance(val, (list, tuple)):
            return False
        eltType = re.sub(r'^array\.', '', valueType)
        return all((isValueOfType(elt, eltType) for elt in val))
    elif valueType in ('url',):
        if not isinstance(val, (str, unicode)):
            return False
        try:
            URL_VALIDATOR(val)
            return True
        except ValidationError:
            return False
    elif valueType == 'bbox':
        # must be an array of 4 floats (2d) or 6 floats (3d)
        if not isValueOfType(val, 'array.number'):
            return False
        return len(val) in (4, 6)
    elif valueType == 'crs':
        # could do a better job with this...
        return val['type'] in ('name', 'proj4')
    else:
        if isinstance(val, (dict, dotDict.DotDict)):
            # for example, 'ParamSpec' -> DotDict with 'type' member equal
            # to 'ParamSpec'
            return val['type'] == valueType
        else:
            # for example, 'ParamSpec' -> instance of ParamSpec class
            return val.__class__.__name__ == valueType


def getIdDict(lst):
    return dict([(elt.get('id'), elt) for elt in lst])


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
    commandSpecsLookup = resolveSpecInheritance(rawCommandSpecs,
                                               inheritFields=('params'),
                                               localOnlyFields=('id', 'name', 'abstract'))

    # filter out abstract commandSpecs
    commandSpecs = [commandSpecsLookup[spec.id]
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


class Field(object):
    def __init__(self, valueType, default=None, required=False, validMethod=None):
        self.valueType = valueType
        self.default = default
        self.required = required
        self.validMethod = validMethod


class ParseOpts(object):
    def __init__(self, fillInDefaults=False):
        self.fillInDefaults = fillInDefaults


def makeProperty(fname):
    def getf(self):
        return self.get(fname)

    def setf(self, val):
        return self.set(fname, val)

    return property(getf, setf)


class TypedObjectMetaClass(type):
    """
    This metaclass makes TypedObject and its subclasses work a bit like
    Django models. You can declare fields in the class declaration like
    this:

      geometry = Field('Point', required=True)

    Fields declared this way in class Foo are added to the Foo.fields
    dict. There are two kinds of automatic setup that happen based on
    that:

     * When an instance of the class is constructed from an objDict,
       the objDict is validated against the declared fields. See
       TypedObject.checkFields().

     * A property is automatically generated for the field, so if Foo
       has a field 'bar' and foo is an instance of Foo, accessing
       foo.bar calls foo.get('bar') or foo.set('bar', ...). The get()
       and set() methods are defined in TypedObject.

    """

    def __new__(cls, name, bases, dct):
        global TYPED_OBJECT_CLASSES
        TYPED_OBJECT_CLASSES.add(name)

        dct['fields'] = fields = {}

        # inherit fields from base classes
        for base in bases:
            if hasattr(base, 'fields'):
                fields.update(base.fields)

        # extract Field objects declared in this class. keep track
        # of them in the 'fields' member and create a property for
        # each field that uses the get() and set() methods.
        for fname, val in dct.items():
            if isinstance(val, Field):
                fields[fname] = val
                dct[fname] = makeProperty(fname)

        return type.__new__(cls, name, bases, dct)


######################################################################
# XPJSON CLASSES
######################################################################

class TypedObject(object):
    """
    Implements the TypedObject type from the XPJSON spec.
    """
    __metaclass__ = TypedObjectMetaClass

    type = Field('string', required=True)
    name = Field('string')
    notes = Field('string')
    id = Field('string')

    def __init__(self, objDict,
                 schema=None,
                 schemaParams={},
                 parseOpts=None):
        self._objDict = objDict
        self._schema = schema
        self._schemaParams = schemaParams
        if parseOpts is None:
            parseOpts = ParseOpts()
        self._parseOpts = parseOpts
        self.checkFields()

    def get(self, fieldName, defaultVal='__unspecified__'):
        # first check in _objDict
        result = self._objDict.get(fieldName)
        if result is not None:
            return result

        # may be a default in get() args
        if defaultVal != '__unspecified__':
            return defaultVal

        # may be a default declared in XPJSON spec
        if fieldName in self.fields:
            spec = self.fields.get(fieldName, None)
            if spec and not spec.required:
                return spec.default

        # may be a default declared in PlanSchema
        schemaParam = self._schemaParams.get(fieldName)
        if (schemaParam is not None
            and schemaParam.default is not None):
            return schemaParam.default

        return None

    def set(self, fieldName, val):
        self._objDict[fieldName] = val

    def checkFields(self):
        # validate fields declared in XPJSON spec
        for fieldName, spec in self.fields.iteritems():
            val = self.get(fieldName)
            if val is None:
                assert not spec.required, \
                       'required field %s missing from %s' % (fieldName, self._objDict)
                val = spec.default
            if val is not None:
                assert isValueOfType(val, spec.valueType), \
                       '%s should have valueType %s in %s' % (fieldName, spec.valueType, self._objDict)
            if val is not None and spec.validMethod is not None:
                validMethod = getattr(self, spec.validMethod)
                assert validMethod(val), \
                       '%s should satisfy %s in %s' % (fieldName, validMethod, self._objDict)

            if self._parseOpts.fillInDefaults:
                self._objDict[fieldName] = val

        # validate fields declared in PlanSchema
        for fieldName, paramSpec in self._schemaParams.iteritems():
            reason = paramSpec.invalidParamValueReason(self.get(fieldName))
            assert reason is None, \
                   ('%s; %s should match ParamSpec %s in %s'
                    % (reason, fieldName, paramSpec.id, self._objDict))

        # warn about unknown fields
        for k, v in self._objDict.iteritems():
            if k not in self.fields and k not in self._schemaParams:
                logging.warning('unknown field %s in object %s'
                                % (k, self._objDict))


class ParamSpec(TypedObject):
    """
    Implements the ParamSpec type from the XPJSON spec.
    """

    valueType = Field('string', required=True, validMethod='isValidValueType')
    minimum = Field('custom', validMethod='matchesValueType')
    maximum = Field('custom', validMethod='matchesValueType')
    choices = Field('custom', validMethod='isChoicesValid')
    default = Field('custom', validMethod='matchesValueType')
    required = Field('boolean', default=True)
    visible = Field('boolean', default=True)
    editable = Field('boolean', default=True)

    def __init__(self, objDict, **kwargs):
        super(ParamSpec, self).__init__(objDict, **kwargs)

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
            return 'value %s should exceed minimum %s' % (val, repr(self.minimum))
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

    params = Field('array.ParamSpec', default=[])

    def __init__(self, objDict, **kwargs):
        super(ClassSpec, self).__init__(objDict, **kwargs)
        self.paramsLookup = getIdDict(self.get('params'))


class CommandSpec(ClassSpec):
    """
    Implements the CommandSpec type from the XPJSON spec.
    """

    blocking = Field('boolean', default=True)
    scopeTerminate = Field('boolean', default=True)
    color = Field('string', validMethod='isColorString')

    def isColorString(self, s):
        # should be in HTML hex format '#rrggbb'
        return re.match('\#[0-9a-fA-F]{6}', s) is not None

    def isValidCommand(self, cmd):
        for fieldName, paramSpec in self.paramsLookup.iteritems():
            if not paramSpec.isValidParamValue(cmd.get(fieldName)):
                return False


class Document(TypedObject):
    """
    Implements the Document type from the XPJSON spec.
    """

    xpjson = Field('string', required=True, validMethod='isValidXpjsonVersion')
    subject = Field('array.string', default=[])
    creator = Field('string')
    contributors = Field('array.string', default=[])
    dateCreated = Field('date-time')
    dateModified = Field('date-time')

    def isValidXpjsonVersion(self, val):
        return val == '0.1'


class PlanSchema(Document):
    """
    Implements the PlanSchema type from the XPJSON spec.
    """

    commandSpecs = Field('array.CommandSpec', default=[])
    planParams = Field('array.ParamSpec', default=[])
    stationParams = Field('array.ParamSpec', default=[])
    segmentParams = Field('array.ParamSpec', default=[])
    targetParams = Field('array.ParamSpec', default=[])
    planSequenceCommands = Field('array.string')
    stationSequenceCommands = Field('array.string')
    segmentSequenceCommands = Field('array.string')
    planIdFormat = Field('string')
    pathElementIdFormat = Field('string')
    commandIdFormat = Field('string')

    def __init__(self, objDict, **kwargs):
        # resolveSchemaInheritance(objDict)

        super(Document, self).__init__(objDict, **kwargs)

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
                    getIdDict(self.get(fieldName)))

        self.commandSpecsLookup = getIdDict(self.get('commandSpecs'))

    def isValidCommand(self, cmd):
        return self.commandSpecsLookup[cmd.type].isValidCommand(cmd)


class PathElement(TypedObject):
    """
    Implements the PathElement type from the XPJSON spec.
    """

    sequence = Field('array.custom', default=[])
    libraryId = Field('string')

    def __init__(self, objDict, **kwargs):
        super(PathElement, self).__init__(objDict, **kwargs)
        self.sequence = [Command(elt, **kwargs)
                         for elt in self.sequence]


class Station(PathElement):
    """
    Implements the Station type from the XPJSON spec.
    """

    geometry = Field('Point', required=True)

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = kwargs['schema'].stationParamsLookup
        super(Station, self).__init__(objDict, **kwargs)


class Segment(PathElement):
    """
    Implements the Segment type from the XPJSON spec.
    """

    geometry = Field('LineString')

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = kwargs['schema'].segmentParamsLookup
        super(Segment, self).__init__(objDict, **kwargs)


class Command(TypedObject):
    """
    Implements the Command type from the XPJSON spec (as well as
    inherited types defined by CommandSpecs in the PlanSchema)
    """

    libraryId = Field('string')

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = (kwargs['schema']
                                  .commandSpecsLookup[objDict['type']]
                                  .paramsLookup)
        super(Command, self).__init__(objDict, **kwargs)


class Site(TypedObject):
    """
    Implements the Site type from the XPJSON spec.
    """

    crs = Field('crs', default=CRS84)
    alternateCrs = Field('crs')
    bbox = Field('bbox')


class Platform(TypedObject):
    """
    Implements the Site type from the XPJSON spec.
    """
    pass


class Target(TypedObject):
    """
    Implements the Target type from the XPJSON spec.
    """

    geometry = Field('Point', required=True)

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = kwargs['schema'].targetParamsLookup
        super(Target, self).__init__(self, **kwargs)


class Plan(Document):
    """
    Implements the Plan type from the XPJSON spec.
    """

    schemaUrl = Field('url')
    libraryUrls = Field('array.url')
    planNumber = Field('integer')
    planVersion = Field('string')
    site = Field('Site')
    platform = Field('Platform')
    targets = Field('array.Target', default=[])
    sequence = Field('array.custom', default=[], validMethod='isValidPlanSequence')

    def __init__(self, objDict, **kwargs):
        kwargs['schemaParams'] = kwargs['schema'].planParamsLookup
        super(Plan, self).__init__(objDict, **kwargs)

    def isValidPlanSequence(self, val):
        validTypes = self._schema.commandSpecsLookup.keys() + ['Station', 'Segment']
        for elt in val:
            return elt.type in validTypes


class PlanLibrary(Document):
    """
    Implements the PlanLibrary type from the XPJSON spec.
    """

    schemaUrl = Field('url')
    sites = Field('array.Site', default=[])
    platforms = Field('array.Platform', default=[])
    stations = Field('array.Station', default=[])
    segments = Field('array.Segment', default=[])
    targets = Field('array.Target', default=[])
    commands = Field('array.custom', default=[], validMethod='isValidCommandArray')

    def __init__(self, objDict, **kwargs):
        super(PlanLibrary, self).__init__(objDict, **kwargs)

    def isValidCommandArray(self, val):
        for elt in val:
            return elt['type'] in self._schema.commandSpecsLookup

######################################################################


def encodeWithClassName(obj):
    if hasattr(obj, '_objDict') and obj._objDict != None:
        return obj._objDict
    else:
        return obj


def decodeWithClassName(dct, **kwargs):
    if 'type' in dct:
        className = dct['type']
        if className in TYPED_OBJECT_CLASSES:
            klass = getattr(THIS_MODULE, className)
            return klass(dct, **kwargs)
    return dct


def transformBottomUp(obj, func, **kwargs):
    if isinstance(obj, (list, tuple)):
        return [transformBottomUp(v, func, **kwargs) for v in obj]
    elif isinstance(obj, (int, float, str, unicode, bool)) or obj is None:
        return obj
    else:
        return func(dict(((k, transformBottomUp(v, func, **kwargs))
                          for k, v in obj.iteritems())),
                    **kwargs)

def transformTopDown(obj, func):
    if isinstance(obj, (list, tuple)):
        return [transformTopDown(v, func) for v in obj]
    elif isinstance(obj, (int, float, str, unicode, bool)) or obj is None:
        return obj
    else:
        return dict(((k, transformTopDown(v, func))
                     for k, v in func(obj).iteritems()))


def loadDictFromString(s):
    """
    Load a DotDict from the JSON-format string *s*.
    """
    return dotDict.convertToDotDictRecurse(json.loads(s))


def loadDictFromFile(f):
    """
    Load a DotDict from the JSON-format file *f*.
    """
    return dotDict.convertToDotDictRecurse(json.load(f))


def loadDictFromPath(path):
    """
    Load a DotDict from the JSON-format file at path *path*.
    """
    return loadDictFromFile(file(path, 'r'))


class NoSchemaError(Exception):
    pass


def loadDocumentFromDict(docDict, schema=None, parseOpts=None):
    assert docDict.xpjson == '0.1'
    if docDict.type == 'PlanSchema':
        resolveSchemaInheritance(docDict)
    else:
        if not schema:
            raise NoSchemaError()
    return transformBottomUp(docDict, decodeWithClassName,
                             schema=schema,
                             parseOpts=parseOpts)


def loadDocument(docPath, schema=None, fillInDefaults=False):
    docDict = loadDictFromPath(docPath)
    parseOpts = ParseOpts(fillInDefaults=fillInDefaults)
    return loadDocumentFromDict(docDict, schema, parseOpts=parseOpts)


def dumpDictToPath(path, obj):
    """
    Dump a DotDict in to the specified path in (pretty indented) JSON format.
    """
    f = open(path, 'w')
    f.write(json.dumps(obj, sort_keys=True, indent=4))
    f.close()


def dumpDocumentToPath(path, doc):
    """
    Dump a Document in to the specified path in (pretty indented) JSON format.
    """
    # dumpDictToPath(path, doc._objDict)
    docDict = transformTopDown(doc, encodeWithClassName)
    dumpDictToPath(path, docDict)
