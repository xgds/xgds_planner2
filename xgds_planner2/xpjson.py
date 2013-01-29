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
from collections import deque
import pprint
import re

import jsonschema
import iso8601

from geocamUtil import dotDict

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_SCHEMA_PATH_PLAN_SCHEMA = os.path.join(THIS_DIR, 'xpjsonSpec', 'xpjsonPlanSchemaDocumentSchema.json')

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


def jsonVars(obj):
    if isinstance(obj, (dict, dotDict.DotDict)):
        return dict([(k, jsonVars(v)) for k, v in obj.iteritems()])
    elif isinstance(obj, list):
        return [jsonVars(elt) for elt in obj]
    elif isinstance(obj, (int, float, str, unicode, bool)) or obj is None:
        return obj
    else:
        return jsonVars(vars(obj))


def prettyDumps(obj):
    return json.dumps(jsonVars(obj), indent=4, sort_keys=True)


def isValueOfType(val, valueType):
    """
    Check whether the type of *val* conforms to *valueType* as defined
    in the XPJSON spec. Just rough validation.
    """

    if valueType == 'string':
        return isinstance(val, (str, unicode))
    elif valueType == 'integer':
        return isinstance(val, int)
    elif valueType == 'number':
        return isinstance(val, (int, float))
    elif valueType == 'boolean':
        return isinstance(val, bool)
    elif valueType == 'date-time':
        # must be explicitly in UTC time zone
        if not valueType.endswith('Z'):
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


def isGeometryType(s):
    return s in GEOMETRY_TYPE_CHOICES


def isColorString(s):
    return re.match('\#[0-9a-fA-F]{6}', s)


def getMember(objDict, fieldName, valueType, defaultVal):
    val = objDict.get(fieldName)
    if val is None:
        assert defaultVal is not 'required', \
               'required field %s missing from %s' % (fieldName, objDict)
        val = defaultVal
    if val is not None and valueType != 'custom':
        assert isValueOfType(val, valueType), \
               '%s should have valueType %s in %s' % (fieldName, valueType, objDict)
    return val


def getIdDict(lst):
    return dict([(elt.id, elt) for elt in lst])


def joinById(childList, parentList):
    if parentList is None:
        parentList = []

    # everything should have an id
    assert all(['id' in x for x in childList])
    assert all(['id' in x for x in parentList])

    result = list(parentList)  # copy
    parentIndexLookup = dict([(x.id, i) for i, x in enumerate(parentList)])
    for c in childList:
        parentIndex = parentIndexLookup.get(c.id, None)
        if parentIndex:
            # if child item and parent item have the same id, child overwrites
            # parent
            result[parentIndex] = c
        else:
            # otherwise, add new id
            result.append(c)

    return result


def inherit(child, parent, recurseFields=[]):
    """
    Return the DotDict formed by taking fields from *parent*
    and overriding them with fields from *child*.

    If a field is in *recurseFields* (must be a list of objects), the
    result for that field will be the union of the values from parent
    and child, joined by the 'id' field of each object in the list.
    """
    if parent == None:
        result = child.copy()
    else:
        result = parent.copy()

        # these fields are explicitly not inherited (see ClassSpec section in spec)
        for f in ('id', 'name', 'abstract'):
            result.pop(f, None)

        for key, childVal in child.iteritems():
            if key in recurseFields:
                result[key] = joinById(childVal, parent.get(key))
            else:
                result[key] = childVal

    # to avoid confusion, remove parent field after inheritance is resolved
    result.pop('parent', None)

    return result


def resolveInheritance(specs, recurseFields=[]):
    """
    Given a list of objects with ids that can inherit from a parent by
    specifying its id (such as the value of the paramSpecs or the
    commandSpecs field in the PlanSchema), return a look-up table that
    maps ids to objects with all the inheritance relationships resolved.
    """
    for spec in specs:
        assert 'id' in spec

    specLookup = dict.fromkeys([s.id for s in specs])

    result = {}
    i = 0
    MAX_ITERATIONS = 10000
    q = deque(specs)

    while q:
        i += 1
        if i > MAX_ITERATIONS:
            print 'processed so far:', pprint.pformat(result.keys())
            print 'child, parent:', pprint.pformat([(elt.id, elt.get('parent', None)) for elt in q])
            raise RuntimeError('resolveInheritance: not done after %s iterations, may have an inheritance loop'
                               % MAX_ITERATIONS)

        inSpec = q.popleft()
        parentId = inSpec.get('parent')
        if parentId:
            # make child inherit from parent
            if parentId not in result:
                specLookup[parentId]  # ensure parent exists
                # postpone child until after parent is processed
                q.append(inSpec)
                continue
            parent = result[parentId]
            result[inSpec.id] = inherit(inSpec, parent,
                                        recurseFields)
        else:
            # no parent
            result[inSpec.id] = inherit(inSpec, None,
                                        recurseFields)

    return result


def paramInherit(paramSpecObj, rawParamSpecsDict):
    return ParamSpec(inherit(paramSpecObj, rawParamSpecsDict.get(paramSpecObj.parent)))


