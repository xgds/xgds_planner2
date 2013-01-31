# __BEGIN_LICENSE__
# Copyright (C) 2008-2010 United States Government as represented by
# the Administrator of the National Aeronautics and Space Administration.
# All Rights Reserved.
# __END_LICENSE__

"""
Here we list the fields defined by XPJSON for every class.

This module looks like Python code but really it's more of a data
structure. We use Python classes because that way we get inheritance for
free.

Each field is defined by a tuple (valueType, defaultVal, validFuncName).
Details:

  valueType - Please refer to xpjson.py isValueOfType(). For the more
              complicated cases, specify 'custom' to skip the basic type
              validation (and use validFuncName if you want custom validation).

  defaultVal - Specify a default value or 'required' to flag an error if
               the value isn't specified. Note in some cases the default
               is too complicated, so we specify None and use code to fill
               it in later.

  validFuncName - Refers to custom validation functions defined
                  as class member functions in xpjson.py.

Note: these field lists are only compared with PlanSchema documents
after inheritance is compiled out, so the 'paramSpecs', 'parent', and
'abstract' fields are purposely not included.
"""


from geocamUtil.dotDict import DotDict


# default coordinate system
CRS84 = DotDict({
    "type": "name",
    "properties": {
        "name": "urn:ogc:def:crs:OGC:1.3:CRS84"
    }
})


class TypedObject:
    type = ('string', 'required', None)
    name = ('string', None, None)
    description = ('string', None, None)
    id = ('string', None, None)


class ParamSpec(TypedObject):
    valueType = ('string', 'required', 'isValidValueType')
    minimum = ('custom', None, 'matchesValueType')
    maximum = ('custom', None, 'matchesValueType')
    choices = ('custom', None, 'isChoicesValid')
    default = ('custom', None, 'matchesValueType')
    required = ('boolean', True, None)
    visible = ('boolean', True, None)
    editable = ('boolean', True, None)


class ClassSpec(TypedObject):
    params = ('array.ParamSpec', [], None)


class CommandSpec(ClassSpec):
    blocking = ('boolean', True, None)
    scopeTerminate = ('boolean', True, None)
    color = ('string', 'isColorString', None)


class Document(TypedObject):
    xpjson = ('string', 'required', 'isValidXpjsonVersion')
    subject = ('array.string', None, None)
    creator = ('string', None, None)
    contributors = ('array.string', [], None)
    dateCreated = ('date-time', None, None)
    dateModified = ('date-time', None, None)


class PlanSchema(Document):
    commandSpecs = ('array.CommandSpec', [], None)
    planParams = ('array.ParamSpec', [], None)
    stationParams = ('array.ParamSpec', [], None)
    segmentParams = ('array.ParamSpec', [], None)
    targetParams = ('array.ParamSpec', [], None)
    planSequenceCommands = ('array.string', None, None)
    stationSequenceCommands = ('array.string', None, None)
    segmentSequenceCommands = ('array.string', None, None)
    planIdFormat = ('string', None, None)
    pathElementIdFormat = ('string', None, None)
    commandIdFormat = ('string', None, None)


class PathElement(TypedObject):
    sequence = ('array.custom', [], None)
    libraryId = ('string', None, None)


class Station(PathElement):
    geometry = ('Point', 'required', None)


class Segment(PathElement):
    geometry = ('LineString', None, None)


class Command(TypedObject):
    libraryId = ('string', None, None)


class Site(TypedObject):
    crs = ('custom', CRS84, None)
    bbox = ('custom', None, None)


class Platform(TypedObject):
    pass


class Target(TypedObject):
    geometry = ('Point', 'required', None)


class Plan(Document):
    schemaUrl = ('string', None, None)
    libraryUrls = ('array.string', None, None)
    planNumber = ('integer', None, None)
    planVersion = ('string', None, None)
    site = ('Site', None, None)
    platform = ('Platform', None, None)
    targets = ('array.Target', [], None)
    sequence = ('array.custom', [], None)