def paramsInherit(paramSpecList, rawParamSpecsDict):
    return [paramInherit(p, rawParamSpecsDict) for p in paramSpecList]


class TypedObject(object):
    """
    Implements the TypedObject type from the XPJSON spec.
    """
    def __init__(self, objDict):
        # objDict should already have parent inheritance resolved
        # before this function is called.

        fields = (
            ('type', 'string', 'required'),
            ('name', 'string', None),
            ('description', 'string', None),
            ('id', 'string', None),
        )

        for fieldName, valueType, defaultVal in fields:
            val = getMember(objDict, fieldName, valueType, defaultVal)
            setattr(self, fieldName, val)


class ParamSpec(TypedObject):
    """
    Implements the ParamSpec type from the XPJSON spec.
    """
    def __init__(self, objDict):
        super(ParamSpec, self).__init__(objDict)

        assert objDict.valueType in VALUE_TYPE_CHOICES, \
               ('unknown valueType %s in %s'
                % (objDict.valueType, objDict))
        self.valueType = objDict.valueType

        fields = (
            ('minimum', self.valueType, None),
            ('maximum', self.valueType, None),
            ('choices', 'custom', None),
            ('default', self.valueType, None),
            ('required', 'boolean', True),
            ('visible', 'boolean', True),
            ('editable', 'boolean', True),
        )

        for fieldName, valueType, defaultVal in fields:
            val = getMember(objDict, fieldName, valueType, defaultVal)
            setattr(self, fieldName, val)

        # custom fields and validation

        if self.choices is not None:
            for val, desc in self.choices:
                assert isValueOfType(val, self.valueType)
                assert isinstance(desc, (str, unicode))


class CommandSpec(TypedObject):
    """
    Implements the CommandSpec type from the XPJSON spec.
    """
    def __init__(self, objDict, rawParamSpecsDict):
        super(CommandSpec, self).__init__(objDict)

        fields = (
            ('abstract', 'boolean', False),
            ('blocking', 'boolean', True),
            ('scopeTerminate', 'boolean', True),
            ('allowedInPlan', 'boolean', True),
            ('allowedInStation', 'boolean', True),
            ('allowedInSegment', 'boolean', True),
            ('color', 'string', None),
        )

        for fieldName, valueType, defaultVal in fields:
            val = getMember(objDict, fieldName, valueType, defaultVal)
            setattr(self, fieldName, val)

        # custom fields and validation

        if self.color is not None:
            assert isColorString(self.color)

        rawParams = objDict.get('params', [])
        self.params = paramsInherit(rawParams, rawParamSpecsDict)


class PlanSchema(TypedObject):
    """
    Implements the PlanSchema type from the XPJSON spec.
    """
    def __init__(self, objDict, validate=True):
        if validate:
            schemaSpec = file(JSON_SCHEMA_PATH_PLAN_SCHEMA, 'r')
            jsonschema.validate(objDict,
                                json.load(schemaSpec))

        assert objDict.xpjson == '0.1'

        fields = (
            ('stationGeometryType', 'string', 'Point'),
            ('segmentGeometryType', 'string', 'LineString'),
            ('planIdFormat', 'string', None),
            ('pathElementIdFormat', 'string', 'LineString'),
            ('commandIdFormat', 'string', 'LineString'),
        )

        for fieldName, valueType, defaultVal in fields:
            val = getMember(objDict, fieldName, valueType, defaultVal)
            setattr(self, fieldName, val)

        # custom fields and validation

        # schema.paramSpecs field
        rawParamSpecs = objDict.get('paramSpecs', [])
        self.rawParamSpecsDict = resolveInheritance(rawParamSpecs)

        # schema.commandSpecs field

        # in case a CommandSpec explicitly inherits from 'Command',
        # basically the same as no parent
        rootCommandSpec = dotDict.DotDict({
            'type': 'CommandSpec',
            'id': 'Command',
            'abstract': True,
        })
        rawCommandSpecs = [rootCommandSpec] + objDict.get('commandSpecs', [])
        rawCommandSpecsDict = resolveInheritance(rawCommandSpecs,
                                                 recurseFields=('params'))
        self.commandSpecsDict = dict([(i, CommandSpec(s, self.rawParamSpecsDict))
                                      for i, s in rawCommandSpecsDict.iteritems()])

        # schema.xxxParams fields
        paramsFields = (
            'planParams',
            'targetParams',
            'stationParams',
            'segmentParams',
        )

        for fieldName in paramsFields:
            paramsTmp = objDict.get(fieldName, [])
            setattr(self, fieldName, paramsInherit(paramsTmp, self.rawParamSpecsDict))
            setattr(self, fieldName + 'Dict', getIdDict(getattr(self, fieldName)))

    @staticmethod
    def loads(s):
        """
        Load an XPJSON plan schema from the JSON-format string *s*.
        """
        return PlanSchema(dotDict.convertToDotDictRecurse(json.loads(s)))

    @staticmethod
    def load(path):
        """
        Load an XPJSON plan schema from the JSON-format file specified in *path*.
        """
        f = open(path, 'r')
        return PlanSchema.loads(f.read())
